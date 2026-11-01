-- Production overtime: independent supervisor verification before owner final approval.
-- Existing approved requests remain historical and unchanged. Deployment requires
-- this migration before the associated application code is released.

alter table public.time_adjustment_requests
  add column if not exists supervisor_reviewed_by uuid,
  add column if not exists supervisor_reviewed_name text,
  add column if not exists supervisor_reviewed_at timestamptz,
  add column if not exists supervisor_review_note text;

comment on column public.time_adjustment_requests.supervisor_reviewed_by is
  'Authenticated supervisor who verified production OT; NOT the final payroll approver.';
comment on column public.time_adjustment_requests.supervisor_reviewed_at is
  'Non-null means production OT was forwarded to owner, but status stays pending until owner final approval.';

-- The production supervisor may forward or reject ONLY a pending production OT.
-- The trigger below limits actual column changes and validates the actor.
drop policy if exists time_adjustment_production_supervisor_review on public.time_adjustment_requests;
create policy time_adjustment_production_supervisor_review
on public.time_adjustment_requests for update to authenticated
using (
  public.business_control_has_role(array['supervisor']::text[])
  and request_type = 'overtime'
  and status = 'pending'
  and exists (
    select 1 from public.employees e
    where e.id = employee_id and lower(btrim(coalesce(e.department,''))) = 'production'
  )
)
with check (
  public.business_control_has_role(array['supervisor']::text[])
  and request_type = 'overtime'
  and status in ('pending', 'rejected')
  and exists (
    select 1 from public.employees e
    where e.id = employee_id and lower(btrim(coalesce(e.department,''))) = 'production'
  )
);

create or replace function public.guard_production_overtime_approval_chain()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  actor_is_owner boolean := false;
  actor_is_supervisor boolean := false;
  production_request boolean := false;
  stage_changed boolean := false;
  actual_reason text;
begin
  if new.request_type = 'overtime' and tg_op = 'INSERT' then
    actual_reason := btrim(split_part(coalesce(new.employee_reason,''), 'OT-TIME-RANGE[', 1));
    if char_length(actual_reason) < 15 or
       lower(actual_reason) = any(array[
         'operational requirements / volume of work',
         'rush order / client deadline',
         'staff shortage / manpower gap',
         'management request',
         'inventory or restocking task',
         'others'
       ]::text[]) then
      raise exception using errcode='P0001',
        message='OT_SPECIFIC_REASON_REQUIRED: Describe the actual work performed and why overtime was needed (at least 15 characters).';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.request_type = 'overtime' and exists (
      select 1 from public.employees e
      where e.id = new.employee_id and lower(btrim(coalesce(e.department,'')))='production'
    ) and (coalesce(new.status,'pending') <> 'pending'
       or new.supervisor_reviewed_by is not null or new.supervisor_reviewed_at is not null
       or new.supervisor_review_note is not null) then
      raise exception using errcode='P0001',
        message='PRODUCTION_OT_MUST_START_PENDING: Production overtime starts with supervisor review.';
    end if;
    return new;
  end if;

  production_request := (
    (old.request_type = 'overtime' and exists (
      select 1 from public.employees e
      where e.id = old.employee_id and lower(btrim(coalesce(e.department,'')))='production'
    )) or
    (new.request_type = 'overtime' and exists (
      select 1 from public.employees e
      where e.id = new.employee_id and lower(btrim(coalesce(e.department,'')))='production'
    ))
  );
  if not production_request then return new; end if;

  select exists (
    select 1 from public.admin_users u
    where u.auth_user_id = actor_id and u.is_active
      and ('owner' = lower(btrim(u.role)) or 'owner' = any(
        string_to_array(lower(replace(coalesce(u.extra_roles,''),' ','')), ',')))
  ) into actor_is_owner;

  select exists (
    select 1 from public.admin_users u
    where u.auth_user_id = actor_id and u.is_active
      and ('supervisor' = lower(btrim(u.role)) or 'supervisor' = any(
        string_to_array(lower(replace(coalesce(u.extra_roles,''),' ','')), ',')))
  ) into actor_is_supervisor;

  if new.employee_id is distinct from old.employee_id
     or new.request_type is distinct from old.request_type
     or new.employee_reason is distinct from old.employee_reason
     or new.employee_code is distinct from old.employee_code
     or new.employee_name is distinct from old.employee_name then
    raise exception using errcode='P0001',
      message='PRODUCTION_OT_IDENTITY_LOCKED: Do not reassign or rewrite an existing production OT filing.';
  end if;

  stage_changed := (
    new.supervisor_reviewed_by is distinct from old.supervisor_reviewed_by
    or new.supervisor_reviewed_name is distinct from old.supervisor_reviewed_name
    or new.supervisor_reviewed_at is distinct from old.supervisor_reviewed_at
    or new.supervisor_review_note is distinct from old.supervisor_review_note
  );

  if stage_changed then
    if not actor_is_supervisor or actor_is_owner
       or old.status <> 'pending' or new.status <> 'pending'
       or old.supervisor_reviewed_at is not null
       or new.supervisor_reviewed_by is distinct from actor_id
       or new.supervisor_reviewed_at is null
       or nullif(btrim(coalesce(new.supervisor_reviewed_name,'')), '') is null
       or char_length(btrim(coalesce(new.supervisor_review_note,''))) < 10
       or new.attendance_date is distinct from old.attendance_date
       or new.minutes is distinct from old.minutes
       or new.admin_reason is distinct from old.admin_reason
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at then
      raise exception using errcode='P0001',
        message='SUPERVISOR_REVIEW_INVALID: Only the authenticated production supervisor may forward a pending request with a verification note.';
    end if;
    return new;
  end if;

  -- Supervisors cannot approve payroll, alter minutes, or change request identity.
  if actor_is_supervisor and not actor_is_owner then
    if old.status = 'pending' and new.status = 'rejected'
       and old.supervisor_reviewed_at is null
       and char_length(btrim(coalesce(new.admin_reason,''))) >= 10
       and nullif(btrim(coalesce(new.reviewed_by,'')), '') is not null
       and new.reviewed_at is not null
       and new.attendance_date is not distinct from old.attendance_date
       and new.minutes is not distinct from old.minutes then
      return new;
    end if;
    raise exception using errcode='P0001',
      message='SUPERVISOR_OT_PERMISSION_DENIED: Supervisors can only verify or reject pending production overtime.';
  end if;

  if new.status = 'approved' and old.status is distinct from 'approved' then
    if not actor_is_owner or old.status <> 'pending'
       or old.supervisor_reviewed_by is null or old.supervisor_reviewed_at is null
       or old.supervisor_reviewed_by = actor_id then
      raise exception using errcode='P0001',
        message='OWNER_FINAL_APPROVAL_REQUIRED: Production OT requires an independent supervisor review and authenticated owner final approval.';
    end if;
  elsif new.status is distinct from old.status and not actor_is_owner then
    raise exception using errcode='P0001',
      message='OWNER_PRODUCTION_OT_CONTROL: Only the owner may finalize or void a production overtime decision.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_production_overtime_approval_chain on public.time_adjustment_requests;
create trigger trg_guard_production_overtime_approval_chain
before insert or update on public.time_adjustment_requests
for each row execute function public.guard_production_overtime_approval_chain();

-- Existing historical approvals are grandfathered; all currently pending
-- production OT must pass the new supervisor/owner chain before payroll.
notify pgrst, 'reload schema';
