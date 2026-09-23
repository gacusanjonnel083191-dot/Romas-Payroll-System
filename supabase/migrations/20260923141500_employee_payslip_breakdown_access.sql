-- Preserve the employee portal's legacy payslip breakdowns without granting
-- direct access to companywide payroll adjustment rows.
create or replace function public.employee_payslip_adjustments(
  p_session_token uuid, p_start date, p_end date
)
returns setof public.payroll_adjustments
language plpgsql stable security definer set search_path = '' as $$
declare v_employee_id uuid;
begin
  v_employee_id := private.employee_portal_session_employee(p_session_token);
  return query select a.* from public.payroll_adjustments a
    where a.employee_id = v_employee_id
      and a.adjustment_date between p_start and p_end
    order by a.adjustment_date;
end;
$$;
revoke all on function public.employee_payslip_adjustments(uuid,date,date) from public;
grant execute on function public.employee_payslip_adjustments(uuid,date,date) to anon, authenticated;
notify pgrst, 'reload schema';
