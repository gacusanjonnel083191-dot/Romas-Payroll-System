-- Local foundation only. No location is orderable until its address is verified.
create table public.customer_pickup_locations (
  name text primary key,
  address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint customer_pickup_name_not_blank check (length(btrim(name)) > 0),
  constraint customer_pickup_address_verified check (
    not is_active or (nullif(btrim(address), '') is not null and latitude is not null and longitude is not null)
  ),
  constraint customer_pickup_latitude_valid check (latitude between -90 and 90),
  constraint customer_pickup_longitude_valid check (longitude between -180 and 180)
);

insert into public.customer_pickup_locations (name) values
  ('Asingan'), ('Binmaley'), ('Calasiao'), ('Dagupan City'), ('Laoac'),
  ('Mangaldan'), ('Mapandan'), ('San Carlos'), ('San Fabian'),
  ('San Jacinto'), ('San Manuel'), ('Santa Barbara'), ('Santo Tomas'),
  ('Sta Maria'), ('Tayug'), ('Urdaneta (Nancalobasaan)');

create table public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  request_id uuid not null unique,
  access_token_hash text not null,
  customer_name text not null,
  customer_phone text not null,
  fulfillment_type text not null check (fulfillment_type in ('pickup','delivery')),
  pickup_location text references public.customer_pickup_locations(name) on delete restrict,
  pickup_address_snapshot text,
  delivery_municipality text,
  delivery_address text,
  delivery_landmark text,
  delivery_latitude numeric(9,6),
  delivery_longitude numeric(9,6),
  scheduled_at timestamptz not null,
  packaging text not null check (packaging in ('box','paper_bag')),
  notes text not null default '',
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation','accepted','preparing','ready','out_for_delivery','completed','declined','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid')),
  paid_at timestamptz,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total numeric(12,2) generated always as (subtotal + delivery_fee) stored,
  quote_basis text,
  distance_km numeric(9,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_order_name_not_blank check (length(btrim(customer_name)) between 1 and 120),
  constraint customer_order_phone_not_blank check (length(btrim(customer_phone)) between 10 and 20),
  constraint customer_order_fulfillment_details check (
    (fulfillment_type = 'pickup' and pickup_location is not null and pickup_address_snapshot is not null
      and delivery_municipality is null and delivery_address is null and delivery_fee = 0)
    or
    (fulfillment_type = 'delivery' and pickup_location is null and delivery_municipality is not null
      and delivery_address is not null and delivery_landmark is not null
      and delivery_latitude is not null and delivery_longitude is not null)
  ),
  constraint customer_order_paid_at check ((payment_status = 'paid') = (paid_at is not null))
);

create index customer_orders_status_schedule_idx on public.customer_orders (status, scheduled_at);
create index customer_orders_created_at_idx on public.customer_orders (created_at desc);

create table public.customer_order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  product_id text not null,
  product_name text not null,
  quantity integer not null check (quantity between 1 and 999),
  unit_label text not null,
  pieces_per_unit integer not null check (pieces_per_unit > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) generated always as (quantity * unit_price) stored,
  unique (order_id, product_id)
);

create table public.customer_order_messages (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  sender text not null check (sender in ('customer','staff')),
  sender_admin_user_id uuid references public.admin_users(id) on delete restrict,
  body text not null check (length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  constraint customer_order_message_actor check (
    (sender = 'customer' and sender_admin_user_id is null)
    or (sender = 'staff' and sender_admin_user_id is not null)
  )
);
create index customer_order_messages_order_time_idx on public.customer_order_messages (order_id, created_at);

create table public.customer_order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  actor text not null check (actor in ('system','customer','staff')),
  actor_admin_user_id uuid references public.admin_users(id) on delete restrict,
  old_status text,
  new_status text not null,
  note text,
  created_at timestamptz not null default now()
);
create index customer_order_events_order_time_idx on public.customer_order_events (order_id, created_at);

-- Only server-side code using the secret key can reach these tables.
alter table public.customer_pickup_locations enable row level security;
alter table public.customer_orders enable row level security;
alter table public.customer_order_items enable row level security;
alter table public.customer_order_messages enable row level security;
alter table public.customer_order_events enable row level security;

