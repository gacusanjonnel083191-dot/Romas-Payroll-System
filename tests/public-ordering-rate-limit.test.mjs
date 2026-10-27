import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
import {consumeRateLimit, rateLimitKey} from '../supabase/functions/public-ordering/rate-limit.mjs'

const migration = readFileSync(new URL('../supabase/migrations/20261027122644_customer_order_public_rate_limits.sql', import.meta.url), 'utf8')

test('server-side keys do not store the phone number or receipt token', async () => {
  const secret = 'server-secret-used-only-in-this-test'
  const phoneKey = await rateLimitKey(secret, 'submit', '09123456789')
  const messageKey = await rateLimitKey(secret, 'customer-message', '09123456789')
  assert.match(phoneKey, /^[0-9a-f]{64}$/)
  assert.notEqual(phoneKey, messageKey)
  assert.equal(phoneKey.includes('09123456789'), false)
  let args
  const admin = {rpc: async (name, parameters) => {
    assert.equal(name, 'customer_order_consume_rate_limit')
    args = parameters
    return {data:false, error:null}
  }}
  assert.equal(await consumeRateLimit(admin, secret, 'submit', '09123456789', 20, 3600), 'limited')
  assert.equal(args.p_key_hash, phoneKey)
  assert.equal(args.p_limit, 20)
  assert.equal(args.p_window_seconds, 3600)
  assert.equal(await consumeRateLimit({rpc:async () => ({data:null, error:new Error('database unavailable')})}, secret, 'submit', '09123456789', 20, 3600), 'unavailable')
})

test('database counter enforces a fixed window and denies anonymous access', async () => {
  const db = new PGlite()
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;')
    await db.exec(migration)
    const {rows:[grants]} = await db.query(`select
      has_function_privilege('service_role', 'public.customer_order_consume_rate_limit(text,integer,integer)', 'EXECUTE') as staff_exec,
      has_function_privilege('anon', 'public.customer_order_consume_rate_limit(text,integer,integer)', 'EXECUTE') as anon_exec`)
    assert.deepEqual(grants, {staff_exec:true, anon_exec:false})
    const sql = 'select public.customer_order_consume_rate_limit($1, $2, $3) as allowed'
    const key = 'a'.repeat(64)
    assert.equal((await db.query(sql, [key, 2, 60])).rows[0].allowed, true)
    assert.equal((await db.query(sql, [key, 2, 60])).rows[0].allowed, true)
    assert.equal((await db.query(sql, [key, 2, 60])).rows[0].allowed, false)
    assert.equal((await db.query('select hits from public.customer_order_rate_limits where key_hash=$1', [key])).rows[0].hits, 2)
    await db.query("update public.customer_order_rate_limits set window_started_at = clock_timestamp() - interval '61 seconds' where key_hash=$1", [key])
    assert.equal((await db.query(sql, [key, 2, 60])).rows[0].allowed, true)
    assert.equal((await db.query('select hits from public.customer_order_rate_limits where key_hash=$1', [key])).rows[0].hits, 1)
    await assert.rejects(db.query(sql, ['invalid', 2, 60]))
    await db.exec('set role anon')
    try {
      await assert.rejects(db.query(sql, [key, 2, 60]))
      await assert.rejects(db.query('select * from public.customer_order_rate_limits'))
    } finally {
      await db.exec('reset role')
    }
  } finally {
    await db.close()
  }
})
