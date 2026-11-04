-- Manual SIL payments: one atomic owner-authorized ledger/expense/balance transaction.
-- Apply this migration BEFORE merging the corresponding frontend PR.
-- This migration does not backfill or change historic SIL release audit markers.
create table if not exists public.sil_manual_releases (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  employee_id uuid references public.employees(id) on delete set null,
  employee_code text not null,
  employee_name text not null,
  release_date date not null,
  covered_from date not null,
  covered_to date not null,
  unused_days integer not null check (unused_days between 1 and 5),
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash','online')),
  payment_reference text not null check (length(btrim(payment_reference)) between 3 and 160),
  notes text not null default '',
  source_adjustment_id uuid unique references public.payroll_adjustments(id) on delete restrict,
  expense_id uuid not null unique references public.daily_expenses(id) on delete restrict,
  created_by_auth uuid not null,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  constraint sil_manual_releases_covered_dates_check check (covered_from <= covered_to)
);
create index if not exists sil_manual_releases_employee_cycle_idx
  on public.sil_manual_releases(employee_id,covered_from,covered_to);
create index if not exists sil_manual_releases_release_date_idx
  on public.sil_manual_releases(release_date desc);

alter table public.sil_manual_releases enable row level security;
revoke all on public.sil_manual_releases from anon,authenticated;
grant select on public.sil_manual_releases to authenticated;
drop policy if exists sil_manual_releases_admin_read on public.sil_manual_releases;
create policy sil_manual_releases_admin_read on public.sil_manual_releases
  for select to authenticated
  using (auth.uid() is not null and private.cash_advance_admin_has_role(array['owner','payroll']));

create or replace function private.record_manual_sil_release(
  p_request_id uuid, p_employee_id uuid, p_release_date date,
  p_unused_days integer, p_amount numeric, p_payment_method text,
  p_payment_reference text, p_covered_from date, p_covered_to date,
  p_notes text default '', p_adjustment_id uuid default null
) returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_employee public.employees%rowtype;
  v_adjustment public.payroll_adjustments%rowtype;
  v_existing public.sil_manual_releases%rowtype;
  v_claim_parts text[];
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_years integer;
  v_cycle_start date;
  v_cycle_end date;
  v_actor text;
  v_expected_amount numeric;
  v_expense_id uuid;
  v_release_id uuid := gen_random_uuid();
  v_method text := lower(btrim(coalesce(p_payment_method,'')));
  v_ref text := btrim(coalesce(p_payment_reference,''));
  v_notes text := btrim(coalesce(p_notes,''));
