-- Every active main-system administrator can read customer orders. Only
-- administrators explicitly granted full access can change them.
create table public.customer_order_staff_permissions (
  admin_user_id uuid primary key references public.admin_users(id) on delete restrict,
  access_level text not null check (access_level in ('full', 'view')),
  created_at timestamptz not null default now()
);

alter table public.customer_order_staff_permissions enable row level security;
revoke all on public.customer_order_staff_permissions from public, anon, authenticated;
grant select on public.customer_order_staff_permissions to service_role;

-- Order events are append-only through the application. Staff actions keep
-- their actor ID even if an administrator's display name changes later.
revoke update, delete on public.customer_order_events from service_role;

-- These IDs are the five verified main-system accounts. On a separate test
-- project, only matching existing accounts are inserted.
insert into public.customer_order_staff_permissions (admin_user_id, access_level)
select a.id, allowed.access_level
from (values
  ('213df393-6ae8-4e39-bf2a-c767a42d6258'::uuid, 'full'), -- Jonnel
  ('ecb83890-f0de-4d21-91a0-3e4186db27e9'::uuid, 'full'), -- Sheryl
  ('93057d4b-c43f-4a0a-8e4a-82d6674617ce'::uuid, 'full'), -- Myra
  ('83556dbf-987a-4753-ad73-b0f69afce964'::uuid, 'view'), -- Francis
  ('3614ba50-3bc8-44b0-a27b-14a1d37e9180'::uuid, 'view')  -- Arlyn
) as allowed(admin_user_id, access_level)
join public.admin_users a on a.id = allowed.admin_user_id;
