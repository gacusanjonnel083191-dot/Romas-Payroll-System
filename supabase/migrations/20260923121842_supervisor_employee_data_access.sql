-- Keep operational rosters available to supervisors without exposing existing
-- employees' personal, compensation, banking, or government ID fields.
-- The views deliberately bypass the base tables' RLS and expose only the
-- explicit columns below. Full fields require an active privileged admin role.

create or replace view public.employee_access with (security_barrier = true) as
with access as (
  select private.cash_advance_admin_has_role(
    array['owner','manager','hr','payroll','admin','pos_admin']::text[]
  ) as full_access,
  (select auth.uid()) is not null as signed_in
)
select
  e.id, e.employee_code, e.full_name, e.position, e.shift_start, e.shift_end,
  case when access.full_access then e.daily_rate end as daily_rate,
  e.is_active,
  case when access.full_access then e.created_at end as created_at,
  case when access.full_access then e.is_admin end as is_admin,
  case when access.full_access then e.has_sss end as has_sss,
  case when access.full_access then e.has_pagibig end as has_pagibig,
  case when access.full_access then e.has_philhealth end as has_philhealth,
  e.hire_date,
  case when access.signed_in then e.sick_leave_balance end as sick_leave_balance,
  case when access.signed_in then e.vacation_leave_balance end as vacation_leave_balance,
  e.profile_photo_url,
  case when access.full_access then e.pay_type end as pay_type,
  case when access.full_access then e.hourly_rate end as hourly_rate,
  e.grace_period_minutes,
  case when access.full_access then e.date_of_birth end as date_of_birth,
  case when access.full_access then e.gender end as gender,
  case when access.full_access then e.civil_status end as civil_status,
  case when access.full_access then e.home_address end as home_address,
  case when access.full_access then e.contact_number end as contact_number,
  case when access.full_access then e.emergency_contact_name end as emergency_contact_name,
  case when access.full_access then e.emergency_contact_number end as emergency_contact_number,
  case when access.signed_in then e.employment_type end as employment_type,
  e.department,
  case when access.signed_in then e.sil_balance end as sil_balance,
  e.work_location, e.location_lat, e.location_lng, e.location_radius,
  case when access.full_access then e.admin_role end as admin_role,
  case when access.full_access then e.extra_roles end as extra_roles,
  case when access.full_access then e.payroll_cost_type end as payroll_cost_type,
  case when access.signed_in then e.regular_holiday_pay_eligible end as regular_holiday_pay_eligible,
  case when access.signed_in then e.special_holiday_pay_eligible end as special_holiday_pay_eligible,
  case when access.full_access then e.payroll_basis end as payroll_basis,
  case when access.full_access then e.monthly_salary end as monthly_salary,
  case when access.full_access then e.semi_monthly_salary end as semi_monthly_salary,
  case when access.full_access then e.annual_working_days end as annual_working_days,
  case when access.signed_in then e.overtime_pay_eligible end as overtime_pay_eligible,
  case when access.signed_in then e.undertime_deduction_applicable end as undertime_deduction_applicable,
  case when access.signed_in then e.attendance_required_for_pay end as attendance_required_for_pay,
  case when access.signed_in then e.absence_deduction_applicable end as absence_deduction_applicable,
  case when access.signed_in then e.night_differential_pay_eligible end as night_differential_pay_eligible,
  case when access.full_access then e.bank_name end as bank_name,
  case when access.full_access then e.bank_account_number end as bank_account_number,
  case when access.full_access then e.bank_account_name end as bank_account_name,
  e.strict_camera_timein,
  case when access.full_access then e.sss_no end as sss_no,
  case when access.full_access then e.pagibig_no end as pagibig_no,
  case when access.full_access then e.philhealth_no end as philhealth_no,
  case when access.full_access then e.tin_no end as tin_no
from public.employees e cross join access;

create or replace view public.employee_contract_access with (security_barrier = true) as
with access as (
  select private.cash_advance_admin_has_role(
    array['owner','manager','hr','payroll','admin','pos_admin']::text[]
  ) as full_access
)
select c.id, c.employee_id, c.employee_code, c.employee_name, c.contract_type,
  c.start_date, c.end_date, c.status,
  case when access.full_access then c.file_url end as file_url,
  case when access.full_access then c.file_name end as file_name,
  c.storage_type,
  case when access.full_access then c.physical_location end as physical_location,
  c.created_at
