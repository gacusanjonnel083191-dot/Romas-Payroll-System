-- Local proposal only. Do not apply to production without owner approval.
-- A snapshot is inserted by the same DELETE statement that removes draft rows.
-- If archiving fails, the DELETE is rolled back.
create table if not exists public.payroll_draft_undo_snapshots (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid not null,
  payroll_start date not null,
  payroll_end date not null,
  payroll_record_id uuid not null,
  employee_id uuid not null,
  payroll_record jsonb not null,
  payroll_period jsonb,
  constraint payroll_draft_undo_snapshots_unique_row unique (batch_id, payroll_record_id)
);

create index if not exists payroll_draft_undo_snapshots_period_latest
  on public.payroll_draft_undo_snapshots (payroll_start, payroll_end, deleted_at desc, batch_id);

alter table public.payroll_draft_undo_snapshots enable row level security;
revoke all on public.payroll_draft_undo_snapshots from anon, authenticated;
grant select on public.payroll_draft_undo_snapshots to authenticated;

create policy payroll_draft_undo_snapshots_owner_payroll_read
  on public.payroll_draft_undo_snapshots for select to authenticated
  using ((select auth.uid()) is not null and public.business_control_has_role(array['owner','payroll']));

create or replace function private.guard_payroll_draft_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or
     not public.business_control_has_role(array['owner','payroll']) then
    raise exception 'Owner or payroll role required to undo a payroll draft';
  end if;
  if nullif(current_setting('app.payroll_undo_batch_id', true),'') is null then
    raise exception 'Use the audited undo_payroll_draft operation';
  end if;
  if coalesce(old.payroll_approved,false) or coalesce(old.payroll_locked,false)
     or coalesce(old.payroll_released,false) or old.approved_at is not null
     or lower(coalesce(old.payroll_status,'')) in ('approved','released') then
    raise exception 'Approved or released payroll cannot be undone: % to %, employee %',
      old.payroll_start, old.payroll_end, old.employee_code;
  end if;
  return old;
end;
$$;

revoke all on function private.guard_payroll_draft_delete() from public;
drop trigger if exists trg_guard_payroll_draft_delete on public.payroll_records;
create trigger trg_guard_payroll_draft_delete
  before delete on public.payroll_records
  for each row execute function private.guard_payroll_draft_delete();

create or replace function private.snapshot_deleted_payroll_draft()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_batch_id uuid := nullif(current_setting('app.payroll_undo_batch_id', true),'')::uuid;
  v_deleted_by uuid := (select auth.uid());
begin
  if v_deleted_by is null or
     not public.business_control_has_role(array['owner','payroll']) then
    raise exception 'Owner or payroll role required to snapshot a payroll draft';
  end if;
  if v_batch_id is null then
    raise exception 'Payroll undo batch id is missing';
  end if;
  insert into public.payroll_draft_undo_snapshots (
    batch_id, deleted_by, payroll_start, payroll_end,
    payroll_record_id, employee_id, payroll_record, payroll_period
  )
  select v_batch_id, v_deleted_by, deleted_row.payroll_start, deleted_row.payroll_end,
    deleted_row.id, deleted_row.employee_id, to_jsonb(deleted_row), to_jsonb(period)
  from old_rows deleted_row
  left join public.payroll_periods period
    on period.payroll_start = deleted_row.payroll_start::text and period.payroll_end = deleted_row.payroll_end::text;
  return null;
end;
$$;

revoke all on function private.snapshot_deleted_payroll_draft() from public;
drop trigger if exists trg_snapshot_deleted_payroll_draft on public.payroll_records;
create trigger trg_snapshot_deleted_payroll_draft
  after delete on public.payroll_records
  referencing old table as old_rows
  for each statement execute function private.snapshot_deleted_payroll_draft();

