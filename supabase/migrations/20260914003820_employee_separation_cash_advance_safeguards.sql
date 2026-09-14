-- Employee separation must not silently hide an outstanding cash advance.
-- This migration does not alter existing employees, balances, payrolls, or final-pay rows.
begin;

create table if not exists private.ca_final_pay_allocations (
  final_pay_record_id integer not null references public.final_pay_records(id),
  cash_advance_id uuid not null references public.cash_advances(id),
  employee_id uuid not null references public.employees(id),
  amount numeric(14,2) not null check (amount > 0),
  authorization_reference text not null,
  settled_at timestamptz not null default now(),
  primary key (final_pay_record_id, cash_advance_id)
);
create index if not exists ca_final_pay_allocations_employee_idx
  on private.ca_final_pay_allocations(employee_id, settled_at desc);
alter table private.ca_final_pay_allocations enable row level security;
revoke all on private.ca_final_pay_allocations from public, anon, authenticated;

-- Legacy browser clients can still send a direct employees.is_active=false update.
-- Permit ordinary cleanup where no debt exists, but force a documented final-pay
-- or receivable decision whenever a cash advance remains outstanding.
create or replace function private.guard_employee_deactivation()
returns trigger language plpgsql security invoker set search_path='' as $$
declare trusted boolean;
begin
  select current_user=pg_get_userbyid(c.relowner) into trusted
  from pg_class c where c.oid='public.employees'::regclass;
  if coalesce(old.is_active,true) and not coalesce(new.is_active,true) and not trusted
    and exists (
      select 1 from public.cash_advances ca
      where ca.employee_id=old.id
        and lower(coalesce(ca.status,'')) not in ('void','voided','cancelled','canceled')
        and round(coalesce(ca.balance,coalesce(ca.amount,0)-coalesce(ca.amount_paid,0)),2)>0
    ) then
    raise exception 'Employee has an outstanding cash advance. Use the verified Final Pay workflow to record a written-authorized settlement or a former-employee receivable.';
  end if;
  return new;
end $$;
revoke all on function private.guard_employee_deactivation() from public, anon, authenticated;
drop trigger if exists trg_employee_deactivation_cash_advance_guard on public.employees;
create trigger trg_employee_deactivation_cash_advance_guard
before update of is_active on public.employees
for each row execute function private.guard_employee_deactivation();

