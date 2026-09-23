-- Employees access only their own payslips using the existing portal session.
-- Direct payroll and dispute tables are limited to active payroll staff.

create or replace function private.employee_portal_session_employee(p_session_token uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_employee_id uuid;
begin
  select s.employee_id into v_employee_id
  from private.employee_cash_advance_sessions s
  join public.employees e on e.id = s.employee_id and e.is_active = true
  where s.token = p_session_token and s.expires_at > now();
  if v_employee_id is null then
    raise exception 'Employee session expired. Please log in again.' using errcode = '28000';
  end if;
  return v_employee_id;
end;
$$;
revoke all on function private.employee_portal_session_employee(uuid) from public, anon, authenticated;

create or replace function public.employee_payslips(p_session_token uuid)
returns setof public.payroll_records language plpgsql stable security definer set search_path = '' as $$
declare v_employee_id uuid;
begin
  v_employee_id := private.employee_portal_session_employee(p_session_token);
  return query select p.* from public.payroll_records p
    where p.employee_id = v_employee_id order by p.payroll_start desc;
end;
$$;
revoke all on function public.employee_payslips(uuid) from public;
grant execute on function public.employee_payslips(uuid) to anon, authenticated;

create or replace function public.employee_acknowledge_payslip(
  p_session_token uuid, p_payroll_record_id uuid, p_acknowledgement text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_employee_id uuid;
begin
  v_employee_id := private.employee_portal_session_employee(p_session_token);
  if p_acknowledgement not in ('agreed', 'disputed') then
    raise exception 'Invalid payslip acknowledgement.' using errcode = '22023';
  end if;
  update public.payroll_records p set employee_acknowledgement = p_acknowledgement
  where p.id = p_payroll_record_id and p.employee_id = v_employee_id
    and coalesce(p.employee_acknowledgement, 'pending') in ('pending', 'disputed');
  if not found then
    raise exception 'Payslip unavailable for acknowledgement.' using errcode = '42501';
  end if;
  return true;
end;
$$;
revoke all on function public.employee_acknowledge_payslip(uuid,uuid,text) from public;
grant execute on function public.employee_acknowledge_payslip(uuid,uuid,text) to anon, authenticated;

create or replace function public.employee_submit_payslip_dispute(
  p_session_token uuid, p_payroll_record_id uuid, p_reason text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_employee_id uuid; v_pay public.payroll_records%rowtype; v_employee public.employees%rowtype;
begin
  v_employee_id := private.employee_portal_session_employee(p_session_token);
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Dispute reason is required.' using errcode = '22023';
  end if;
  select * into v_pay from public.payroll_records
    where id = p_payroll_record_id and employee_id = v_employee_id;
  if v_pay.id is null or coalesce(v_pay.employee_acknowledgement, 'pending') not in ('pending','disputed') then
    raise exception 'Payslip unavailable for dispute.' using errcode = '42501';
  end if;
  select * into v_employee from public.employees where id = v_employee_id;
  if not exists (
    select 1 from public.payslip_disputes d
    where d.payroll_record_id = p_payroll_record_id::text
      and d.employee_id = v_employee_id and d.status = 'pending'
  ) then
    insert into public.payslip_disputes
      (employee_id, employee_code, employee_name, payroll_record_id, payroll_start, payroll_end, reason, status)
    values
      (v_employee_id, v_employee.employee_code, v_employee.full_name,
       p_payroll_record_id::text, v_pay.payroll_start::text, v_pay.payroll_end::text,
       btrim(p_reason), 'pending');
  end if;
  update public.payroll_records set employee_acknowledgement = 'disputed'
    where id = p_payroll_record_id;
  return true;
end;
$$;
revoke all on function public.employee_submit_payslip_dispute(uuid,uuid,text) from public;
grant execute on function public.employee_submit_payslip_dispute(uuid,uuid,text) to anon, authenticated;

drop policy if exists payroll_records_portal_read on public.payroll_records;
drop policy if exists payroll_records_portal_ack_update on public.payroll_records;
create policy payroll_records_staff_read on public.payroll_records
  for select to authenticated using
  (private.cash_advance_admin_has_role(array['owner','payroll','hr','manager','admin','pos_admin']));
revoke all on public.payroll_records from anon;

alter table public.payslip_disputes enable row level security;
create policy payslip_disputes_staff_access on public.payslip_disputes
  for all to authenticated
  using (private.cash_advance_admin_has_role(array['owner','payroll','hr']))
  with check (private.cash_advance_admin_has_role(array['owner','payroll','hr']));
revoke all on public.payslip_disputes from anon;

-- Keep non-pay document records available in the Documents Center, while
-- pay and COE records remain visible only to authorized payroll/HR staff.
alter table public.company_document_records enable row level security;
create policy company_documents_staff_read on public.company_document_records
  for select to authenticated using (
    private.cash_advance_admin_has_role(array['owner','manager','hr','payroll','admin','pos_admin','supervisor'])
    and (
      coalesce(form_key,'') not like 'PAY-%'
      and coalesce(form_key,'') not in ('HR-COE','FIN-CHARGE-SLIP')
      or private.cash_advance_admin_has_role(array['owner','manager','hr','payroll','admin','pos_admin'])
    )
  );
create policy company_documents_staff_insert on public.company_document_records
  for insert to authenticated with check (
    private.cash_advance_admin_has_role(array['owner','manager','hr','payroll','admin','pos_admin','supervisor'])
    and (
      (coalesce(form_key,'') not like 'PAY-%'
       and coalesce(form_key,'') not in ('HR-COE','FIN-CHARGE-SLIP'))
      or private.cash_advance_admin_has_role(array['owner','manager','hr','payroll','admin','pos_admin'])
    )
  );
create policy company_documents_staff_update on public.company_document_records
  for update to authenticated using (
    private.cash_advance_admin_has_role(array['owner','manager','hr','payroll','admin','pos_admin','supervisor'])
    and (
      (coalesce(form_key,'') not like 'PAY-%'
       and coalesce(form_key,'') not in ('HR-COE','FIN-CHARGE-SLIP'))
      or private.cash_advance_admin_has_role(array['owner','manager','hr','payroll','admin','pos_admin'])
    )
  ) with check (
    private.cash_advance_admin_has_role(array['owner','manager','hr','payroll','admin','pos_admin','supervisor'])
    and (
      (coalesce(form_key,'') not like 'PAY-%'
       and coalesce(form_key,'') not in ('HR-COE','FIN-CHARGE-SLIP'))
      or private.cash_advance_admin_has_role(array['owner','manager','hr','payroll','admin','pos_admin'])
    )
  );
revoke all on public.company_document_records from anon;

notify pgrst, 'reload schema';
