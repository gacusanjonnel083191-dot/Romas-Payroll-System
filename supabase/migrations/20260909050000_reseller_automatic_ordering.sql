begin;

create schema if not exists private;
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.reseller_auto_order_settings (
  reseller_id uuid primary key references public.resellers(id) on delete cascade,
  enabled boolean not null default false,
  safety_buffer_pct numeric(5,2) not null default 10 check (safety_buffer_pct between 0 and 50),
  notify_on_generated boolean not null default true,
  notify_on_adjusted boolean not null default true,
  notify_on_approved boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.reseller_auto_order_schedules (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.resellers(id) on delete cascade,
  delivery_weekday smallint not null check (delivery_weekday between 0 and 6),
  template_name text not null,
  enabled boolean not null default true,
  effective_start_date date not null default current_date,
  effective_end_date date,
  submission_time time not null default '13:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reseller_auto_order_schedule_date_check
    check (effective_end_date is null or effective_end_date >= effective_start_date),
  constraint reseller_auto_order_schedule_one_day unique (reseller_id, delivery_weekday)
);

create table if not exists public.reseller_auto_order_template_items (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.reseller_auto_order_schedules(id) on delete cascade,
  variant_id uuid not null references public.donut_variants(id) on delete restrict,
  variant_name text not null,
  template_quantity integer not null check (template_quantity > 0),
  minimum_quantity integer not null default 0 check (minimum_quantity >= 0),
  maximum_quantity integer check (maximum_quantity is null or maximum_quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reseller_auto_order_template_item_unique unique (schedule_id, variant_id),
  constraint reseller_auto_order_template_range_check
    check (maximum_quantity is null or maximum_quantity >= minimum_quantity)
);

create table if not exists public.reseller_auto_order_skips (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.resellers(id) on delete cascade,
  schedule_id uuid references public.reseller_auto_order_schedules(id) on delete cascade,
  skip_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by text,
  constraint reseller_auto_order_skip_unique unique (reseller_id, skip_date)
);

create table if not exists public.reseller_auto_order_runs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.reseller_auto_order_schedules(id) on delete set null,
  reseller_id uuid not null references public.resellers(id) on delete cascade,
  delivery_date date not null,
  status text not null check (status in ('generated','skipped','duplicate','error')),
  order_id uuid references public.reseller_orders(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.reseller_auto_order_events (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.resellers(id) on delete cascade,
  order_id uuid references public.reseller_orders(id) on delete cascade,
  event_type text not null check (event_type in ('generated','adjusted','approved','held','rejected','skipped','enabled','disabled','template_saved')),
  message text not null,
  performed_by text not null,
  notify_reseller boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.reseller_orders
  add column if not exists order_source text not null default 'manual',
  add column if not exists auto_schedule_id uuid references public.reseller_auto_order_schedules(id) on delete set null,
  add column if not exists generated_at timestamptz,
  add column if not exists original_suggested_qty integer,
  add column if not exists staff_adjustment_reason text,
  add column if not exists staff_adjusted_by text,
  add column if not exists staff_adjusted_at timestamptz,
  add column if not exists held_by text,
  add column if not exists held_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.reseller_order_items
  add column if not exists template_quantity integer,
  add column if not exists average_ordered_quantity numeric(10,2),
  add column if not exists average_sold_quantity numeric(10,2),
  add column if not exists average_returned_quantity numeric(10,2),
  add column if not exists suggested_quantity integer,
  add column if not exists staff_adjustment_reason text;

create index if not exists reseller_auto_order_schedules_due_idx
  on public.reseller_auto_order_schedules (delivery_weekday, enabled, effective_start_date, effective_end_date);
create index if not exists reseller_auto_order_skips_date_idx
  on public.reseller_auto_order_skips (skip_date, reseller_id);
create index if not exists reseller_auto_order_runs_delivery_idx
  on public.reseller_auto_order_runs (delivery_date, reseller_id, status);
create index if not exists reseller_auto_order_events_reseller_idx
  on public.reseller_auto_order_events (reseller_id, created_at desc);
create unique index if not exists reseller_auto_order_one_generated_run_idx
  on public.reseller_auto_order_runs (schedule_id, delivery_date)
  where status = 'generated';

alter table public.reseller_auto_order_settings enable row level security;
alter table public.reseller_auto_order_schedules enable row level security;
alter table public.reseller_auto_order_template_items enable row level security;
alter table public.reseller_auto_order_skips enable row level security;
alter table public.reseller_auto_order_runs enable row level security;
alter table public.reseller_auto_order_events enable row level security;

revoke all on table public.reseller_auto_order_settings from anon, authenticated;
revoke all on table public.reseller_auto_order_schedules from anon, authenticated;
revoke all on table public.reseller_auto_order_template_items from anon, authenticated;
revoke all on table public.reseller_auto_order_skips from anon, authenticated;
revoke all on table public.reseller_auto_order_runs from anon, authenticated;
revoke all on table public.reseller_auto_order_events from anon, authenticated;

grant select, insert, update, delete on table public.reseller_auto_order_settings to authenticated;
grant select, insert, update, delete on table public.reseller_auto_order_schedules to authenticated;
grant select, insert, update, delete on table public.reseller_auto_order_template_items to authenticated;
grant select, insert, update, delete on table public.reseller_auto_order_skips to authenticated;
grant select on table public.reseller_auto_order_runs to authenticated;
grant select, insert on table public.reseller_auto_order_events to authenticated;

create or replace function private.is_reseller_order_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.auth_user_id = auth.uid()
      and coalesce(au.is_active, true) = true
      and (
        lower(coalesce(au.role, '')) in ('owner','manager','hr')
        or exists (
          select 1
          from unnest(string_to_array(lower(coalesce(au.extra_roles, '')), ',')) as extra(role_name)
          where trim(extra.role_name) in ('owner','manager','hr')
        )
        or exists (select 1 from public.invoice_deletion_requesters p where p.admin_user_id = au.id and p.is_active = true)
      )
  );
$$;

drop policy if exists reseller_auto_order_settings_admin_select on public.reseller_auto_order_settings;
create policy reseller_auto_order_settings_admin_select
  on public.reseller_auto_order_settings for select to authenticated
  using ((select private.is_reseller_order_admin()));
drop policy if exists reseller_auto_order_settings_admin_insert on public.reseller_auto_order_settings;
create policy reseller_auto_order_settings_admin_insert
  on public.reseller_auto_order_settings for insert to authenticated
  with check ((select private.is_reseller_order_admin()));
drop policy if exists reseller_auto_order_settings_admin_update on public.reseller_auto_order_settings;
create policy reseller_auto_order_settings_admin_update
  on public.reseller_auto_order_settings for update to authenticated
  using ((select private.is_reseller_order_admin()))
  with check ((select private.is_reseller_order_admin()));
drop policy if exists reseller_auto_order_settings_admin_delete on public.reseller_auto_order_settings;
create policy reseller_auto_order_settings_admin_delete
  on public.reseller_auto_order_settings for delete to authenticated
  using ((select private.is_reseller_order_admin()));

drop policy if exists reseller_auto_order_schedules_admin_select on public.reseller_auto_order_schedules;
create policy reseller_auto_order_schedules_admin_select
  on public.reseller_auto_order_schedules for select to authenticated
  using ((select private.is_reseller_order_admin()));
drop policy if exists reseller_auto_order_schedules_admin_insert on public.reseller_auto_order_schedules;
create policy reseller_auto_order_schedules_admin_insert
  on public.reseller_auto_order_schedules for insert to authenticated
  with check ((select private.is_reseller_order_admin()));
drop policy if exists reseller_auto_order_schedules_admin_update on public.reseller_auto_order_schedules;
create policy reseller_auto_order_schedules_admin_update
  on public.reseller_auto_order_schedules for update to authenticated
  using ((select private.is_reseller_order_admin()))
  with check ((select private.is_reseller_order_admin()));
drop policy if exists reseller_auto_order_schedules_admin_delete on public.reseller_auto_order_schedules;
create policy reseller_auto_order_schedules_admin_delete
  on public.reseller_auto_order_schedules for delete to authenticated
  using ((select private.is_reseller_order_admin()));

drop policy if exists reseller_auto_order_items_admin_select on public.reseller_auto_order_template_items;
create policy reseller_auto_order_items_admin_select
  on public.reseller_auto_order_template_items for select to authenticated
  using ((select private.is_reseller_order_admin()));
drop policy if exists reseller_auto_order_items_admin_insert on public.reseller_auto_order_template_items;
create policy reseller_auto_order_items_admin_insert
  on public.reseller_auto_order_template_items for insert to authenticated
  with check ((select private.is_reseller_order_admin()));
drop policy if exists reseller_auto_order_items_admin_update on public.reseller_auto_order_template_items;
create policy reseller_auto_order_items_admin_update
  on public.reseller_auto_order_template_items for update to authenticated
  using ((select private.is_reseller_order_admin()))
  with check ((select private.is_reseller_order_admin()));
drop policy if exists reseller_auto_order_items_admin_delete on public.reseller_auto_order_template_items;
create policy reseller_auto_order_items_admin_delete
  on public.reseller_auto_order_template_items for delete to authenticated
  using ((select private.is_reseller_order_admin()));

drop policy if exists reseller_auto_order_skips_admin_select on public.reseller_auto_order_skips;
create policy reseller_auto_order_skips_admin_select
  on public.reseller_auto_order_skips for select to authenticated
  using ((select private.is_reseller_order_admin()));
drop policy if exists reseller_auto_order_skips_admin_insert on public.reseller_auto_order_skips;
create policy reseller_auto_order_skips_admin_insert
  on public.reseller_auto_order_skips for insert to authenticated
  with check ((select private.is_reseller_order_admin()));
drop policy if exists reseller_auto_order_skips_admin_update on public.reseller_auto_order_skips;
create policy reseller_auto_order_skips_admin_update
  on public.reseller_auto_order_skips for update to authenticated
  using ((select private.is_reseller_order_admin()))
  with check ((select private.is_reseller_order_admin()));
drop policy if exists reseller_auto_order_skips_admin_delete on public.reseller_auto_order_skips;
create policy reseller_auto_order_skips_admin_delete
  on public.reseller_auto_order_skips for delete to authenticated
  using ((select private.is_reseller_order_admin()));

drop policy if exists reseller_auto_order_runs_admin_select on public.reseller_auto_order_runs;
create policy reseller_auto_order_runs_admin_select
  on public.reseller_auto_order_runs for select to authenticated
  using ((select private.is_reseller_order_admin()));
drop policy if exists reseller_auto_order_events_admin_select on public.reseller_auto_order_events;
create policy reseller_auto_order_events_admin_select
  on public.reseller_auto_order_events for select to authenticated
  using ((select private.is_reseller_order_admin()));
drop policy if exists reseller_auto_order_events_admin_insert on public.reseller_auto_order_events;
create policy reseller_auto_order_events_admin_insert
  on public.reseller_auto_order_events for insert to authenticated
  with check ((select private.is_reseller_order_admin()));

create or replace function private.verify_reseller_portal_credentials(
  p_reseller_id uuid,
  p_access_code text,
  p_access_pin text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.resellers r
    left join public.reseller_accounts ra on ra.id = r.reseller_account_id
    where r.id = p_reseller_id
      and nullif(trim(p_access_code), '') is not null
      and nullif(trim(p_access_pin), '') is not null
      and coalesce(r.is_active, true) = true
      and (
        (
          upper(trim(coalesce(r.access_code, ''))) = upper(trim(coalesce(p_access_code, '')))
          and coalesce(r.access_pin, '') = coalesce(p_access_pin, '')
        )
        or (
          ra.id is not null
          and coalesce(ra.is_active, true) = true
          and upper(trim(coalesce(ra.access_code, ''))) = upper(trim(coalesce(p_access_code, '')))
          and coalesce(ra.access_pin, '') = coalesce(p_access_pin, '')
        )
      )
  );
$$;

create or replace function private.get_reseller_auto_order_config_internal(
  p_reseller_id uuid,
  p_access_code text,
  p_access_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  result jsonb;
begin
  if not private.verify_reseller_portal_credentials(p_reseller_id, p_access_code, p_access_pin) then
    raise exception 'Invalid or inactive reseller portal credentials.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'settings', coalesce(
      (select to_jsonb(s) from public.reseller_auto_order_settings s where s.reseller_id = p_reseller_id),
      jsonb_build_object(
        'reseller_id', p_reseller_id,
        'enabled', false,
        'safety_buffer_pct', 10,
        'notify_on_generated', true,
        'notify_on_adjusted', true,
        'notify_on_approved', true
      )
    ),
    'schedules', coalesce((
      select jsonb_agg(
        to_jsonb(s) || jsonb_build_object(
          'items', coalesce((
            select jsonb_agg(to_jsonb(i) order by i.variant_name)
            from public.reseller_auto_order_template_items i
            where i.schedule_id = s.id
          ), '[]'::jsonb),
          'skips', coalesce((
            select jsonb_agg(to_jsonb(k) order by k.skip_date)
            from public.reseller_auto_order_skips k
            where k.schedule_id = s.id and k.skip_date >= current_date
          ), '[]'::jsonb)
        ) order by s.delivery_weekday
      )
      from public.reseller_auto_order_schedules s
      where s.reseller_id = p_reseller_id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at desc)
      from (
        select * from public.reseller_auto_order_events
        where reseller_id = p_reseller_id
        order by created_at desc
        limit 20
      ) e
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.reseller_auto_order_get(
  p_reseller_id uuid,
  p_access_code text,
  p_access_pin text
)
returns jsonb
language sql
security invoker
set search_path = public, private, pg_catalog
as $$
  select private.get_reseller_auto_order_config_internal(p_reseller_id, p_access_code, p_access_pin);
$$;

create or replace function private.set_reseller_auto_order_enabled_internal(
  p_reseller_id uuid,
  p_access_code text,
  p_access_pin text,
  p_enabled boolean,
  p_safety_buffer_pct numeric default 10,
  p_notify_on_generated boolean default true,
  p_notify_on_adjusted boolean default true,
  p_notify_on_approved boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  if not private.verify_reseller_portal_credentials(p_reseller_id, p_access_code, p_access_pin) then
    raise exception 'Invalid or inactive reseller portal credentials.' using errcode = '42501';
  end if;

  insert into public.reseller_auto_order_settings (
    reseller_id, enabled, safety_buffer_pct,
    notify_on_generated, notify_on_adjusted, notify_on_approved,
    updated_at, updated_by
  ) values (
    p_reseller_id, coalesce(p_enabled, false), least(50, greatest(0, coalesce(p_safety_buffer_pct, 10))),
    coalesce(p_notify_on_generated, true), coalesce(p_notify_on_adjusted, true), coalesce(p_notify_on_approved, true),
    now(), 'Reseller Portal'
  )
  on conflict (reseller_id) do update set
    enabled = excluded.enabled,
    safety_buffer_pct = excluded.safety_buffer_pct,
    notify_on_generated = excluded.notify_on_generated,
    notify_on_adjusted = excluded.notify_on_adjusted,
    notify_on_approved = excluded.notify_on_approved,
    updated_at = now(),
    updated_by = 'Reseller Portal';

  insert into public.reseller_auto_order_events (reseller_id, event_type, message, performed_by)
  values (
    p_reseller_id,
    case when p_enabled then 'enabled' else 'disabled' end,
    case when p_enabled then 'Automatic ordering enabled.' else 'Automatic ordering disabled.' end,
    'Reseller Portal'
  );

  return jsonb_build_object('ok', true, 'enabled', coalesce(p_enabled, false));
end;
$$;

create or replace function public.reseller_auto_order_set_enabled(
  p_reseller_id uuid,
  p_access_code text,
  p_access_pin text,
  p_enabled boolean,
  p_safety_buffer_pct numeric default 10,
  p_notify_on_generated boolean default true,
  p_notify_on_adjusted boolean default true,
  p_notify_on_approved boolean default true
)
returns jsonb
language sql
security invoker
set search_path = public, private, pg_catalog
as $$
  select private.set_reseller_auto_order_enabled_internal(
    p_reseller_id, p_access_code, p_access_pin, p_enabled, p_safety_buffer_pct,
    p_notify_on_generated, p_notify_on_adjusted, p_notify_on_approved
  );
$$;

create or replace function private.save_reseller_auto_order_schedule_internal(
  p_reseller_id uuid,
  p_access_code text,
  p_access_pin text,
  p_delivery_weekday smallint,
  p_template_name text,
  p_enabled boolean,
  p_effective_start_date date,
  p_effective_end_date date,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_schedule_id uuid;
  local_now timestamp := timezone('Asia/Manila', now());
  tomorrow_date date := timezone('Asia/Manila', now())::date + 1;
  tomorrow_weekday smallint := extract(dow from tomorrow_date)::smallint;
  item_count integer;
begin
  if not private.verify_reseller_portal_credentials(p_reseller_id, p_access_code, p_access_pin) then
    raise exception 'Invalid or inactive reseller portal credentials.' using errcode = '42501';
  end if;
  if p_delivery_weekday not between 0 and 6 then
    raise exception 'Delivery weekday must be from 0 to 6.';
  end if;
  if local_now::time >= time '13:00' and p_delivery_weekday = tomorrow_weekday then
    raise exception 'Tomorrow''s automatic-order template is locked after the 1:00 PM Philippine-time cutoff.';
  end if;
  if nullif(trim(coalesce(p_template_name, '')), '') is null then
    raise exception 'Template name is required.';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Template items must be an array.';
  end if;

  insert into public.reseller_auto_order_schedules (
    reseller_id, delivery_weekday, template_name, enabled,
    effective_start_date, effective_end_date, submission_time, updated_at
  ) values (
    p_reseller_id, p_delivery_weekday, trim(p_template_name), coalesce(p_enabled, true),
    coalesce(p_effective_start_date, local_now::date), p_effective_end_date, time '13:00', now()
  )
  on conflict (reseller_id, delivery_weekday) do update set
    template_name = excluded.template_name,
    enabled = excluded.enabled,
    effective_start_date = excluded.effective_start_date,
    effective_end_date = excluded.effective_end_date,
    submission_time = time '13:00',
    updated_at = now()
  returning id into v_schedule_id;

  delete from public.reseller_auto_order_template_items where schedule_id = v_schedule_id;

  insert into public.reseller_auto_order_template_items (
    schedule_id, variant_id, variant_name, template_quantity,
    minimum_quantity, maximum_quantity, updated_at
  )
  select
    v_schedule_id,
    (item->>'variant_id')::uuid,
    trim(item->>'variant_name'),
    greatest(1, (item->>'template_quantity')::integer),
    greatest(0, coalesce(nullif(item->>'minimum_quantity', '')::integer, floor((item->>'template_quantity')::numeric * 0.80)::integer)),
    coalesce(nullif(item->>'maximum_quantity', '')::integer, ceil((item->>'template_quantity')::numeric * 1.20)::integer),
    now()
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) item
  where coalesce(nullif(item->>'template_quantity', '')::integer, 0) > 0
    and nullif(item->>'variant_id', '') is not null;

  get diagnostics item_count = row_count;
  if item_count = 0 then
    raise exception 'Add at least one product with a quantity greater than zero.';
  end if;

  insert into public.reseller_auto_order_events (reseller_id, event_type, message, performed_by)
  values (p_reseller_id, 'template_saved', trim(p_template_name) || ' template saved for the 1:00 PM cutoff.', 'Reseller Portal');

  return jsonb_build_object('ok', true, 'schedule_id', v_schedule_id, 'item_count', item_count);
end;
$$;

create or replace function public.reseller_auto_order_save_schedule(
  p_reseller_id uuid,
  p_access_code text,
  p_access_pin text,
  p_delivery_weekday smallint,
  p_template_name text,
  p_enabled boolean,
  p_effective_start_date date,
  p_effective_end_date date,
  p_items jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, private, pg_catalog
as $$
  select private.save_reseller_auto_order_schedule_internal(
    p_reseller_id, p_access_code, p_access_pin, p_delivery_weekday,
    p_template_name, p_enabled, p_effective_start_date, p_effective_end_date, p_items
  );
$$;

create or replace function private.skip_reseller_auto_order_date_internal(
  p_reseller_id uuid,
  p_access_code text,
  p_access_pin text,
  p_skip_date date,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  local_now timestamp := timezone('Asia/Manila', now());
  target_schedule_id uuid;
begin
  if not private.verify_reseller_portal_credentials(p_reseller_id, p_access_code, p_access_pin) then
    raise exception 'Invalid or inactive reseller portal credentials.' using errcode = '42501';
  end if;
  if p_skip_date < local_now::date + 1 then
    raise exception 'Only future delivery dates can be skipped.';
  end if;
  if p_skip_date = local_now::date + 1 and local_now::time >= time '13:00' then
    raise exception 'Tomorrow''s order can no longer be skipped after the 1:00 PM Philippine-time cutoff.';
  end if;

  select id into target_schedule_id
  from public.reseller_auto_order_schedules
  where reseller_id = p_reseller_id
    and delivery_weekday = extract(dow from p_skip_date)::smallint
  limit 1;
  if target_schedule_id is null then
    raise exception 'No automatic-order template exists for that delivery day.';
  end if;

  insert into public.reseller_auto_order_skips (reseller_id, schedule_id, skip_date, reason, created_by)
  values (p_reseller_id, target_schedule_id, p_skip_date, nullif(trim(coalesce(p_reason, '')), ''), 'Reseller Portal')
  on conflict (reseller_id, skip_date) do update set
    schedule_id = excluded.schedule_id,
    reason = excluded.reason,
    created_by = excluded.created_by;

  insert into public.reseller_auto_order_events (reseller_id, event_type, message, performed_by)
  values (p_reseller_id, 'skipped', 'Automatic order skipped for ' || p_skip_date::text || '.', 'Reseller Portal');

  return jsonb_build_object('ok', true, 'skip_date', p_skip_date);
end;
$$;

create or replace function public.reseller_auto_order_skip_date(
  p_reseller_id uuid,
  p_access_code text,
  p_access_pin text,
  p_skip_date date,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = public, private, pg_catalog
as $$
  select private.skip_reseller_auto_order_date_internal(
    p_reseller_id, p_access_code, p_access_pin, p_skip_date, p_reason
  );
$$;

create or replace function private.generate_reseller_auto_orders(p_as_of timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  local_now timestamp := timezone('Asia/Manila', p_as_of);
  target_date date := timezone('Asia/Manila', p_as_of)::date + 1;
  target_weekday smallint := extract(dow from timezone('Asia/Manila', p_as_of)::date + 1)::smallint;
  schedule_row record;
  item_row record;
  v_order_id uuid;
  generated_count integer := 0;
  skipped_count integer := 0;
  v_total_qty integer;
  v_total_amount numeric(14,2);
  avg_ordered numeric(10,2);
  avg_sold numeric(10,2);
  avg_returned numeric(10,2);
  suggested integer;
  safety_pct numeric(5,2);
  reseller_price numeric(12,2);
begin
  if local_now::time < time '13:00' then
    return jsonb_build_object('ok', false, 'reason', 'before_cutoff');
  end if;
  if not pg_try_advisory_xact_lock(748219, target_date - date '2000-01-01') then
    return jsonb_build_object('ok', false, 'reason', 'already_running', 'delivery_date', target_date);
  end if;

  for schedule_row in
    select s.*, r.name reseller_name, st.safety_buffer_pct
    from public.reseller_auto_order_schedules s
    join public.reseller_auto_order_settings st on st.reseller_id = s.reseller_id and st.enabled = true
    join public.resellers r on r.id = s.reseller_id and coalesce(r.is_active, true) = true
    where s.enabled = true
      and s.delivery_weekday = target_weekday
      and s.effective_start_date <= target_date
      and (s.effective_end_date is null or s.effective_end_date >= target_date)
  loop
    begin
      if exists (
        select 1 from public.reseller_auto_order_skips k
        where k.reseller_id = schedule_row.reseller_id and k.skip_date = target_date
      ) then
        insert into public.reseller_auto_order_runs (schedule_id, reseller_id, delivery_date, status, details)
        values (schedule_row.id, schedule_row.reseller_id, target_date, 'skipped', jsonb_build_object('reason', 'reseller_skip'));
        skipped_count := skipped_count + 1;
        continue;
      end if;

      if exists (
        select 1
        from public.delivery_invoices overdue
        where overdue.reseller_id = schedule_row.reseller_id
          and lower(coalesce(overdue.status, 'unpaid')) not in ('paid','cancelled','voided')
          and coalesce(overdue.due_date, overdue.delivery_date + 7) < local_now::date
          and greatest(
            coalesce(overdue.total_amount, 0)
            - coalesce(overdue.paid_amount, 0)
            ,
            0
          ) > 0.009
      ) then
        insert into public.reseller_auto_order_runs (schedule_id, reseller_id, delivery_date, status, details)
        values (schedule_row.id, schedule_row.reseller_id, target_date, 'skipped', jsonb_build_object('reason', 'overdue_account'));
        insert into public.reseller_auto_order_events (reseller_id, event_type, message, performed_by)
        values (schedule_row.reseller_id, 'skipped', 'Automatic order was not submitted because the reseller account has an overdue balance.', 'System');
        skipped_count := skipped_count + 1;
        continue;
      end if;

      if exists (
        select 1 from public.reseller_orders o
        where o.reseller_id = schedule_row.reseller_id
          and o.delivery_date = target_date
          and lower(coalesce(o.status, 'pending')) not in ('rejected','cancelled','voided')
      ) or exists (
        select 1 from public.delivery_invoices i
        where i.reseller_id = schedule_row.reseller_id
          and i.delivery_date = target_date
          and lower(coalesce(i.status, 'unpaid')) not in ('cancelled','voided')
      ) then
        insert into public.reseller_auto_order_runs (schedule_id, reseller_id, delivery_date, status, details)
        values (schedule_row.id, schedule_row.reseller_id, target_date, 'duplicate', jsonb_build_object('reason', 'manual_order_or_invoice_exists'));
        skipped_count := skipped_count + 1;
        continue;
      end if;

      v_order_id := gen_random_uuid();
      v_total_qty := 0;
      v_total_amount := 0;
      safety_pct := least(50, greatest(0, coalesce(schedule_row.safety_buffer_pct, 10)));

      insert into public.reseller_orders (
        id, reseller_id, reseller_name, order_date, delivery_date,
        status, notes, total_qty, estimated_amount,
        order_source, auto_schedule_id, generated_at, original_suggested_qty
      ) values (
        v_order_id, schedule_row.reseller_id, schedule_row.reseller_name,
        local_now::date, target_date, 'pending',
        'Automatically submitted from ' || schedule_row.template_name || ' at the 1:00 PM Philippine-time cutoff. Staff approval required.',
        0, 0, 'automatic', schedule_row.id, p_as_of, 0
      );

      for item_row in
        select ti.*, v.selling_price
        from public.reseller_auto_order_template_items ti
        join public.donut_variants v on v.id = ti.variant_id and coalesce(v.is_active, true) = true
        where ti.schedule_id = schedule_row.id and ti.template_quantity > 0
        order by ti.variant_name
      loop
        select
          round(avg(h.ordered_qty), 2),
          round(avg(h.sold_qty), 2),
          round(avg(h.returned_qty), 2)
        into avg_ordered, avg_sold, avg_returned
        from (
          select
            coalesce((
              select sum(roi.quantity)
              from public.reseller_orders ro
              join public.reseller_order_items roi on roi.order_id = ro.id
              where ro.reseller_id = schedule_row.reseller_id
                and ro.delivery_date = di.delivery_date
                and roi.variant_id = item_row.variant_id
                and lower(coalesce(ro.status, 'pending')) not in ('rejected','cancelled','voided')
            ), dii.quantity)::numeric ordered_qty,
            greatest(dii.quantity - coalesce(sum(rri.returned_quantity), 0), 0)::numeric sold_qty,
            coalesce(sum(rri.returned_quantity), 0)::numeric returned_qty
          from public.delivery_invoices di
          join public.delivery_invoice_items dii on dii.invoice_id = di.id and dii.variant_id = item_row.variant_id
          left join public.reseller_returns rr on rr.invoice_id = di.id
          left join public.reseller_return_items rri on rri.return_id = rr.id and rri.variant_id = item_row.variant_id
          where di.reseller_id = schedule_row.reseller_id
            and di.delivery_date < target_date
            and extract(dow from di.delivery_date)::smallint = target_weekday
            and lower(coalesce(di.status, 'unpaid')) not in ('cancelled','voided')
          group by di.id, di.delivery_date, dii.quantity
          order by di.delivery_date desc
          limit 4
        ) h;

        suggested := case
          when avg_sold is null then item_row.template_quantity
          else round(avg_sold * (1 + safety_pct / 100.0))::integer
        end;
        suggested := greatest(item_row.minimum_quantity, suggested);
        suggested := least(coalesce(item_row.maximum_quantity, ceil(item_row.template_quantity * 1.20)::integer), suggested);
        reseller_price := round(coalesce(item_row.selling_price, 0) * 0.80, 2);

        insert into public.reseller_order_items (
          order_id, variant_id, variant_name, quantity, retail_price, reseller_price,
          template_quantity, average_ordered_quantity, average_sold_quantity,
          average_returned_quantity, suggested_quantity
        ) values (
          v_order_id, item_row.variant_id, item_row.variant_name, suggested,
          coalesce(item_row.selling_price, 0), reseller_price,
          item_row.template_quantity, avg_ordered, avg_sold, avg_returned, suggested
        );

        v_total_qty := v_total_qty + suggested;
        v_total_amount := v_total_amount + (suggested * reseller_price);
      end loop;

      if v_total_qty <= 0 then
        delete from public.reseller_orders where id = v_order_id;
        insert into public.reseller_auto_order_runs (schedule_id, reseller_id, delivery_date, status, details)
        values (schedule_row.id, schedule_row.reseller_id, target_date, 'error', jsonb_build_object('reason', 'no_active_template_items'));
        skipped_count := skipped_count + 1;
        continue;
      end if;

      update public.reseller_orders
      set total_qty = v_total_qty,
          estimated_amount = round(v_total_amount, 2),
          original_suggested_qty = v_total_qty
      where id = v_order_id;

      insert into public.reseller_auto_order_runs (schedule_id, reseller_id, delivery_date, status, order_id, details)
      values (
        schedule_row.id, schedule_row.reseller_id, target_date, 'generated', v_order_id,
        jsonb_build_object('template_name', schedule_row.template_name, 'total_qty', v_total_qty, 'estimated_amount', round(v_total_amount, 2), 'safety_buffer_pct', safety_pct)
      );
      insert into public.reseller_auto_order_events (reseller_id, order_id, event_type, message, performed_by)
      values (
        schedule_row.reseller_id, v_order_id, 'generated',
        'Automatic order submitted for ' || target_date::text || ' with ' || v_total_qty::text || ' suggested pieces. Waiting for staff approval.',
        'System'
      );
      generated_count := generated_count + 1;
    exception when others then
      insert into public.reseller_auto_order_runs (schedule_id, reseller_id, delivery_date, status, details)
      values (schedule_row.id, schedule_row.reseller_id, target_date, 'error', jsonb_build_object('error', sqlerrm));
      skipped_count := skipped_count + 1;
    end;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'delivery_date', target_date,
    'generated_count', generated_count,
    'skipped_count', skipped_count
  );
end;
$$;

-- Store the notification decision with the event; audit history is always retained.
create or replace function private.flag_reseller_auto_order_notice()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_settings public.reseller_auto_order_settings%rowtype;
begin
  select * into v_settings from public.reseller_auto_order_settings where reseller_id = new.reseller_id;
  new.notify_reseller := case new.event_type
    when 'generated' then coalesce(v_settings.notify_on_generated, true)
    when 'adjusted' then coalesce(v_settings.notify_on_adjusted, true)
    when 'approved' then coalesce(v_settings.notify_on_approved, true)
    when 'held' then true when 'rejected' then true when 'skipped' then true
    else false end;
  return new;
end;
$$;
drop trigger if exists reseller_auto_order_notice on public.reseller_auto_order_events;
create trigger reseller_auto_order_notice before insert on public.reseller_auto_order_events
for each row execute function private.flag_reseller_auto_order_notice();

-- Approval, quantities, invoice lines, and audit events commit together.
create or replace function private.review_reseller_auto_order_internal(
  p_order_id uuid, p_action text, p_items jsonb default '[]'::jsonb, p_reason text default null
)
returns jsonb language plpgsql security definer set search_path = public, private, pg_catalog as $$
declare
  v_order public.reseller_orders%rowtype;
  v_item record;
  v_actor text;
  v_invoice_id uuid;
  v_invoice_number text;
  v_quantity integer;
  v_count integer;
  v_changed integer := 0;
  v_total_qty integer := 0;
  v_total numeric := 0;
begin
  if not private.is_reseller_order_admin() then
    raise exception 'Only authorized order staff can review automatic orders.' using errcode = '42501';
  end if;
  select coalesce(nullif(full_name, ''), role, 'Staff') into v_actor
    from public.admin_users where auth_user_id = auth.uid() limit 1;
  if p_action not in ('approve','hold','reject') or p_action is null then
    raise exception 'Invalid order review action.';
  end if;
  select * into v_order from public.reseller_orders where id = p_order_id for update;
  if not found or v_order.order_source <> 'automatic' then raise exception 'Automatic order not found.'; end if;
  if v_order.status not in ('pending','on_hold') or v_order.invoice_id is not null then
    raise exception 'This order has already been reviewed. Refresh the order list.';
  end if;
  p_reason := nullif(trim(p_reason), '');
  if p_action in ('hold','reject') then
    if p_reason is null then raise exception 'A reason is required.'; end if;
    update public.reseller_orders set
      status = case when p_action = 'hold' then 'on_hold' else 'rejected' end,
      held_by = case when p_action = 'hold' then v_actor else held_by end,
      held_at = case when p_action = 'hold' then now() else held_at end,
      staff_adjustment_reason = case when p_action = 'hold' then p_reason else staff_adjustment_reason end,
      rejection_reason = case when p_action = 'reject' then p_reason else rejection_reason end
    where id = p_order_id;
    insert into public.reseller_auto_order_events (reseller_id, order_id, event_type, message, performed_by)
    values (v_order.reseller_id, p_order_id, case when p_action = 'hold' then 'held' else 'rejected' end,
      'Order for ' || v_order.delivery_date::text || case when p_action = 'hold' then ' placed on hold. ' else ' rejected. ' end || p_reason, v_actor);
    return jsonb_build_object('ok', true, 'action', p_action);
  end if;

  -- Serialize approvals for the same branch and day.
  perform pg_advisory_xact_lock(hashtext(v_order.reseller_id::text), v_order.delivery_date - date '2000-01-01');
  if exists (select 1 from public.delivery_invoices where reseller_id = v_order.reseller_id
      and delivery_date = v_order.delivery_date and lower(coalesce(status,'')) not in ('cancelled','voided')) then
    raise exception 'An active invoice already exists for this reseller and delivery date.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Order items are required.'; end if;
  select count(*) into v_count from public.reseller_order_items where order_id = p_order_id;
  if jsonb_array_length(p_items) <> v_count or
    (select count(distinct x->>'id') from jsonb_array_elements(p_items) x) <> v_count or
    exists (select 1 from jsonb_array_elements(p_items) x where not exists (
      select 1 from public.reseller_order_items i where i.order_id = p_order_id and i.id::text = x->>'id')) then
    raise exception 'Order lines have changed. Refresh before approving.';
  end if;

  for v_item in select * from public.reseller_order_items where order_id = p_order_id for update loop
    select (x->>'quantity')::integer into v_quantity from jsonb_array_elements(p_items) x where x->>'id' = v_item.id::text;
    if v_quantity is null or v_quantity < 0 then raise exception 'Quantities must be zero or greater.'; end if;
    if v_quantity <> coalesce(v_item.suggested_quantity, v_item.quantity) then v_changed := v_changed + 1; end if;
    v_total_qty := v_total_qty + v_quantity;
    v_total := v_total + v_quantity * round(coalesce(v_item.retail_price,0) * 0.80, 2);
    update public.reseller_order_items set quantity = v_quantity,
      reseller_price = round(coalesce(v_item.retail_price,0) * 0.80, 2),
      staff_adjustment_reason = case when v_quantity <> coalesce(v_item.suggested_quantity, v_item.quantity) then p_reason else null end
      where id = v_item.id;
  end loop;
  if v_total_qty <= 0 then raise exception 'Use Reject when no products are required.'; end if;
  if v_changed > 0 and p_reason is null then raise exception 'Explain the quantity changes before approval.'; end if;
  v_invoice_number := 'INV-' || to_char(v_order.delivery_date,'YYYYMMDD') || '-' || upper(substr(replace(p_order_id::text,'-',''),1,12));
  insert into public.delivery_invoices (invoice_number,reseller_id,reseller_name,delivery_date,due_date,
    subtotal,discount_pct,total_amount,status,prepared_by,dispatched_by,notes,created_by)
  values (v_invoice_number,v_order.reseller_id,v_order.reseller_name,v_order.delivery_date,v_order.delivery_date + 7,
    v_total,20,v_total,'unpaid','Ronald Reyes / Jomar Cerezo','Ronald Reyes / Jomar Cerezo',
    'From automatic order ' || p_order_id::text || coalesce(' | Staff reason: ' || p_reason,''),v_actor)
  returning id into v_invoice_id;
  insert into public.delivery_invoice_items (invoice_id,variant_id,variant_name,retail_price,reseller_price,quantity,total_price)
  select v_invoice_id,variant_id,variant_name,retail_price,reseller_price,quantity,round(quantity * reseller_price,2)
    from public.reseller_order_items where order_id = p_order_id and quantity > 0;
  update public.reseller_orders set status = 'approved', approved_by = v_actor, approved_at = now(), invoice_id = v_invoice_id,
    total_qty = v_total_qty, estimated_amount = v_total,
    staff_adjustment_reason = case when v_changed > 0 then p_reason else staff_adjustment_reason end,
    staff_adjusted_by = case when v_changed > 0 then v_actor else staff_adjusted_by end,
    staff_adjusted_at = case when v_changed > 0 then now() else staff_adjusted_at end
    where id = p_order_id;
  if v_changed > 0 then
    insert into public.reseller_auto_order_events (reseller_id,order_id,event_type,message,performed_by)
    values (v_order.reseller_id,p_order_id,'adjusted','Staff adjusted ' || v_changed::text || ' product line(s). Reason: ' || p_reason,v_actor);
  end if;
  insert into public.reseller_auto_order_events (reseller_id,order_id,event_type,message,performed_by)
  values (v_order.reseller_id,p_order_id,'approved','Order approved: ' || v_total_qty::text || ' pieces. Invoice ' || v_invoice_number || '.',v_actor);
  return jsonb_build_object('ok',true,'action',p_action,'invoice_id',v_invoice_id,'invoice_number',v_invoice_number,'total_qty',v_total_qty,'total_amount',v_total);
end;
$$;
create or replace function public.reseller_auto_order_review(p_order_id uuid,p_action text,p_items jsonb default '[]'::jsonb,p_reason text default null)
returns jsonb language sql security invoker set search_path = public, private, pg_catalog as $$
  select private.review_reseller_auto_order_internal(p_order_id,p_action,p_items,p_reason);
$$;
-- Legacy manual ordering uses direct table access. Protect automatic records and
-- enforce the reseller cutoff on the server without changing that login flow.
create or replace function private.guard_reseller_order_write()
returns trigger language plpgsql security invoker set search_path = public, pg_catalog as $$
declare
  v_auto boolean := false;
  v_dates date[] := '{}';
  v_parent record;
  v_local timestamp := timezone('Asia/Manila',now());
begin
  if current_user in ('postgres','supabase_admin','service_role') then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_table_name='reseller_orders' then
    if tg_op<>'INSERT' then v_auto := old.order_source='automatic'; v_dates := array_append(v_dates,old.delivery_date); end if;
    if tg_op<>'DELETE' then v_auto := v_auto or new.order_source='automatic'; v_dates := array_append(v_dates,new.delivery_date); end if;
  else
    if tg_op<>'INSERT' then
      select order_source,delivery_date into v_parent from public.reseller_orders where id=old.order_id;
      v_auto := coalesce(v_parent.order_source='automatic',false); v_dates := array_append(v_dates,v_parent.delivery_date);
    end if;
    if tg_op<>'DELETE' then
      select order_source,delivery_date into v_parent from public.reseller_orders where id=new.order_id;
      v_auto := v_auto or coalesce(v_parent.order_source='automatic',false); v_dates := array_append(v_dates,v_parent.delivery_date);
    end if;
  end if;
  if v_auto then raise exception 'Automatic orders must be changed through staff review.' using errcode='42501'; end if;
  if current_user='anon' and v_local::time >= time '13:00' and (v_local::date+1)=any(v_dates) then
    raise exception 'Tomorrow''s reseller order is locked after 1:00 PM Philippine time.';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists reseller_order_write_guard on public.reseller_orders;
create trigger reseller_order_write_guard before insert or update or delete on public.reseller_orders
for each row execute function private.guard_reseller_order_write();
drop trigger if exists reseller_order_item_write_guard on public.reseller_order_items;
create trigger reseller_order_item_write_guard before insert or update or delete on public.reseller_order_items
for each row execute function private.guard_reseller_order_write();
revoke all on function private.guard_reseller_order_write() from public;
revoke all on function private.flag_reseller_auto_order_notice() from public;
revoke all on function private.review_reseller_auto_order_internal(uuid,text,jsonb,text) from public;
revoke all on function public.reseller_auto_order_review(uuid,text,jsonb,text) from public;
grant execute on function private.review_reseller_auto_order_internal(uuid,text,jsonb,text) to authenticated;
grant execute on function public.reseller_auto_order_review(uuid,text,jsonb,text) to authenticated;

revoke all on function private.is_reseller_order_admin() from public;
revoke all on function private.verify_reseller_portal_credentials(uuid, text, text) from public;
revoke all on function private.get_reseller_auto_order_config_internal(uuid, text, text) from public;
revoke all on function private.set_reseller_auto_order_enabled_internal(uuid, text, text, boolean, numeric, boolean, boolean, boolean) from public;
revoke all on function private.save_reseller_auto_order_schedule_internal(uuid, text, text, smallint, text, boolean, date, date, jsonb) from public;
revoke all on function private.skip_reseller_auto_order_date_internal(uuid, text, text, date, text) from public;
revoke all on function private.generate_reseller_auto_orders(timestamptz) from public;

grant usage on schema private to anon, authenticated;
grant execute on function private.is_reseller_order_admin() to authenticated;
grant execute on function private.get_reseller_auto_order_config_internal(uuid, text, text) to anon, authenticated;
grant execute on function private.set_reseller_auto_order_enabled_internal(uuid, text, text, boolean, numeric, boolean, boolean, boolean) to anon, authenticated;
grant execute on function private.save_reseller_auto_order_schedule_internal(uuid, text, text, smallint, text, boolean, date, date, jsonb) to anon, authenticated;
grant execute on function private.skip_reseller_auto_order_date_internal(uuid, text, text, date, text) to anon, authenticated;

revoke all on function public.reseller_auto_order_get(uuid, text, text) from public;
revoke all on function public.reseller_auto_order_set_enabled(uuid, text, text, boolean, numeric, boolean, boolean, boolean) from public;
revoke all on function public.reseller_auto_order_save_schedule(uuid, text, text, smallint, text, boolean, date, date, jsonb) from public;
revoke all on function public.reseller_auto_order_skip_date(uuid, text, text, date, text) from public;
grant execute on function public.reseller_auto_order_get(uuid, text, text) to anon, authenticated;
grant execute on function public.reseller_auto_order_set_enabled(uuid, text, text, boolean, numeric, boolean, boolean, boolean) to anon, authenticated;
grant execute on function public.reseller_auto_order_save_schedule(uuid, text, text, smallint, text, boolean, date, date, jsonb) to anon, authenticated;
grant execute on function public.reseller_auto_order_skip_date(uuid, text, text, date, text) to anon, authenticated;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'romas-reseller-auto-orders-1pm-ph';
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
  perform cron.schedule(
    'romas-reseller-auto-orders-1pm-ph',
    '0 5 * * *',
    'select private.generate_reseller_auto_orders(now());'
  );
end;
$$;

notify pgrst, 'reload schema';

commit;
