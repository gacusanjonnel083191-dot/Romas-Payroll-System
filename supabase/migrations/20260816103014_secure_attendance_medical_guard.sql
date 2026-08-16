-- Secure and enforce the two-consecutive-scheduled-absence medical certificate rule.
-- The 2026-08-16 effective date avoids retroactively locking employees for legacy records.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.employee_medical_certificates
  add column if not exists file_path text;

update public.employee_medical_certificates
set file_path = file_name
where nullif(file_path, '') is null
  and nullif(file_name, '') is not null;

update public.employee_medical_certificates
set file_url = null
where file_url is not null;

alter table public.employee_medical_certificates enable row level security;
revoke all on table public.employee_medical_certificates from anon, authenticated;

drop policy if exists "Allow medical certificate reads" on storage.objects;
drop policy if exists "Allow medical certificate uploads" on storage.objects;

update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp']::text[]
where id = 'medical-certificates';

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
      select 1 from public.daily_schedules ds, params p
      where ds.employee_id = p.employee_id and ds.schedule_date = wd.work_date
    ) as has_schedule,
    exists (
      select 1 from public.attendance_logs al, params p
      where al.employee_id = p.employee_id
        and al.attendance_date = wd.work_date
        and lower(trim(coalesce(al.status, ''))) = 'absent'
    ) as explicitly_absent,
    exists (
      select 1 from public.attendance_logs al, params p
      where al.employee_id = p.employee_id
        and al.attendance_date = wd.work_date
        and al.time_in is not null
        and lower(trim(coalesce(al.status, ''))) <> 'absent'
    ) as has_valid_time_in,
    exists (
      select 1 from public.leave_requests lr, params p
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
    (not approved_leave and (explicitly_absent or (has_schedule and not has_valid_time_in))) as is_absent
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
      'message', 'Time In locked. Medical certificate required for 2 consecutive scheduled workday absences (' ||
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

create or replace function public.employee_medical_lock_secure(
  p_employee_id uuid,
  p_reference_date date default ((now() at time zone 'Asia/Manila')::date)
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select private.employee_medical_lock(p_employee_id, p_reference_date);
$function$;

revoke all on function public.employee_medical_lock_secure(uuid, date) from public, anon, authenticated;
grant execute on function public.employee_medical_lock_secure(uuid, date) to service_role;

create or replace function private.enforce_medical_certificate_time_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  lock_result jsonb;
begin
  if new.time_in is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.time_in is not null then
    return new;
  end if;

  if new.employee_id is null or new.attendance_date < date '2026-08-16' then
    return new;
  end if;

  lock_result := private.employee_medical_lock(new.employee_id, new.attendance_date);
  if coalesce((lock_result ->> 'locked')::boolean, false) then
    raise exception using
      errcode = 'P0001',
      message = 'MEDICAL_CERTIFICATE_REQUIRED',
      detail = coalesce(lock_result ->> 'message', 'Upload a medical certificate before Time In.');
  end if;

  return new;
end;
$function$;

revoke all on function private.enforce_medical_certificate_time_in() from public, anon, authenticated;

drop trigger if exists trg_enforce_medical_certificate_time_in_insert on public.attendance_logs;
create trigger trg_enforce_medical_certificate_time_in_insert
before insert on public.attendance_logs
for each row
execute function private.enforce_medical_certificate_time_in();

drop trigger if exists trg_enforce_medical_certificate_time_in_update on public.attendance_logs;
create trigger trg_enforce_medical_certificate_time_in_update
before update of time_in on public.attendance_logs
for each row
execute function private.enforce_medical_certificate_time_in();

create index if not exists idx_employee_medical_certificates_absence_range
  on public.employee_medical_certificates (employee_id, absence_start, absence_end);

notify pgrst, 'reload schema';
