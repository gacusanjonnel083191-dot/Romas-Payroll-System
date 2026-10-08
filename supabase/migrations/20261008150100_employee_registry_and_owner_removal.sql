-- 2026-10-08: owner-controlled physical account removal; no history deletion.
-- Staged: never run against production without verifying schema and isolated tests.
begin;

-- The registry is NOT a login account: it contains only identity data needed by
-- existing historical payroll, attendance and HR foreign keys.
create table if not exists public.employee_registry (
  id uuid primary key,
  employee_code text not null,
  full_name text not null,
  position text,
  department text,
  profile_photo_url text,
  removed_at timestamptz,
  registered_at timestamptz not null default now()
);

insert into public.employee_registry (id, employee_code, full_name, position, department, profile_photo_url)
select id, employee_code, full_name, position, department, profile_photo_url
from public.employees
on conflict (id) do nothing;

alter table public.employee_registry enable row level security;
revoke all on public.employee_registry from public, anon, authenticated;
grant select on public.employee_registry to authenticated;
drop policy if exists employee_registry_admin_read on public.employee_registry;
create policy employee_registry_admin_read on public.employee_registry
for select to authenticated
using (private.cash_advance_admin_has_role(
  array['owner','manager','hr','payroll','admin','pos_admin','supervisor','asst_supervisor']::text[]
));

create or replace function private.sync_employee_registry()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.employee_registry
    (id,employee_code,full_name,position,department,profile_photo_url)
  values
    (new.id,new.employee_code,new.full_name,new.position,new.department,new.profile_photo_url)
  on conflict(id) do update set
    employee_code = excluded.employee_code,
    full_name = excluded.full_name,
    position = excluded.position,
    department = excluded.department,
    profile_photo_url = excluded.profile_photo_url
  where public.employee_registry.removed_at is null;
  return new;
end;
$$;

drop trigger if exists trg_sync_employee_registry on public.employees;
create trigger trg_sync_employee_registry
after insert or update of employee_code,full_name,position,department,profile_photo_url
on public.employees for each row
execute function private.sync_employee_registry();

-- Reparent historical FK records to the permanent non-login identity registry.
-- Employee sessions must still reference employees with ON DELETE CASCADE.
-- Notifications are transient and may cascade; linked chat accounts deactivate.
do $reparent$
declare rec record;
begin
  for rec in
    select ns.nspname as schema_name,
           rel.relname as table_name,
           con.conname as constraint_name,
           att.attname as column_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = con.conkey[1]
    where con.contype = 'f' and con.confrelid = 'public.employees'::regclass
      and array_length(con.conkey,1) = 1
      and con.conrelid not in (
        'private.employee_cash_advance_sessions'::regclass,
        'public.notifications'::regclass
      )
  loop
    execute format('alter table %I.%I drop constraint %I',
       rec.schema_name,rec.table_name,rec.constraint_name);
    execute format(
      'alter table %I.%I add constraint %I foreign key (%I) references public.employee_registry(id) on delete restrict',
      rec.schema_name,rec.table_name,rec.constraint_name,rec.column_name
    );
  end loop;
end
$reparent$;

