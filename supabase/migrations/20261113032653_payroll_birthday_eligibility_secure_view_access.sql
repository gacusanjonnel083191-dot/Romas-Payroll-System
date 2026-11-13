-- Payroll-only permission repair: expose the already-stored eligibility flag
-- through the existing role-masked employee_access view. No direct employees
-- table grants, RLS changes, payroll data edits, or pay formula changes.
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
  case when access.full_access then e.tin_no end as tin_no,
  case when access.full_access then e.birthday_pay_eligible end as birthday_pay_eligible
from public.employees e cross join access;


notify pgrst, 'reload schema';
