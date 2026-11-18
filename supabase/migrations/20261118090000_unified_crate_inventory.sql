-- New active recount cycle; original crate_movements and physical counts remain intact.
create table public.crate_inventory_locations (
 location_key text primary key,
 reseller_id uuid unique references public.resellers(id),
 crates integer not null default 0,
 covers integer not null default 0,
 counted boolean not null default false,
 counted_at timestamptz,
 updated_at timestamptz not null default now(),
 check ((location_key='production' and reseller_id is null) or location_key=reseller_id::text)
);
create table public.crate_inventory_events (
 id uuid primary key,
 action text not null check(action in ('dispatch','collection','count','approve','reject')),
 location_key text not null references public.crate_inventory_locations(location_key),
 invoice_id uuid references public.delivery_invoices(id),
 crates integer not null,
 covers integer not null,
 before_crates integer not null,
 before_covers integer not null,
 business_date date not null,
 driver text not null default '',
 reference text not null default '',
 notes text not null default '',
 recorded_by uuid not null,
 recorded_name text not null,
 created_at timestamptz not null default now(),
 status text not null default 'posted' check(status in ('posted','pending','approved','rejected')),
 count_event_id uuid references public.crate_inventory_events(id),
 request_payload jsonb not null
);
create unique index crate_pickup_once on public.crate_inventory_events(location_key,business_date,lower(driver),lower(reference)) where action='collection';
create index crate_inventory_events_location on public.crate_inventory_events(location_key,created_at desc);
create table public.crate_inventory_cutover (
 id integer primary key check(id=1), started_at timestamptz not null default now(),
 reason text not null, historical_movements integer not null, historical_counts integer not null
);
insert into public.crate_inventory_cutover values(1,now(),'Owner authorized zero active crates and covers and recount all locations on 2026-11-18',
 (select count(*) from public.crate_movements),(select count(*) from public.crate_physical_counts));