create or replace function public.owner_permanently_remove_employee(
  p_employee_id uuid,
  p_confirmation_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  emp public.employees%rowtype;
  actor text;
  payroll_count integer;
  attendance_count integer;
  cash_advance_count integer;
  schedule_count integer;
  outstanding numeric;
  affected integer;
begin
  if (select auth.uid()) is null
     or not private.cash_advance_admin_has_role(array['owner']::text[]) then
    raise exception 'Only the signed-in owner can permanently remove employees.'
      using errcode = '42501';
  end if;
  if p_employee_id is null then
    raise exception 'Select an employee.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('employee-removal:'||p_employee_id::text,0));
  select * into emp from public.employees where id=p_employee_id for update;
  if not found then
    raise exception 'Employee account does not exist or was already removed.'
      using errcode = 'P0002';
  end if;
  if emp.is_active is distinct from false then
    raise exception 'Deactivate this employee first and complete final-pay clearance.'
      using errcode = '23514';
  end if;
  if p_confirmation_code is distinct from emp.employee_code then
    raise exception 'Employee code does not match; removal was cancelled.'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from public.admin_users au
    where au.employee_id=emp.id::text and
      (lower(btrim(coalesce(au.role,'')))='owner' or
       'owner'=any(string_to_array(lower(replace(coalesce(au.extra_roles,''),' ','')),',')))
  ) then
    raise exception 'An owner identity cannot be permanently removed.'
      using errcode = '42501';
  end if;
  if not exists(select 1 from public.employee_registry er where er.id=emp.id) then
    raise exception 'Historical identity registry is missing. Removal aborted.'
      using errcode = 'P0001';
  end if;

  select coalesce(round(sum(
     coalesce(ca.balance, coalesce(ca.amount,0)-coalesce(ca.amount_paid,0))
  ),2),0) into outstanding
  from public.cash_advances ca
  where ca.employee_id=emp.id and
    lower(coalesce(ca.status,'')) not in ('void','voided','cancelled','canceled')
    and coalesce(ca.balance,coalesce(ca.amount,0)-coalesce(ca.amount_paid,0))>0;
  if outstanding>0 then
    raise exception 'Outstanding cash advances require verified final-pay or receivable settlement.'
      using errcode = '23514';
  end if;

  select count(*) into payroll_count from public.payroll_records where employee_id=emp.id;
  select count(*) into attendance_count from public.attendance_logs where employee_id=emp.id;
  select count(*) into cash_advance_count from public.cash_advances where employee_id=emp.id;
  select count(*) into schedule_count from public.daily_schedules where employee_id=emp.id;

  select coalesce(nullif(full_name,''),'Authorized owner') into actor
  from public.admin_users
  where auth_user_id=(select auth.uid()) and is_active=true limit 1;
  actor := coalesce(actor,'Authorized owner');

  -- Revoke every remaining method of accessing the company app.
  delete from private.employee_cash_advance_sessions where employee_id=emp.id;
  update public.admin_users set is_active=false where employee_id=emp.id::text;
  update public.staff_chat_users set is_active=false where employee_id=emp.id;
  delete from public.employee_passkeys
    where employee_id=emp.id::text or employee_code=emp.employee_code;
  delete from public.passkey_challenges
    where employee_id=emp.id::text or employee_code=emp.employee_code;

  -- Strip photos from the permanent registry. Name/code remain for lawful
  -- historical financial and employment evidence.
  update public.employee_registry
     set removed_at=now(),profile_photo_url=null
   where id=emp.id;

  delete from public.employees where id=emp.id;
  get diagnostics affected = row_count;
  if affected<>1 then
    raise exception 'Employee account removal was not confirmed.' using errcode='P0001';
  end if;

  insert into public.audit_logs(action,performed_by,target_employee,details)
  values ('EMPLOYEE ACCOUNT PERMANENTLY REMOVED',actor,emp.full_name,
    'Employee Code: '||emp.employee_code||
    ' | historical payroll: '||payroll_count||
    ' | historical attendance: '||attendance_count||
    ' | cash advances: '||cash_advance_count||
    ' | schedules: '||schedule_count);
  return jsonb_build_object(
     'ok',true,'employee_code',emp.employee_code,
     'historical_payroll_preserved',payroll_count,
     'historical_attendance_preserved',attendance_count,
     'historical_cash_advances_preserved',cash_advance_count,
     'historical_schedules_preserved',schedule_count
  );
end;
$$;

revoke all on function public.owner_permanently_remove_employee(uuid,text)
from public,anon;
grant execute on function public.owner_permanently_remove_employee(uuid,text)
to authenticated;

notify pgrst,'reload schema';
commit;
