-- Phase 2: enforce the approved role model at the database boundary.

create unique index if not exists cash_advance_requests_one_pending_per_employee_idx
  on public.cash_advance_requests (employee_id)
  where lower(coalesce(status, '')) = 'pending';

alter table public.cash_advance_requests enable row level security;
alter table public.cash_advances enable row level security;

drop policy if exists "cash advance requests owner hr read" on public.cash_advance_requests;
drop policy if exists "cash advance requests owner update" on public.cash_advance_requests;
drop policy if exists "cash advances owner payroll read" on public.cash_advances;
drop policy if exists "cash advances owner insert" on public.cash_advances;
drop policy if exists "cash advances owner payroll update" on public.cash_advances;
drop policy if exists "cash advances owner delete" on public.cash_advances;

create policy "cash advance requests owner hr read"
on public.cash_advance_requests
for select
to authenticated
using (private.cash_advance_admin_has_role(array['owner','hr']));

create policy "cash advance requests owner update"
on public.cash_advance_requests
for update
to authenticated
using (private.cash_advance_admin_has_role(array['owner']))
with check (private.cash_advance_admin_has_role(array['owner']));

create policy "cash advances owner payroll read"
on public.cash_advances
for select
to authenticated
using (private.cash_advance_admin_has_role(array['owner','payroll']));

create policy "cash advances owner insert"
on public.cash_advances
for insert
to authenticated
with check (private.cash_advance_admin_has_role(array['owner']));

create policy "cash advances owner payroll update"
on public.cash_advances
for update
to authenticated
using (private.cash_advance_admin_has_role(array['owner','payroll']))
with check (private.cash_advance_admin_has_role(array['owner','payroll']));

create policy "cash advances owner delete"
on public.cash_advances
for delete
to authenticated
using (private.cash_advance_admin_has_role(array['owner']));

revoke all on table public.cash_advance_requests from public, anon, authenticated;
revoke all on table public.cash_advances from public, anon, authenticated;

grant select, update on table public.cash_advance_requests to authenticated;
grant select, insert, update, delete on table public.cash_advances to authenticated;

-- Employee PINs must not remain readable or changeable through the public table API,
-- otherwise an attacker could impersonate an employee to obtain an own-record session.
revoke all on table public.employees from public, anon;
grant select (
  id,
  employee_code,
  full_name,
  position,
  shift_start,
  shift_end,
  is_active,
  hire_date,
  profile_photo_url,
  grace_period_minutes,
  department,
  work_location,
  location_lat,
  location_lng,
  location_radius,
  strict_camera_timein
) on public.employees to anon;

-- Temporary legacy self-service writes retained for the existing profile/SIL flows.
-- No credential, role, rate, bank, or government-ID field is writable anonymously.
grant update (
  profile_photo_url,
  sick_leave_balance,
  vacation_leave_balance,
  sil_balance
) on public.employees to anon;

-- Signed-in admin accounts may read operational employee fields, but PINs are
-- never returned by the table API. PIN changes go through the guarded RPC above.
revoke select, update, truncate, references, trigger on table public.employees from authenticated;
grant select (
  id, employee_code, full_name, position, shift_start, shift_end, daily_rate,
  is_active, created_at, is_admin, has_sss, has_pagibig, has_philhealth,
  hire_date, sick_leave_balance, vacation_leave_balance, profile_photo_url,
  pay_type, hourly_rate, grace_period_minutes, date_of_birth, gender,
  civil_status, home_address, contact_number, emergency_contact_name,
  emergency_contact_number, employment_type, department, sil_balance,
  work_location, location_lat, location_lng, location_radius, admin_role,
  extra_roles, payroll_cost_type, regular_holiday_pay_eligible,
  special_holiday_pay_eligible, payroll_basis, monthly_salary,
  semi_monthly_salary, annual_working_days, overtime_pay_eligible,
  undertime_deduction_applicable, attendance_required_for_pay,
  absence_deduction_applicable, night_differential_pay_eligible,
  bank_name, bank_account_number, bank_account_name, strict_camera_timein,
  sss_no, pagibig_no, philhealth_no, tin_no
) on public.employees to authenticated;
grant update (
  employee_code, full_name, position, shift_start, shift_end, daily_rate,
  is_active, is_admin, has_sss, has_pagibig, has_philhealth, hire_date,
  sick_leave_balance, vacation_leave_balance, profile_photo_url, pay_type,
  hourly_rate, grace_period_minutes, date_of_birth, gender, civil_status,
  home_address, contact_number, emergency_contact_name,
  emergency_contact_number, employment_type, department, sil_balance,
  work_location, location_lat, location_lng, location_radius, admin_role,
  extra_roles, payroll_cost_type, regular_holiday_pay_eligible,
  special_holiday_pay_eligible, payroll_basis, monthly_salary,
  semi_monthly_salary, annual_working_days, overtime_pay_eligible,
  undertime_deduction_applicable, attendance_required_for_pay,
  absence_deduction_applicable, night_differential_pay_eligible,
  bank_name, bank_account_number, bank_account_name, strict_camera_timein,
  sss_no, pagibig_no, philhealth_no, tin_no
) on public.employees to authenticated;

notify pgrst, 'reload schema';
