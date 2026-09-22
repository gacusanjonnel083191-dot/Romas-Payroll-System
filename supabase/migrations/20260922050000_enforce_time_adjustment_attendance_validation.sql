-- Enforce employee filing against authoritative attendance at the database boundary.
-- Scope: NEW OT and No Meal Break requests only. Existing requests and admin review
-- updates remain untouched.

create or replace function public.guard_time_adjustment_filing_attendance()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_request_type text := lower(trim(coalesce(new.request_type, '')));
  v_status text := lower(trim(coalesce(new.status, 'pending')));
  v_attendance_date date;
  v_completed_count integer := 0;
  v_incomplete_count integer := 0;
  v_raw_span_minutes integer := 0;
  v_current_start integer := null;
  v_current_end integer := null;
  v_recorded_break_minutes integer := 0;
  v_log_break_minutes integer := 0;
  v_break_row_count integer := 0;
  v_fallback_key text;
  v_seen_fallback_keys text[] := array[]::text[];
  v_approved_break_override integer := null;
  v_deducted_break_minutes integer := 0;
  v_paid_worked_minutes integer := 0;
  v_raw_overtime_minutes integer := 0;
  v_payable_overtime_minutes integer := 0;
  r record;
begin
  if tg_op <> 'INSERT'
     or v_request_type not in ('overtime', 'meal_break')
     or v_status not in ('pending', 'approved') then
    return new;
  end if;

  if new.employee_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'TIME_ADJUSTMENT_FILING_BLOCKED_EMPLOYEE_REQUIRED: Employee identity is required before filing.';
  end if;

  begin
    v_attendance_date := new.attendance_date::date;
  exception
    when others then
      raise exception using
        errcode = 'P0001',
        message = 'TIME_ADJUSTMENT_FILING_BLOCKED_INVALID_DATE: A valid attendance date is required before filing.';
  end;

  select
    count(*) filter (
      where lower(trim(coalesce(al.status, ''))) <> 'absent'
        and al.time_in is not null
        and al.time_out is not null
    ),
    count(*) filter (
      where lower(trim(coalesce(al.status, ''))) <> 'absent'
        and (al.time_in is null or al.time_out is null)
    )
  into v_completed_count, v_incomplete_count
  from public.attendance_logs al
  where al.employee_id = new.employee_id
    and al.attendance_date = v_attendance_date;

  if v_incomplete_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'TIME_ADJUSTMENT_FILING_BLOCKED_INCOMPLETE_ATTENDANCE: Complete Time In and Time Out first, or correct the DTR before filing OT or No Meal Break.';
  end if;

  if v_completed_count <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'TIME_ADJUSTMENT_FILING_BLOCKED_NO_COMPLETED_ATTENDANCE: A completed, non-absent Time In and Time Out record is required before filing OT or No Meal Break.';
  end if;

  for r in
    select
      (extract(hour from al.time_in)::integer * 60 + extract(minute from al.time_in)::integer) as start_minute,
      (
        extract(hour from al.time_out)::integer * 60
        + extract(minute from al.time_out)::integer
        + case when al.time_out < al.time_in then 1440 else 0 end
      ) as end_minute
    from public.attendance_logs al
    where al.employee_id = new.employee_id
      and al.attendance_date = v_attendance_date
      and lower(trim(coalesce(al.status, ''))) <> 'absent'
      and al.time_in is not null
      and al.time_out is not null
    order by start_minute, end_minute
  loop
    if r.end_minute <= r.start_minute then
      continue;
    end if;

    if v_current_start is null then
      v_current_start := r.start_minute;
      v_current_end := r.end_minute;
    elsif r.start_minute <= v_current_end then
      v_current_end := greatest(v_current_end, r.end_minute);
    else
      v_raw_span_minutes := v_raw_span_minutes + (v_current_end - v_current_start);
      v_current_start := r.start_minute;
      v_current_end := r.end_minute;
    end if;
  end loop;

  if v_current_start is not null then
    v_raw_span_minutes := v_raw_span_minutes + (v_current_end - v_current_start);
  end if;

  if v_raw_span_minutes < 5 then
    raise exception using
      errcode = 'P0001',
      message = 'TIME_ADJUSTMENT_FILING_BLOCKED_INVALID_SHORT_PUNCH: Attendance duration is below 5 minutes and requires DTR correction before filing.';
  end if;

  for r in
    select al.id, al.time_in, al.time_out, greatest(coalesce(al.total_break_minutes, 0), 0)::integer as saved_break_minutes
    from public.attendance_logs al
    where al.employee_id = new.employee_id
      and al.attendance_date = v_attendance_date
      and lower(trim(coalesce(al.status, ''))) <> 'absent'
      and al.time_in is not null
      and al.time_out is not null
    order by al.created_at asc nulls last, al.id
  loop
    select
      count(*),
      coalesce(sum(
        case
          when greatest(coalesce(bl.break_minutes, 0), 0) > 0 then greatest(coalesce(bl.break_minutes, 0), 0)
          when bl.break_out is not null and bl.break_in is not null then
            (
              extract(hour from bl.break_in)::integer * 60
              + extract(minute from bl.break_in)::integer
              + case when bl.break_in < bl.break_out then 1440 else 0 end
              - (extract(hour from bl.break_out)::integer * 60 + extract(minute from bl.break_out)::integer)
            )
          else 0
        end
      ), 0)::integer
    into v_break_row_count, v_log_break_minutes
    from public.break_logs bl
    where bl.attendance_log_id = r.id::text;

    if r.saved_break_minutes > 0 then
      v_log_break_minutes := r.saved_break_minutes;
    end if;

    if v_break_row_count > 0 then
      v_recorded_break_minutes := v_recorded_break_minutes + greatest(v_log_break_minutes, 0);
    else
      v_fallback_key := coalesce(r.time_in::text, '') || '|' || coalesce(r.time_out::text, '') || '|' || greatest(v_log_break_minutes, 0)::text;
      if not (v_fallback_key = any(v_seen_fallback_keys)) then
        v_seen_fallback_keys := array_append(v_seen_fallback_keys, v_fallback_key);
        v_recorded_break_minutes := v_recorded_break_minutes + greatest(v_log_break_minutes, 0);
      end if;
    end if;
  end loop;

  select least(60, greatest(0, round(al.approved_unpaid_break_minutes)::integer))
  into v_approved_break_override
  from public.attendance_logs al
  where al.employee_id = new.employee_id
    and al.attendance_date = v_attendance_date
    and lower(trim(coalesce(al.status, ''))) <> 'absent'
    and al.time_in is not null
    and al.time_out is not null
    and coalesce(al.meal_break_exception_approved, false) = true
    and al.approved_unpaid_break_minutes is not null
    and al.approved_unpaid_break_minutes >= 0
  order by al.created_at asc nulls last, al.id
  limit 1;

  v_deducted_break_minutes := least(
    v_raw_span_minutes,
    case
      when v_approved_break_override is not null then v_approved_break_override
      else greatest(60, v_recorded_break_minutes)
    end
  );
  v_paid_worked_minutes := greatest(0, v_raw_span_minutes - v_deducted_break_minutes);

  if v_request_type = 'meal_break' then
    if coalesce(new.minutes, 0) <> 0 then
      raise exception using
        errcode = 'P0001',
        message = 'NO_MEAL_BREAK_FILING_BLOCKED_INVALID_MINUTES: No Meal Break requests must file 0 adjustment minutes and wait for admin validation.';
    end if;
    return new;
  end if;

  v_raw_overtime_minutes := greatest(0, v_paid_worked_minutes - 480);
  v_payable_overtime_minutes := floor(v_raw_overtime_minutes::numeric / 30)::integer * 30;

  if v_payable_overtime_minutes <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'OT_FILING_BLOCKED_NO_PAYABLE_ATTENDANCE: Actual completed attendance does not support payable overtime for this date.';
  end if;

  if coalesce(new.minutes, 0) <> v_payable_overtime_minutes then
    raise exception using
      errcode = 'P0001',
      message = format(
        'OT_FILING_BLOCKED_MINUTES_MISMATCH: Actual attendance supports exactly %s payable OT minute(s) in completed 30-minute blocks.',
        v_payable_overtime_minutes
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_time_adjustment_filing_attendance
on public.time_adjustment_requests;

create trigger trg_guard_time_adjustment_filing_attendance
before insert
on public.time_adjustment_requests
for each row
execute function public.guard_time_adjustment_filing_attendance();

comment on function public.guard_time_adjustment_filing_attendance() is
'Insert-only filing guard: requires complete non-absent attendance for OT and No Meal Break, rejects invalid short punches, and requires OT minutes to equal attendance-supported completed 30-minute blocks. Admin review updates and historical records are intentionally unaffected.';

notify pgrst, 'reload schema';
