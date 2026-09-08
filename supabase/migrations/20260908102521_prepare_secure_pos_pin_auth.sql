-- Stage 1: add server-side POS authentication and transactional admin actions.
-- Plain PIN compatibility remains temporarily so the currently deployed POS
-- can stay online until the new client is published and verified.

alter table public.pos_employees
  add column if not exists pin_hash text;

update public.pos_employees
set pin_hash = extensions.crypt(pin, extensions.gen_salt('bf', 10))
where nullif(trim(pin_hash), '') is null
  and nullif(trim(pin), '') is not null;

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
    and (
      (nullif(trim(e.pin_hash), '') is not null and e.pin_hash = extensions.crypt(trim(p_pin), e.pin_hash))
      or (nullif(trim(e.pin_hash), '') is null and e.pin = trim(p_pin))
    )
  order by e.created_at, e.id
  limit 1;
end;
$$;

revoke all on function public.pos_authenticate_employee(text, text) from public;
grant execute on function public.pos_authenticate_employee(text, text) to anon, authenticated, service_role;

create or replace function public.pos_upsert_employee(
  p_employee_id text,
  p_outlet_id text,
  p_full_name text,
  p_role text,
  p_pin text,
  p_is_active boolean default true
)
returns table (id text, outlet_id text, full_name text, role text, is_active boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_role text;
  v_extra_roles text;
  v_roles text;
  v_employee_id text := nullif(trim(p_employee_id), '');
  v_outlet_id text := nullif(trim(p_outlet_id), '');
  v_full_name text := nullif(trim(p_full_name), '');
  v_role text := lower(trim(coalesce(p_role, 'cashier')));
  v_pin text := nullif(trim(p_pin), '');
  v_is_owner boolean := false;
begin
  select lower(trim(coalesce(a.role, ''))), lower(trim(coalesce(a.extra_roles, '')))
  into v_admin_role, v_extra_roles
  from public.admin_users as a
  where a.auth_user_id = auth.uid() and coalesce(a.is_active, false) = true
  limit 1;

  v_roles := concat_ws(',', v_admin_role, v_extra_roles);
  v_is_owner := v_admin_role = 'owner'
    or v_extra_roles ~ '(^|[,;[:space:]\[\]\"]+)owner($|[,;[:space:]\[\]\"]+)';

  if v_roles is null
     or not (v_roles ~ '(^|[,;[:space:]\[\]\"]+)(owner|manager|admin|pos_admin)($|[,;[:space:]\[\]\"]+)') then
    raise exception 'POS_EMPLOYEE_ACCESS_DENIED: an authorized admin login is required.';
  end if;
  if v_outlet_id is null or v_full_name is null then
    raise exception 'Outlet and cashier name are required.';
  end if;
  if v_role not in ('owner', 'cashier') then
    raise exception 'POS role must be owner or cashier.';
  end if;
  if v_role = 'owner' and not v_is_owner then
    raise exception 'Only the Owner can create or assign a POS Owner account.';
  end if;
  if v_pin is not null and v_pin !~ '^\d{4,8}$' then
    raise exception 'The POS PIN must contain 4 to 8 numbers.';
  end if;
  if v_employee_id is null and v_pin is null then
    raise exception 'A PIN is required for a new POS account.';
  end if;

  if v_pin is not null and exists (
    select 1 from public.pos_employees as e
    where e.outlet_id = v_outlet_id
      and (v_employee_id is null or e.id <> v_employee_id)
      and (
        (nullif(trim(e.pin_hash), '') is not null and e.pin_hash = extensions.crypt(v_pin, e.pin_hash))
        or (nullif(trim(e.pin_hash), '') is null and e.pin = v_pin)
      )
  ) then
    raise exception 'That PIN is already assigned to another POS user. Please use a different PIN.';
  end if;

  if v_employee_id is null then
    v_employee_id := 'EMP-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 16));
    insert into public.pos_employees (id, outlet_id, full_name, pin, pin_hash, role, is_active)
    values (
      v_employee_id, v_outlet_id, v_full_name, v_pin,
      extensions.crypt(v_pin, extensions.gen_salt('bf', 10)),
      v_role, coalesce(p_is_active, true)
    );
  else
    if not exists (
      select 1 from public.pos_employees as e
      where e.id = v_employee_id and e.outlet_id = v_outlet_id
    ) then
      raise exception 'The POS account was not found for this outlet.';
    end if;

    if exists (
      select 1 from public.pos_employees as e
      where e.id = v_employee_id and e.outlet_id = v_outlet_id
        and lower(trim(e.role)) = 'owner' and e.is_active = true
    ) and (v_role <> 'owner' or not coalesce(p_is_active, true)) and not exists (
      select 1 from public.pos_employees as other
      where other.outlet_id = v_outlet_id and other.id <> v_employee_id
        and lower(trim(other.role)) = 'owner' and other.is_active = true
    ) then
      raise exception 'This is the last active POS Owner account.';
    end if;

    update public.pos_employees as e
    set full_name = v_full_name,
        role = v_role,
        is_active = coalesce(p_is_active, true),
        pin = case when v_pin is null then e.pin else v_pin end,
        pin_hash = case when v_pin is null then e.pin_hash else extensions.crypt(v_pin, extensions.gen_salt('bf', 10)) end
    where e.id = v_employee_id and e.outlet_id = v_outlet_id;
  end if;

  return query
  select e.id, e.outlet_id, e.full_name, e.role, e.is_active
  from public.pos_employees as e
  where e.id = v_employee_id and e.outlet_id = v_outlet_id;
end;
$$;

revoke all on function public.pos_upsert_employee(text, text, text, text, text, boolean) from public, anon;
grant execute on function public.pos_upsert_employee(text, text, text, text, text, boolean) to authenticated, service_role;

create unique index if not exists pos_void_logs_outlet_sale_uidx
  on public.pos_void_logs (outlet_id, sale_id)
  where sale_id is not null;

create or replace function public.pos_void_sale_atomic(
  p_outlet_id text,
  p_sale_id text,
  p_reason text,
  p_voided_by text
)
returns table (
  sale_id text,
  receipt_no text,
  original_total numeric,
  restored_item_count integer,
  already_voided boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_role text;
  v_extra_roles text;
  v_roles text;
  v_sale public.pos_sales%rowtype;
  v_item record;
  v_restored integer := 0;
begin
  select lower(trim(coalesce(a.role, ''))), lower(trim(coalesce(a.extra_roles, '')))
  into v_admin_role, v_extra_roles
  from public.admin_users as a
  where a.auth_user_id = auth.uid() and coalesce(a.is_active, false) = true
  limit 1;
  v_roles := concat_ws(',', v_admin_role, v_extra_roles);

  if v_roles is null
     or not (v_roles ~ '(^|[,;[:space:]\[\]\"]+)(owner|manager|admin|pos_admin)($|[,;[:space:]\[\]\"]+)') then
    raise exception 'POS_VOID_ACCESS_DENIED: an authorized admin login is required.';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'A void reason is required.';
  end if;
  if nullif(trim(p_voided_by), '') is null then
    raise exception 'The person voiding the receipt is required.';
  end if;

  select s.* into v_sale
  from public.pos_sales as s
  where s.id = trim(p_sale_id) and s.outlet_id = trim(p_outlet_id)
  for update;

  if not found then
    raise exception 'The POS sale was not found for this outlet.';
  end if;
  if lower(trim(coalesce(v_sale.status, 'completed'))) = 'voided' then
    return query select v_sale.id, v_sale.receipt_no, coalesce(v_sale.net_total, 0), 0, true;
    return;
  end if;

  for v_item in
    select i.product_id, sum(coalesce(i.qty, 0))::numeric as qty
    from public.pos_sale_items as i
    where i.sale_id = v_sale.id
      and nullif(trim(i.product_id), '') is not null
      and coalesce(i.qty, 0) > 0
    group by i.product_id
  loop
    perform public.pos_apply_inventory_movement(
      v_sale.outlet_id, v_item.product_id, 'void_reversal', v_item.qty,
      v_sale.receipt_no, 'Void reason: ' || trim(p_reason), trim(p_voided_by)
    );
    v_restored := v_restored + 1;
  end loop;

  update public.pos_sales as s
  set status = 'voided', voided_at = clock_timestamp(),
      voided_by = trim(p_voided_by), void_reason = trim(p_reason)
  where s.id = v_sale.id;

  insert into public.pos_void_logs (
    outlet_id, receipt_no, sale_id, business_date,
    voided_by, void_reason, original_total, created_at
  ) values (
    v_sale.outlet_id, v_sale.receipt_no, v_sale.id, v_sale.business_date,
    trim(p_voided_by), trim(p_reason), coalesce(v_sale.net_total, 0), clock_timestamp()
  )
  on conflict (outlet_id, sale_id) where sale_id is not null do update
  set voided_by = excluded.voided_by,
      void_reason = excluded.void_reason,
      original_total = excluded.original_total;

  return query
  select v_sale.id, v_sale.receipt_no, coalesce(v_sale.net_total, 0), v_restored, false;
end;
$$;

revoke all on function public.pos_void_sale_atomic(text, text, text, text) from public, anon;
grant execute on function public.pos_void_sale_atomic(text, text, text, text) to authenticated, service_role;
