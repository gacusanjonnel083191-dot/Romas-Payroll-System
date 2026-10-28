-- SAGS is a company outlet. Sending donuts to it is an internal movement, not a sale.
-- Historical invoices stay untouched until their quantities and payments are reconciled.
create table if not exists public.sags_internal_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_number text not null unique,
  outlet_id text not null default 'OUTLET-MALUED' check (outlet_id = 'OUTLET-MALUED'),
  delivery_date date not null,
  status text not null default 'dispatched' check (status in ('dispatched','received')),
  dispatched_by text,
  received_by text,
  receipt_notes text,
  notes text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create table if not exists public.sags_internal_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.sags_internal_transfers(id) on delete restrict,
  variant_id uuid not null references public.donut_variants(id) on delete restrict,
  variant_name text not null,
  pos_product_id text not null references public.pos_products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  received_quantity integer check (received_quantity >= 0 and received_quantity <= quantity),
  unique (transfer_id, variant_id),
  unique (transfer_id, pos_product_id)
);
create index if not exists sags_internal_transfers_date_idx on public.sags_internal_transfers(delivery_date desc);
create index if not exists sags_internal_transfer_items_transfer_idx on public.sags_internal_transfer_items(transfer_id);

alter table public.sags_internal_transfers enable row level security;
alter table public.sags_internal_transfer_items enable row level security;
revoke all on public.sags_internal_transfers, public.sags_internal_transfer_items from public, anon, authenticated;
grant select on public.sags_internal_transfers, public.sags_internal_transfer_items to authenticated;
create policy sags_transfers_staff_read on public.sags_internal_transfers for select to authenticated
  using (auth.uid() is not null and public.business_control_has_role(array['owner','manager','admin','pos_admin','hr']));
create policy sags_transfer_items_staff_read on public.sags_internal_transfer_items for select to authenticated
  using (auth.uid() is not null and public.business_control_has_role(array['owner','manager','admin','pos_admin','hr']));

