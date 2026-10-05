-- Reconcile invoice handovers atomically. Preparing an invoice does not move crates.
-- A staff confirmation or settlement calls this function after physical handover.
create or replace function public.crate_reconcile_invoice_handovers(
  p_invoice_id uuid,
  p_crates_delivered integer default null,
  p_crates_collected integer default null,
  p_covers_delivered integer default null,
  p_covers_collected integer default null,
  p_dispatcher_name text default '',
  p_driver_name text default '',
  p_recorded_by text default '',
  p_notes text default ''
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_invoice public.delivery_invoices%rowtype;
  v_asset text;
  v_kind text;
  v_requested integer;
  v_current numeric;
  v_target integer;
  v_event_date date;
  v_changed boolean := false;
  v_result jsonb := '{}'::jsonb;
  v_types text[];
begin
  if auth.uid() is null or not public.business_control_has_role(array['owner','manager','hr','supervisor','asst_supervisor']) then
    raise exception 'Crate handover access denied';
  end if;

  -- The invoice lock serializes retries and concurrent staff submissions.
  select * into v_invoice from public.delivery_invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.reseller_id is null or lower(coalesce(v_invoice.customer_type,'reseller')) <> 'reseller'
     or lower(coalesce(v_invoice.container_type,'Crates')) <> 'crates' then
    raise exception 'Only reseller invoices using crates can record crate handovers';
  end if;
  if lower(coalesce(v_invoice.status,'')) in ('cancelled','void','voided','deleted') then
    raise exception 'A cancelled or voided invoice cannot record crate handovers';
  end if;
  if p_crates_delivered < 0 or p_crates_collected < 0 or p_covers_delivered < 0 or p_covers_collected < 0 then
    raise exception 'Crate and cover quantities cannot be negative';
  end if;

  perform id from public.crate_movements
    where invoice_id = p_invoice_id and is_deleted = false
      and movement_type in ('dispatch','released','settlement_dispatch','collection','returned','return','settlement_collection')
    for update;

  for v_asset, v_kind, v_requested in
    select x.asset, x.kind, x.requested from (values
      ('crate'::text, 'dispatch'::text, p_crates_delivered),
      ('crate'::text, 'collection'::text, p_crates_collected),
      ('cover'::text, 'dispatch'::text, p_covers_delivered),
      ('cover'::text, 'collection'::text, p_covers_collected)
    ) as x(asset, kind, requested)
  loop
    v_types := case when v_kind = 'dispatch'
      then array['dispatch','released','settlement_dispatch']
      else array['collection','returned','return','settlement_collection'] end;
    select coalesce(sum(quantity),0), max(movement_date)
      into v_current, v_event_date
      from public.crate_movements
      where invoice_id = p_invoice_id and is_deleted = false
        and asset_type = v_asset and movement_type = any(v_types);
    v_target := coalesce(v_requested, v_current::integer);
    if v_current <> trunc(v_current) then
      raise exception 'Existing invoice crate movement has a fractional quantity';
    end if;
    if v_target < 0 then raise exception 'Crate and cover quantities cannot be negative'; end if;

    if v_target <> v_current then
      update public.crate_movements
        set is_deleted = true,
            notes = concat_ws(' | ', nullif(notes,''), 'Superseded by invoice handover reconciliation')
        where invoice_id = p_invoice_id and is_deleted = false
          and asset_type = v_asset and movement_type = any(v_types);
      if v_target > 0 then
        insert into public.crate_movements (
          movement_date, related_delivery_date, reseller_id, reseller_name,
          invoice_id, invoice_number, movement_type, direction, quantity, asset_type,
          dispatcher_name, driver_name, recorded_by, notes, is_deleted
        ) values (
          case when v_kind = 'dispatch'
            then coalesce(v_invoice.delivery_date, (now() at time zone 'Asia/Manila')::date)
            else coalesce(v_event_date, (now() at time zone 'Asia/Manila')::date) end,
          v_invoice.delivery_date, v_invoice.reseller_id, coalesce(v_invoice.reseller_name,''),
          v_invoice.id, coalesce(v_invoice.invoice_number,''),
          case when v_kind = 'dispatch' then 'settlement_dispatch' else 'settlement_collection' end,
          case when v_kind = 'dispatch' then 'out' else 'in' end,
          v_target, v_asset,
          case when v_kind = 'dispatch' then coalesce(p_dispatcher_name,'') else '' end,
          case when v_kind = 'collection' then coalesce(p_driver_name,'') else '' end,
          coalesce(nullif(btrim(p_recorded_by),''), auth.uid()::text),
          concat_ws(' | ', 'Invoice handover reconciled by ' || auth.uid()::text, nullif(btrim(p_notes),'')),
          false
        );
      end if;
      v_changed := true;
    end if;
    v_result := v_result || jsonb_build_object(v_asset || '_' || v_kind, v_target);
  end loop;

  if p_crates_delivered is not null and coalesce(v_invoice.crates_used,0) <> p_crates_delivered then
    update public.delivery_invoices set crates_used = p_crates_delivered where id = p_invoice_id;
    v_changed := true;
  end if;
  return v_result || jsonb_build_object('changed', v_changed);
end;
$$;

revoke all on function public.crate_reconcile_invoice_handovers(
  uuid, integer, integer, integer, integer, text, text, text, text
) from public, anon;
grant execute on function public.crate_reconcile_invoice_handovers(
  uuid, integer, integer, integer, integer, text, text, text, text
) to authenticated;
