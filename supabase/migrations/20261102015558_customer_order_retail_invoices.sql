-- Direct customer invoices are separate from reseller delivery invoices.
-- They snapshot the agreed retail prices when staff accepts a verified order.
grant usage on schema private to service_role;
create table public.customer_order_retail_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.customer_orders(id) on delete restrict,
  invoice_number text not null unique,
  status text not null default 'active'
    check (status in ('active','pending_removal','retained','voided')),
  customer_name text not null,
  customer_phone text not null,
  fulfillment_type text not null check (fulfillment_type in ('pickup','delivery')),
  scheduled_at timestamptz not null,
  pickup_location text,
  pickup_address text,
  dispatch_location text,
  delivery_municipality text,
  delivery_address text,
  delivery_landmark text,
  distance_km numeric(9,3),
  packaging text not null,
  order_notes text not null default '',
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null check (delivery_fee >= 0),
  total numeric(12,2) not null check (total = subtotal + delivery_fee),
  issued_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by_admin_user_id uuid references public.admin_users(id) on delete restrict
);

create table public.customer_order_retail_invoice_removals (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.customer_orders(id) on delete restrict,
  invoice_id uuid references public.customer_order_retail_invoices(id) on delete set null,
  invoice_number text not null,
  invoice_snapshot jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_by_admin_user_id uuid references public.admin_users(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  result_action text check (result_action in ('deleted','voided','retained'))
);
create index customer_order_retail_invoice_removals_status_idx
  on public.customer_order_retail_invoice_removals(status,requested_at desc);

alter table public.customer_order_retail_invoices enable row level security;
alter table public.customer_order_retail_invoice_removals enable row level security;
revoke all on public.customer_order_retail_invoices,
  public.customer_order_retail_invoice_removals from public,anon,authenticated;
grant select,insert,update,delete on public.customer_order_retail_invoices,
  public.customer_order_retail_invoice_removals to service_role;

create or replace function private.create_customer_order_retail_invoice(p_order_id uuid)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_order public.customer_orders%rowtype;
  v_items jsonb;
  v_item_total numeric(12,2);
begin
  select * into v_order from public.customer_orders where id = p_order_id;
  if not found or v_order.status not in ('accepted','preparing','ready','out_for_delivery','completed')
    or v_order.phone_verified_at is null then
    raise exception 'Only verified accepted orders can be invoiced';
  end if;
  if v_order.fulfillment_type = 'delivery'
    and (v_order.delivery_quoted_at is null or v_order.delivery_origin_location is null) then
    raise exception 'A delivery quote and dispatch point are required';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'product_id',i.product_id,'product_name',i.product_name,
    'quantity',i.quantity,'unit_label',i.unit_label,
    'pieces_per_unit',i.pieces_per_unit,'unit_price',i.unit_price,
    'line_total',i.line_total) order by i.id),'[]'::jsonb),
    coalesce(sum(i.line_total),0)
  into v_items,v_item_total
  from public.customer_order_items i where i.order_id = p_order_id;
  if jsonb_array_length(v_items) = 0 or v_item_total <> v_order.subtotal then
    raise exception 'Order item snapshots do not match the agreed retail subtotal';
  end if;
  insert into public.customer_order_retail_invoices (
    order_id,invoice_number,customer_name,customer_phone,fulfillment_type,
    scheduled_at,pickup_location,pickup_address,dispatch_location,
    delivery_municipality,delivery_address,delivery_landmark,distance_km,
    packaging,order_notes,items,subtotal,delivery_fee,total
  ) values (
    v_order.id,'RI-' || substr(v_order.order_code,4),v_order.customer_name,
    v_order.customer_phone,v_order.fulfillment_type,v_order.scheduled_at,
    v_order.pickup_location,v_order.pickup_address_snapshot,
    v_order.delivery_origin_location,v_order.delivery_municipality,
    v_order.delivery_address,v_order.delivery_landmark,v_order.distance_km,
    v_order.packaging,v_order.notes,v_items,v_order.subtotal,
    v_order.delivery_fee,v_order.total
  ) on conflict (order_id) do nothing;
end;
$$;