create or replace function public.create_sags_internal_transfer(
  p_request_id uuid, p_delivery_date date, p_dispatched_by text, p_notes text, p_items jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_item jsonb;
  v_variant public.donut_variants%rowtype;
  v_product public.pos_products%rowtype;
  v_quantity integer;
  v_id uuid;
begin
  if auth.uid() is null or not public.business_control_has_role(array['owner','manager','admin']) then
    raise exception 'SAGS transfer creation requires Owner, Manager, or Admin access';
  end if;
  if p_request_id is null or p_delivery_date is null or p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'Enter a date and 1 to 100 transfer items';
  end if;
  if exists(select 1 from public.sags_internal_transfers where id=p_request_id) then
    if exists(select 1 from public.sags_internal_transfers where id=p_request_id and created_by=auth.uid()) then
      return p_request_id; -- retry after a lost response; no duplicate transfer
    end if;
    raise exception 'Transfer request ID already used';
  end if;
  if exists (
    select 1 from public.delivery_invoices invoice
    join public.resellers reseller on reseller.id=invoice.reseller_id
    where lower(trim(reseller.name))='sags' and invoice.delivery_date=p_delivery_date
      and lower(coalesce(invoice.status,'')) not in ('cancelled','void','voided','deleted')
  ) then
    raise exception 'A SAGS invoice already exists for this date. Reconcile that delivery before creating an internal transfer';
  end if;
  insert into public.sags_internal_transfers(id,transfer_number,delivery_date,dispatched_by,notes,created_by)
  values (p_request_id, 'SAGS-TR-' || upper(replace(p_request_id::text,'-','')), p_delivery_date,
    nullif(trim(coalesce(p_dispatched_by,'')),''),nullif(trim(coalesce(p_notes,'')),''),auth.uid())
  returning id into v_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' or (v_item->>'quantity') !~ '^[1-9][0-9]*$' then
      raise exception 'Each transfer item needs a whole positive quantity';
    end if;
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_variant from public.donut_variants where id=(v_item->>'variant_id')::uuid;
    if not found then raise exception 'Donut variant not found'; end if;
    select * into v_product from public.pos_products where id=v_item->>'pos_product_id'
      and outlet_id='OUTLET-MALUED' and lower(coalesce(category,''))='donuts';
    if not found then raise exception 'Select a SAGS POS donut product for each item'; end if;
    insert into public.sags_internal_transfer_items(transfer_id,variant_id,variant_name,pos_product_id,quantity)
    values(v_id,v_variant.id,v_variant.name,v_product.id,v_quantity);
  end loop;
  return v_id;
end; $$;

create or replace function public.receive_sags_internal_transfer(p_transfer_id uuid, p_received_by text, p_actual_items jsonb, p_receipt_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_transfer public.sags_internal_transfers%rowtype;
  v_item public.sags_internal_transfer_items%rowtype;
  v_product public.pos_products%rowtype;
  v_actual integer;
  v_received_total integer := 0;
  v_has_variance boolean := false;
begin
  if auth.uid() is null or not public.business_control_has_role(array['owner','manager','admin','pos_admin']) then
    raise exception 'SAGS transfer receiving requires POS administrator access';
  end if;
  if nullif(trim(coalesce(p_received_by,'')),'') is null then raise exception 'Enter the receiver name'; end if;
  select * into v_transfer from public.sags_internal_transfers where id=p_transfer_id for update;
  if not found then raise exception 'Transfer not found'; end if;
  if v_transfer.status='received' then return v_transfer.id; end if; -- safe retry, stock counted once
  if jsonb_typeof(p_actual_items) <> 'array' or jsonb_array_length(p_actual_items) <> (select count(*) from public.sags_internal_transfer_items where transfer_id=p_transfer_id) then
    raise exception 'Enter an actual received quantity for every item';
  end if;
  if v_transfer.delivery_date <> (now() at time zone 'Asia/Manila')::date then
    raise exception 'Receive the transfer on its delivery date; review past or future stock manually';
  end if;
  for v_item in select * from public.sags_internal_transfer_items where transfer_id=p_transfer_id order by id loop
    if (select count(*) from jsonb_array_elements(p_actual_items) entry where entry->>'id'=v_item.id::text) <> 1 then
      raise exception 'Each transfer line must have one actual quantity';
    end if;
    if (select entry->>'quantity' from jsonb_array_elements(p_actual_items) entry where entry->>'id'=v_item.id::text) !~ '^(0|[1-9][0-9]*)$' then
      raise exception 'Actual received quantity must be a whole number';
    end if;
    select (entry->>'quantity')::integer into v_actual from jsonb_array_elements(p_actual_items) entry where entry->>'id'=v_item.id::text;
    if v_actual > v_item.quantity then raise exception 'Actual receipt exceeds dispatched quantity'; end if;
    v_received_total := v_received_total + v_actual;
    if v_actual <> v_item.quantity then v_has_variance := true; end if;
    select * into v_product from public.pos_products where id=v_item.pos_product_id
      and outlet_id='OUTLET-MALUED' and lower(coalesce(category,''))='donuts' for update;
    if not found then raise exception 'A mapped POS donut product is missing'; end if;
    update public.sags_internal_transfer_items set received_quantity=v_actual where id=v_item.id;
    if v_actual > 0 then
      update public.pos_products set stock=coalesce(stock,0)+v_actual where id=v_product.id;
      insert into public.pos_inventory_movements(outlet_id,product_id,sku,barcode,product_name,movement_type,qty,reference_no,remarks,created_by)
      values('OUTLET-MALUED',v_product.id,coalesce(v_product.sku,''),coalesce(v_product.barcode,''),v_product.product_name,
        'stock_in',v_actual,v_transfer.transfer_number,'SAGS internal transfer received; no sales revenue',auth.uid()::text);
    end if;
  end loop;
  if v_received_total = 0 then raise exception 'No pieces received; leave this transfer pending for review'; end if;
  if v_has_variance and length(trim(coalesce(p_receipt_notes,''))) < 5 then raise exception 'Explain the delivery quantity difference'; end if;
  update public.sags_internal_transfers set status='received',received_by=trim(p_received_by),receipt_notes=nullif(trim(coalesce(p_receipt_notes,'')),''),received_at=now() where id=p_transfer_id;
  return p_transfer_id;
end; $$;

revoke all on function public.create_sags_internal_transfer(uuid,date,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.receive_sags_internal_transfer(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.create_sags_internal_transfer(uuid,date,text,text,jsonb) to authenticated;
grant execute on function public.receive_sags_internal_transfer(uuid,text,jsonb,text) to authenticated;

-- Prevent future SAGS reseller invoices from reintroducing duplicate revenue/AR.
-- Other resellers and edits to historical SAGS invoices remain available.
create or replace function public.guard_new_sags_reseller_invoice()
returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.resellers r where r.id=new.reseller_id and lower(trim(r.name))='sags') then
    raise exception 'SAGS deliveries must use Internal Transfers, not reseller invoices';
  end if;
  return new;
end; $$;
drop trigger if exists guard_new_sags_reseller_invoice on public.delivery_invoices;
create trigger guard_new_sags_reseller_invoice before insert on public.delivery_invoices
for each row execute function public.guard_new_sags_reseller_invoice();
notify pgrst, 'reload schema';