begin
  if auth.uid() is null or not private.cash_advance_admin_has_role(array['owner']) then
    raise exception 'Owner access is required to release SIL cash payments.' using errcode='42501';
  end if;
  if p_request_id is null or p_employee_id is null or p_release_date is null
    or p_covered_from is null or p_covered_to is null then
    raise exception 'Complete the employee, payment date and SIL covered period.';
  end if;
  if p_release_date > v_today or p_release_date < date '2020-01-01'
    or p_covered_from > p_covered_to or p_covered_to > v_today + interval '1 year' then
    raise exception 'Invalid SIL payment date or covered period.';
  end if;
  if p_unused_days is null or p_unused_days not between 1 and 5 then
    raise exception 'SIL manual release must be between one and five whole days.';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount,2)
    or p_amount::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Enter a positive SIL amount rounded to centavos.';
  end if;
  if v_method not in ('cash','online') then
    raise exception 'Choose Cash or Online as the SIL payment method.';
  end if;
  if length(v_ref) < 3 or length(v_ref) > 160 or length(v_notes) > 800 then
    raise exception 'Provide a 3–160 character receipt/acknowledgement reference and optional notes under 800 characters.';
  end if;

  -- Share the employee-separation advisory lock: final pay and manual SIL release must not race.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('employee-separation:'||p_employee_id::text,0));
  select * into v_existing from public.sil_manual_releases where request_id=p_request_id;
  if found then
    if v_existing.employee_id is distinct from p_employee_id then
      raise exception 'Payment request ID was already used for another employee.';
    end if;
    return pg_catalog.jsonb_build_object('ok',true,'existing',true,'release_id',v_existing.id,
      'expense_id',v_existing.expense_id,'amount',v_existing.amount,
      'remaining_sil_days',null);
  end if;
  select * into v_employee from public.employees where id=p_employee_id for update;
  if not found then raise exception 'Employee was not found.'; end if;
  if coalesce(v_employee.is_active,false)=false then
    raise exception 'Employee is inactive. Reconcile historical SIL with the owner before recording.';
  end if;
  if exists (select 1 from public.final_pay_records where employee_id=p_employee_id) then
    raise exception 'Final pay already exists. Do not post a separate SIL payment.';
  end if;
  select coalesce(nullif(full_name,''),'Owner') into v_actor
    from public.admin_users where auth_user_id=auth.uid() and is_active=true limit 1;
  v_actor := coalesce(v_actor,'Owner');

  if p_adjustment_id is not null then
    select * into v_adjustment from public.payroll_adjustments
      where id=p_adjustment_id and employee_id=p_employee_id for update;
    if not found or v_adjustment.category is distinct from 'Unused SIL Conversion' then
      raise exception 'The selected pending SIL cash conversion was not found.';
    end if;
    if v_adjustment.source_type = 'sil_manual_paid'
      or exists (select 1 from public.sil_manual_releases where source_adjustment_id=p_adjustment_id)
      or exists (select 1 from public.audit_logs
                 where action='SIL RELEASED/PAID'
                   and position('ADJ:'||p_adjustment_id::text in coalesce(details,''))>0) then
      raise exception 'This SIL conversion has already been marked paid. Reconcile legacy records before retrying.';
    end if;
    if exists(select 1 from public.payroll_records
      where employee_id=p_employee_id
        and payroll_start<=v_adjustment.adjustment_date
        and payroll_end>=v_adjustment.adjustment_date) then
      raise exception 'A draft or released payroll already covers this conversion. Review/undo the draft or reconcile released payroll first.';
    end if;
    v_claim_parts := pg_catalog.regexp_match(coalesce(v_adjustment.notes,''),
      '([0-9]+) day\(s\) from ([0-9]{4}-[0-9]{2}-[0-9]{2}) to ([0-9]{4}-[0-9]{2}-[0-9]{2})', 'i');
    if v_claim_parts is null or v_claim_parts[1]::integer<>p_unused_days
      or v_claim_parts[2]::date<>p_covered_from
      or v_claim_parts[3]::date<>p_covered_to
      or round(coalesce(v_adjustment.amount,0),2)<>p_amount then
      raise exception 'Manual payment does not match the saved automatic SIL conversion. Use its exact dates/days/amount.';
    end if;
  else
    if v_employee.hire_date is null then
      raise exception 'Employee hire date is missing; SIL entitlement cannot be verified.';
    end if;
    v_years := extract(year from pg_catalog.age(v_today,v_employee.hire_date))::integer;
    if v_years < 1 then raise exception 'Employee has not yet completed one year of service.'; end if;
    v_cycle_start := (v_employee.hire_date + pg_catalog.make_interval(years=>v_years))::date;
    v_cycle_end := (v_employee.hire_date + pg_catalog.make_interval(years=>v_years+1))::date - 1;
    if p_covered_from<>v_cycle_start or p_covered_to<>v_cycle_end then
      raise exception 'The claim does not match the current SIL cycle. Choose a pending annual conversion for an older cycle.';
    end if;
    -- syncEmployeeSIL uses a credit audit marker as its reset guard; do not allow
    -- a manual payment without it or the next sync could restore the paid days.
    if not exists(
      select 1 from public.audit_logs
      where action='SIL CREDITED'
        and position(p_employee_id::text in coalesce(details,''))>0
        and position(v_cycle_start::text in coalesce(details,''))>0
    ) then
      raise exception 'SIL cycle was not credited yet. Run the existing SIL check/apply workflow first, then refresh.';
    end if;
    if p_release_date < v_cycle_start then
      raise exception 'Payment date predates the current SIL entitlement cycle.';
    end if;
    if p_unused_days > greatest(0,coalesce(v_employee.sil_balance,0)) then
      raise exception 'Not enough unused SIL days remain. Refresh employee SIL and verify prior releases.';
    end if;
  end if;

  v_expected_amount := round(p_unused_days * coalesce(v_employee.daily_rate,0),2);
  if p_adjustment_id is null and p_amount<>v_expected_amount and length(v_notes)<10 then
    raise exception 'An amount override requires a written reason of at least ten characters.';
  end if;

  insert into public.daily_expenses(
    expense_date,category,amount,description,status,encoded_by,approved_by,approved_at)
  values(p_release_date,'SIL Cash Conversion',p_amount,
    'Manual SIL payment | Employee: '||v_employee.employee_code||
    ' | Days: '||p_unused_days||' | Covered: '||p_covered_from||' to '||p_covered_to||
    ' | Method: '||v_method||' | Reference: '||v_ref||
    case when p_adjustment_id is not null then ' | Conversion: '||p_adjustment_id else '' end,
    'approved',v_actor,v_actor,now())
  returning id into v_expense_id;

  insert into public.sil_manual_releases(
    id,request_id,employee_id,employee_code,employee_name,release_date,
    covered_from,covered_to,unused_days,amount,payment_method,payment_reference,
    notes,source_adjustment_id,expense_id,created_by_auth,created_by_name)
  values(v_release_id,p_request_id,p_employee_id,v_employee.employee_code,v_employee.full_name,
    p_release_date,p_covered_from,p_covered_to,p_unused_days,p_amount,v_method,
    v_ref,v_notes,p_adjustment_id,v_expense_id,auth.uid(),v_actor);

  if p_adjustment_id is not null then
    update public.payroll_adjustments
      set source_type='sil_manual_paid',source_id=v_release_id::text
      where id=p_adjustment_id;
  else
    update public.employees
      set sil_balance = greatest(0,coalesce(sil_balance,0)-p_unused_days)
      where id=p_employee_id;
  end if;

  insert into public.audit_logs(action,performed_by,target_employee,details)
  values('SIL MANUAL PAYMENT RECORDED',v_actor,v_employee.full_name,
    'RELEASE:'||v_release_id||' | EXPENSE:'||v_expense_id||' | EMP:'||p_employee_id||
    ' | DAYS:'||p_unused_days||' | AMOUNT:'||p_amount||
    ' | METHOD:'||v_method||' | REF:'||v_ref||
    case when p_adjustment_id is not null then ' | ADJ:'||p_adjustment_id else '' end);

  return pg_catalog.jsonb_build_object('ok',true,'existing',false,
    'release_id',v_release_id,'expense_id',v_expense_id,'amount',p_amount,
    'remaining_sil_days',case when p_adjustment_id is null then
      greatest(0,coalesce(v_employee.sil_balance,0)-p_unused_days)
      else coalesce(v_employee.sil_balance,0) end);
