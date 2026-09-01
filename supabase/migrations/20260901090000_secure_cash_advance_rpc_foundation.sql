-- Secure employee cash-advance access without exposing the underlying tables.
-- Phase 1 is backward-compatible: it adds private sessions and narrow RPCs.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.employee_cash_advance_sessions (
  token uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours')
);

alter table private.employee_cash_advance_sessions enable row level security;
revoke all on table private.employee_cash_advance_sessions from public, anon, authenticated;

create index if not exists employee_cash_advance_sessions_employee_expiry_idx
  on private.employee_cash_advance_sessions (employee_id, expires_at desc);

create or replace function private.cash_advance_admin_has_role(p_allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.admin_users au
      where au.auth_user_id = (select auth.uid())
        and au.is_active = true
        and (
          lower(btrim(au.role)) = any (p_allowed_roles)
          or exists (
            select 1
            from unnest(string_to_array(lower(coalesce(au.extra_roles, '')), ',')) as extra(role_name)
            where btrim(extra.role_name) = any (p_allowed_roles)
          )
        )
    );
$$;

revoke all on function private.cash_advance_admin_has_role(text[]) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.cash_advance_admin_has_role(text[]) to authenticated;

create or replace function public.admin_set_employee_pin(
  p_employee_id uuid,
  p_new_pin text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pin text := btrim(coalesce(p_new_pin, ''));
begin
  if not private.cash_advance_admin_has_role(array['owner','hr']) then
    raise exception 'Only Owner or HR may change an employee PIN.' using errcode = '42501';
  end if;

  if v_pin = '' then
    raise exception 'New employee PIN is required.' using errcode = '22023';
  end if;

  update public.employees
  set pin = v_pin
  where id = p_employee_id;

  if not found then
    raise exception 'Employee was not found.' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

revoke all on function public.admin_set_employee_pin(uuid, text) from public, anon;
grant execute on function public.admin_set_employee_pin(uuid, text) to authenticated;

create or replace function public.employee_portal_login(
  p_employee_code text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.employees%rowtype;
  v_token uuid;
begin
  select e.*
    into v_employee
  from public.employees e
  where e.employee_code = btrim(coalesce(p_employee_code, ''))
    and e.pin = btrim(coalesce(p_pin, ''))
    and e.is_active = true
  limit 1;

  if v_employee.id is null then
    raise exception 'Invalid Employee ID or PIN.' using errcode = '28000';
  end if;

  delete from private.employee_cash_advance_sessions
  where expires_at <= now();

  insert into private.employee_cash_advance_sessions (employee_id)
  values (v_employee.id)
  returning token into v_token;

  return jsonb_build_object(
    'employee', to_jsonb(v_employee) - 'pin',
    'cash_advance_session_token', v_token
  );
end;
$$;

revoke all on function public.employee_portal_login(text, text) from public;
grant execute on function public.employee_portal_login(text, text) to anon, authenticated;

create or replace function public.issue_employee_cash_advance_session(p_employee_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid;
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'Service authorization is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.employees e
    where e.id = p_employee_id and e.is_active = true
  ) then
    raise exception 'Employee account is inactive or not found.' using errcode = 'P0002';
  end if;

  insert into private.employee_cash_advance_sessions (employee_id)
  values (p_employee_id)
  returning token into v_token;

  return v_token;
end;
$$;

revoke all on function public.issue_employee_cash_advance_session(uuid) from public, anon, authenticated;
grant execute on function public.issue_employee_cash_advance_session(uuid) to service_role;

create or replace function public.employee_cash_advance_session_for_linked_admin()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_id uuid;
  v_token uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Admin authentication is required.' using errcode = '28000';
  end if;

  select e.id
    into v_employee_id
  from public.admin_users au
  join public.employees e on e.id::text = au.employee_id
  where au.auth_user_id = (select auth.uid())
    and au.is_active = true
    and e.is_active = true
  limit 1;

  if v_employee_id is null then
    raise exception 'No active employee profile is linked to this admin account.' using errcode = 'P0002';
  end if;

  insert into private.employee_cash_advance_sessions (employee_id)
  values (v_employee_id)
  returning token into v_token;

  return v_token;
end;
$$;

revoke all on function public.employee_cash_advance_session_for_linked_admin() from public, anon;
grant execute on function public.employee_cash_advance_session_for_linked_admin() to authenticated;

create or replace function public.employee_cash_advance_requests(p_session_token uuid)
returns setof public.cash_advance_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_id uuid;
begin
  select s.employee_id
    into v_employee_id
  from private.employee_cash_advance_sessions s
  where s.token = p_session_token
    and s.expires_at > now();

  if v_employee_id is null then
    raise exception 'Employee cash-advance session expired. Please log in again.' using errcode = '28000';
  end if;

  return query
  select r.*
  from public.cash_advance_requests r
  where r.employee_id = v_employee_id::text
  order by r.created_at desc;
end;
$$;

revoke all on function public.employee_cash_advance_requests(uuid) from public;
grant execute on function public.employee_cash_advance_requests(uuid) to anon, authenticated;

create or replace function public.employee_cash_advance_ledgers(p_session_token uuid)
returns setof public.cash_advances
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_id uuid;
begin
  select s.employee_id
    into v_employee_id
  from private.employee_cash_advance_sessions s
  where s.token = p_session_token
    and s.expires_at > now();

  if v_employee_id is null then
    raise exception 'Employee cash-advance session expired. Please log in again.' using errcode = '28000';
  end if;

  return query
  select ca.*
  from public.cash_advances ca
  where ca.employee_id = v_employee_id
  order by ca.advance_date desc, ca.created_at desc;
end;
$$;

revoke all on function public.employee_cash_advance_ledgers(uuid) from public;
grant execute on function public.employee_cash_advance_ledgers(uuid) to anon, authenticated;

create or replace function public.employee_submit_cash_advance(
  p_session_token uuid,
  p_amount numeric,
  p_reason text
)
returns public.cash_advance_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.employees%rowtype;
  v_request public.cash_advance_requests%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  select e.*
    into v_employee
  from private.employee_cash_advance_sessions s
  join public.employees e on e.id = s.employee_id
  where s.token = p_session_token
    and s.expires_at > now()
    and e.is_active = true
  limit 1;

  if v_employee.id is null then
    raise exception 'Employee cash-advance session expired. Please log in again.' using errcode = '28000';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Amount must be greater than 0.' using errcode = '22023';
  end if;

  if v_reason = '' then
    raise exception 'Cash advance reason is required.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.cash_advance_requests r
    where r.employee_id = v_employee.id::text
      and lower(coalesce(r.status, '')) = 'pending'
  ) then
    raise exception 'You already have a pending cash advance request. Please wait for admin review before submitting another request.' using errcode = '23505';
  end if;

  insert into public.cash_advance_requests (
    employee_id,
    employee_code,
    employee_name,
    amount,
    reason,
    status
  ) values (
    v_employee.id::text,
    v_employee.employee_code,
    v_employee.full_name,
    p_amount,
    v_reason,
    'pending'
  )
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.employee_submit_cash_advance(uuid, numeric, text) from public;
grant execute on function public.employee_submit_cash_advance(uuid, numeric, text) to anon, authenticated;

create or replace function public.employee_cash_advance_logout(p_session_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.employee_cash_advance_sessions
  where token = p_session_token;
  return found;
end;
$$;

revoke all on function public.employee_cash_advance_logout(uuid) from public;
grant execute on function public.employee_cash_advance_logout(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
