-- Replace legacy employee PIN storage with bcrypt while preserving API shape.
-- The PIN column stores a one-way bcrypt hash after this migration.
begin;
create extension if not exists pgcrypto with schema extensions;

-- Migrate existing legacy employee PINs without logging or returning the secrets.
update public.employees
   set pin = extensions.crypt(pin, extensions.gen_salt('bf', 10))
 where pin !~ '^\\$2[aby]\\$[0-9]{2}\\$'
   and pin is not null;

create or replace function private.hash_employee_pin_on_write()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.pin is null or btrim(new.pin) = '' then
    raise exception 'Employee PIN is required.' using errcode='22023';
  end if;
  if tg_op = 'INSERT' or (new.pin is distinct from old.pin) then
    if new.pin !~ '^\\$2[aby]\\$[0-9]{2}\\$' then
      new.pin := extensions.crypt(new.pin,extensions.gen_salt('bf',10));
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_hash_employee_pin_on_write on public.employees;
create trigger trg_hash_employee_pin_on_write
before insert or update of pin on public.employees
for each row execute function private.hash_employee_pin_on_write();

create or replace function public.employee_portal_login(p_employee_code text,p_pin text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
 v_employee public.employees%rowtype;
 v_token uuid;
begin
 select e.* into v_employee from public.employees e
 where e.employee_code=btrim(coalesce(p_employee_code,''))
   and e.is_active=true
   and e.pin=extensions.crypt(btrim(coalesce(p_pin,'')),e.pin)
 limit 1;
 if v_employee.id is null then
   raise exception 'Invalid Employee ID or PIN.' using errcode='28000';
 end if;
 delete from private.employee_cash_advance_sessions where expires_at<=now();
 insert into private.employee_cash_advance_sessions(employee_id)
 values(v_employee.id) returning token into v_token;
 return jsonb_build_object('employee',to_jsonb(v_employee)-'pin',
    'cash_advance_session_token',v_token);
end;
$$;

revoke all on function public.employee_portal_login(text,text) from public;
grant execute on function public.employee_portal_login(text,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
