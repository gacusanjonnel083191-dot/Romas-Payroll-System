-- A closed-by-default, auditable ordering switch. The Edge Function's
-- PUBLIC_ORDERING_SUBMISSIONS_ENABLED secret remains an emergency kill switch.
create table public.customer_ordering_control (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  version bigint not null default 0,
  changed_at timestamptz,
  changed_by uuid references public.admin_users(id) on delete restrict
);

insert into public.customer_ordering_control (id, enabled) values (true, false);

create table public.customer_ordering_control_events (
  id bigint generated always as identity primary key,
  actor_admin_user_id uuid not null references public.admin_users(id) on delete restrict,
  actor_name text not null,
  old_enabled boolean not null,
  new_enabled boolean not null,
  created_at timestamptz not null default now()
);

alter table public.customer_ordering_control enable row level security;
alter table public.customer_ordering_control_events enable row level security;
revoke all on public.customer_ordering_control, public.customer_ordering_control_events
  from public, anon, authenticated, service_role;
revoke all on sequence public.customer_ordering_control_events_id_seq
  from public, anon, authenticated, service_role;
grant select on public.customer_ordering_control, public.customer_ordering_control_events to service_role;

create function public.customer_set_ordering_enabled(
  p_actor_admin_user_id uuid,
  p_expected_version bigint,
  p_enabled boolean
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_actor_name text;
  v_old_enabled boolean;
  v_version bigint;
begin
  select a.full_name into v_actor_name
  from public.admin_users a
  join public.customer_order_staff_permissions p on p.admin_user_id = a.id
  where a.id = p_actor_admin_user_id and a.is_active = true
    and a.auth_user_id is not null and p.access_level = 'full';
  if v_actor_name is null or p_enabled is null then return false; end if;

  select c.enabled, c.version into v_old_enabled, v_version
  from public.customer_ordering_control c where c.id = true for update;
  if not found or v_version is distinct from p_expected_version
    or v_old_enabled = p_enabled then return false; end if;

  update public.customer_ordering_control
  set enabled = p_enabled, version = v_version + 1,
    changed_at = now(), changed_by = p_actor_admin_user_id
  where id = true;
  insert into public.customer_ordering_control_events
    (actor_admin_user_id, actor_name, old_enabled, new_enabled)
  values (p_actor_admin_user_id, v_actor_name, v_old_enabled, p_enabled);
  return true;
end;
$$;
revoke all on function public.customer_set_ordering_enabled(uuid,bigint,boolean)
  from public, anon, authenticated;
grant execute on function public.customer_set_ordering_enabled(uuid,bigint,boolean)
  to service_role;

-- Lock the control row during a new order insert so closing the switch waits
-- for in-flight inserts, and no insert can commit after the close takes effect.
create function public.customer_guard_ordering_open() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_enabled boolean;
begin
  select enabled into v_enabled
  from public.customer_ordering_control where id = true for share;
  if v_enabled is distinct from true then
    raise exception 'Customer ordering is closed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.customer_guard_ordering_open()
  from public, anon, authenticated;
create trigger customer_orders_ordering_open_guard
  before insert on public.customer_orders
  for each row execute function public.customer_guard_ordering_open();
