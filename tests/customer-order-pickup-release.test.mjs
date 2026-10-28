import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'

const foundation = readFileSync(new URL('../supabase/migrations/20261015074848_public_customer_order_foundation.sql', import.meta.url), 'utf8')
const pickupRelease = readFileSync(new URL('../supabase/customer-ordering-verified-pickup-locations.sql', import.meta.url), 'utf8')

test('pickup release activates only the four verified Dagupan points and is safe to retry', async () => {
  const db = new PGlite()
  try {
    await db.exec('create role anon; create role authenticated; create role service_role; create table public.admin_users (id uuid primary key);')
    await db.exec(foundation)
    await db.exec(pickupRelease)
    await db.exec(pickupRelease)

    const {rows: [counts]} = await db.query(`
      select count(*)::int as total,
             count(*) filter (where is_active)::int as active,
             count(*) filter (where is_active and (address is null or latitude is null or longitude is null))::int as incomplete
      from public.customer_pickup_locations`)
    assert.deepEqual(counts, {total: 20, active: 4, incomplete: 0})

    const {rows: active} = await db.query('select name from public.customer_pickup_locations where is_active order by name')
    assert.deepEqual(active.map(row => row.name), [
      'Dagupan City - Arellano St. (Novo)',
      'Dagupan City - Malued (Centrum Gas)',
      'Dagupan City - Malued (St. Albert School)',
      'Dagupan City - Perez Blvd. (PAMMA)',
    ])
  } finally {
    await db.close()
  }
})
