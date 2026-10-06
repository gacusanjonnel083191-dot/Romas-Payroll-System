import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFoundationReceivables } from '../src/foundationReceivables.js'

test('Foundation AR includes prior-month balances and derives status from money, not stale invoice status', () => {
  const result = buildFoundationReceivables([
    { id:'old', delivery_date:'2026-09-01', due_date:'2026-09-10', status:'delivered', total_amount:50000, paid_amount:10000 },
    { id:'current', delivery_date:'2026-10-02', due_date:'2026-10-09', status:'unpaid', total_amount:12000, paid_amount:2000 },
    { id:'settled', status:'unpaid', total_amount:500, paid_amount:500 },
    { id:'void', status:'voided', total_amount:100000, paid_amount:0 },
  ], '2026-10-06')
  assert.equal(result.totalAR, 50000)
  assert.equal(result.overdueAR, 40000)
  assert.equal(result.rows.length, 2)
  assert.equal(result.arAging.reduce((sum, bucket) => sum + bucket.total, 0), result.totalAR)
})

test('Foundation AR rejects bad money and removes duplicate invoice rows', () => {
  const invoice = { id:'same', status:'partial', total_amount:10, paid_amount:2 }
  assert.equal(buildFoundationReceivables([invoice, invoice], '2026-10-06').totalAR, 8)
  assert.throws(() => buildFoundationReceivables([{ id:'bad', total_amount:'invalid' }], '2026-10-06'), /Invalid receivable/)
})
