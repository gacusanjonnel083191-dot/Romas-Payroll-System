import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'

const migration = readFileSync(new URL('../supabase/migrations/20261029091500_customer_delivery_quote.sql', import.meta.url), 'utf8')
const orderId = '11111111-1111-4111-8111-111111111111'
const actorId = '22222222-2222-4222-8222-222222222222'
const origin = 'Dagupan City - Arellano St. (Novo)'

test('delivery quote uses road distance, resets call confirmation, and blocks premature acceptance', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table public.customer_pickup_locations(name text primary key, address text, is_active boolean);
      create table public.customer_orders(
        id uuid primary key, request_id uuid unique, access_token_hash text, order_code text,
        customer_name text, customer_phone text, fulfillment_type text,
        pickup_location text, pickup_address_snapshot text,
        delivery_municipality text, delivery_address text, delivery_landmark text,
        delivery_latitude numeric, delivery_longitude numeric,
        scheduled_at timestamptz, packaging text, notes text, subtotal numeric,
        delivery_fee numeric default 0, total numeric generated always as (subtotal + delivery_fee) stored,
        distance_km numeric, quote_basis text, status text default 'pending_confirmation',
        payment_status text default 'unpaid', phone_verified_at timestamptz,
        phone_verified_by uuid, phone_verification_method text, updated_at timestamptz
      );
      create table public.customer_order_items(
        order_id uuid, product_id text, product_name text, quantity integer,
        unit_label text, pieces_per_unit integer, unit_price numeric
      );
      create table public.customer_order_events(
        order_id uuid, actor text, actor_admin_user_id uuid, old_status text,
        new_status text, note text
      );`)
    await db.exec(migration)
    await db.query('insert into public.customer_pickup_locations values ($1,$2,true)',[origin,'Arellano St.'])
    await db.query(`insert into public.customer_orders
      (id,request_id,access_token_hash,order_code,customer_name,customer_phone,
       fulfillment_type,delivery_municipality,delivery_address,delivery_landmark,
       delivery_latitude,delivery_longitude,scheduled_at,packaging,notes,subtotal)
      values ($1,$1,'hash','RD-1','Test Customer','09123456789','delivery',
        'Dagupan City','Example Street','Example landmark',16.04,120.33,now(),'box','',100)`,[orderId])
    await assert.rejects(db.query("update public.customer_orders set status='accepted' where id=$1",[orderId]),/delivery quote/i)
    const quote = async km => (await db.query(
      'select public.customer_set_delivery_quote($1::uuid,$2::uuid,$3,$4::numeric) as saved',
      [orderId,actorId,origin,km],
    )).rows[0].saved
    assert.equal(await quote(3.001),true)
    let order = (await db.query('select delivery_fee,total,distance_km,delivery_quoted_at,phone_verified_at from public.customer_orders')).rows[0]
    assert.equal(Number(order.delivery_fee),90)
    assert.equal(Number(order.total),190)
    assert.equal(Number(order.distance_km),3.001)
    assert.ok(order.delivery_quoted_at)
    assert.equal(order.phone_verified_at,null)
    await assert.rejects(db.query("update public.customer_orders set status='accepted' where id=$1",[orderId]),/delivery quote/i)
    await db.query('update public.customer_orders set phone_verified_at=clock_timestamp(),phone_verified_by=$1 where id=$2',[actorId,orderId])
    await db.query("update public.customer_orders set status='accepted' where id=$1",[orderId])
    assert.equal(await quote(5),false)
    assert.equal((await db.query('select count(*)::integer as count from public.customer_order_events')).rows[0].count,1)
    order = (await db.query('select status from public.customer_orders')).rows[0]
    assert.equal(order.status,'accepted')
  } finally {await db.close()}
})
