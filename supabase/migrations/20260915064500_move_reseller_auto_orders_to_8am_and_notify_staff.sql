-- Move reseller automatic ordering from 10:00 AM to 8:00 AM Asia/Manila.
-- Preserve the separate 1:00 PM manual-order deadline.
-- After a successful automatic order, notify the reseller and all active Owner/Admin/HR users.

alter table public.reseller_auto_order_schedules
  alter column submission_time set default time '08:00';

update public.reseller_auto_order_schedules
set submission_time = time '08:00',
    updated_at = now()
where submission_time is distinct from time '08:00';

-- A generated automatic order must always be visible to the reseller.
update public.reseller_auto_order_settings
set notify_on_generated = true,
    updated_at = now()
where notify_on_generated is distinct from true;

create or replace function private.flag_reseller_auto_order_notice()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_settings public.reseller_auto_order_settings%rowtype;
begin
  select * into v_settings
  from public.reseller_auto_order_settings
  where reseller_id = new.reseller_id;

  new.notify_reseller := case new.event_type
    when 'generated' then true
    when 'adjusted' then coalesce(v_settings.notify_on_adjusted, true)
    when 'approved' then coalesce(v_settings.notify_on_approved, true)
    when 'held' then true
    when 'rejected' then true
    when 'skipped' then true
    else false
  end;

  return new;
end;
$function$;

create or replace function private.notify_staff_on_reseller_auto_order_generated()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_catalog'
as $function$
declare
  v_reseller_name text;
  v_delivery_date date;
  v_total_qty integer;
begin
  if new.event_type is distinct from 'generated' or new.order_id is null then
    return new;
  end if;

  select o.reseller_name, o.delivery_date, coalesce(o.total_qty, 0)
  into v_reseller_name, v_delivery_date, v_total_qty
  from public.reseller_orders o
  where o.id = new.order_id;

  if not found then
    return new;
  end if;

  insert into public.notifications (
    admin_user_id,
    type,
    title,
    message,
    is_read,
    reference_type,
    reference_id,
    dedupe_key
  )
  select
    au.id,
    'reseller_auto_order',
    'Automatic Reseller Order Submitted',
    'Automatic order for ' || coalesce(v_reseller_name, 'Reseller') ||
      ' was submitted for delivery ' || v_delivery_date::text ||
      ' with ' || v_total_qty::text || ' piece(s). Waiting for staff approval.',
    false,
    'reseller_order',
    new.order_id,
    'reseller-auto-order-generated:' || new.order_id::text || ':' || au.id::text
  from public.admin_users au
  where au.is_active = true
    and (
      lower(trim(coalesce(au.role, ''))) in ('owner', 'admin', 'hr')
      or regexp_replace(lower(coalesce(au.extra_roles, '')), '\s+', '', 'g') ~ '(^|,)(owner|admin|hr)(,|$)'
    )
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$function$;

drop trigger if exists trg_notify_staff_on_reseller_auto_order_generated on public.reseller_auto_order_events;
create trigger trg_notify_staff_on_reseller_auto_order_generated
after insert on public.reseller_auto_order_events
for each row
when (new.event_type = 'generated')
execute function private.notify_staff_on_reseller_auto_order_generated();

-- Change only automatic-order functions from 10:00 AM to 8:00 AM.
do $auto_order_cutoff$
declare
  fn record;
  old_definition text;
  new_definition text;
begin
  for fn in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.prokind = 'f'
      and p.proname in (
        'generate_reseller_auto_orders',
        'generate_reseller_auto_orders_with_weekly_skips',
        'save_reseller_auto_order_schedule_internal',
        'skip_reseller_auto_order_date_internal',
        'set_reseller_auto_order_weekly_skip_internal'
      )
  loop
    old_definition := pg_get_functiondef(fn.oid);
    new_definition := replace(old_definition, '10:00 AM', '8:00 AM');
    new_definition := replace(new_definition, '10:00', '08:00');
    if new_definition is distinct from old_definition then
      execute new_definition;
    end if;
  end loop;
end
$auto_order_cutoff$;

-- pg_cron is stored in UTC. 00:00 UTC = 08:00 Asia/Manila.
do $auto_order_cron$
declare
  existing_job record;
  generator_command text;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname in (
      'romas-reseller-auto-orders-1pm-ph',
      'romas-reseller-auto-orders-10am-ph',
      'romas-reseller-auto-orders-8am-ph',
      'reseller-auto-order-1pm-ph',
      'reseller-auto-order-10am-ph',
      'reseller-auto-order-8am-ph'
    )
       or command ilike '%generate_reseller_auto_orders%'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  if to_regprocedure('private.generate_reseller_auto_orders_with_weekly_skips(timestamp with time zone)') is not null then
    generator_command := 'select private.generate_reseller_auto_orders_with_weekly_skips(now());';
  else
    generator_command := 'select private.generate_reseller_auto_orders(now());';
  end if;

  perform cron.schedule(
    'romas-reseller-auto-orders-8am-ph',
    '0 0 * * *',
    generator_command
  );
end
$auto_order_cron$;

-- Fail the migration if the production rules are not internally consistent.
do $auto_order_verify$
declare
  remaining_ten_am integer;
  non_eight_am_schedules integer;
  staff_trigger_count integer;
begin
  select count(*) into non_eight_am_schedules
  from public.reseller_auto_order_schedules
  where submission_time is distinct from time '08:00';

  if non_eight_am_schedules <> 0 then
    raise exception 'Automatic-order schedule migration incomplete: % schedule(s) are not set to 8:00 AM.', non_eight_am_schedules;
  end if;

  select count(*) into remaining_ten_am
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.prokind = 'f'
    and p.proname in (
      'generate_reseller_auto_orders',
      'generate_reseller_auto_orders_with_weekly_skips',
      'save_reseller_auto_order_schedule_internal',
      'skip_reseller_auto_order_date_internal',
      'set_reseller_auto_order_weekly_skip_internal'
    )
    and (pg_get_functiondef(p.oid) ilike '%10:00%' or pg_get_functiondef(p.oid) ilike '%10:00 AM%');

  if remaining_ten_am <> 0 then
    raise exception 'Automatic-order cutoff migration incomplete: % function(s) still reference 10:00 AM.', remaining_ten_am;
  end if;

  if not exists (
    select 1 from cron.job
    where jobname = 'romas-reseller-auto-orders-8am-ph'
      and schedule = '0 0 * * *'
      and active = true
      and command ilike '%generate_reseller_auto_orders%'
  ) then
    raise exception '8:00 AM reseller auto-order cron job was not scheduled correctly.';
  end if;

  select count(*) into staff_trigger_count
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'reseller_auto_order_events'
    and t.tgname = 'trg_notify_staff_on_reseller_auto_order_generated'
    and not t.tgisinternal;

  if staff_trigger_count <> 1 then
    raise exception 'Staff notification trigger was not installed correctly.';
  end if;
end
$auto_order_verify$;
