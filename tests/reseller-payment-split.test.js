import assert from 'node:assert/strict'
import test from 'node:test'
import { getResellerPaymentParts, getResellerPaymentTotal } from '../src/resellerPaymentSplit.js'

test('split payment keeps Cash and GCash as separate exact ledger amounts', () => {
  const parts = getResellerPaymentParts('Cash + GCash', '', '120.29', '79.71')
  assert.deepEqual(parts, [{ method:'Cash', amount:120.29 }, { method:'GCash', amount:79.71 }])
  assert.equal(getResellerPaymentTotal(parts), 200)
})

test('single payment still uses one method and amount', () => {
  assert.deepEqual(getResellerPaymentParts('Cash', '85.50'), [{ method:'Cash', amount:85.5 }])
})

test('split payment requires two positive peso amounts with at most two decimals', () => {
  for (const [cash, gcash] of [['100', ''], ['0', '50'], ['-1', '50'], ['1.001', '50'], ['abc', '50']]) {
    assert.throws(() => getResellerPaymentParts('Cash + GCash', '', cash, gcash))
  }
})
