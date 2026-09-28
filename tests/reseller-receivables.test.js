import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchResellerReceivables, summarizeResellerReceivables } from '../src/resellerReceivables.js'

const invoice = (id, overrides = {}) => ({ id, reseller_id: 'branch-a', status: 'unpaid', total_amount: 100, paid_amount: 0, ...overrides })

function clientFor(pages) {
  const calls = []
  const client = {
    from(table) {
      assert.equal(table, 'delivery_invoices')
      return {
        select(fields, options) {
          assert.equal(fields, 'id,reseller_id,status,total_amount,paid_amount')
          assert.deepEqual(options, { count: 'exact' })
          return this
        },
        order(column, options) {
          assert.equal(column, 'id')
          assert.deepEqual(options, { ascending: true })
          return this
        },
        async range(start, end) {
          calls.push([start, end])
          return pages[calls.length - 1]
        },
      }
    },
  }
  return { client, calls }
}

test('counts only positive outstanding invoices, per outlet, using money instead of saved payment labels', () => {
  const rows = [
    invoice('unpaid'),
    invoice('partial', { status: 'partial', paid_amount: 40 }),
    invoice('delivered', { status: 'delivered', paid_amount: 10 }),
    invoice('settled', { status: 'unpaid', paid_amount: 100 }),
    invoice('stale-paid-label', { status: 'paid', paid_amount: 50 }),
    invoice('overpaid', { paid_amount: 120 }),
    invoice('other-outlet', { reseller_id: 'branch-b', total_amount: '200.25', paid_amount: '10.10' }),
    invoice('walkin', { reseller_id: null }),
    ...['void', 'voided', 'cancelled', 'deleted'].map(status => invoice(status, { status })),
  ]
  assert.deepEqual(summarizeResellerReceivables(rows), {
    'branch-a': { balance: 300, unpaidCount: 4 },
    'branch-b': { balance: 190.15, unpaidCount: 1 },
  })
})

test('uses net invoice total without subtracting returns twice; preserves cents and settlement tolerance', () => {
  const rows = [
    invoice('returns', { total_amount: 80.10, paid_amount: 10, returns_amount: 20 }),
    invoice('cents', { total_amount: 0.2, paid_amount: 0.1 }),
    invoice('tolerance', { total_amount: 100, paid_amount: 99.99 }),
    invoice('zero', { total_amount: 0 }),
  ]
  assert.deepEqual(summarizeResellerReceivables([...rows, rows[0]]), { 'branch-a': { balance: 70.2, unpaidCount: 2 } })
  assert.throws(() => summarizeResellerReceivables([invoice('bad', { total_amount: 'bad' })]), /Invalid invoice amount/)
})

test('loads all pages beyond the API row limit and handles a smaller server page limit', async () => {
  const rows = Array.from({ length: 1001 }, (_, i) => invoice(String(i)))
  const { client, calls } = clientFor([
    { data: rows.slice(0, 500), count: 1001 },
    { data: rows.slice(500, 1000), count: 1001 },
    { data: rows.slice(1000), count: 1001 },
  ])
  assert.deepEqual(await fetchResellerReceivables(client), { 'branch-a': { balance: 100100, unpaidCount: 1001 } })
  assert.deepEqual(calls, [[0, 999], [500, 1499], [1000, 1999]])
})

test('refresh fetches fresh data so payments and removed/voided invoices update totals', async () => {
  const { client } = clientFor([
    { data: [invoice('a'), invoice('b')], count: 2 },
    { data: [invoice('a', { paid_amount: 25 }), invoice('b', { status: 'voided' })], count: 2 },
    { data: [invoice('a', { paid_amount: 100 })], count: 1 },
  ])
  assert.deepEqual(await fetchResellerReceivables(client), { 'branch-a': { balance: 200, unpaidCount: 2 } })
  assert.deepEqual(await fetchResellerReceivables(client), { 'branch-a': { balance: 75, unpaidCount: 1 } })
  assert.deepEqual(await fetchResellerReceivables(client), {})
})

test('empty database returns zero summaries', async () => {
  const { client } = clientFor([{ data: [], count: 0 }])
  assert.deepEqual(await fetchResellerReceivables(client), {})
})

test('fails closed on network errors, incomplete responses, or changing pagination', async () => {
  for (const pages of [
    [{ error: new Error('network') }],
    [{ data: [], count: null }],
    [{ data: [invoice('a')], count: 2 }, { error: new Error('second page') }],
    [{ data: [invoice('a')], count: 2 }, { data: [], count: 2 }],
    [{ data: [invoice('a')], count: 2 }, { data: [invoice('b')], count: 3 }],
    [{ data: [invoice('a')], count: 2 }, { data: [invoice('a')], count: 2 }],
  ]) {
    const { client } = clientFor(pages)
    await assert.rejects(fetchResellerReceivables(client))
  }
})
