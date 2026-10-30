import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {test} from 'node:test'
import {PGlite} from '@electric-sql/pglite'

const migration = async name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const pickup = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const delivery = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

test('pickup completion and delivery payment post one audited online sale each', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create table public.admin_users (id uuid primary key, role text not null, is_active boolean not null);
      create table public.daily_sales_online_payments (
        id uuid primary key default gen_random_uuid(), payment_date date not null,
        sales_channel text not null, payment_method text not null,
        reference_number text, customer_name text, amount numeric(12,2) not null,
        notes text, recorded_by text, status text not null,
        count_as_revenue boolean, receipt_already_counted boolean
      );
      grant usage on schema public to service_role;
      grant select on public.admin_users to service_role;
      grant select, insert on public.daily_sales_online_payments to service_role;
    `)
    await db.exec(await migration('20261015074848_public_customer_order_foundation.sql'))
    await db.exec(await migration('20261024002147_customer_order_paid_sales.sql'))
    await db.exec(await migration('20261027132531_customer_order_staff_phone_confirmation.sql'))
    await db.exec(await migration('20261030090000_customer_order_completion.sql'))
    await db.query('insert into public.admin_users values ($1,$2,true)', [actor,'owner'])
    await db.query(`insert into public.customer_orders
      (id,order_code,request_id,access_token_hash,customer_name,customer_phone,
        fulfillment_type,pickup_location,pickup_address_snapshot,scheduled_at,packaging,subtotal)
      values ($1,'RD-PICKUP',$2,$3,'Pickup customer','09123456789','pickup',
        'Dagupan City','Test pickup','2030-01-01T10:00:00+08:00','box',25)`,
      [pickup,'11111111-1111-4111-8111-111111111111','a'.repeat(64)])
    await db.query(`insert into public.customer_orders
      (id,order_code,request_id,access_token_hash,customer_name,customer_phone,
        fulfillment_type,delivery_municipality,delivery_address,delivery_landmark,
        delivery_latitude,delivery_longitude,scheduled_at,packaging,subtotal,delivery_fee)
      values ($1,'RD-DELIVERY',$2,$3,'Delivery customer','09123456789','delivery',
        'Dagupan City','Test address','Test landmark',16.04,120.33,
        '2030-01-01T10:00:00+08:00','box',25,80)`,
      [delivery,'22222222-2222-4222-8222-222222222222','b'.repeat(64)])

    await db.exec('set role service_role')
    const status = async (id, oldStatus, nextStatus) =>
      (await db.query('select public.customer_set_order_status($1,$2,$3,$4,null) as changed',
        [id,oldStatus,nextStatus,actor])).rows[0].changed
    for (const id of [pickup,delivery]) {
      assert.equal((await db.query('select public.customer_confirm_order_phone($1,$2) as confirmed', [id,actor])).rows[0].confirmed, true)
      assert.equal(await status(id,'pending_confirmation','accepted'), true)
      assert.equal(await status(id,'accepted','preparing'), true)
      assert.equal(await status(id,'preparing','ready'), true)
    }
    assert.equal(await status(pickup,'ready','out_for_delivery'), false)
    assert.equal(await status(pickup,'ready','completed'), true)
    assert.equal(await status(delivery,'ready','completed'), false)
    assert.equal(await status(delivery,'ready','out_for_delivery'), true)

    const first = await db.query('select * from public.customer_record_paid_sale($1,$2,$3,$4)', [delivery,'Cash',null,actor])
    const retry = await db.query('select * from public.customer_record_paid_sale($1,$2,$3,$4)', [delivery,'Cash',null,actor])
    assert.equal(first.rows[0].reused, false)
    assert.equal(retry.rows[0].reused, true)
    assert.equal(await status(delivery,'out_for_delivery','completed'), true)
    await db.query('select * from public.customer_record_paid_sale($1,$2,$3,$4)', [pickup,'GCash','TEST-REF',actor])

    const sales = await db.query(`select o.order_code,o.status,o.payment_status,p.amount,p.sales_channel,p.count_as_revenue
      from public.customer_orders o join public.daily_sales_online_payments p on p.customer_order_id=o.id order by o.order_code`)
    assert.deepEqual(sales.rows.map(row=>[row.order_code,row.status,row.payment_status,row.amount,row.sales_channel,row.count_as_revenue]), [
      ['RD-DELIVERY','completed','paid','105.00','Website Order',true],
      ['RD-PICKUP','completed','paid','25.00','Website Order',true],
    ])
    const audit = await db.query(`select new_status,actor_admin_user_id from public.customer_order_events
      where order_id=$1 and new_status='completed'`, [delivery])
    assert.equal(audit.rows.length,1)
    assert.equal(audit.rows[0].actor_admin_user_id,actor)
  } finally { await db.close() }
})
