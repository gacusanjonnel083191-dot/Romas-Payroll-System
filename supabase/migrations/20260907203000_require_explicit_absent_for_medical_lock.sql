-- Count only attendance rows explicitly marked Absent toward the
-- two-consecutive-workday medical-certificate lock. A schedule with no
-- attendance row is "No record yet" and must not be treated as an absence.

create or replace function private.employee_medical_lock(
  p_employee_id uuid,
  p_reference_date date default ((now() at time zone 'Asia/Manila')::date)
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
with params as (
  select
    p_employee_id as employee_id,
    greatest(coalesce(p_reference_date, (now() at time zone 'Asia/Manila')::date), date '2026-08-16') as reference_date,
    date '2026-08-16' as effective_date
),
work_dates as (
  select ds.schedule_date as work_date
  from public.daily_schedules ds, params p
  where ds.employee_id = p.employee_id
    and ds.schedule_date >= p.effective_date
    and ds.schedule_date < p.reference_date
  union
  select al.attendance_date as work_date
  from public.attendance_logs al, params p
  where al.employee_id = p.employee_id
    and al.attendance_date >= p.effective_date
    and al.attendance_date < p.reference_date
),
facts as (
  select
    wd.work_date,
    exists (
      select 1
      from public.attendance_logs al, params p
      where al.employee_id = p.employee_id
        and al.attendance_date = wd.work_date
        and lower(trim(coalesce(al.status, ''))) = 'absent'
    ) as explicitly_absent,
    exists (
      select 1
      from public.leave_requests lr, params p
      where lr.employee_id = p.employee_id
        and lower(trim(coalesce(lr.status, ''))) = 'approved'
        and coalesce(lr.leave_start, lr.leave_date) <= wd.work_date
        and coalesce(lr.leave_end, lr.leave_start, lr.leave_date) >= wd.work_date
    ) as approved_leave
  from work_dates wd
),
classified as (
  select
    work_date,
    (explicitly_absent and not approved_leave) as is_absent
  from facts
),
sequenced as (
  select
    work_date,
    is_absent,
    lag(work_date) over (order by work_date) as previous_work_date,
    lag(is_absent) over (order by work_date) as previous_is_absent
  from classified
),
uncovered_pairs as (
  select
    s.previous_work_date as absence_start,
    s.work_date as absence_end
  from sequenced s, params p
  where s.is_absent
    and s.previous_is_absent
    and not exists (
      select 1
      from public.employee_medical_certificates c
      where c.employee_id = p.employee_id
        and c.absence_start <= s.previous_work_date
        and coalesce(c.absence_end, c.absence_start) >= s.work_date
        and lower(trim(coalesce(c.status, 'uploaded'))) not in ('rejected','void','voided','cancelled','deleted')
    )
  order by s.work_date desc
  limit 1
),
result as (
  select absence_start, absence_end from uncovered_pairs
)
select case
  when exists (select 1 from result) then (
    select jsonb_build_object(
      'locked', true,
      'absenceStart', absence_start,
      'absenceEnd', absence_end,
      'absentDays', 2,
      'message', 'Time In locked. Medical certificate required for 2 consecutive explicitly marked workday absences (' ||
        to_char(absence_start, 'Mon DD, YYYY') || ' - ' || to_char(absence_end, 'Mon DD, YYYY') || ').'
    ) from result
  )
  else jsonb_build_object(
    'locked', false,
    'absenceStart', '',
    'absenceEnd', '',
    'absentDays', 0,
    'message', ''
  )
end;
$function$;

revoke all on function private.employee_medical_lock(uuid, date) from public, anon, authenticated;

notify pgrst, 'reload schema';
