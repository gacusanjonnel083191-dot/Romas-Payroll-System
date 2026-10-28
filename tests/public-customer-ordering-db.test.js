import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const migration = readFileSync(new URL('../supabase/migrations/20261015074848_public_customer_order_foundation.sql', import.meta.url), 'utf8')

test('pickup order migration stays closed and saves one audited order per request', async () => {
  const db = new PGlite()
  try {
    await db.exec('create role anon; create role authenticated; create role service_role; create table public.admin_users (id uuid primary key);')
    await db.exec(migration)

    const { rows: [locations] } = await db.query('select count(*)::int as total, count(*) filter (where is_active)::int as active from public.customer_pickup_locations')
    assert.deepEqual(locations, { total: 16, active: 0 })
    await assert.rejects(db.query("update public.customer_pickup_locations set is_active = true where name = 'Dagupan City'"))

    await db.query("update public.customer_pickup_locations set address = 'Verified test address', latitude = 16.043, longitude = 120.333, is_active = true where name = 'Dagupan City'")
    const requestId = '11111111-1111-4111-8111-111111111111'
    const actorId = '22222222-2222-4222-8222-222222222222'
    const items = JSON.stringify([{ id: 'shells-6', name: 'Shells · 6 pcs', quantity: 1, unitLabel: 'box of 6', piecesPerUnit: 6, price: 156 }])
    const submitSql = `select * from public.customer_submit_pickup_order(
      $1::uuid, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10, $11::numeric, $12::jsonb
    )`
    const args = [requestId, 'a'.repeat(64), 'RD-2030-ABCDEF123456', 'Test Customer', '09123456789', 'Dagupan City', 'Verified test address', '2030-01-01T10:00:00+08:00', 'box', '', 156, items]
    const { rows: [created] } = await db.query(submitSql, args)
    assert.equal(created.reused, false)
    const { rows: [retried] } = await db.query(submitSql, [args[0], args[1], 'RD-2030-DIFFERENT123', ...args.slice(3)])
    assert.equal(retried.id, created.id)
    assert.equal(retried.reused, true)
    await assert.rejects(db.query(submitSql, [args[0], 'b'.repeat(64), ...args.slice(2)]))

    const { rows: [counts] } = await db.query('select (select count(*)::int from public.customer_orders) as orders, (select count(*)::int from public.customer_order_items) as items, (select count(*)::int from public.customer_order_events) as events')
    assert.deepEqual(counts, { orders: 1, items: 1, events: 1 })
    await db.exec('set role anon')
    try {
      await assert.rejects(db.query('select * from public.customer_orders'))
      await assert.rejects(db.query(submitSql, args))
    } finally {
      await db.exec('reset role')
    }
    await db.query('insert into public.admin_users(id) values ($1::uuid)', [actorId])
    const statusSql = 'select public.customer_set_order_status($1::uuid, $2, $3, $4::uuid, null) as changed'
    assert.equal((await db.query(statusSql, [created.id, 'pending_confirmation', 'accepted', actorId])).rows[0].changed, true)
    assert.equal((await db.query(statusSql, [created.id, 'accepted', 'preparing', actorId])).rows[0].changed, true)
    assert.equal((await db.query(statusSql, [created.id, 'preparing', 'ready', actorId])).rows[0].changed, true)
    assert.equal((await db.query(statusSql, [created.id, 'ready', 'out_for_delivery', actorId])).rows[0].changed, false)
    assert.equal((await db.query('select status from public.customer_orders where id = $1::uuid', [created.id])).rows[0].status, 'ready')
  } finally {
    await db.close()
  }
})
