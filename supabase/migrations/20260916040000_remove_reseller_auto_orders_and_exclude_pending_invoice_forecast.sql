-- Retire reseller automatic ordering while preserving historical settings,
-- schedules, orders, and audit events for reference.

update public.reseller_auto_order_settings
set enabled = false,
    updated_at = now(),
    updated_by = 'System - automatic ordering retired 2026-09-16'
where enabled = true;

update public.reseller_auto_order_schedules
set enabled = false,
    updated_at = now()
where enabled = true;

do $retire_reseller_auto_order_cron$
declare
  job record;
begin
  if to_regclass('cron.job') is not null then
    for job in execute $query$
      select jobid
      from cron.job
      where lower(jobname) like '%reseller%auto%order%'
         or lower(command) like '%generate_reseller_auto_orders%'
    $query$
    loop
      perform cron.unschedule(job.jobid);
    end loop;
  end if;
end
$retire_reseller_auto_order_cron$;

-- Block every former configuration/generation entry point from application
-- roles. The review RPC stays available so staff can resolve any historical
-- automatic order that was already generated before retirement.
do $revoke_reseller_auto_order_entry_points$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.proname in (
        'reseller_auto_order_get',
        'reseller_auto_order_set_enabled',
        'reseller_auto_order_save_schedule',
        'reseller_auto_order_skip_date',
        'get_reseller_auto_order_config_internal',
        'set_reseller_auto_order_enabled_internal',
        'save_reseller_auto_order_schedule_internal',
        'skip_reseller_auto_order_date_internal',
        'set_reseller_auto_order_weekly_skip_internal',
        'generate_reseller_auto_orders',
        'generate_reseller_auto_orders_with_weekly_skips'
      )
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      fn.schema_name,
      fn.function_name,
      fn.arguments
    );
  end loop;
end
$revoke_reseller_auto_order_entry_points$;

-- Production needs only the invoice IDs whose deletion requests are pending.
-- Financial values, reasons, and requester details are intentionally omitted.
create or replace function public.get_production_forecast_excluded_invoice_ids()
returns table(invoice_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct request.invoice_id
  from public.invoice_deletion_requests request
  join public.delivery_invoices invoice on invoice.id = request.invoice_id
  where request.status = 'pending'
    and lower(coalesce(invoice.status, 'unpaid')) not in ('cancelled', 'void', 'voided', 'deleted')
    and exists (
      select 1
      from public.admin_users admin_user
      where admin_user.auth_user_id = (select auth.uid())
        and admin_user.is_active = true
    )
$$;

revoke execute on function public.get_production_forecast_excluded_invoice_ids() from public, anon;
grant execute on function public.get_production_forecast_excluded_invoice_ids() to authenticated;

comment on function public.get_production_forecast_excluded_invoice_ids() is
  'Returns only invoice IDs that must be excluded from production while deletion approval is pending.';

notify pgrst, 'reload schema';

do $verify_reseller_auto_order_retirement$
declare
  remaining_jobs integer := 0;
begin
  if exists (select 1 from public.reseller_auto_order_settings where enabled = true) then
    raise exception 'Automatic-order retirement failed: enabled reseller settings remain.';
  end if;

  if exists (select 1 from public.reseller_auto_order_schedules where enabled = true) then
    raise exception 'Automatic-order retirement failed: enabled reseller schedules remain.';
  end if;

  if to_regclass('cron.job') is not null then
    execute $query$
      select count(*)::integer
      from cron.job
      where active = true
        and (
          lower(jobname) like '%reseller%auto%order%'
          or lower(command) like '%generate_reseller_auto_orders%'
        )
    $query$ into remaining_jobs;
  end if;

  if remaining_jobs > 0 then
    raise exception 'Automatic-order retirement failed: % active cron job(s) remain.', remaining_jobs;
  end if;
end
$verify_reseller_auto_order_retirement$;
