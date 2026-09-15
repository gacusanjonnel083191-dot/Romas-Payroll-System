'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { applyPayrollAdjustmentDeferral } = require('../scripts/payroll-adjustment-deferral.cjs')

const deductionBlock = `  const adjDeductionsRounded=moneyRound(adjDeductions+absenceDeductionRounded)\n  const nonCADeductions=moneyRound(lateDeductionRounded+undertimeDeductionRounded+sssDeductionRounded+pagibigDeductionRounded+philhealthDeductionRounded+adjDeductionsRounded)\n\n  // Payroll safety rule: deductions must never create negative net pay.\n  // Cash advance is flexible and is always applied last. Any unpaid CA stays in the CA balance.\n  // If non-CA deductions alone exceed earnings, release is blocked until admin reviews/corrects it.\n  const nonCADeductionOverflow=moneyRound(Math.max(0, nonCADeductions-totalEarnings))\n  const availableForCA=moneyRound(Math.max(0, totalEarnings-nonCADeductions))\n  const rawCADeduction=moneyRound((cas||[]).filter(isOutstandingCashAdvance).reduce((s,ca)=>s+getCashAdvancePayrollDeduction(ca),0))\n  const caDeduction=moneyRound(Math.min(rawCADeduction, availableForCA))\n  const deferredCADeduction=moneyRound(Math.max(0, rawCADeduction-caDeduction))\n  const cashAdvanceBreakdown=buildCashAdvanceDeductionSnapshot(cas || [], caDeduction)\n  const totalDeductions=moneyRound(nonCADeductionOverflow>0?nonCADeductions:nonCADeductions+caDeduction)\n  const netPay=moneyRound(Math.max(0,totalEarnings-totalDeductions))`

function fixture() {
  return `const supabase = createClient(supabaseUrl, supabaseKey)\n${deductionBlock}\nresults.push({ adjustmentEarnings:adjEarnings, adjustmentItems:adjustmentBreakdown, totalEarnings })`
}

test('defers payroll adjustment deductions instead of allowing them to create avoidable overflow', () => {
  const out = applyPayrollAdjustmentDeferral(fixture())
  assert.match(out, /mandatoryNonCADeductions/)
  assert.match(out, /PAYROLL ADJUSTMENT AUTO-DEFERRED/)
  assert.match(out, /adjustment_date:nextPayrollStart/)
  assert.match(out, /adjustmentItems:payableAdjustmentBreakdown/)
})

test('patch is idempotent', () => {
  const once = applyPayrollAdjustmentDeferral(fixture())
  const twice = applyPayrollAdjustmentDeferral(once)
  assert.equal(twice, once)
})

test('fails closed if payroll anchors change', () => {
  assert.throws(
    () => applyPayrollAdjustmentDeferral('const supabase = createClient(supabaseUrl, supabaseKey)\nchanged payroll code'),
    /anchor was not found/
  )
})
