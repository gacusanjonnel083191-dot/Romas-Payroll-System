-- App(69): enforce employee OT eligibility at the database boundary.
-- Attendance-supported minutes remain calculated and revalidated by App.jsx.

create or replace function public.guard_overtime_request_employee_eligibility()
returns trigger
language plpgsql
as $$
declare
  employee_exists boolean := false;
  overtime_eligible boolean := false;
begin
  if lower(trim(coalesce(new.request_type, ''))) = 'overtime'
     and lower(trim(coalesce(new.status, 'pending'))) in ('pending', 'approved') then
    select true, coalesce(e.overtime_pay_eligible, true)
      into employee_exists, overtime_eligible
    from public.employees e
    where e.id = new.employee_id;

    if employee_exists is not true then
      raise exception using
        errcode = 'P0001',
        message = 'OT_FILING_BLOCKED_EMPLOYEE_NOT_FOUND: The current employee policy record could not be verified.';
    end if;

    if not overtime_eligible then
      raise exception using
        errcode = 'P0001',
        message = 'OT_FILING_BLOCKED_NOT_ELIGIBLE: This employee is not eligible for overtime pay.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_overtime_request_employee_eligibility
on public.time_adjustment_requests;

create trigger trg_guard_overtime_request_employee_eligibility
before insert or update of employee_id, request_type, minutes, status
on public.time_adjustment_requests
for each row
execute function public.guard_overtime_request_employee_eligibility();

comment on function public.guard_overtime_request_employee_eligibility() is
'Blocks pending or approved overtime requests when the employee record is missing or overtime_pay_eligible is false.';

notify pgrst, 'reload schema';