create or replace function public.undo_payroll_draft(
  p_start date, p_end date, p_expected_count integer
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_count integer;
  v_deleted integer;
  v_batch_id uuid := gen_random_uuid();
begin
  if (select auth.uid()) is null or
     not public.business_control_has_role(array['owner','payroll']) then
    raise exception 'Owner or payroll role required to undo a payroll draft';
  end if;
  if p_start is null or p_end is null or p_end < p_start or p_expected_count < 1 then
    raise exception 'Invalid payroll period or expected row count';
  end if;

  perform 1 from public.payroll_records
    where payroll_start = p_start and payroll_end = p_end for update;
  select count(*) into v_count from public.payroll_records
    where payroll_start = p_start and payroll_end = p_end;
  if v_count <> p_expected_count then
    raise exception 'Payroll row count changed: expected %, found %', p_expected_count, v_count;
  end if;
  if exists (
    select 1 from public.payroll_records
    where payroll_start = p_start and payroll_end = p_end
      and (coalesce(payroll_approved,false) or coalesce(payroll_locked,false)
        or coalesce(payroll_released,false) or approved_at is not null
        or lower(coalesce(payroll_status,'')) in ('approved','released'))
  ) then
    raise exception 'Approved or released payroll cannot be undone';
  end if;

  perform set_config('app.payroll_undo_batch_id', v_batch_id::text, true);
  delete from public.payroll_records
    where payroll_start = p_start and payroll_end = p_end;
  get diagnostics v_deleted = row_count;
  if v_deleted <> p_expected_count then
    raise exception 'Payroll delete count changed: expected %, deleted %', p_expected_count, v_deleted;
  end if;

  update public.payslip_disputes
    set status = 'voided',
        admin_reason = 'Payroll draft undone for recomputation'
    where payroll_start = p_start::text and payroll_end = p_end::text and status <> 'resolved';
  delete from public.payroll_periods
    where payroll_start = p_start::text and payroll_end = p_end::text;
  return v_batch_id;
end;
$$;

revoke all on function public.undo_payroll_draft(date,date,integer) from public;
grant execute on function public.undo_payroll_draft(date,date,integer) to authenticated;

-- An owner must acknowledge the exact saved recomputation after an undo.
-- Reviews are append-only. A later financial edit changes the fingerprint and
-- automatically invalidates the old acknowledgement.
create table if not exists public.payroll_comparison_reviews (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  payroll_start date not null,
  payroll_end date not null,
  financial_fingerprint text not null,
  reviewed_by uuid not null,
  reviewed_at timestamptz not null default now(),
  unique (batch_id, financial_fingerprint)
);

alter table public.payroll_comparison_reviews enable row level security;
revoke all on public.payroll_comparison_reviews from anon, authenticated;
grant select on public.payroll_comparison_reviews to authenticated;
create policy payroll_comparison_reviews_owner_payroll_read
  on public.payroll_comparison_reviews for select to authenticated
  using ((select auth.uid()) is not null and public.business_control_has_role(array['owner','payroll']));

create or replace function public.payroll_comparison_status(p_start date,p_end date)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_batch_id uuid;
  v_fingerprint text;
  v_reviewed boolean;
begin
  if (select auth.uid()) is null or
     not public.business_control_has_role(array['owner','payroll']) then
    raise exception 'Owner or payroll role required to inspect payroll comparison';
  end if;
  select snapshot.batch_id into v_batch_id
    from public.payroll_draft_undo_snapshots snapshot
    where snapshot.payroll_start=p_start and snapshot.payroll_end=p_end
    order by snapshot.deleted_at desc, snapshot.batch_id desc limit 1;
  if v_batch_id is null then
    return jsonb_build_object('has_snapshot',false,'reviewed',true);
  end if;
  select md5(coalesce(string_agg((to_jsonb(financial_row)
      - 'employee_acknowledgement' - 'payroll_status' - 'review_sent_at'
      - 'review_sent_by' - 'payroll_approved' - 'approved_at' - 'approved_by'
      - 'payroll_locked' - 'payroll_released' - 'released_at'
      - 'released_by' - 'updated_at')::text, '|'
      order by financial_row.employee_id, financial_row.id),'')) into v_fingerprint
    from public.payroll_records financial_row
    where financial_row.payroll_start=p_start and financial_row.payroll_end=p_end;
  select exists(select 1 from public.payroll_comparison_reviews review
    where review.batch_id=v_batch_id and review.financial_fingerprint=v_fingerprint)
    into v_reviewed;
  return jsonb_build_object('has_snapshot',true,'reviewed',v_reviewed,'batch_id',v_batch_id);
end;
$$;
revoke all on function public.payroll_comparison_status(date,date) from public;
grant execute on function public.payroll_comparison_status(date,date) to authenticated;

create or replace function public.acknowledge_payroll_comparison(
  p_start date,p_end date,p_batch_id uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_latest_batch uuid;
  v_fingerprint text;
  v_count integer;
begin
  if (select auth.uid()) is null or
     not public.business_control_has_role(array['owner']) then
    raise exception 'Owner role required to acknowledge recomputed payroll';
  end if;
  select snapshot.batch_id into v_latest_batch
    from public.payroll_draft_undo_snapshots snapshot
    where snapshot.payroll_start=p_start and snapshot.payroll_end=p_end
    order by snapshot.deleted_at desc, snapshot.batch_id desc limit 1;
  if v_latest_batch is null or v_latest_batch <> p_batch_id then
    raise exception 'Payroll comparison changed; reload the latest snapshot';
  end if;
  select count(*),md5(coalesce(string_agg((to_jsonb(financial_row)
      - 'employee_acknowledgement' - 'payroll_status' - 'review_sent_at'
      - 'review_sent_by' - 'payroll_approved' - 'approved_at' - 'approved_by'
      - 'payroll_locked' - 'payroll_released' - 'released_at'
      - 'released_by' - 'updated_at')::text, '|'
      order by financial_row.employee_id, financial_row.id),''))
    into v_count,v_fingerprint
    from public.payroll_records financial_row
    where financial_row.payroll_start=p_start and financial_row.payroll_end=p_end;
  if v_count=0 then raise exception 'No saved recomputation exists to review'; end if;
  insert into public.payroll_comparison_reviews (
    batch_id,payroll_start,payroll_end,financial_fingerprint,reviewed_by
  ) values (v_latest_batch,p_start,p_end,v_fingerprint,(select auth.uid()))
  on conflict (batch_id,financial_fingerprint) do nothing;
  return true;
end;
$$;
revoke all on function public.acknowledge_payroll_comparison(date,date,uuid) from public;
grant execute on function public.acknowledge_payroll_comparison(date,date,uuid) to authenticated;

-- Enforce the review at the database boundary as well as in the UI. The
-- release RPC updates every payroll row; workflow-only updates are excluded
-- from the fingerprint so each row sees the same reviewed calculation.
create or replace function private.guard_recomputed_payroll_release()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_status jsonb;
begin
  if (coalesce(new.payroll_approved,false) or coalesce(new.payroll_released,false))
     and not (coalesce(old.payroll_approved,false) or coalesce(old.payroll_released,false)) then
    v_status := public.payroll_comparison_status(new.payroll_start,new.payroll_end);
    if coalesce((v_status->>'has_snapshot')::boolean,false)
       and not coalesce((v_status->>'reviewed')::boolean,false) then
      raise exception 'Recomputed payroll requires owner comparison acknowledgement before release';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_recomputed_payroll_release() from public;
drop trigger if exists trg_guard_recomputed_payroll_release on public.payroll_records;
create trigger trg_guard_recomputed_payroll_release
  before update on public.payroll_records
  for each row execute function private.guard_recomputed_payroll_release();
