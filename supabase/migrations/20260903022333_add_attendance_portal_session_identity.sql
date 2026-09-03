-- Allow the attendance Edge Function to verify the employee through the
-- existing short-lived employee portal session without exposing employee PINs.

create or replace function public.employee_attendance_session_identity(
  p_session_token uuid,
  p_employee_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'id', e.id,
    'employee_code', e.employee_code,
    'full_name', e.full_name,
    'is_active', e.is_active
  )
  from private.employee_cash_advance_sessions s
  join public.employees e on e.id = s.employee_id
  where s.token = p_session_token
    and s.expires_at > now()
    and e.id = p_employee_id
    and e.is_active = true
  limit 1;
$function$;

revoke all on function public.employee_attendance_session_identity(uuid, uuid) from public, anon, authenticated;
grant execute on function public.employee_attendance_session_identity(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