from public.employee_contracts c cross join access;

revoke all on public.employee_access, public.employee_contract_access from public, anon, authenticated;
grant select on public.employee_access to anon, authenticated;
grant select on public.employee_contract_access to authenticated;

-- Column grants protect direct Data API queries even when the caller bypasses
-- the application screen. The access views provide full rows to privileged roles.
revoke select on public.employees from authenticated;
revoke select (
  daily_rate, created_at, is_admin, has_sss, has_pagibig, has_philhealth,
  sick_leave_balance, vacation_leave_balance, pay_type, hourly_rate,
  date_of_birth, gender, civil_status, home_address, contact_number,
  emergency_contact_name, emergency_contact_number, employment_type,
  sil_balance, admin_role, extra_roles, payroll_cost_type,
  regular_holiday_pay_eligible, special_holiday_pay_eligible, payroll_basis,
  monthly_salary, semi_monthly_salary, annual_working_days,
  overtime_pay_eligible, undertime_deduction_applicable,
  attendance_required_for_pay, absence_deduction_applicable,
  night_differential_pay_eligible, bank_name, bank_account_number,
  bank_account_name, sss_no, pagibig_no, philhealth_no, tin_no
) on public.employees from authenticated;
grant select (
  id, employee_code, full_name, position, shift_start, shift_end,
  is_active, hire_date, profile_photo_url, grace_period_minutes,
  department, work_location, location_lat, location_lng,
  location_radius, strict_camera_timein
) on public.employees to authenticated;

revoke all on public.employee_contracts from anon;
revoke truncate, references, trigger on public.employee_contracts from authenticated;
revoke select on public.employee_contracts from authenticated;
revoke select (file_url, file_name, physical_location)
  on public.employee_contracts from authenticated;
grant select (
  id, employee_id, employee_code, employee_name, contract_type,
  start_date, end_date, status, storage_type, created_at
) on public.employee_contracts to authenticated;

alter table public.employee_contracts enable row level security;
drop policy if exists employee_contracts_admin_read on public.employee_contracts;
drop policy if exists employee_contracts_admin_insert on public.employee_contracts;
drop policy if exists employee_contracts_admin_update on public.employee_contracts;
drop policy if exists employee_contracts_admin_delete on public.employee_contracts;
create policy employee_contracts_admin_read on public.employee_contracts
  for select to authenticated using (private.cash_advance_admin_has_role(
    array['owner','manager','hr','payroll','admin','pos_admin','supervisor','asst_supervisor']::text[]
  ));
create policy employee_contracts_admin_insert on public.employee_contracts
  for insert to authenticated with check (private.cash_advance_admin_has_role(
    array['owner','manager','hr','payroll','admin','pos_admin','supervisor','asst_supervisor']::text[]
  ));
create policy employee_contracts_admin_update on public.employee_contracts
  for update to authenticated using (private.cash_advance_admin_has_role(
    array['owner','manager','hr','payroll','admin','pos_admin','supervisor','asst_supervisor']::text[]
  )) with check (private.cash_advance_admin_has_role(
    array['owner','manager','hr','payroll','admin','pos_admin','supervisor','asst_supervisor']::text[]
  ));
create policy employee_contracts_admin_delete on public.employee_contracts
  for delete to authenticated using (private.cash_advance_admin_has_role(
    array['owner','manager','hr','payroll','admin','pos_admin']::text[]
  ));

create or replace function private.guard_supervisor_contract_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null
     or private.cash_advance_admin_has_role(
       array['owner','manager','hr','payroll','admin','pos_admin']::text[]
     ) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if not private.cash_advance_admin_has_role(
    array['supervisor','asst_supervisor']::text[]
  ) then
    raise exception 'An active admin role is required to change contracts.';
  end if;
  if tg_op = 'INSERT' then return new; end if;
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
    return new;
  end if;
  raise exception 'Supervisors may only change contract status.';