revoke all on public.customer_pickup_locations, public.customer_orders,
  public.customer_order_items, public.customer_order_messages,
  public.customer_order_events from public, anon, authenticated;
revoke all on sequence public.customer_order_items_id_seq,
  public.customer_order_messages_id_seq, public.customer_order_events_id_seq
  from public, anon, authenticated;

grant all on public.customer_pickup_locations, public.customer_orders,
  public.customer_order_items, public.customer_order_messages,
  public.customer_order_events to service_role;
grant usage, select on sequence public.customer_order_items_id_seq,
  public.customer_order_messages_id_seq, public.customer_order_events_id_seq to service_role;

-- One transaction for the order header and its server-priced lines. The caller
-- must validate the catalog, schedule, and pickup point before invoking this.
create function public.customer_submit_pickup_order(
  p_request_id uuid,
  p_access_token_hash text,
  p_order_code text,
  p_customer_name text,
  p_customer_phone text,
  p_pickup_location text,
  p_pickup_address text,
  p_scheduled_at timestamptz,
  p_packaging text,
  p_notes text,
  p_subtotal numeric,
  p_items jsonb
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
    fulfillment_type, pickup_location, pickup_address_snapshot, scheduled_at,
    packaging, notes, subtotal
  ) values (
    p_request_id, p_access_token_hash, p_order_code, p_customer_name, p_customer_phone,
    'pickup', p_pickup_location, p_pickup_address, p_scheduled_at,
    p_packaging, coalesce(p_notes, ''), p_subtotal
  ) on conflict (request_id) do nothing returning customer_orders.id, customer_orders.order_code into v_id, v_code;
  if v_id is null then
    select o.id, o.order_code, o.access_token_hash into v_id, v_code, v_existing_hash
    from public.customer_orders o where o.request_id = p_request_id;
    if v_existing_hash <> p_access_token_hash then raise exception 'Request ID already used'; end if;
    return query select v_id, v_code, true;
    return;
  end if;
  insert into public.customer_order_items (
    order_id, product_id, product_name, quantity, unit_label, pieces_per_unit, unit_price
  )
  select v_id, item->>'id', item->>'name', (item->>'quantity')::integer,
    item->>'unitLabel', (item->>'piecesPerUnit')::integer, (item->>'price')::numeric
  from jsonb_array_elements(p_items) as item;
  insert into public.customer_order_events (order_id, actor, new_status, note)
  values (v_id, 'system', 'pending_confirmation', 'Order request received');
  return query select v_id, v_code, false;
end;
$$;

revoke all on function public.customer_submit_pickup_order(
  uuid,text,text,text,text,text,text,timestamptz,text,text,numeric,jsonb
) from public, anon, authenticated;
grant execute on function public.customer_submit_pickup_order(
  uuid,text,text,text,text,text,text,timestamptz,text,text,numeric,jsonb
) to service_role;

create function public.customer_set_order_status(
  p_order_id uuid,
  p_expected_status text,
  p_new_status text,
  p_actor_admin_user_id uuid,
  p_note text default null
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_old text;
begin
  if p_new_status not in ('accepted','preparing','ready','out_for_delivery','declined','cancelled') then
    raise exception 'Status requires another workflow';
  end if;
  update public.customer_orders
  set status = p_new_status, updated_at = now()
  where id = p_order_id and status = p_expected_status
    and (
      (status = 'pending_confirmation' and p_new_status in ('accepted','declined','cancelled'))
      or (status = 'accepted' and p_new_status in ('preparing','cancelled'))
      or (status = 'preparing' and p_new_status in ('ready','cancelled'))
      or (status = 'ready' and p_new_status = 'cancelled')
      or (status = 'ready' and fulfillment_type = 'delivery' and p_new_status = 'out_for_delivery')
    )
  returning p_expected_status into v_old;
  if v_old is null then return false; end if;
  insert into public.customer_order_events
    (order_id, actor, actor_admin_user_id, old_status, new_status, note)
  values (p_order_id, 'staff', p_actor_admin_user_id, p_expected_status, p_new_status, p_note);
  return true;
end;
$$;

revoke all on function public.customer_set_order_status(uuid,text,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.customer_set_order_status(uuid,text,text,uuid,text) to service_role;
