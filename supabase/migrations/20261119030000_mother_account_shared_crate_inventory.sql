-- Shared mother-account crates: preserve outlet-level audit history while pooling physical stock.
-- Existing crate locations and event rows are untouched. This replaces only the saving RPC.
create or replace function public.crate_inventory_save(
 p_request_id uuid,p_action text,p_reseller_id uuid,p_crates integer,p_covers integer,
 p_day date,p_driver text default '',p_reference text default '',p_notes text default '',
 p_invoice_id uuid default null,p_count_event_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 k text := coalesce(p_reseller_id::text,'production');
 actor text; payload jsonb; prior public.crate_inventory_events%rowtype;
 loc public.crate_inventory_locations%rowtype; prod public.crate_inventory_locations%rowtype;
 cnt public.crate_inventory_events%rowtype; dc integer; dv integer; st text := 'posted';
 owner_role boolean; day_now date := (now() at time zone 'Asia/Manila')::date;
 account_id uuid; group_crates integer; group_covers integer; group_counted boolean;
begin
 if auth.uid() is null or not public.business_control_has_role(array['owner','manager','hr','supervisor','asst_supervisor']) then raise exception 'Crate access denied'; end if;
 owner_role := public.business_control_has_role(array['owner']);
 if p_request_id is null or p_action not in ('dispatch','collection','count','approve','reject') then raise exception 'Invalid action'; end if;
 if p_crates is null or p_covers is null or p_crates<0 or p_covers<0 or p_day is null or p_day<>day_now then raise exception 'Enter whole quantities for today. Use a count correction for older errors.'; end if;
 if p_reseller_id is not null then
  select r.reseller_account_id into account_id from public.resellers r where r.id=p_reseller_id;
  if not found then raise exception 'Outlet not found'; end if;
 end if;
 select coalesce(nullif(au.full_name,''),auth.uid()::text) into actor from public.admin_users au where au.auth_user_id=auth.uid() limit 1;
 actor:=coalesce(actor,auth.uid()::text);
 payload:=jsonb_build_object('action',p_action,'outlet',p_reseller_id,'crates',p_crates,'covers',p_covers,'day',p_day,'driver',btrim(p_driver),'reference',btrim(p_reference),'notes',p_notes,'invoice',p_invoice_id,'count',p_count_event_id);
 -- One short transaction protects both sides of a transfer and duplicate retries.
 perform pg_advisory_xact_lock(1931811206);
 select * into prior from public.crate_inventory_events where id=p_request_id;
 if found then
  if prior.request_payload<>payload then raise exception 'This request was already saved with different values. Refresh before changing it.'; end if;
  return jsonb_build_object('id',prior.id,'status',prior.status,'duplicate',true);
 end if;
 insert into public.crate_inventory_locations(location_key,reseller_id) values(k,p_reseller_id) on conflict do nothing;
 select * into loc from public.crate_inventory_locations where location_key=k for update;
 select * into prod from public.crate_inventory_locations where location_key='production' for update;
 -- Multiple outlets under one mother account share a physical balance, without losing
 -- outlet IDs on their original events or rewriting historical counts.
 if account_id is not null then
  select coalesce(sum(l.crates),0)::integer, coalesce(sum(l.covers),0)::integer,
         coalesce(bool_or(l.counted),false)
  into group_crates,group_covers,group_counted
  from public.crate_inventory_locations l
  join public.resellers r on r.id=l.reseller_id
  where r.reseller_account_id=account_id;
 else
  group_crates:=loc.crates; group_covers:=loc.covers; group_counted:=loc.counted;
 end if;
 if p_action in ('dispatch','collection') then
  if p_reseller_id is null or p_crates+p_covers=0 then raise exception 'Select an outlet and enter at least one crate or cover.'; end if;
  if p_invoice_id is not null and not exists(select 1 from public.delivery_invoices where id=p_invoice_id and reseller_id=p_reseller_id and lower(coalesce(status,'')) not in ('void','voided','deleted','cancelled')) then raise exception 'Invoice does not match this outlet'; end if;
  if length(btrim(coalesce(p_driver,'')))<2 or length(btrim(coalesce(p_reference,'')))<1 then raise exception 'Enter the driver and trip/list reference.'; end if;
  if p_action='collection' then
   select * into prior from public.crate_inventory_events e
   where e.action='collection' and e.business_date=p_day
     and lower(btrim(e.driver))=lower(btrim(p_driver)) and lower(btrim(e.reference))=lower(btrim(p_reference))
     and (e.location_key=k or (account_id is not null and exists(
       select 1 from public.resellers r where r.id::text=e.location_key and r.reseller_account_id=account_id
     )));
   if found then raise exception 'This driver trip/list is already recorded today under this mother account. Leave crates at zero for a repeated list, or use a new reference for a separate pickup.'; end if;
  end if;
  dc:=case when p_action='dispatch' then p_crates else -p_crates end;
  dv:=case when p_action='dispatch' then p_covers else -p_covers end;
  if group_counted and (group_crates+dc<0 or group_covers+dv<0) then raise exception 'Collection exceeds the shared mother-account/outlet balance. Recount or correct it first.'; end if;
  if prod.counted and (prod.crates-dc<0 or prod.covers-dv<0) then raise exception 'Not enough stock in production. Recount or correct it first.'; end if;
  update public.crate_inventory_locations set crates=crates+dc,covers=covers+dv,updated_at=now() where location_key=k;
  update public.crate_inventory_locations set crates=crates-dc,covers=covers-dv,updated_at=now() where location_key='production';
 elsif p_action='count' then
  if length(btrim(coalesce(p_notes,'')))<3 then raise exception 'Enter a count reference or correction reason.'; end if;
  if exists(select 1 from public.crate_inventory_events e where e.action='count' and e.status='pending'
    and (e.location_key=k or (account_id is not null and exists(
      select 1 from public.resellers r where r.id::text=e.location_key and r.reseller_account_id=account_id
    )))) then raise exception 'A count is already awaiting review for this mother account/location.'; end if;
  st:=case when owner_role then 'approved' else 'pending' end;
  if owner_role then
    update public.crate_inventory_locations
    set crates=p_crates-(group_crates-loc.crates),covers=p_covers-(group_covers-loc.covers),
        counted=true,counted_at=now(),updated_at=now() where location_key=k;
  end if;
 else
  if not owner_role then raise exception 'Owner approval required'; end if;
  select * into cnt from public.crate_inventory_events where id=p_count_event_id and action='count' and status='pending' and location_key=k for update;
  if not found then raise exception 'Pending count not found or already reviewed'; end if;
  if p_action='approve' then
   if (account_id is null and loc.counted_at>cnt.created_at) or (account_id is not null and exists(
      select 1 from public.crate_inventory_locations l join public.resellers r on r.id=l.reseller_id
      where r.reseller_account_id=account_id and l.counted_at>cnt.created_at
   )) then raise exception 'A newer count exists. Reject this old count.'; end if;
   dc:=cnt.crates-cnt.before_crates; dv:=cnt.covers-cnt.before_covers;
   if group_crates+dc<0 or group_covers+dv<0 then raise exception 'Later movements conflict with this count. Recount this mother account/location.'; end if;
   update public.crate_inventory_locations set crates=crates+dc,covers=covers+dv,counted=true,counted_at=now(),updated_at=now() where location_key=k;
  end if;
  update public.crate_inventory_events set status=case when p_action='approve' then 'approved' else 'rejected' end where id=cnt.id;
 end if;
 insert into public.crate_inventory_events(id,action,location_key,invoice_id,crates,covers,before_crates,before_covers,business_date,driver,reference,notes,recorded_by,recorded_name,status,count_event_id,request_payload)
 values(p_request_id,p_action,k,p_invoice_id,p_crates,p_covers,group_crates,group_covers,p_day,btrim(coalesce(p_driver,'')),btrim(coalesce(p_reference,'')),coalesce(p_notes,''),auth.uid(),actor,st,p_count_event_id,payload);
 return jsonb_build_object('id',p_request_id,'status',st,'duplicate',false);
end $$;
notify pgrst,'reload schema';