end $function$;

-- The exposed RPC is invoker-only; privileged logic remains in private.
create or replace function public.record_manual_sil_release(
  p_request_id uuid,p_employee_id uuid,p_release_date date,p_unused_days integer,
  p_amount numeric,p_payment_method text,p_payment_reference text,
  p_covered_from date,p_covered_to date,p_notes text default '',
  p_adjustment_id uuid default null
) returns jsonb language sql security invoker set search_path = ''
as $function$
  select private.record_manual_sil_release(
    p_request_id,p_employee_id,p_release_date,p_unused_days,p_amount,
    p_payment_method,p_payment_reference,p_covered_from,p_covered_to,
    p_notes,p_adjustment_id);
$function$;
revoke all on function public.record_manual_sil_release(uuid,uuid,date,integer,numeric,text,text,date,date,text,uuid)
  from public,anon;
grant execute on function public.record_manual_sil_release(uuid,uuid,date,integer,numeric,text,text,date,date,text,uuid)
  to authenticated;
revoke all on function private.record_manual_sil_release(uuid,uuid,date,integer,numeric,text,text,date,date,text,uuid)
  from public,anon;
grant execute on function private.record_manual_sil_release(uuid,uuid,date,integer,numeric,text,text,date,date,text,uuid)
  to authenticated;

-- A released SIL expense is a linked financial fact: correction requires a dedicated reversal.
create or replace function private.protect_manual_sil_expense()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if exists(select 1 from public.sil_manual_releases where expense_id=old.id) then
    raise exception 'This expense belongs to a manual SIL payment. Do not edit/void/delete it directly; use a documented reversal.';
  end if;
  if tg_op='DELETE' then
    return old;
  end if;
  return new;
end $function$;
drop trigger if exists protect_manual_sil_expense on public.daily_expenses;
create trigger protect_manual_sil_expense before update or delete
  on public.daily_expenses for each row execute function private.protect_manual_sil_expense();

-- Recheck SIL during final-pay INSERT: a stale preview cannot pay released SIL again.
create or replace function private.validate_final_pay_sil_balance()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_emp public.employees%rowtype;
  v_expected numeric;
begin
  select * into v_emp from public.employees where id=new.employee_id;
  if not found then raise exception 'Employee not found for SIL final-pay check.'; end if;
  v_expected := case
    when v_emp.hire_date is not null
      and (v_emp.hire_date + interval '1 year')::date <= new.last_working_date::date
    then round(greatest(0,coalesce(v_emp.sil_balance,0))*coalesce(v_emp.daily_rate,0),2)
    else 0 end;
  if round(coalesce(new.sil_pay,0),2)<>v_expected then
    raise exception 'SIL balance or daily rate changed. Recompute final pay before processing.';
  end if;
  return new;
end $function$;
drop trigger if exists validate_final_pay_sil_balance on public.final_pay_records;
create trigger validate_final_pay_sil_balance before insert
  on public.final_pay_records for each row execute function private.validate_final_pay_sil_balance();
