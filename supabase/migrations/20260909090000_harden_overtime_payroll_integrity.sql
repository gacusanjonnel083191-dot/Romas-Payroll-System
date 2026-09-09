-- Overtime/payroll integrity hardening.
-- Scope: overtime + payroll lifecycle/security only.
-- IMPORTANT: This migration does not update, relink, normalize, or delete any
-- existing payroll_adjustments rows. Manual adjustments are preserved exactly.

-- ---------------------------------------------------------------------------
-- 1) Canonical payroll release lifecycle
-- ---------------------------------------------------------------------------
create or replace function public.enforce_payroll_release_state()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if lower(trim(coalesce(new.payroll_status, ''))) = 'released'
     or coalesce(new.payroll_released, false) = true then
    new.payroll_status := 'released';
    new.payroll_approved := true;
    new.payroll_released := true;
    new.payroll_locked := true;
    new.approved_at := coalesce(new.approved_at, new.released_at, new.created_at, now());
    new.released_at := coalesce(new.released_at, new.approved_at, new.created_at, now());
    new.released_by := coalesce(new.released_by, new.approved_by);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_payroll_release_state on public.payroll_records;
create trigger trg_enforce_payroll_release_state
before insert or update of payroll_status, payroll_approved, payroll_released, payroll_locked, approved_at, released_at
on public.payroll_records
for each row execute function public.enforce_payroll_release_state();

create or replace function public.sync_payroll_period_release_state()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.payroll_periods pp
     set payroll_status = 'released'
   where pp.payroll_start = new.payroll_start::text
     and pp.payroll_end = new.payroll_end::text
     and exists (
       select 1
       from public.payroll_records pr
       where pr.payroll_start = new.payroll_start
         and pr.payroll_end = new.payroll_end
     )
     and not exists (
       select 1
       from public.payroll_records pr
       where pr.payroll_start = new.payroll_start
         and pr.payroll_end = new.payroll_end
         and not (
           lower(trim(coalesce(pr.payroll_status, ''))) = 'released'
           and coalesce(pr.payroll_approved, false) = true
           and coalesce(pr.payroll_released, false) = true
           and coalesce(pr.payroll_locked, false) = true
           and pr.released_at is not null
         )
     );
  return new;
end;
$$;

drop trigger if exists trg_sync_payroll_period_release_state on public.payroll_records;
create trigger trg_sync_payroll_period_release_state
after insert or update of payroll_status, payroll_approved, payroll_released, payroll_locked, released_at
on public.payroll_records
for each row execute function public.sync_payroll_period_release_state();

-- Backfill release metadata only. No monetary fields are changed.
update public.payroll_records
   set payroll_released = true,
       payroll_locked = true,
       released_at = coalesce(released_at, approved_at, created_at),
       released_by = coalesce(released_by, approved_by)
 where lower(trim(coalesce(payroll_status, ''))) = 'released'
   and coalesce(payroll_approved, false) = true
   and (
     coalesce(payroll_released, false) = false
     or coalesce(payroll_locked, false) = false
     or released_at is null
   );

-- Reconcile only exact payroll-period metadata rows for fully released payrolls.
update public.payroll_periods pp
   set payroll_status = 'released'
 where exists (
   select 1
   from public.payroll_records pr
   where pr.payroll_start::text = pp.payroll_start
     and pr.payroll_end::text = pp.payroll_end
 )
 and not exists (
   select 1
   from public.payroll_records pr
   where pr.payroll_start::text = pp.payroll_start
     and pr.payroll_end::text = pp.payroll_end
     and not (
       lower(trim(coalesce(pr.payroll_status, ''))) = 'released'
       and coalesce(pr.payroll_approved, false) = true
       and coalesce(pr.payroll_released, false) = true
       and coalesce(pr.payroll_locked, false) = true
       and pr.released_at is not null
     )
 );

