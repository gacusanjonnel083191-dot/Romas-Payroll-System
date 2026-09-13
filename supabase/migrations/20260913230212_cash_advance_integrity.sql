-- REVIEW ONLY. Apply only after owner authorizes this database change.
-- No existing cash-advance balance or released payroll total is rewritten here.
begin;

create table if not exists private.ca_integrity_control (
  singleton boolean primary key default true check (singleton),
  release_hold boolean not null default true,
  reconciled_at timestamptz,
  reason text not null default 'Cash-advance incident reconciliation is required before payroll release.'
);
insert into private.ca_integrity_control(singleton) values(true) on conflict do nothing;

create table if not exists private.ca_payroll_batches (
  payroll_start date not null,
  payroll_end date not null,
  state text not null check(state in ('legacy_applied','review_required','applied','reversed')),
  generation integer not null default 1,
  amount numeric(14,2) not null default 0,
  changed_at timestamptz not null default now(),
  primary key(payroll_start,payroll_end),
  check(payroll_start <= payroll_end)
);
create table if not exists private.ca_payroll_allocations (
  payroll_start date not null,
  payroll_end date not null,
  generation integer not null,
  payroll_record_id uuid not null,
  employee_id uuid not null,
  cash_advance_id uuid not null references public.cash_advances(id),
  amount numeric(14,2) not null check(amount > 0),
  applied_at timestamptz not null default now(),
  reversed_at timestamptz,
  primary key(payroll_start,payroll_end,generation,payroll_record_id,cash_advance_id),
  unique(payroll_start,payroll_end,generation,cash_advance_id),
  foreign key(payroll_start,payroll_end) references private.ca_payroll_batches
);
create index if not exists ca_payroll_allocations_advance_idx on private.ca_payroll_allocations(cash_advance_id);
create table if not exists private.ca_integrity_events (
  id bigint generated always as identity primary key,
  cash_advance_id uuid not null,
  old_data jsonb,
  new_data jsonb,
  actor_id uuid,
  occurred_at timestamptz not null default now()
);
alter table private.ca_integrity_control enable row level security;
alter table private.ca_payroll_batches enable row level security;
alter table private.ca_payroll_allocations enable row level security;
alter table private.ca_integrity_events enable row level security;
revoke all on private.ca_integrity_control, private.ca_payroll_batches,
  private.ca_payroll_allocations, private.ca_integrity_events from public, anon, authenticated;

-- Legacy release evidence is a permanent replay barrier, not a new repayment.
-- Do not fabricate per-loan allocations from old aggregate totals.
insert into private.ca_payroll_batches(payroll_start,payroll_end,state,amount)
select payroll_start,payroll_end,
  case when bool_and(coalesce(payroll_approved,false) or coalesce(payroll_released,false)
      or lower(coalesce(payroll_status,''))='released') then 'legacy_applied' else 'review_required' end,
  round(sum(coalesce(cash_advance_deduction,0)),2)
from public.payroll_records p
where exists (
  select 1 from public.payroll_records r
  where r.payroll_start=p.payroll_start and r.payroll_end=p.payroll_end
    and (coalesce(r.payroll_approved,false) or coalesce(r.payroll_released,false)
      or lower(coalesce(r.payroll_status,''))='released')
) or exists (
  select 1 from public.audit_logs a
  where a.action='CA PAYROLL DEDUCTIONS APPLIED'
    and split_part(a.details,' | ',1)='CA_PAYROLL:'||p.payroll_start||'|'||p.payroll_end
)
group by payroll_start,payroll_end
on conflict do nothing;