create or replace function private.employee_separation_command(
  p_employee_id uuid,
  p_reason text,
  p_last_working_date date,
  p_last_salary numeric,
  p_pro_rated_13th numeric,
  p_sil_pay numeric,
  p_separation_pay numeric,
  p_settle_cash_advance boolean,
  p_authorization_reference text default null,
  p_receivable_note text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  emp public.employees%rowtype;
  ca public.cash_advances%rowtype;
  final_pay_id integer;
  gross_final_pay numeric:=0;
  total_ca numeric:=0;
  settlement numeric:=0;
  remaining numeric:=0;
  allocation numeric:=0;
  actor text;
  authorization_reference text:=btrim(coalesce(p_authorization_reference,''));
  receivable_note text:=btrim(coalesce(p_receivable_note,''));
begin
  if auth.uid() is null or not private.cash_advance_admin_has_role(array['owner']) then
    raise exception 'Owner access is required to process employee separation.' using errcode='42501';
  end if;
  if p_employee_id is null or p_last_working_date is null
    or btrim(coalesce(p_reason,''))='' then
    raise exception 'Employee, separation reason and last working date are required.';
  end if;
  if p_last_salary is null or p_pro_rated_13th is null or p_sil_pay is null or p_separation_pay is null
    or p_last_salary<0 or p_pro_rated_13th<0 or p_sil_pay<0 or p_separation_pay<0
    or p_last_salary<>round(p_last_salary,2) or p_pro_rated_13th<>round(p_pro_rated_13th,2)
    or p_sil_pay<>round(p_sil_pay,2) or p_separation_pay<>round(p_separation_pay,2)
    or p_last_salary::text in ('NaN','Infinity','-Infinity')
    or p_pro_rated_13th::text in ('NaN','Infinity','-Infinity')
    or p_sil_pay::text in ('NaN','Infinity','-Infinity')
    or p_separation_pay::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Final-pay components must be non-negative peso amounts rounded to centavos.';
  end if;
  if length(authorization_reference)>500 or length(receivable_note)>1000 then
    raise exception 'Separation documentation is too long.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('employee-separation:'||p_employee_id::text, 0));
  select * into emp from public.employees where id=p_employee_id for update;
  if not found then raise exception 'Employee record was not found.'; end if;
  if coalesce(emp.is_active,true)=false then raise exception 'Employee is already inactive. Do not create a second final-pay record.'; end if;
  if exists(select 1 from public.final_pay_records where employee_id=p_employee_id) then
    raise exception 'A final-pay record already exists for this employee. Review it before any correction.';
  end if;

  for ca in select * from public.cash_advances
    where employee_id=p_employee_id
      and lower(coalesce(status,'')) not in ('void','voided','cancelled','canceled')
      and round(coalesce(balance,coalesce(amount,0)-coalesce(amount_paid,0)),2)>0
    order by advance_date nulls last, id for update loop
    if ca.amount is null or ca.amount_paid is null or ca.balance is null
      or ca.amount_paid<0 or ca.amount_paid>ca.amount
      or round(ca.balance,2)<>round(ca.amount-ca.amount_paid,2) then
      raise exception 'Outstanding cash advance does not reconcile. Use documented reconciliation before final pay.';
    end if;
    total_ca:=total_ca+round(ca.balance,2);
  end loop;

  gross_final_pay:=round(p_last_salary+p_pro_rated_13th+p_sil_pay+p_separation_pay,2);
  if coalesce(p_settle_cash_advance,false) then
    if total_ca>0 and authorization_reference='' then
      raise exception 'Written cash-advance settlement authorization reference is required.';
    end if;
    settlement:=least(gross_final_pay,total_ca);
  end if;
  remaining:=round(total_ca-settlement,2);
  if remaining>0 and receivable_note='' then
    raise exception 'Record the former-employee receivable note and collection owner before deactivation.';
  end if;

  select coalesce(nullif(full_name,''),'Authorized owner') into actor
  from public.admin_users where auth_user_id=auth.uid() and is_active=true limit 1;
  actor:=coalesce(actor,'Authorized owner');

  insert into public.final_pay_records(
    employee_id,employee_name,employee_code,separation_reason,last_working_date,
    last_salary,pro_rated_13th,sil_pay,separation_pay,cash_advance_deduction,total_final_pay
  ) values (
    emp.id,emp.full_name,emp.employee_code,btrim(p_reason),p_last_working_date::text,
    p_last_salary,p_pro_rated_13th,p_sil_pay,p_separation_pay,settlement,round(gross_final_pay-settlement,2)
  ) returning id into final_pay_id;

  if settlement>0 then
    remaining:=settlement;
    for ca in select * from public.cash_advances
      where employee_id=p_employee_id
        and lower(coalesce(status,'')) not in ('void','voided','cancelled','canceled')
        and round(coalesce(balance,coalesce(amount,0)-coalesce(amount_paid,0)),2)>0
      order by advance_date nulls last, id for update loop
      exit when remaining<=0;
      allocation:=least(round(ca.balance,2),remaining);
      update public.cash_advances
        set amount_paid=round(amount_paid+allocation,2),
            balance=round(balance-allocation,2),
            status=case when round(balance-allocation,2)=0 then 'Paid' else 'Unpaid' end,
            installments_remaining=case when round(balance-allocation,2)=0 then 0
              when per_payroll_deduction>0 then ceil(round(balance-allocation,2)/per_payroll_deduction)::integer
              else greatest(1,coalesce(installments_remaining,1)) end
        where id=ca.id;
      insert into private.ca_final_pay_allocations(final_pay_record_id,cash_advance_id,employee_id,amount,authorization_reference)
        values(final_pay_id,ca.id,p_employee_id,allocation,authorization_reference);
      remaining:=round(remaining-allocation,2);
    end loop;
    if remaining<>0 then raise exception 'Final-pay cash-advance settlement did not reconcile.'; end if;
  end if;

  update public.employees
    set is_active=false,sil_balance=0,sick_leave_balance=0,vacation_leave_balance=0
    where id=p_employee_id;
  insert into public.audit_logs(action,performed_by,target_employee,details)
    values('FINAL PAY PROCESSED',actor,emp.full_name,
      'Final Pay ID: '||final_pay_id||' | Gross: PHP '||gross_final_pay||
      ' | CA settled: PHP '||settlement||' | Former employee receivable: PHP '||round(total_ca-settlement,2)||
      case when authorization_reference<>'' then ' | Authorization: '||authorization_reference else '' end||
      case when receivable_note<>'' then ' | Receivable note: '||receivable_note else '' end);
  return jsonb_build_object(
    'ok',true,'final_pay_record_id',final_pay_id,'gross_final_pay',gross_final_pay,
    'cash_advance_deduction',settlement,'former_employee_receivable',round(total_ca-settlement,2),
    'total_final_pay',round(gross_final_pay-settlement,2)
  );
end $$;
revoke all on function private.employee_separation_command(uuid,text,date,numeric,numeric,numeric,numeric,boolean,text,text)
  from public, anon, authenticated;
grant execute on function private.employee_separation_command(uuid,text,date,numeric,numeric,numeric,numeric,boolean,text,text)
  to authenticated;

create or replace function public.employee_separation_command(
  p_employee_id uuid,p_reason text,p_last_working_date date,p_last_salary numeric,p_pro_rated_13th numeric,
  p_sil_pay numeric,p_separation_pay numeric,p_settle_cash_advance boolean,
  p_authorization_reference text default null,p_receivable_note text default null
)
returns jsonb language sql security invoker set search_path='' as $$
  select private.employee_separation_command(
    p_employee_id,p_reason,p_last_working_date,p_last_salary,p_pro_rated_13th,p_sil_pay,p_separation_pay,
    p_settle_cash_advance,p_authorization_reference,p_receivable_note
  );
$$;
revoke all on function public.employee_separation_command(uuid,text,date,numeric,numeric,numeric,numeric,boolean,text,text)
  from public, anon;
grant execute on function public.employee_separation_command(uuid,text,date,numeric,numeric,numeric,numeric,boolean,text,text)
  to authenticated;
notify pgrst,'reload schema';
commit;
