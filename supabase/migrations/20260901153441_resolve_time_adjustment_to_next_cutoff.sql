-- Resolve a pending OT / UT / No Meal Break request from a released payroll
-- into the next uncomputed cutoff without rewriting the released payroll.

create or replace function public.resolve_time_adjustment_to_next_cutoff(
  p_request_id bigint,
  p_source_attendance_date date,
  p_target_adjustment_date date,
  p_verified_minutes integer,
  p_adjustment_type text,
  p_adjustment_category text,
  p_adjustment_amount numeric,
  p_hourly_rate numeric,
  p_multiplier numeric,
  p_reviewer text,
  p_review_note text,
  p_attendance_log_id uuid,
  p_late_minutes integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
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
  if v_request_type = 'meal_break' and coalesce(p_verified_minutes, 0) <> 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_MEAL_BREAK_MINUTES: No Meal Break resolution must save zero request minutes.';
  end if;
  if v_request_type in ('overtime', 'undertime') and mod(coalesce(p_verified_minutes, 0), 30) <> 0 then
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
  if v_request_type = 'meal_break' and exists (
    select 1
    from public.time_adjustment_requests approved_time
    where approved_time.employee_id = v_request.employee_id
      and approved_time.attendance_date::date = p_source_attendance_date
      and approved_time.request_type in ('overtime', 'undertime')
      and approved_time.status = 'approved'
  ) then
    raise exception using errcode = 'P0001', message = 'APPROVED_TIME_CONFLICT: Review the approved OT/UT record before changing the meal-break treatment.';
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

  select *
  into v_source_payroll
  from public.payroll_records
  where employee_id = v_request.employee_id
    and payroll_start <= p_source_attendance_date
    and payroll_end >= p_source_attendance_date
    and (
      payroll_approved is true
      or approved_at is not null
      or lower(trim(coalesce(payroll_status, ''))) = 'released'
    )
  order by approved_at desc nulls last, created_at desc nulls last
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
$$;

comment on function public.resolve_time_adjustment_to_next_cutoff(bigint,date,date,integer,text,text,numeric,numeric,numeric,text,text,uuid,integer) is
'Atomically resolves a pending released-period OT/UT/No Meal Break request, preserves the released payroll snapshot, and creates at most one linked adjustment in a later uncomputed cutoff.';

revoke all on function public.resolve_time_adjustment_to_next_cutoff(bigint,date,date,integer,text,text,numeric,numeric,numeric,text,text,uuid,integer) from public;
revoke all on function public.resolve_time_adjustment_to_next_cutoff(bigint,date,date,integer,text,text,numeric,numeric,numeric,text,text,uuid,integer) from anon;
grant execute on function public.resolve_time_adjustment_to_next_cutoff(bigint,date,date,integer,text,text,numeric,numeric,numeric,text,text,uuid,integer) to authenticated;

notify pgrst, 'reload schema';
