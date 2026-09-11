-- Reseller automatic ordering cutoff: 10:00 AM Asia/Manila.
-- IMPORTANT: the 1:00 PM manual-order deadline is intentionally unchanged.
-- This migration changes only the automatic-order schedule, automatic template/skip locks,
-- automatic-order audit wording, and the pg_cron execution time.
-- Rollback reference: supabase/migrations/20260911035607_restore_reseller_auto_order_1pm_ph.sql

alter table public.reseller_auto_order_schedules
  alter column submission_time set default time '10:00';

update public.reseller_auto_order_schedules
set submission_time = time '10:00',
    updated_at = now()
where submission_time is distinct from time '10:00';

-- Preserve the exact production function bodies while changing only the auto-order cutoff.
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
    new_definition := replace(old_definition, '13:00', '10:00');
    new_definition := replace(new_definition, '1:00 PM', '10:00 AM');

    if new_definition is distinct from old_definition then
      execute new_definition;
    end if;
  end loop;
end
$auto_order_cutoff$;

-- Replace the old 1:00 PM automatic-order cron with one 10:00 AM Philippine-time job.
-- pg_cron runs in UTC: 02:00 UTC = 10:00 Asia/Manila.
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
      'reseller-auto-order-1pm-ph',
      'reseller-auto-order-10am-ph'
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
    'romas-reseller-auto-orders-10am-ph',
    '0 2 * * *',
    generator_command
  );
end
$auto_order_cron$;

-- Fail fast if an automatic-order function still contains the obsolete 1 PM cutoff.
do $auto_order_verify$
declare
  remaining_count integer;
begin
  select count(*)
  into remaining_count
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
    and (pg_get_functiondef(p.oid) ilike '%13:00%' or pg_get_functiondef(p.oid) ilike '%1:00 PM%');

  if remaining_count <> 0 then
    raise exception 'Automatic-order cutoff migration incomplete: % function(s) still reference 1:00 PM.', remaining_count;
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'guard_reseller_order_write'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ilike '%13:00%'
  ) then
    raise exception 'Manual-order 1:00 PM guard is missing or was changed unexpectedly.';
  end if;
end
$auto_order_verify$;
