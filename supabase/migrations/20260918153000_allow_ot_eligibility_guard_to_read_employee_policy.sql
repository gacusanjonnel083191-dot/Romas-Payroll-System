-- Employee portal requests must be able to verify OT eligibility without
-- exposing the private employees table to the portal database role.
-- The existing trigger only reads the employee identified by NEW.employee_id
-- and continues to reject missing or OT-ineligible employee records.
alter function public.guard_overtime_request_employee_eligibility()
  security definer;

-- The function qualifies its employees table reference with public. Keep
-- caller-controlled schemas out of its lookup path.
alter function public.guard_overtime_request_employee_eligibility()
  set search_path = pg_catalog, pg_temp;

-- This is a trigger function, not a callable portal API. Existing triggers
-- continue to execute it; portal roles must not execute it directly.
revoke execute on function public.guard_overtime_request_employee_eligibility()
  from public, anon, authenticated;
