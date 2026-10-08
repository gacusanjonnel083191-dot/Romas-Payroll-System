-- Staged only. Apply after staging validation; NOT executed against production.
-- 2026-10-08: offboarding session revocation + schedule write permission hardening.
-- Keeps all existing attendance, payroll, leave, and cash advance history.
begin;

create or replace function private.revoke_employee_access_on_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active is distinct from false and new.is_active = false then
    -- Never allow the company owner to be locked out through the staff screen.
    if exists (
      select 1 from public.admin_users au
      where au.employee_id = new.id::text
        and au.is_active = true
        and (lower(btrim(coalesce(au.role,''))) = 'owner'
          or 'owner' = any(string_to_array(lower(replace(coalesce(au.extra_roles,''),' ','')),',')))
    ) then
      raise exception 'A linked owner account cannot be deactivated through Employee Management.'
        using errcode = '42501';
    end if;

    -- Immediately make every outstanding employee-portal token unusable.
    delete from private.employee_cash_advance_sessions s where s.employee_id = new.id;

    -- A linked admin must also lose the Supabase-Auth-backed application role.
    update public.admin_users au set is_active = false
    where au.employee_id = new.id::text and au.is_active = true;
  end if;
  return new;
end
$$;

drop trigger if exists trg_revoke_employee_access_on_deactivation on public.employees;
create trigger trg_revoke_employee_access_on_deactivation
before update of is_active on public.employees
for each row execute function private.revoke_employee_access_on_deactivation();

-- Do not rely solely on token deletion; all employee RPC reads verify active status.
create or replace function public.employee_cash_advance_ledgers(p_session_token uuid)
returns setof public.cash_advances
language plpgsql
security definer
set search_path = ''
as $$
declare v_employee_id uuid;
begin
  v_employee_id := private.employee_portal_session_employee(p_session_token);
  return query
    select ca.* from public.cash_advances ca
    where ca.employee_id = v_employee_id
    order by ca.advance_date desc, ca.created_at desc;
end
$$;

create or replace function public.employee_cash_advance_requests(p_session_token uuid)
returns setof public.cash_advance_requests
language plpgsql
security definer
set search_path = ''
as $$
declare v_employee_id uuid;
begin
  v_employee_id := private.employee_portal_session_employee(p_session_token);
  return query
    select r.* from public.cash_advance_requests r
    where r.employee_id = v_employee_id::text
    order by r.created_at desc;
end
$$;

-- Existing authenticated admin schedule workflows continue to use direct API calls.
-- Employee portal still reads schedules anonymously until its session-scoped
-- reader can be installed. Block anonymous *writes* immediately on deployment.
alter table public.daily_schedules enable row level security;

drop policy if exists daily_schedules_staff_read_compat on public.daily_schedules;
create policy daily_schedules_staff_read_compat on public.daily_schedules
for select to anon, authenticated using (true);

drop policy if exists daily_schedules_admin_insert on public.daily_schedules;
create policy daily_schedules_admin_insert on public.daily_schedules
for insert to authenticated
with check (private.cash_advance_admin_has_role(array['owner','manager','hr','payroll','supervisor','asst_supervisor']::text[]));

drop policy if exists daily_schedules_admin_update on public.daily_schedules;
create policy daily_schedules_admin_update on public.daily_schedules
for update to authenticated
using (private.cash_advance_admin_has_role(array['owner','manager','hr','payroll','supervisor','asst_supervisor']::text[]))
with check (private.cash_advance_admin_has_role(array['owner','manager','hr','payroll','supervisor','asst_supervisor']::text[]));

drop policy if exists daily_schedules_admin_delete on public.daily_schedules;
create policy daily_schedules_admin_delete on public.daily_schedules
for delete to authenticated
using (private.cash_advance_admin_has_role(array['owner','manager','hr','payroll','supervisor','asst_supervisor']::text[]));

revoke insert, update, delete, truncate, references, trigger on public.daily_schedules from anon;
grant select on public.daily_schedules to anon;

-- Browser-client deletes must be owner-only, in addition to existing FK guards.
drop policy if exists employees_authenticated_delete on public.employees;
drop policy if exists employees_owner_delete on public.employees;
create policy employees_owner_delete on public.employees
for delete to authenticated
using (private.cash_advance_admin_has_role(array['owner']::text[]));

notify pgrst, 'reload schema';
commit;