-- Invoker trigger: browser/API callers cannot change paid amounts, including old
-- cached clients. Trusted settlement functions execute as the table owner.
create or replace function private.guard_ca_financial_change()
returns trigger language plpgsql security invoker set search_path='' as $$
declare trusted boolean; financial_change boolean;
begin
  select current_user=pg_get_userbyid(c.relowner) into trusted
  from pg_class c where c.oid='public.cash_advances'::regclass;
  if tg_op='DELETE' then
    if not trusted and coalesce(old.amount_paid,0)<>0 then
      raise exception 'Cash advances with repayment history cannot be deleted.';
    end if;
    return old;
  end if;
  financial_change := tg_op='INSERT';
  if tg_op='UPDATE' then
    financial_change := (new.amount,new.amount_paid,new.balance,new.status,new.employee_id,
      new.installments_total,new.installments_remaining,new.per_payroll_deduction,new.advance_date)
      is distinct from (old.amount,old.amount_paid,old.balance,old.status,old.employee_id,
      old.installments_total,old.installments_remaining,old.per_payroll_deduction,old.advance_date);
  end if;
  if not financial_change then return new; end if;
  if not trusted then
    if tg_op='INSERT' and coalesce(new.amount_paid,0)<>0 then
      raise exception 'New cash advances must start unpaid.';
    elsif tg_op='UPDATE' then
      if new.amount_paid is distinct from old.amount_paid then
        raise exception 'Direct repayment changes are blocked. Refresh the app and use the verified payroll workflow.';
      end if;
      if coalesce(old.amount_paid,0)>0 then
        raise exception 'A cash advance with repayments requires a documented reconciliation.';
      end if;
    end if;
    if not private.cash_advance_admin_has_role(array['owner']) then
      raise exception 'Owner access is required to change a cash-advance plan.';
    end if;
  end if;
  if new.amount is null or new.amount_paid is null or new.balance is null
    or new.amount::text in ('NaN','Infinity','-Infinity')
    or new.amount_paid::text in ('NaN','Infinity','-Infinity')
    or new.balance::text in ('NaN','Infinity','-Infinity')
    or new.amount<=0 or new.amount_paid<0 or new.amount_paid>new.amount
    or new.balance<0 or round(new.balance,2)<>round(new.amount-new.amount_paid,2) then
    raise exception 'Cash-advance amount, recorded repayments and outstanding balance do not reconcile.';
  end if;
  if lower(coalesce(new.status,'')) not in ('cancelled','canceled','void','voided') then
    new.status:=case when round(new.balance,2)=0 then 'Paid' else 'Unpaid' end;
  elsif not trusted then
    raise exception 'Voiding a cash advance requires a documented reconciliation.';
  end if;
  return new;
end $$;
revoke all on function private.guard_ca_financial_change() from public,anon,authenticated;
drop trigger if exists trg_ca_financial_guard on public.cash_advances;
create trigger trg_ca_financial_guard before insert or update or delete on public.cash_advances
for each row execute function private.guard_ca_financial_change();

-- This audit must succeed with the balance change; never swallow audit errors.
create or replace function private.audit_ca_financial_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and (new.amount,new.amount_paid,new.balance,new.status)
     is not distinct from (old.amount,old.amount_paid,old.balance,old.status) then return new; end if;
  insert into private.ca_integrity_events(cash_advance_id,old_data,new_data,actor_id)
  values(coalesce(new.id,old.id),case when tg_op<>'INSERT' then to_jsonb(old) end,
    case when tg_op<>'DELETE' then to_jsonb(new) end,auth.uid());
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.audit_ca_financial_change() from public,anon,authenticated;
drop trigger if exists trg_ca_integrity_audit on public.cash_advances;
create trigger trg_ca_integrity_audit after insert or update or delete on public.cash_advances
for each row execute function private.audit_ca_financial_change();

-- Also block old clients from releasing payroll before settlement is committed.
create or replace function private.guard_ca_payroll_release()
returns trigger language plpgsql security invoker set search_path='' as $$
declare trusted boolean;
begin
  select current_user=pg_get_userbyid(c.relowner) into trusted
  from pg_class c where c.oid='public.payroll_records'::regclass;
  if trusted then return new; end if;
  if tg_op='INSERT' then
    if coalesce(new.payroll_approved,false) or coalesce(new.payroll_released,false)
       or new.approved_at is not null or new.released_at is not null or new.payroll_status='released' then
      raise exception 'Use the verified payroll release workflow.';
    end if;
  elsif (new.payroll_approved,new.payroll_released,new.payroll_locked,new.approved_at,new.released_at,new.payroll_status)
    is distinct from (old.payroll_approved,old.payroll_released,old.payroll_locked,old.approved_at,old.released_at,old.payroll_status)
    and (coalesce(new.payroll_approved,false) or coalesce(new.payroll_released,false)
      or coalesce(old.payroll_approved,false) or coalesce(old.payroll_released,false)
      or new.payroll_status='released' or old.payroll_status='released') then
    raise exception 'Use the verified payroll release or reopen workflow.';
  end if;
  if tg_op='UPDATE' and (coalesce(old.payroll_approved,false) or coalesce(old.payroll_released,false))
     and (new.cash_advance_deduction,new.cash_advance_breakdown,new.employee_id,new.payroll_start,new.payroll_end)
       is distinct from (old.cash_advance_deduction,old.cash_advance_breakdown,old.employee_id,old.payroll_start,old.payroll_end) then
    raise exception 'Released cash-advance allocations cannot be rewritten.';
  end if;
  return new;
