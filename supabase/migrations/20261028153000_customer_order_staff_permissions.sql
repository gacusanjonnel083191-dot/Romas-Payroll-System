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

-- Match the five verified main-system accounts by name and existing role.
-- On a separate test project, only matching existing accounts are inserted.
insert into public.customer_order_staff_permissions (admin_user_id, access_level)
select a.id, allowed.access_level
from (values
  ('jonnel gacusan', 'owner', 'full'),
  ('sheryl rosal', 'payroll', 'full'),
  ('myra romero', 'hr', 'full'),
  ('francis galleto', 'asst_supervisor', 'view'),
  ('arlyn verano', 'supervisor', 'view')
) as allowed(full_name, role, access_level)
join public.admin_users a on lower(trim(a.full_name)) = allowed.full_name
  and lower(a.role) = allowed.role;
