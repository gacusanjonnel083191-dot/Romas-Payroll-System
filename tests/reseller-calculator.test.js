import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateResellerLine, calculateResellerTotals, toWholeQuantity } from '../src/resellerCalculator.js'

test('uses actual delivered, additions, deductions, and unsold to calculate settlement', () => {
  const result = calculateResellerLine({
    ordered: 50,
    delivered: 48,
    added: 5,
    deducted: 2,
    unsold: 6,
    resellerPrice: 20,
    retailPrice: 25,
  })

  assert.equal(result.sold, 45)
  assert.equal(result.amountDue, 900)
  assert.equal(result.estimatedProfit, 225)
})

test('never produces a negative sold quantity or payable', () => {
  const result = calculateResellerLine({ delivered: 3, deducted: 5, unsold: 8, resellerPrice: 20 })

  assert.equal(result.sold, 0)
  assert.equal(result.amountDue, 0)
  assert.equal(result.hasDeductionError, true)
  assert.equal(result.hasUnsoldError, true)
})

test('totals multiple products and preserves ordered as informational', () => {
  const totals = calculateResellerTotals([
    { ordered: 10, delivered: 9, added: 1, deducted: 0, unsold: 2, resellerPrice: 20, retailPrice: 25 },
    { ordered: 5, delivered: 5, added: 0, deducted: 1, unsold: 1, resellerPrice: 10, retailPrice: 12 },
  ])

  assert.deepEqual({
    ordered: totals.ordered,
    delivered: totals.delivered,
    added: totals.added,
    deducted: totals.deducted,
    unsold: totals.unsold,
    sold: totals.sold,
    amountDue: totals.amountDue,
    estimatedProfit: totals.estimatedProfit,
  }, {
    ordered: 15,
    delivered: 14,
    added: 1,
    deducted: 1,
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

