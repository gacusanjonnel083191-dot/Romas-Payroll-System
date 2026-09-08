-- Stage 2: remove plaintext POS PIN access after both updated clients are live.

create or replace function public.pos_hash_employee_pin_on_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(trim(new.pin), '') is not null then
    new.pin_hash := extensions.crypt(trim(new.pin), extensions.gen_salt('bf', 10));
  end if;
  new.pin := null;
  return new;
end;
$$;

drop trigger if exists pos_employees_hash_pin_before_write on public.pos_employees;
create trigger pos_employees_hash_pin_before_write
before insert or update of pin on public.pos_employees
for each row execute function public.pos_hash_employee_pin_on_write();

update public.pos_employees
set pin_hash = extensions.crypt(trim(pin), extensions.gen_salt('bf', 10))
where nullif(trim(pin_hash), '') is null
  and nullif(trim(pin), '') is not null;

do $$
begin
  if exists (select 1 from public.pos_employees where nullif(trim(pin_hash), '') is null) then
    raise exception 'POS PIN finalization blocked: at least one employee has no PIN hash.';
  end if;
end;
$$;

alter table public.pos_employees alter column pin drop not null;
update public.pos_employees set pin = null where pin is not null;
alter table public.pos_employees alter column pin_hash set not null;

create or replace function public.pos_authenticate_employee(p_outlet_id text, p_pin text)
returns table (id text, outlet_id text, full_name text, role text, is_active boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(trim(p_outlet_id), '') is null
     or coalesce(trim(p_pin), '') !~ '^\d{4,8}$' then
    return;
  end if;

  return query
  select e.id, e.outlet_id, e.full_name, e.role, e.is_active
  from public.pos_employees as e
  where e.outlet_id = trim(p_outlet_id)
    and e.is_active = true
    and e.pin_hash = extensions.crypt(trim(p_pin), e.pin_hash)
  order by e.created_at, e.id
  limit 1;
end;
$$;

revoke all on function public.pos_authenticate_employee(text, text) from public;
grant execute on function public.pos_authenticate_employee(text, text) to anon, authenticated, service_role;

alter table public.pos_employees enable row level security;
drop policy if exists allow_all_pos_employees on public.pos_employees;
drop policy if exists pos_employees_authenticated_select on public.pos_employees;
revoke all on table public.pos_employees from anon, authenticated;
grant select (id, outlet_id, full_name, role, is_active, created_at) on public.pos_employees to authenticated;
create policy pos_employees_authenticated_select
on public.pos_employees for select to authenticated
using (auth.uid() is not null);

alter table public.pos_void_logs enable row level security;
drop policy if exists pos_void_logs_authenticated_select on public.pos_void_logs;
revoke all on table public.pos_void_logs from anon, authenticated;
grant select on table public.pos_void_logs to authenticated;
create policy pos_void_logs_authenticated_select
on public.pos_void_logs for select to authenticated
using (auth.uid() is not null);

revoke all on function public.pos_hash_employee_pin_on_write() from public, anon, authenticated;
grant execute on function public.pos_hash_employee_pin_on_write() to postgres, service_role;

notify pgrst, 'reload schema';