create or replace function private.customer_order_retail_invoice_status()
returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_invoice public.customer_order_retail_invoices%rowtype;
begin
  if new.status = 'accepted' and old.status is distinct from new.status then
    perform private.create_customer_order_retail_invoice(new.id);
  elsif new.status = 'cancelled' and old.status is distinct from new.status then
    select * into v_invoice from public.customer_order_retail_invoices
      where order_id = new.id for update;
    if found and v_invoice.status = 'active' then
      update public.customer_order_retail_invoices set status = 'pending_removal'
        where id = v_invoice.id;
      insert into public.customer_order_retail_invoice_removals (
        order_id,invoice_id,invoice_number,invoice_snapshot
      ) values (
        new.id,v_invoice.id,v_invoice.invoice_number,to_jsonb(v_invoice)
      ) on conflict (order_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger customer_order_retail_invoice_status_trigger
after update of status on public.customer_orders
for each row execute function private.customer_order_retail_invoice_status();

create or replace function public.customer_review_retail_invoice_removal(
  p_request_id uuid,p_decision text,p_actor_admin_user_id uuid,p_note text default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_request public.customer_order_retail_invoice_removals%rowtype;
  v_invoice public.customer_order_retail_invoices%rowtype;
  v_order public.customer_orders%rowtype;
  v_action text;
begin
  if not exists (
    select 1 from public.admin_users a
    where a.id = p_actor_admin_user_id and a.is_active = true
      and (lower(btrim(a.role)) = 'owner'
        or 'owner' = any(regexp_split_to_array(lower(coalesce(a.extra_roles,'')),'\s*,\s*')))
  ) then raise exception 'Only the owner can review retail invoice removals'; end if;
  if p_decision not in ('approve','reject') then raise exception 'Invalid decision'; end if;
  if p_decision = 'reject' and length(btrim(coalesce(p_note,''))) < 3 then
    raise exception 'A rejection reason is required';
  end if;
  select * into v_request from public.customer_order_retail_invoice_removals
    where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'Removal request is unavailable or already reviewed';
  end if;
  select * into v_order from public.customer_orders
    where id = v_request.order_id for update;
  if v_order.status <> 'cancelled' then raise exception 'The order is not cancelled'; end if;
  select * into v_invoice from public.customer_order_retail_invoices
    where id = v_request.invoice_id for update;
  if not found or v_invoice.status <> 'pending_removal' then
    raise exception 'Retail invoice is not awaiting removal';
  end if;

  if p_decision = 'reject' then
    update public.customer_order_retail_invoices set status = 'retained'
      where id = v_invoice.id;
    v_action := 'retained';
  elsif v_order.payment_status = 'unpaid'
    and not exists (select 1 from public.daily_sales_online_payments
      where customer_order_id = v_order.id) then
    delete from public.customer_order_retail_invoices where id = v_invoice.id;
    v_action := 'deleted';
  else
    update public.customer_order_retail_invoices
      set status = 'voided',removed_at = now(),
        removed_by_admin_user_id = p_actor_admin_user_id
      where id = v_invoice.id;
    v_action := 'voided';
  end if;

  update public.customer_order_retail_invoice_removals
    set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
      reviewed_by_admin_user_id = p_actor_admin_user_id,
      reviewed_at = now(),review_note = nullif(btrim(coalesce(p_note,'')),''),result_action = v_action
    where id = v_request.id;
  insert into public.customer_order_events (
    order_id,actor,actor_admin_user_id,old_status,new_status,note
  ) values (
    v_order.id,'staff',p_actor_admin_user_id,v_order.status,v_order.status,
    'Retail invoice ' || v_invoice.invoice_number || ' removal ' || v_action
  );
  return jsonb_build_object('invoice_number',v_invoice.invoice_number,
    'result_action',v_action,'request_id',v_request.id);
end;
$$;

revoke all on function private.create_customer_order_retail_invoice(uuid)
  from public,anon,authenticated;
revoke all on function private.customer_order_retail_invoice_status()
  from public,anon,authenticated;
grant execute on function private.create_customer_order_retail_invoice(uuid),
  private.customer_order_retail_invoice_status() to service_role;
revoke all on function public.customer_review_retail_invoice_removal(uuid,text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.customer_review_retail_invoice_removal(uuid,text,uuid,text)
  to service_role;
