import test from 'node:test'
import assert from 'node:assert/strict'
import { buildResetQuantities, calculateResellerLine, calculateResellerTotals, toWholeQuantity } from '../src/resellerCalculator.js'

test('uses actual delivered and unsold to calculate settlement', () => {
  const result = calculateResellerLine({
    ordered: 50,
    delivered: 48,
    unsold: 6,
    resellerPrice: 20,
    retailPrice: 25,
  })

  assert.equal(result.sold, 42)
  assert.equal(result.amountDue, 840)
  assert.equal(result.estimatedProfit, 210)
})

test('legacy added and deducted draft values no longer affect settlement', () => {
  const result = calculateResellerLine({
    delivered: 48,
    added: 5,
    deducted: 2,
    unsold: 6,
    resellerPrice: 20,
  })

  assert.equal(result.sold, 42)
  assert.equal(result.amountDue, 840)
})

test('never produces a negative sold quantity or payable', () => {
  const result = calculateResellerLine({ delivered: 3, unsold: 8, resellerPrice: 20 })

  assert.equal(result.sold, 0)
  assert.equal(result.amountDue, 0)
  assert.equal(result.hasUnsoldError, true)
})

test('totals multiple products and preserves ordered as informational', () => {
  const totals = calculateResellerTotals([
    { ordered: 10, delivered: 9, unsold: 2, resellerPrice: 20, retailPrice: 25 },
    { ordered: 5, delivered: 5, unsold: 1, resellerPrice: 10, retailPrice: 12 },
  ])

  assert.deepEqual({
    ordered: totals.ordered,
    delivered: totals.delivered,
    unsold: totals.unsold,
    sold: totals.sold,
    amountDue: totals.amountDue,
    estimatedProfit: totals.estimatedProfit,
  }, {
    ordered: 15,
    delivered: 14,
    unsold: 3,
    sold: 11,
    amountDue: 190,
    estimatedProfit: 46,
  })
})

test('normalizes invalid and decimal quantities to safe whole pieces', () => {
  assert.equal(toWholeQuantity(-2), 0)
  assert.equal(toWholeQuantity('not-a-number'), 0)
  assert.equal(toWholeQuantity('4.9'), 4)
})

test('reset preserves ordered quantity while clearing delivered and unsold', () => {
  assert.deepEqual(buildResetQuantities([
    { key: 'ring', variant_id: 'ring', variant_name: 'Rings', quantity: 12, ordered: '18' },
    { variant_id: 'shell', variant_name: 'Shells', quantity: '' },
  ]), {
    ring: { ordered: '18', delivered: '', unsold: '' },
    shell: { ordered: '', delivered: '', unsold: '' },
  })
})