end $$;
revoke all on function private.guard_ca_payroll_release() from public,anon,authenticated;
drop trigger if exists trg_ca_payroll_release_guard on public.payroll_records;
create trigger trg_ca_payroll_release_guard before insert or update on public.payroll_records
for each row execute function private.guard_ca_payroll_release();

create or replace function private.ca_payroll_command(p_command text,p_start date,p_end date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  b private.ca_payroll_batches%rowtype;
  ctl private.ca_integrity_control%rowtype;
  r public.payroll_records%rowtype;
  ca public.cash_advances%rowtype;
  item jsonb; alloc record; total numeric:=0; item_total numeric; debit numeric;
  n integer; gen integer:=1; actor text; released_count integer;
begin
  if auth.uid() is null or not private.cash_advance_admin_has_role(array['owner','payroll']) then
    raise exception 'Owner or payroll access is required.' using errcode='42501';
  end if;
  if p_start is null or p_end is null or p_start>p_end or p_command is null or p_command not in ('status','release','reopen') then
    raise exception 'Invalid cash-advance payroll command or dates.';
  end if;
  -- A global payroll settlement lock serializes overlapping cutoffs too.
  perform pg_advisory_xact_lock(731946285019::bigint);
  select * into ctl from private.ca_integrity_control where singleton for update;
  if not found then raise exception 'Cash-advance integrity control is unavailable.'; end if;
  select * into b from private.ca_payroll_batches where payroll_start=p_start and payroll_end=p_end for update;
  if p_command='status' then
    return jsonb_build_object('ok',true,'exists',coalesce(b.state in ('applied','legacy_applied'),false),
      'state',b.state,'hold',ctl.release_hold);
  end if;
  if ctl.release_hold then raise exception '%',ctl.reason; end if;
  perform 1 from public.payroll_records where payroll_start=p_start and payroll_end=p_end order by id for update;
  select count(*),count(*) filter(where coalesce(payroll_approved,false) or coalesce(payroll_released,false)
    or payroll_status='released') into n,released_count from public.payroll_records
    where payroll_start=p_start and payroll_end=p_end;
  if n=0 then raise exception 'No saved payroll records for this cutoff.'; end if;
  if n<>(select count(distinct employee_id) from public.payroll_records where payroll_start=p_start and payroll_end=p_end) then
    raise exception 'Duplicate or unidentified employees in this payroll. Review required.';
  end if;
  select coalesce(nullif(full_name,''),'Authorized payroll admin') into actor from public.admin_users
    where auth_user_id=auth.uid() and is_active=true limit 1;
  actor:=coalesce(actor,'Authorized payroll admin');
  if b.state='review_required' then raise exception 'Legacy payroll requires reconciliation; automatic replay is blocked.'; end if;

  if p_command='release' then
    if b.state in ('applied','legacy_applied') then
      if released_count<>n then raise exception 'Payroll status conflicts with its settlement receipt. Review required.'; end if;
      return jsonb_build_object('ok',true,'applied',false,'existing',true,'amount',0);
    end if;
    if released_count<>0 then raise exception 'Released payroll has no verified settlement receipt. Review required.'; end if;
    if ctl.reconciled_at is not null and exists(select 1 from public.payroll_records
      where payroll_start=p_start and payroll_end=p_end and created_at<=ctl.reconciled_at) then
      raise exception 'Rebuild this draft after the cash-advance reconciliation, then send it for review again.';
    end if;
    if exists(select 1 from public.payroll_records where payroll_start=p_start and payroll_end=p_end
      and (lower(coalesce(payroll_status,''))='draft' or lower(coalesce(employee_acknowledgement,'')) in ('draft','disputed')
        or coalesce(review_sent_at,approved_at) is null
        or coalesce(total_deductions,0)>coalesce(total_earnings,0)+0.009
        or coalesce(non_ca_deduction_overflow,0)>0.009)) then
      raise exception 'Payroll is not ready for release: review, disputes or deduction totals need attention.';
    end if;
    if exists(select 1 from public.time_adjustment_requests where status='pending'
      and request_type in ('overtime','meal_break') and attendance_date between p_start::text and p_end::text) then
      raise exception 'Resolve pending OT or No Meal Break requests before release.';
    end if;
    gen:=case when b.state='reversed' then b.generation+1 else 1 end;
    insert into private.ca_payroll_batches(payroll_start,payroll_end,state,generation)
      values(p_start,p_end,'applied',gen)
      on conflict(payroll_start,payroll_end) do update set state='applied',generation=excluded.generation,changed_at=now();
    for r in select * from public.payroll_records where payroll_start=p_start and payroll_end=p_end order by id loop
      if r.created_at is null or r.cash_advance_deduction is null or r.cash_advance_deduction<0
        or r.cash_advance_deduction<>round(r.cash_advance_deduction,2)
        or r.cash_advance_deduction::text in ('NaN','Infinity','-Infinity') then
        raise exception 'Invalid payroll cash-advance amount.';
      end if;
      if jsonb_typeof(coalesce(r.cash_advance_breakdown,'[]'::jsonb))<>'array' then
        raise exception 'Cash-advance snapshot is invalid. Recompute payroll.';
      end if;
      item_total:=0;
      for item in select value from jsonb_array_elements(coalesce(r.cash_advance_breakdown,'[]'::jsonb)) loop
        debit:=(item->>'amount')::numeric;
        if debit is null or debit<=0 or debit::text in ('NaN','Infinity','-Infinity') or debit<>round(debit,2) then
          raise exception 'Invalid cash-advance snapshot amount.';
        end if;
        select * into ca from public.cash_advances where id=(item->>'id')::uuid for update;
        if not found or ca.employee_id is distinct from r.employee_id or ca.advance_date is null or ca.advance_date>p_end
          or ca.created_at is null or ca.created_at>r.created_at or lower(coalesce(ca.status,'')) in ('void','voided','cancelled','canceled') then
          raise exception 'Cash-advance snapshot does not match an eligible loan. Recompute payroll.';
        end if;
        if ca.amount_paid is null or ca.balance is null or ca.amount_paid<0 or ca.amount_paid>ca.amount
          or round(ca.balance,2)<>round(ca.amount-ca.amount_paid,2) then
          raise exception 'Stored cash-advance balance does not reconcile. Review required.';
        end if;
        if debit>round(ca.balance,2) or debit>round(case when ca.per_payroll_deduction>0
          then least(ca.balance,ca.per_payroll_deduction) else ca.balance end,2) then
          raise exception 'Cash-advance balance or installment changed. Recompute payroll before release.';
        end if;
        insert into private.ca_payroll_allocations(payroll_start,payroll_end,generation,payroll_record_id,employee_id,cash_advance_id,amount)
          values(p_start,p_end,gen,r.id,r.employee_id,ca.id,debit);
        update public.cash_advances set amount_paid=round(amount_paid+debit,2),balance=round(balance-debit,2),
          status=case when round(balance-debit,2)=0 then 'Paid' else 'Unpaid' end,
          installments_remaining=case when round(balance-debit,2)=0 then 0 when per_payroll_deduction>0
            then ceil(round(balance-debit,2)/per_payroll_deduction)::integer else greatest(1,coalesce(installments_remaining,1)) end
          where id=ca.id;
        item_total:=item_total+debit;
      end loop;
      if item_total<>round(r.cash_advance_deduction,2) then
        raise exception 'Cash-advance snapshot total does not match the payslip. Recompute payroll.';
      end if;
      total:=total+item_total;
    end loop;
    update public.payroll_records set payroll_approved=true,payroll_released=true,payroll_locked=true,
      payroll_status='released',approved_at=now(),released_at=now(),approved_by=actor,released_by=actor
      where payroll_start=p_start and payroll_end=p_end;
    update private.ca_payroll_batches set amount=total,changed_at=now() where payroll_start=p_start and payroll_end=p_end;
    insert into public.audit_logs(action,performed_by,target_employee,details)
      values('CA PAYROLL DEDUCTIONS APPLIED',actor,'ALL','CA_PAYROLL:'||p_start||'|'||p_end||' | Verified transaction | Applied: PHP '||total||' | Generation: '||gen);
    return jsonb_build_object('ok',true,'applied',true,'amount',total);
  end if;

  if b.state='reversed' then return jsonb_build_object('ok',true,'reversed',false,'existing',true,'amount',0); end if;
  if b.state is distinct from 'applied' then
    raise exception 'Historical payroll cannot be automatically reversed without exact repayment allocations. Reconcile it first.';
  end if;
  if exists(select 1 from public.daily_expenses where category='Payroll Expense'
    and split_part(description,' | ',1)='PAYROLL:'||p_start||'|'||p_end) then
    raise exception 'Payroll was posted to expenses. Reconcile the expense before reopening.';
  end if;
  if released_count<>n then raise exception 'Payroll release state is inconsistent. Review required.'; end if;
  for alloc in select cash_advance_id,sum(amount) amount from private.ca_payroll_allocations
    where payroll_start=p_start and payroll_end=p_end and generation=b.generation and reversed_at is null
    group by cash_advance_id order by cash_advance_id loop
    select * into ca from public.cash_advances where id=alloc.cash_advance_id for update;
    if not found or ca.amount_paid<alloc.amount or round(ca.balance,2)<>round(ca.amount-ca.amount_paid,2) then
      raise exception 'Repayment reversal does not reconcile. Review required.';
    end if;
    update public.cash_advances set amount_paid=round(amount_paid-alloc.amount,2),balance=round(balance+alloc.amount,2),status='Unpaid',
      installments_remaining=case when per_payroll_deduction>0 then ceil(round(balance+alloc.amount,2)/per_payroll_deduction)::integer
        else greatest(1,coalesce(installments_remaining,1)) end where id=ca.id;
    total:=total+alloc.amount;
  end loop;
  if total<>b.amount then raise exception 'Repayment reversal total does not match its receipt.'; end if;
  update private.ca_payroll_allocations set reversed_at=now()
    where payroll_start=p_start and payroll_end=p_end and generation=b.generation and reversed_at is null;
  update private.ca_payroll_batches set state='reversed',changed_at=now() where payroll_start=p_start and payroll_end=p_end;
  update public.payroll_records set payroll_approved=false,payroll_released=false,payroll_locked=false,
    payroll_status='draft',approved_at=null,released_at=null,approved_by=null,released_by=null,
    employee_acknowledgement='draft',review_sent_at=null,review_sent_by=null where payroll_start=p_start and payroll_end=p_end;
  update public.payroll_periods set payroll_status='draft',review_sent_at=null,review_sent_by=null,acknowledge_deadline=null
    where payroll_start=p_start::text and payroll_end=p_end::text;
  insert into public.audit_logs(action,performed_by,target_employee,details)
    values('CA PAYROLL DEDUCTIONS REVERSED',actor,'ALL','CA_PAYROLL:'||p_start||'|'||p_end||' | Verified transaction | Reversed: PHP '||total);
  return jsonb_build_object('ok',true,'reversed',true,'amount',total);
end $$;
revoke all on function private.ca_payroll_command(text,date,date) from public,anon,authenticated;
grant execute on function private.ca_payroll_command(text,date,date) to authenticated;
create or replace function public.cash_advance_payroll_command(p_command text,p_start date,p_end date)
returns jsonb language sql security invoker set search_path='' as $$
  select private.ca_payroll_command(p_command,p_start,p_end);
$$;
revoke all on function public.cash_advance_payroll_command(text,date,date) from public,anon;
grant execute on function public.cash_advance_payroll_command(text,date,date) to authenticated;
notify pgrst,'reload schema';
commit;
