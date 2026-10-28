import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'

const foundation = readFileSync(new URL('../supabase/migrations/20261015074848_public_customer_order_foundation.sql', import.meta.url), 'utf8')
const confirmation = readFileSync(new URL('../supabase/migrations/20261027132531_customer_order_staff_phone_confirmation.sql', import.meta.url), 'utf8')

test('staff call confirmation is audited and required before accepting an order', async () => {
  const db = new PGlite()
  try {
    await db.exec('create role anon; create role authenticated; create role service_role; create table public.admin_users (id uuid primary key);')
    await db.exec(foundation)
    await db.exec(confirmation)
    const actor = '22222222-2222-4222-8222-222222222222'
    await db.query('insert into public.admin_users(id) values ($1::uuid)', [actor])
    await db.exec("update public.customer_pickup_locations set address='Test pickup',latitude=16.04,longitude=120.33,is_active=true where name='Dagupan City'")
    const items = JSON.stringify([{id:'shells-6',name:'Shells · 6 pcs',quantity:1,unitLabel:'box of 6',piecesPerUnit:6,price:156}])
    const {rows:[order]} = await db.query(`select * from public.customer_submit_pickup_order(
      $1::uuid,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9,$10,$11::numeric,$12::jsonb)`, [
      '11111111-1111-4111-8111-111111111111', 'a'.repeat(64), 'RD-2030-ABCDEF123456',
      'Test Customer', '09123456789', 'Dagupan City', 'Test pickup',
      '2030-01-01T10:00:00+08:00', 'box', '', 156, items,
    ])
    const accept = 'select public.customer_set_order_status($1::uuid,$2,$3,$4::uuid,null) as changed'
    const confirm = 'select public.customer_confirm_order_phone($1::uuid,$2::uuid) as confirmed'
    assert.equal((await db.query(accept, [order.id,'pending_confirmation','accepted',actor])).rows[0].changed, false)
    assert.equal((await db.query(confirm, [order.id,actor])).rows[0].confirmed, true)
    assert.equal((await db.query(confirm, [order.id,actor])).rows[0].confirmed, false)
    const {rows:[verified]} = await db.query('select phone_verified_at,phone_verified_by,phone_verification_method from public.customer_orders where id=$1::uuid', [order.id])
    assert.ok(verified.phone_verified_at)
    assert.equal(verified.phone_verified_by, actor)
    assert.equal(verified.phone_verification_method, 'staff_call')
    assert.equal((await db.query(accept, [order.id,'pending_confirmation','accepted',actor])).rows[0].changed, true)
    const {rows:events} = await db.query('select actor,new_status,note from public.customer_order_events where order_id=$1::uuid order by id', [order.id])
    assert.equal(events.length, 3)
    assert.match(events[1].note, /confirmed by staff call/)
    await db.exec('set role anon')
    try { await assert.rejects(db.query(confirm, [order.id,actor])) }
    finally { await db.exec('reset role') }
  } finally { await db.close() }
})
