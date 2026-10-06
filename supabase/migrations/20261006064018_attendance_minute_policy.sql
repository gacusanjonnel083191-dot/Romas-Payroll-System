begin;
CREATE OR REPLACE FUNCTION public.normalize_attendance_ot_ut_policy_minutes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if greatest(coalesce(new.overtime_minutes, 0), 0) = 0 then
    new.overtime_minutes := 0;
  else
    new.overtime_minutes := case when new.attendance_date::date >= date '2026-10-06' then greatest(coalesce(new.overtime_minutes, 0), 0) else floor(greatest(coalesce(new.overtime_minutes, 0), 0)::numeric / 30) * 30 end;
  end if;

  if greatest(coalesce(new.undertime_minutes, 0), 0) = 0 then
    new.undertime_minutes := 0;
  else
    new.undertime_minutes := ceil(greatest(coalesce(new.undertime_minutes, 0), 0)::numeric / 30) * 30;
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.normalize_time_adjustment_policy_minutes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  normalized_minutes integer;
begin
  if lower(coalesce(new.request_type, '')) = 'overtime' then
    normalized_minutes := case when new.attendance_date::date >= date '2026-10-06' then greatest(coalesce(new.minutes, 0), 0) else floor(greatest(coalesce(new.minutes, 0), 0)::numeric / 30) * 30 end;
    new.minutes := normalized_minutes;
  elsif lower(coalesce(new.request_type, '')) = 'undertime' then
    if greatest(coalesce(new.minutes, 0), 0) = 0 then
      new.minutes := 0;
    else
      normalized_minutes := ceil(greatest(coalesce(new.minutes, 0), 0)::numeric / 30) * 30;
      new.minutes := normalized_minutes;
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_time_adjustment_to_next_cutoff(p_request_id bigint, p_source_attendance_date date, p_target_adjustment_date date, p_verified_minutes integer, p_adjustment_type text, p_adjustment_category text, p_adjustment_amount numeric, p_hourly_rate numeric, p_multiplier numeric, p_reviewer text, p_review_note text, p_attendance_log_id uuid, p_late_minutes integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_request public.time_adjustment_requests%rowtype;
  v_source_payroll public.payroll_records%rowtype;
  v_adjustment_id uuid;
  v_request_type text;
  v_adjustment_type text := lower(trim(coalesce(p_adjustment_type, '')));
  v_amount numeric := round(greatest(coalesce(p_adjustment_amount, 0), 0), 2);
  v_reviewed_at timestamptz := now();
  v_reviewer text;
  v_notification_title text;
  v_notification_message text;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'ADMIN_AUTH_REQUIRED: Sign in with an authorized Owner or Payroll account.';
  end if;

  select coalesce(nullif(trim(au.full_name), ''), nullif(trim(au.email), ''), 'Authenticated Payroll Admin')
  into v_reviewer
  from public.admin_users au
  where au.auth_user_id = (select auth.uid())
    and au.is_active = true
    and (
      lower(trim(coalesce(au.role, ''))) in ('owner', 'payroll')
      or exists (
        select 1
        from unnest(string_to_array(lower(coalesce(au.extra_roles, '')), ',')) as extra(role_name)
        where trim(extra.role_name) in ('owner', 'payroll')
      )
    )
  limit 1;

  if v_reviewer is null then
    raise exception using errcode = '42501', message = 'PAYROLL_ROLE_REQUIRED: Only an active Owner or Payroll account may resolve a released-period request.';
  end if;
  if coalesce(trim(p_review_note), '') = '' then
    raise exception using errcode = 'P0001', message = 'REVIEW_NOTE_REQUIRED: Document the verification and business reason before resolving this request.';
  end if;
  if p_source_attendance_date is null or p_target_adjustment_date is null then
    raise exception using errcode = 'P0001', message = 'RESOLUTION_DATE_REQUIRED: Source and target payroll dates are required.';
  end if;
  if coalesce(p_verified_minutes, 0) < 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_VERIFIED_MINUTES: Verified minutes cannot be negative.';
  end if;

  select *
  into v_request
  from public.time_adjustment_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_FOUND: The attendance request no longer exists.';
  end if;

  v_request_type := lower(trim(coalesce(v_request.request_type, '')));
  if lower(trim(coalesce(v_request.status, ''))) <> 'pending' then
    raise exception using errcode = 'P0001', message = 'REQUEST_ALREADY_RESOLVED: This attendance request is no longer pending.';
  end if;
  if v_request_type not in ('overtime', 'undertime', 'meal_break') then
    raise exception using errcode = 'P0001', message = 'UNSUPPORTED_REQUEST_TYPE: Only OT, UT, and No Meal Break requests can be carried forward.';
  end if;
  if v_request_type = 'meal_break' and p_source_attendance_date >= date '2026-10-06' then
    raise exception 'No Meal Break approval is disabled from October 6, 2026.';
  end if;
  if v_request_type = 'meal_break' and coalesce(p_verified_minutes, 0) <> 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_MEAL_BREAK_MINUTES: No Meal Break resolution must save zero request minutes.';
  end if;
  if (v_request_type = 'undertime' or (v_request_type = 'overtime' and p_source_attendance_date < date '2026-10-06')) and mod(coalesce(p_verified_minutes, 0), 30) <> 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_POLICY_BLOCK: Verified OT/UT must use completed 30-minute policy blocks.';
  end if;
  if abs(p_source_attendance_date - v_request.attendance_date::date) > 1 then
    raise exception using errcode = 'P0001', message = 'SOURCE_DATE_MISMATCH: The verified attendance date must match the request date or its overnight shift-start date.';
  end if;
  if not exists (
    select 1
    from public.attendance_logs al
    where al.employee_id = v_request.employee_id
      and al.attendance_date = p_source_attendance_date
      and al.time_in is not null
      and al.time_out is not null
  ) then
    raise exception using errcode = 'P0001', message = 'COMPLETED_ATTENDANCE_REQUIRED: A completed Time In and Time Out record is required.';
  end if;
  if v_request_type in ('overtime', 'undertime') and exists (
    select 1
    from public.time_adjustment_requests meal_request
    where meal_request.employee_id = v_request.employee_id
      and meal_request.attendance_date::date = p_source_attendance_date
      and meal_request.request_type = 'meal_break'
      and meal_request.status = 'pending'
  ) then
    raise exception using errcode = 'P0001', message = 'MEAL_BREAK_REVIEW_REQUIRED: Resolve the pending No Meal Break request first.';
  end if;

  select *
  into v_source_payroll
  from public.payroll_records
  where employee_id = v_request.employee_id
    and payroll_start <= p_source_attendance_date
    and payroll_end >= p_source_attendance_date
    and (
      payroll_approved is true
      or payroll_released is true
      or approved_at is not null
      or released_at is not null
      or lower(trim(coalesce(payroll_status, ''))) in ('released', 'approved')
    )
  order by approved_at desc nulls last, released_at desc nulls last, created_at desc nulls last
  limit 1
  for share;

  if not found then
    raise exception using errcode = 'P0001', message = 'RELEASED_PAYROLL_NOT_FOUND: Use the normal approval workflow because the source date is not inside released payroll.';
  end if;
  if p_target_adjustment_date <= v_source_payroll.payroll_end then
    raise exception using errcode = 'P0001', message = 'TARGET_DATE_NOT_LATER: The correction date must be after the released payroll period.';
  end if;
  if exists (
    select 1
    from public.payroll_records pr
    where pr.payroll_start <= p_target_adjustment_date
      and pr.payroll_end >= p_target_adjustment_date
  ) then
    raise exception using errcode = 'P0001', message = 'TARGET_PAYROLL_ALREADY_COMPUTED: Undo the target draft payroll before creating this correction.';
  end if;

  if v_request_type = 'meal_break' and exists (
    select 1
    from public.time_adjustment_requests approved_time
    where approved_time.employee_id = v_request.employee_id
      and approved_time.attendance_date::date = p_source_attendance_date
      and approved_time.request_type in ('overtime', 'undertime')
      and approved_time.status = 'approved'
      and greatest(coalesce(approved_time.minutes, 0), 0) > 0
      and not exists (
        select 1
        from public.attendance_logs approved_log
        where approved_log.employee_id = v_request.employee_id
          and approved_log.attendance_date = p_source_attendance_date
          and (
            (
              approved_time.request_type = 'undertime'
              and greatest(coalesce(approved_log.undertime_minutes, 0), 0) = greatest(coalesce(approved_time.minutes, 0), 0)
              and greatest(coalesce(v_source_payroll.undertime_minutes, 0), 0) >= greatest(coalesce(approved_time.minutes, 0), 0)
            )
            or (
              approved_time.request_type = 'overtime'
              and greatest(coalesce(approved_log.overtime_minutes, 0), 0) = greatest(coalesce(approved_time.minutes, 0), 0)
              and coalesce(approved_log.overtime_approved, false) is true
              and greatest(coalesce(v_source_payroll.overtime_minutes, 0), 0) >= greatest(coalesce(approved_time.minutes, 0), 0)
            )
          )
      )
  ) then
    raise exception using errcode = 'P0001', message = 'APPROVED_TIME_CONFLICT: Review the approved OT/UT record before changing the meal-break treatment. Released-payroll history is allowed only when the approved minutes already match the released payroll and attendance snapshot.';
  end if;
  if v_request_type = 'undertime' and (v_amount <> 0 or v_adjustment_type <> '') then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_UT_DEDUCTION_BLOCKED: Attendance UT was already included in the released payroll; no second deduction is allowed.';
  end if;
  if v_amount > 0 and v_adjustment_type <> 'addition' then
    raise exception using errcode = 'P0001', message = 'INVALID_CORRECTION_DIRECTION: Released-period OT and break corrections may only create additions or refunds.';
  end if;
  if v_request_type = 'overtime' then
    if round(coalesce(p_multiplier, 0), 4) <> 1.25 then
      raise exception using errcode = 'P0001', message = 'INVALID_OT_MULTIPLIER: Regular-day overtime must use the 1.25 multiplier.';
    end if;
    if v_amount <> round(coalesce(p_verified_minutes, 0) * coalesce(p_hourly_rate, 0) / 60 * 1.25, 2) then
      raise exception using errcode = 'P0001', message = 'OT_AMOUNT_MISMATCH: The correction amount does not match the verified OT formula.';
    end if;
  end if;
  if v_amount > 0 and exists (
    select 1
    from public.payroll_adjustments existing_adjustment
    where existing_adjustment.employee_id = v_request.employee_id
      and existing_adjustment.source_type = 'time_adjustment_carry_forward'
      and existing_adjustment.source_attendance_date = p_source_attendance_date
      and existing_adjustment.source_payroll_start = v_source_payroll.payroll_start
      and existing_adjustment.source_payroll_end = v_source_payroll.payroll_end
      and lower(trim(coalesce(existing_adjustment.adjustment_type, ''))) = v_adjustment_type
      and round(coalesce(existing_adjustment.amount, 0), 2) = v_amount
  ) then
    raise exception using errcode = 'P0001', message = 'CORRECTION_ALREADY_EXISTS: This attendance date already has a linked next-cutoff correction.';
  end if;

  if v_amount > 0 then
    if v_adjustment_type not in ('addition', 'deduction') then
      raise exception using errcode = 'P0001', message = 'INVALID_ADJUSTMENT_TYPE: A positive correction must be an addition or deduction.';
    end if;
    if coalesce(trim(p_adjustment_category), '') = '' then
      raise exception using errcode = 'P0001', message = 'ADJUSTMENT_CATEGORY_REQUIRED: A correction category is required.';
    end if;
    if coalesce(p_hourly_rate, 0) <= 0 then
      raise exception using errcode = 'P0001', message = 'HOURLY_RATE_REQUIRED: The employee hourly rate could not be verified.';
    end if;

    insert into public.payroll_adjustments (
      employee_id,
      employee_code,
      employee_name,
      adjustment_date,
      adjustment_type,
      category,
      amount,
      notes,
      source_type,
      source_id,
      source_payroll_start,
      source_payroll_end,
      source_attendance_date,
      source_minutes,
      source_rate,
      source_multiplier,
      created_by
    ) values (
      v_request.employee_id,
      coalesce(v_request.employee_code, ''),
      coalesce(v_request.employee_name, ''),
      p_target_adjustment_date,
      v_adjustment_type,
      trim(p_adjustment_category),
      v_amount,
      trim(p_review_note),
      'time_adjustment_carry_forward',
      v_request.id::text,
      v_source_payroll.payroll_start,
      v_source_payroll.payroll_end,
      p_source_attendance_date,
      coalesce(p_verified_minutes, 0),
      round(coalesce(p_hourly_rate, 0), 6),
      round(coalesce(p_multiplier, 1), 4),
      v_reviewer
    )
    returning id into v_adjustment_id;
  end if;

  if v_request_type = 'meal_break' then
    if exists (
      select 1
      from public.break_logs bl
      join public.attendance_logs al on al.id::text = bl.attendance_log_id::text
      where al.employee_id = v_request.employee_id
        and al.attendance_date = p_source_attendance_date
        and (bl.break_out is not null or bl.break_in is not null)
    ) then
      raise exception using errcode = 'P0001', message = 'BREAK_PUNCH_CONFLICT: No Meal Break cannot be approved because a break punch exists.';
    end if;

    update public.attendance_logs
    set meal_break_exception_approved = true,
        approved_unpaid_break_minutes = 0,
        meal_break_exception_request_id = v_request.id::text,
        meal_break_exception_status = 'approved',
        meal_break_exception_reason = trim(p_review_note),
        meal_break_exception_reviewed_by = v_reviewer,
        meal_break_exception_reviewed_at = v_reviewed_at,
        updated_at = v_reviewed_at
    where employee_id = v_request.employee_id
      and attendance_date = p_source_attendance_date;
  elsif v_request_type = 'overtime' then
    update public.attendance_logs
    set overtime_minutes = 0,
        overtime_approved = false,
        status = case when lower(trim(coalesce(status, ''))) like 'overtime%' then 'Completed' else status end,
        updated_at = v_reviewed_at
    where employee_id = v_request.employee_id
      and attendance_date = p_source_attendance_date;

    if coalesce(p_verified_minutes, 0) > 0 then
      update public.attendance_logs
      set overtime_minutes = p_verified_minutes,
          overtime_approved = true,
          status = 'Overtime - Approved',
          updated_at = v_reviewed_at
      where id = p_attendance_log_id
        and employee_id = v_request.employee_id
        and attendance_date = p_source_attendance_date;
      if not found then
        raise exception using errcode = 'P0001', message = 'ATTENDANCE_LOG_NOT_FOUND: The verified attendance row could not be synchronized.';
      end if;
    end if;
  else
    update public.attendance_logs
    set undertime_minutes = 0,
        status = case when lower(trim(coalesce(status, ''))) like 'undertime%' then 'Completed' else status end,
        updated_at = v_reviewed_at
    where employee_id = v_request.employee_id
      and attendance_date = p_source_attendance_date;

    if coalesce(p_verified_minutes, 0) > 0 then
      update public.attendance_logs
      set undertime_minutes = p_verified_minutes,
          late_minutes = greatest(coalesce(p_late_minutes, 0), 0),
          status = 'Undertime - Approved',
          updated_at = v_reviewed_at
      where id = p_attendance_log_id
        and employee_id = v_request.employee_id
        and attendance_date = p_source_attendance_date;
      if not found then
        raise exception using errcode = 'P0001', message = 'ATTENDANCE_LOG_NOT_FOUND: The verified attendance row could not be synchronized.';
      end if;
    end if;
  end if;

  update public.time_adjustment_requests
  set attendance_date = p_source_attendance_date::text,
      status = 'approved',
      minutes = case when v_request_type = 'meal_break' then 0 else coalesce(p_verified_minutes, 0) end,
      reviewed_by = v_reviewer,
      reviewed_at = v_reviewed_at,
      admin_reason = trim(p_review_note)
  where id = v_request.id;

  insert into public.audit_logs (action, performed_by, target_employee, details)
  values (
    'TIME ADJUSTMENT RESOLVED TO NEXT CUTOFF',
    v_reviewer,
    coalesce(v_request.employee_name, v_request.employee_code, ''),
    format(
      'Request %s | %s | Source %s to %s | Attendance %s | Target %s | %s %s | %s minute(s)',
      v_request.id,
      upper(v_request_type),
      v_source_payroll.payroll_start,
      v_source_payroll.payroll_end,
      p_source_attendance_date,
      p_target_adjustment_date,
      coalesce(nullif(v_adjustment_type, ''), 'no adjustment'),
      to_char(v_amount, 'FM9999999990.00'),
      coalesce(p_verified_minutes, 0)
    )
  );

  v_notification_title := case
    when v_request_type = 'overtime' then 'Prior-Cutoff Overtime Resolved'
    when v_request_type = 'undertime' then 'Prior-Cutoff Undertime Resolved'
    else 'Prior-Cutoff No Meal Break Resolved'
  end;
  v_notification_message := case
    when v_amount > 0 and v_adjustment_type = 'addition' then format('A PHP %s addition was approved for the next payroll cutoff. Source attendance: %s.', to_char(v_amount, 'FM9999999990.00'), p_source_attendance_date)
    when v_amount > 0 and v_adjustment_type = 'deduction' then format('A PHP %s deduction was approved for the next payroll cutoff. Source attendance: %s.', to_char(v_amount, 'FM9999999990.00'), p_source_attendance_date)
    else format('Your prior-cutoff request for %s was reviewed. No additional payroll amount is required because the released payroll already contains the applicable attendance treatment.', p_source_attendance_date)
  end;

  insert into public.notifications (employee_id, employee_name, type, title, message, is_read)
  values (v_request.employee_id, v_request.employee_name, 'payroll', v_notification_title, v_notification_message, false);

  return jsonb_build_object(
    'request_id', v_request.id,
    'request_type', v_request_type,
    'source_payroll_start', v_source_payroll.payroll_start,
    'source_payroll_end', v_source_payroll.payroll_end,
    'source_attendance_date', p_source_attendance_date,
    'target_adjustment_date', p_target_adjustment_date,
    'verified_minutes', coalesce(p_verified_minutes, 0),
    'adjustment_id', v_adjustment_id,
    'adjustment_type', nullif(v_adjustment_type, ''),
    'adjustment_amount', v_amount,
    'status', 'approved'
  );
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'CORRECTION_ALREADY_EXISTS: This source request already has a linked next-cutoff correction.';
end;
$function$
;

-- Block stale employee clients as well as the current UI. Preserve legacy rows.
create or replace function public.guard_retired_no_meal_break_policy()
returns trigger language plpgsql security invoker set search_path = pg_catalog, pg_temp
as $$
begin
 if lower(coalesce(new.request_type,'')) = 'meal_break' then
  if tg_op = 'INSERT' or (new.attendance_date::date >= date '2026-10-06' and lower(coalesce(new.status,'')) in ('pending','approved')) then
   raise exception 'No Meal Break filing is no longer allowed.';
  end if;
 end if;
 return new;
end;
$$;
drop trigger if exists trg_retired_no_meal_break_policy on public.time_adjustment_requests;
create trigger trg_retired_no_meal_break_policy before insert or update on public.time_adjustment_requests
for each row execute function public.guard_retired_no_meal_break_policy();
create or replace function public.guard_retired_attendance_meal_override()
returns trigger language plpgsql security invoker set search_path = pg_catalog, pg_temp
as $$
begin
 if new.attendance_date::date >= date '2026-10-06' and
 (coalesce(new.meal_break_exception_approved,false) or new.approved_unpaid_break_minutes is not null) then
  raise exception 'Meal-break overrides are disabled from October 6, 2026.';
 end if;
 return new;
end;
$$;
drop trigger if exists trg_retired_attendance_meal_override on public.attendance_logs;
create trigger trg_retired_attendance_meal_override before insert or update of meal_break_exception_approved,approved_unpaid_break_minutes on public.attendance_logs
for each row execute function public.guard_retired_attendance_meal_override();
-- Prevent schedule edits from changing a day already started, including stale tabs.
create or replace function public.guard_started_staff_schedule()
returns trigger language plpgsql security invoker set search_path = pg_catalog, pg_temp
as $$
begin
 if exists (select 1 from public.attendance_logs al where al.employee_id=new.employee_id and al.attendance_date=new.schedule_date and al.time_in is not null) then
  if tg_op='INSERT' then raise exception 'Cannot assign a schedule after Time In.'; end if;
  if new.shift_start is distinct from old.shift_start or new.shift_end is distinct from old.shift_end or new.employee_id is distinct from old.employee_id or new.schedule_date is distinct from old.schedule_date then
   raise exception 'Cannot change a schedule after Time In. Use the attendance correction workflow.';
  end if;
 end if;
 return new;
end;
$$;
drop trigger if exists trg_guard_started_staff_schedule on public.daily_schedules;
create trigger trg_guard_started_staff_schedule before insert or update on public.daily_schedules for each row execute function public.guard_started_staff_schedule();
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
  v_post_shift_minutes integer := null;
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
      when v_attendance_date >= date '2026-10-06' and v_raw_span_minutes < 540 then v_recorded_break_minutes
      when v_attendance_date < date '2026-10-06' and v_approved_break_override is not null then v_approved_break_override
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
  if v_attendance_date >= date '2026-10-06' then
    select max(greatest(0,
      extract(hour from al.time_out)::integer * 60 + extract(minute from al.time_out)::integer
      + case when al.time_out < al.time_in then 1440 else 0 end
      - (extract(hour from al.shift_end)::integer * 60 + extract(minute from al.shift_end)::integer
      + case when al.shift_end <= al.shift_start then 1440 else 0 end)))
    into v_post_shift_minutes
    from public.attendance_logs al
    where al.employee_id=new.employee_id and al.attendance_date=v_attendance_date
      and al.time_in is not null and al.time_out is not null
      and al.shift_start is not null and al.shift_end is not null and lower(coalesce(al.status,'')) <> 'absent';
    v_raw_overtime_minutes := least(v_raw_overtime_minutes,coalesce(v_post_shift_minutes,v_raw_overtime_minutes));
    v_payable_overtime_minutes := v_raw_overtime_minutes;
  else
    v_payable_overtime_minutes := floor(v_raw_overtime_minutes::numeric / 30)::integer * 30;
  end if;

  if v_payable_overtime_minutes <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'OT_FILING_BLOCKED_NO_PAYABLE_ATTENDANCE: Actual completed attendance does not support payable overtime for this date.';
  end if;

  if coalesce(new.minutes, 0) <> v_payable_overtime_minutes then
    raise exception using
      errcode = 'P0001',
      message = format(
        'OT_FILING_BLOCKED_MINUTES_MISMATCH: Actual attendance supports exactly %s payable OT minute(s) under the attendance-date policy.',
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


notify pgrst, 'reload schema';
commit;