end;
$$;
revoke all on function private.guard_supervisor_contract_write() from public, anon, authenticated;
drop trigger if exists guard_supervisor_contract_write on public.employee_contracts;
create trigger guard_supervisor_contract_write
before insert or update or delete on public.employee_contracts
for each row execute function private.guard_supervisor_contract_write();

-- Existing public URLs stop working once the bucket is private. The app
-- resolves a stored file name to a short-lived signed URL for allowed staff.
update storage.buckets set public = false where id = 'Contracts';
drop policy if exists "Contracts bucket policy" on storage.objects;
drop policy if exists contracts_privileged_read on storage.objects;
drop policy if exists contracts_staff_insert on storage.objects;
drop policy if exists contracts_privileged_update on storage.objects;
drop policy if exists contracts_privileged_delete on storage.objects;
create policy contracts_privileged_read on storage.objects
  for select to authenticated using (
    bucket_id = 'Contracts' and private.cash_advance_admin_has_role(
      array['owner','manager','hr','payroll','admin','pos_admin']::text[]
    )
  );
create policy contracts_staff_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'Contracts' and private.cash_advance_admin_has_role(
      array['owner','manager','hr','payroll','admin','pos_admin','supervisor','asst_supervisor']::text[]
    )
  );
create policy contracts_privileged_update on storage.objects
  for update to authenticated using (
    bucket_id = 'Contracts' and private.cash_advance_admin_has_role(
      array['owner','manager','hr','payroll','admin','pos_admin']::text[]
    )
  ) with check (
    bucket_id = 'Contracts' and private.cash_advance_admin_has_role(
      array['owner','manager','hr','payroll','admin','pos_admin']::text[]
    )
  );
create policy contracts_privileged_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'Contracts' and private.cash_advance_admin_has_role(
      array['owner','manager','hr','payroll','admin','pos_admin']::text[]
    )
  );

alter table public.employees enable row level security;
drop policy if exists employees_roster_anon_read on public.employees;
drop policy if exists employees_roster_authenticated_read on public.employees;
drop policy if exists employees_legacy_anon_profile_update on public.employees;
drop policy if exists employees_authenticated_insert on public.employees;
drop policy if exists employees_authenticated_update on public.employees;
drop policy if exists employees_authenticated_delete on public.employees;
create policy employees_roster_anon_read on public.employees
  for select to anon using (true);
create policy employees_roster_authenticated_read on public.employees
  for select to authenticated using (true);
create policy employees_legacy_anon_profile_update on public.employees
  for update to anon using (true) with check (true);
create policy employees_authenticated_insert on public.employees
  for insert to authenticated with check (true);
create policy employees_authenticated_update on public.employees
  for update to authenticated using (true) with check (true);
create policy employees_authenticated_delete on public.employees
  for delete to authenticated using (true);

create or replace function private.guard_supervisor_employee_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare allowed_fields text[] := array[
  'sil_balance','sick_leave_balance','vacation_leave_balance',
  'employment_type','work_location','location_lat','location_lng',
  'location_radius','profile_photo_url'
];
begin
  if (select auth.uid()) is null
     or private.cash_advance_admin_has_role(
       array['owner','manager','hr','payroll','admin','pos_admin']::text[]
     ) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if not private.cash_advance_admin_has_role(
    array['supervisor','asst_supervisor']::text[]
  ) then
    raise exception 'An active admin role is required to change employee records.';
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.admin_role,'') <> '' or coalesce(new.extra_roles,'') <> ''
       or coalesce(new.is_admin,false) then
      raise exception 'Supervisors cannot grant admin roles when adding employees.';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - allowed_fields) is distinct from
       (to_jsonb(old) - allowed_fields) then
      raise exception 'Supervisors can update operational HR fields only.';
    end if;
    return new;
  end if;
  raise exception 'Supervisors cannot delete employee records.';
end;
$$;
revoke all on function private.guard_supervisor_employee_write() from public, anon, authenticated;
drop trigger if exists guard_supervisor_employee_write on public.employees;
create trigger guard_supervisor_employee_write
before insert or update or delete on public.employees
for each row execute function private.guard_supervisor_employee_write();

notify pgrst, 'reload schema';