-- ---------------------------------------------------------------------------
-- 2) Exact prospective OT-correction precision
-- Existing adjustments are deliberately not rewritten.
-- ---------------------------------------------------------------------------
create or replace function public.payroll_exact_hourly_rate(p_employee_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  e public.employees%rowtype;
  v_basis text;
  v_fixed_monthly numeric;
  v_annual_days numeric;
  v_daily numeric;
  v_hourly numeric;
begin
  select * into e from public.employees where id = p_employee_id;
  if not found then return null; end if;

  v_basis := lower(trim(coalesce(e.payroll_basis, 'daily')));
  v_annual_days := case when coalesce(e.annual_working_days, 0) > 0 then e.annual_working_days else 313 end;

  if v_basis = 'daily' then
    v_daily := case
      when coalesce(e.daily_rate, 0) > 0 then e.daily_rate
      when coalesce(e.hourly_rate, 0) > 0 then e.hourly_rate * 8
      else 0
    end;
  else
    v_fixed_monthly := case
      when v_basis = 'semi_monthly' and coalesce(e.semi_monthly_salary, 0) > 0 then e.semi_monthly_salary * 2
      else coalesce(e.monthly_salary, 0)
    end;
    v_daily := case
      when v_fixed_monthly > 0 then (v_fixed_monthly * 12) / v_annual_days
      when coalesce(e.daily_rate, 0) > 0 then e.daily_rate
      when coalesce(e.hourly_rate, 0) > 0 then e.hourly_rate * 8
      else 0
    end;
  end if;

  v_hourly := case when v_daily > 0 then v_daily / 8 else coalesce(e.hourly_rate, 0) end;
  return nullif(v_hourly, 0);
end;
$$;

revoke all on function public.payroll_exact_hourly_rate(uuid) from public, anon, authenticated;

create or replace function public.normalize_system_ot_adjustment_precision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hourly numeric;
  v_exact_amount numeric;
begin
  -- INSERT only + source-linked system OT corrections only.
  -- Manual adjustments (including rows with null source_type/source_id) are untouched.
  if lower(trim(coalesce(new.adjustment_type, ''))) = 'addition'
     and new.source_type in ('time_adjustment_request', 'time_adjustment_carry_forward')
     and coalesce(new.source_minutes, 0) > 0
     and coalesce(new.source_multiplier, 0) > 0
     and new.employee_id is not null then
    v_hourly := public.payroll_exact_hourly_rate(new.employee_id);
    if v_hourly is not null then
      v_exact_amount := round((new.source_minutes::numeric / 60) * v_hourly * new.source_multiplier, 2);
      new.source_rate := v_hourly;
      new.amount := v_exact_amount;
      new.notes := concat_ws(' | ', nullif(new.notes, ''),
        'SYSTEM OT PRECISION: exact hourly rate ' || trim(to_char(v_hourly, 'FM999999990.000000')) ||
        '; final source-linked OT amount ' || trim(to_char(v_exact_amount, 'FM999999990.00'))
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.normalize_system_ot_adjustment_precision() from public, anon, authenticated;

drop trigger if exists trg_normalize_system_ot_adjustment_precision on public.payroll_adjustments;
create trigger trg_normalize_system_ot_adjustment_precision
before insert on public.payroll_adjustments
for each row execute function public.normalize_system_ot_adjustment_precision();

-- ---------------------------------------------------------------------------
-- 3) Database-level OT/payroll write authorization
-- Preserve employee portal continuity while moving financial/approval writes
-- behind authenticated business roles.
-- ---------------------------------------------------------------------------
create or replace function public.guard_anon_payroll_record_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') = 'anon' then
    if (to_jsonb(new) - 'employee_acknowledgement')
       is distinct from
       (to_jsonb(old) - 'employee_acknowledgement') then
      raise exception using
        errcode = 'P0001',
        message = 'PAYROLL_WRITE_BLOCKED: employee portal may update acknowledgement only.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_anon_payroll_record_update on public.payroll_records;
create trigger trg_guard_anon_payroll_record_update
before update on public.payroll_records
for each row execute function public.guard_anon_payroll_record_update();

create or replace function public.guard_anon_attendance_ot_approval()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') = 'anon' then
    if tg_op = 'INSERT' then
      if coalesce(new.overtime_approved, false) = true then
        raise exception using errcode='P0001', message='OT_APPROVAL_WRITE_BLOCKED: employee portal cannot approve overtime.';
      end if;
    elsif tg_op = 'UPDATE' then
      if coalesce(old.overtime_approved, false) = false
         and coalesce(new.overtime_approved, false) = true then
        raise exception using errcode='P0001', message='OT_APPROVAL_WRITE_BLOCKED: employee portal cannot approve overtime.';
      end if;
      if coalesce(old.overtime_approved, false) = true
         and (
           coalesce(new.overtime_approved, false) = false
           or new.overtime_minutes is distinct from old.overtime_minutes
           or new.status is distinct from old.status
         ) then
        raise exception using errcode='P0001', message='OT_APPROVED_RECORD_LOCKED: approved overtime can be changed only by an authorized admin workflow.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_anon_attendance_ot_approval on public.attendance_logs;
create trigger trg_guard_anon_attendance_ot_approval
before insert or update on public.attendance_logs
for each row execute function public.guard_anon_attendance_ot_approval();

alter table public.attendance_logs enable row level security;
alter table public.time_adjustment_requests enable row level security;
alter table public.payroll_records enable row level security;
alter table public.payroll_adjustments enable row level security;

-- Remove unnecessary high-risk table privileges from browser roles.
revoke truncate, references, trigger on public.attendance_logs from anon, authenticated;
revoke truncate, references, trigger on public.time_adjustment_requests from anon, authenticated;
revoke truncate, references, trigger on public.payroll_records from anon, authenticated;
revoke truncate, references, trigger on public.payroll_adjustments from anon, authenticated;

revoke delete on public.attendance_logs from anon;
revoke update, delete on public.time_adjustment_requests from anon;
revoke insert, delete on public.payroll_records from anon;
revoke insert, update, delete on public.payroll_adjustments from anon;

-- Explicit continuity grants; RLS + triggers enforce the boundaries below.
grant select, insert, update on public.attendance_logs to anon, authenticated;
grant select, insert on public.time_adjustment_requests to anon, authenticated;
grant select, update on public.payroll_records to anon, authenticated;
grant select on public.payroll_adjustments to authenticated;
grant insert, update, delete on public.attendance_logs, public.time_adjustment_requests, public.payroll_records, public.payroll_adjustments to authenticated;

-- Drop only policies owned by this hardening migration so reruns stay safe.
drop policy if exists attendance_portal_read on public.attendance_logs;
drop policy if exists attendance_portal_insert on public.attendance_logs;
drop policy if exists attendance_portal_update on public.attendance_logs;
drop policy if exists attendance_admin_delete on public.attendance_logs;

create policy attendance_portal_read on public.attendance_logs
for select to anon, authenticated using (true);
create policy attendance_portal_insert on public.attendance_logs
for insert to anon, authenticated with check (true);
create policy attendance_portal_update on public.attendance_logs
for update to anon, authenticated using (true) with check (true);
create policy attendance_admin_delete on public.attendance_logs
for delete to authenticated
using (public.business_control_has_role(array['owner','payroll','hr']::text[]));

drop policy if exists time_adjustment_portal_read on public.time_adjustment_requests;
drop policy if exists time_adjustment_portal_file_pending on public.time_adjustment_requests;
drop policy if exists time_adjustment_admin_insert on public.time_adjustment_requests;
drop policy if exists time_adjustment_admin_update on public.time_adjustment_requests;
drop policy if exists time_adjustment_admin_delete on public.time_adjustment_requests;

create policy time_adjustment_portal_read on public.time_adjustment_requests
for select to anon, authenticated using (true);
create policy time_adjustment_portal_file_pending on public.time_adjustment_requests
for insert to anon
with check (
  lower(trim(coalesce(status, 'pending'))) = 'pending'
  and lower(trim(coalesce(request_type, ''))) in ('overtime','meal_break')
  and nullif(trim(coalesce(reviewed_by, '')), '') is null
  and reviewed_at is null
  and nullif(trim(coalesce(admin_reason, '')), '') is null
);
create policy time_adjustment_admin_insert on public.time_adjustment_requests
for insert to authenticated
with check (public.business_control_has_role(array['owner','payroll','hr']::text[]));
create policy time_adjustment_admin_update on public.time_adjustment_requests
for update to authenticated
using (public.business_control_has_role(array['owner','payroll','hr']::text[]))
with check (public.business_control_has_role(array['owner','payroll','hr']::text[]));
create policy time_adjustment_admin_delete on public.time_adjustment_requests
for delete to authenticated
using (public.business_control_has_role(array['owner','payroll','hr']::text[]));

drop policy if exists payroll_records_portal_read on public.payroll_records;
drop policy if exists payroll_records_portal_ack_update on public.payroll_records;
drop policy if exists payroll_records_admin_insert on public.payroll_records;
drop policy if exists payroll_records_admin_update on public.payroll_records;
drop policy if exists payroll_records_admin_delete on public.payroll_records;

create policy payroll_records_portal_read on public.payroll_records
for select to anon, authenticated using (true);
create policy payroll_records_portal_ack_update on public.payroll_records
for update to anon using (true) with check (true);
create policy payroll_records_admin_insert on public.payroll_records
for insert to authenticated
with check (public.business_control_has_role(array['owner','payroll','hr']::text[]));
create policy payroll_records_admin_update on public.payroll_records
for update to authenticated
using (public.business_control_has_role(array['owner','payroll','hr']::text[]))
with check (public.business_control_has_role(array['owner','payroll','hr']::text[]));
create policy payroll_records_admin_delete on public.payroll_records
for delete to authenticated
using (public.business_control_has_role(array['owner','payroll','hr']::text[]));

drop policy if exists payroll_adjustments_admin_read on public.payroll_adjustments;
drop policy if exists payroll_adjustments_admin_insert on public.payroll_adjustments;
drop policy if exists payroll_adjustments_admin_update on public.payroll_adjustments;
drop policy if exists payroll_adjustments_admin_delete on public.payroll_adjustments;

create policy payroll_adjustments_admin_read on public.payroll_adjustments
for select to authenticated
using (public.business_control_has_role(array['owner','payroll','hr']::text[]));
create policy payroll_adjustments_admin_insert on public.payroll_adjustments
for insert to authenticated
with check (public.business_control_has_role(array['owner','payroll','hr']::text[]));
create policy payroll_adjustments_admin_update on public.payroll_adjustments
for update to authenticated
using (public.business_control_has_role(array['owner','payroll','hr']::text[]))
with check (public.business_control_has_role(array['owner','payroll','hr']::text[]));
create policy payroll_adjustments_admin_delete on public.payroll_adjustments
for delete to authenticated
using (public.business_control_has_role(array['owner','payroll','hr']::text[]));
