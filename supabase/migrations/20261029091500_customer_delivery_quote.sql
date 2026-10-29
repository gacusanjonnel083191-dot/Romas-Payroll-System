-- Delivery requests start with a product subtotal. Staff verify a road route,
-- quote the approved rate, call the customer, and only then accept the order.
alter table public.customer_orders
  add column delivery_origin_location text references public.customer_pickup_locations(name) on delete restrict,
  add column delivery_quoted_at timestamptz,
  add constraint customer_order_delivery_quote_fields check (
    (fulfillment_type = 'pickup' and delivery_origin_location is null and delivery_quoted_at is null)
    or fulfillment_type = 'delivery'
  );

create function public.customer_submit_delivery_order(
  p_request_id uuid, p_access_token_hash text, p_order_code text,
  p_customer_name text, p_customer_phone text, p_municipality text,
  p_address text, p_landmark text, p_latitude numeric, p_longitude numeric,
  p_scheduled_at timestamptz, p_packaging text, p_notes text,
  p_subtotal numeric, p_items jsonb
) returns table (id uuid, order_code text, reused boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_code text;
  v_existing_hash text;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'Order items are invalid';
  end if;
  select o.id, o.order_code, o.access_token_hash into v_id, v_code, v_existing_hash
  from public.customer_orders o where o.request_id = p_request_id;
  if v_id is not null then
    if v_existing_hash <> p_access_token_hash then raise exception 'Request ID already used'; end if;
    return query select v_id, v_code, true;
    return;
  end if;
  insert into public.customer_orders (
    request_id, access_token_hash, order_code, customer_name, customer_phone,
    fulfillment_type, delivery_municipality, delivery_address, delivery_landmark,
    delivery_latitude, delivery_longitude, scheduled_at, packaging, notes, subtotal
  ) values (
    p_request_id, p_access_token_hash, p_order_code, p_customer_name, p_customer_phone,
    'delivery', p_municipality, p_address, p_landmark, p_latitude, p_longitude,
    p_scheduled_at, p_packaging, coalesce(p_notes, ''), p_subtotal
  ) on conflict (request_id) do nothing
  returning customer_orders.id, customer_orders.order_code into v_id, v_code;
  if v_id is null then
    select o.id, o.order_code, o.access_token_hash into v_id, v_code, v_existing_hash
    from public.customer_orders o where o.request_id = p_request_id;
    if v_existing_hash <> p_access_token_hash then raise exception 'Request ID already used'; end if;
    return query select v_id, v_code, true;
    return;
  end if;
  insert into public.customer_order_items (
    order_id, product_id, product_name, quantity, unit_label, pieces_per_unit, unit_price
  ) select v_id, item->>'id', item->>'name', (item->>'quantity')::integer,
      item->>'unitLabel', (item->>'piecesPerUnit')::integer, (item->>'price')::numeric
    from jsonb_array_elements(p_items) as item;
  insert into public.customer_order_events (order_id, actor, new_status, note)
    values (v_id, 'system', 'pending_confirmation', 'Delivery request received; road distance and fee pending');
  return query select v_id, v_code, false;
end;
$$;
revoke all on function public.customer_submit_delivery_order(
  uuid,text,text,text,text,text,text,text,numeric,numeric,timestamptz,text,text,numeric,jsonb
) from public, anon, authenticated;
grant execute on function public.customer_submit_delivery_order(
  uuid,text,text,text,text,text,text,text,numeric,numeric,timestamptz,text,text,numeric,jsonb
) to service_role;

create function public.customer_set_delivery_quote(
  p_order_id uuid, p_actor_admin_user_id uuid, p_origin_location text,
  p_road_km numeric
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_fee numeric(12,2);
  v_id uuid;
begin
  if p_road_km is null or p_road_km < 0 or p_road_km > 100
    or p_road_km <> round(p_road_km, 3) then return false; end if;
  if not exists (select 1 from public.customer_pickup_locations
      where name = p_origin_location and is_active = true and address is not null) then return false; end if;
  v_fee := 80 + 10 * ceil(greatest(0, p_road_km - 3));
  update public.customer_orders
  set delivery_origin_location = p_origin_location,
      distance_km = p_road_km, delivery_fee = v_fee,
      quote_basis = 'Staff-verified road distance: PHP 80 for first 3 km, PHP 10 per additional started km',
      delivery_quoted_at = clock_timestamp(),
      phone_verified_at = null, phone_verified_by = null, phone_verification_method = null,
      updated_at = now()
  where customer_orders.id = p_order_id and fulfillment_type = 'delivery'
    and status = 'pending_confirmation' and payment_status = 'unpaid'
  returning customer_orders.id into v_id;
  if v_id is null then return false; end if;
  insert into public.customer_order_events
    (order_id, actor, actor_admin_user_id, old_status, new_status, note)
  values (v_id, 'staff', p_actor_admin_user_id, 'pending_confirmation',
    'pending_confirmation', 'Delivery quote: ' || p_road_km || ' road km from '
      || p_origin_location || '; fee PHP ' || v_fee || '. Customer confirmation required.');
  return true;
end;
$$;
revoke all on function public.customer_set_delivery_quote(uuid,uuid,text,numeric)
  from public, anon, authenticated;
grant execute on function public.customer_set_delivery_quote(uuid,uuid,text,numeric) to service_role;

create function public.customer_guard_delivery_acceptance() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.fulfillment_type = 'delivery' and new.status = 'accepted'
    and old.status is distinct from 'accepted'
    and (new.delivery_quoted_at is null or new.delivery_origin_location is null
      or new.distance_km is null or new.delivery_fee < 80
      or new.phone_verified_at is null
      or new.phone_verified_at < new.delivery_quoted_at) then
    raise exception 'Delivery quote and customer confirmation required before acceptance'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.customer_guard_delivery_acceptance()
  from public, anon, authenticated;
create trigger customer_orders_delivery_acceptance_guard
  before update of status on public.customer_orders
  for each row execute function public.customer_guard_delivery_acceptance();