insert into public.crate_inventory_locations(location_key) values('production');
insert into public.crate_inventory_locations(location_key,reseller_id) select id::text,id from public.resellers;
alter table public.crate_inventory_locations enable row level security;
alter table public.crate_inventory_events enable row level security;
alter table public.crate_inventory_cutover enable row level security;
revoke all on public.crate_inventory_locations,public.crate_inventory_events,public.crate_inventory_cutover from public,anon,authenticated;
grant select on public.crate_inventory_locations,public.crate_inventory_events,public.crate_inventory_cutover to authenticated;
create policy crate_locations_read on public.crate_inventory_locations for select to authenticated using(public.business_control_has_role(array['owner','manager','hr','supervisor','asst_supervisor']));
create policy crate_events_read on public.crate_inventory_events for select to authenticated using(public.business_control_has_role(array['owner','manager','hr','supervisor','asst_supervisor']));
create policy crate_cutover_read on public.crate_inventory_cutover for select to authenticated using(public.business_control_has_role(array['owner','manager','hr','supervisor','asst_supervisor']));

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
begin
 if auth.uid() is null or not public.business_control_has_role(array['owner','manager','hr','supervisor','asst_supervisor']) then raise exception 'Crate access denied'; end if;
 owner_role := public.business_control_has_role(array['owner']);
 if p_request_id is null or p_action not in ('dispatch','collection','count','approve','reject') then raise exception 'Invalid action'; end if;
 if p_crates is null or p_covers is null or p_crates<0 or p_covers<0 or p_day is null or p_day<>day_now then raise exception 'Enter whole quantities for today. Use a count correction for older errors.'; end if;
 if p_reseller_id is not null and not exists(select 1 from public.resellers where id=p_reseller_id) then raise exception 'Outlet not found'; end if;
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
 if p_action in ('dispatch','collection') then
  if p_reseller_id is null or p_crates+p_covers=0 then raise exception 'Select an outlet and enter at least one crate or cover.'; end if;
  if p_invoice_id is not null and not exists(select 1 from public.delivery_invoices where id=p_invoice_id and reseller_id=p_reseller_id and lower(coalesce(status,'')) not in ('void','voided','deleted','cancelled')) then raise exception 'Invoice does not match this outlet'; end if;
  if length(btrim(coalesce(p_driver,'')))<2 or length(btrim(coalesce(p_reference,'')))<1 then raise exception 'Enter the driver and trip/list reference.'; end if;
  if p_action='collection' then
   select * into prior from public.crate_inventory_events where action='collection' and location_key=k and business_date=p_day and lower(driver)=lower(btrim(p_driver)) and lower(reference)=lower(btrim(p_reference));
   if found then raise exception 'This outlet pickup is already recorded. View History; do not enter the same driver list on another invoice.'; end if;
  end if;
  dc:=case when p_action='dispatch' then p_crates else -p_crates end;
  dv:=case when p_action='dispatch' then p_covers else -p_covers end;
  if loc.counted and (loc.crates+dc<0 or loc.covers+dv<0) then raise exception 'Collection exceeds this outlet balance. Recount or correct it first.'; end if;
  if prod.counted and (prod.crates-dc<0 or prod.covers-dv<0) then raise exception 'Not enough stock in production. Recount or correct it first.'; end if;
  update public.crate_inventory_locations set crates=crates+dc,covers=covers+dv,updated_at=now() where location_key=k;
  update public.crate_inventory_locations set crates=crates-dc,covers=covers-dv,updated_at=now() where location_key='production';
 elsif p_action='count' then
  if length(btrim(coalesce(p_notes,'')))<3 then raise exception 'Enter a count reference or correction reason.'; end if;
  if exists(select 1 from public.crate_inventory_events where action='count' and location_key=k and status='pending') then raise exception 'A count is already awaiting review for this location.'; end if;
  st:=case when owner_role then 'approved' else 'pending' end;
  if owner_role then update public.crate_inventory_locations set crates=p_crates,covers=p_covers,counted=true,counted_at=now(),updated_at=now() where location_key=k; end if;
 else
  if not owner_role then raise exception 'Owner approval required'; end if;
  select * into cnt from public.crate_inventory_events where id=p_count_event_id and action='count' and status='pending' and location_key=k for update;
  if not found then raise exception 'Pending count not found or already reviewed'; end if;
  if p_action='approve' then
   if loc.counted_at>cnt.created_at then raise exception 'A newer count exists. Reject this old count.'; end if;
   dc:=cnt.crates-cnt.before_crates; dv:=cnt.covers-cnt.before_covers;
   if loc.crates+dc<0 or loc.covers+dv<0 then raise exception 'Later movements conflict with this count. Recount this location.'; end if;
   update public.crate_inventory_locations set crates=crates+dc,covers=covers+dv,counted=true,counted_at=now(),updated_at=now() where location_key=k;
  end if;
  update public.crate_inventory_events set status=case when p_action='approve' then 'approved' else 'rejected' end where id=cnt.id;
 end if;
 insert into public.crate_inventory_events(id,action,location_key,invoice_id,crates,covers,before_crates,before_covers,business_date,driver,reference,notes,recorded_by,recorded_name,status,count_event_id,request_payload)
 values(p_request_id,p_action,k,p_invoice_id,p_crates,p_covers,loc.crates,loc.covers,p_day,btrim(coalesce(p_driver,'')),btrim(coalesce(p_reference,'')),coalesce(p_notes,''),auth.uid(),actor,st,p_count_event_id,payload);
 return jsonb_build_object('id',p_request_id,'status',st,'duplicate',false);
end $$;
revoke all on function public.crate_inventory_save(uuid,text,uuid,integer,integer,date,text,text,text,uuid,uuid) from public,anon;
grant execute on function public.crate_inventory_save(uuid,text,uuid,integer,integer,date,text,text,text,uuid,uuid) to authenticated;
-- Old versions must not silently continue posting to the retired ledger.
revoke insert,update,delete on public.crate_movements,public.crate_physical_counts from authenticated;
create or replace function public.crate_reconcile_invoice_handovers(p_invoice_id uuid,p_crates_delivered integer default null,p_crates_collected integer default null,p_covers_delivered integer default null,p_covers_collected integer default null,p_dispatcher_name text default '',p_driver_name text default '',p_recorded_by text default '',p_notes text default '') returns jsonb language plpgsql as $$ begin raise exception 'Crate inventory has been reset for recount. Refresh the app and use the new crate table.'; end $$;
notify pgrst,'reload schema';
