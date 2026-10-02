import test from 'node:test'
import assert from 'node:assert/strict'
import { getPayrollOverbreakDeduction } from '../src/payrollOverbreakPolicy.js'
import { enforcePayrollOverbreakDeduction } from '../vite.payroll-overbreak-deduction-invariant.js'

test('Mary Ann Sep 18: 46 overbreak minutes deduct exactly ₱48.40 without UT rounding', () => {
  const minuteRate = 505 / 8 / 60
  assert.deepEqual(getPayrollOverbreakDeduction({ overbreakMinutes:46, minuteRate, deductionApplicable:true }), {
    minutes:46,
    amount:48.40,
  })
})

test('overbreak deduction respects employees exempt from automatic attendance deductions', () => {
  assert.deepEqual(getPayrollOverbreakDeduction({ overbreakMinutes:46, minuteRate:505/480, deductionApplicable:false }), {
    minutes:0,
    amount:0,
  })
})

test('payroll invariant wires overbreak calculation, totals, persistence, and UI once', () => {
  const fixture = `import {
 getChargeableEarlyOutMinutes,
 x
} from './attendancePolicy.js'
function computePayroll(){
  const actualUndertimeCapacityByDate={}
  const workDetailByDate={}
   actualUndertimeCapacityByDate[logDateKey]=attendanceDeductionSplit.undertimeMinutes
   const actualDayOvertimeMinutes=0
  const undertimeDeduction=undertimeDeductionApplicable ? automaticUndertimeMinutes*minuteRate : 0

  // Night differential premium
  const undertimeDeductionRounded=moneyRound(undertimeDeduction)
  const absenceDeductionRounded=moneyRound(absenceDeduction)
  const mandatoryNonCADeductions=moneyRound(lateDeductionRounded+undertimeDeductionRounded+sssDeductionRounded+pagibigDeductionRounded+philhealthDeductionRounded+absenceDeductionRounded)
  results.push({ lateDeduction:lateDeductionRounded, undertimeDeduction:undertimeDeductionRounded, adjustmentDeductions:x })
  const payrollPayload=results.map(pay=>({
  late_deduction:moneyRound(pay.lateDeduction||0),
  undertime_deduction:moneyRound(pay.undertimeDeduction||0),
  cash_advance_deduction:x
  }))
  const {
     late_deduction, undertime_deduction,
     requested_cash_advance_deduction }=row
  const s={ totalUndertimeDeduction:results.reduce((a,p)=>a+(p.undertimeDeduction||0),0), totalCA:x }
}
function mapSavedPayrollRecordToResult(record){return {
  undertimeDeduction: safeNum(record.undertime_deduction, 0),
  adjustmentDeductions:x
}}
function buildPayrollSummaryFromResults(results){return {
  totalUndertimeDeduction: results.reduce((a,p)=>a+safeNum(p.undertimeDeduction,0),0),
  totalCA:x
}}
const ui=[['Undertime Deduction',php(payrollSummary.totalUndertimeDeduction||0)],['SSS']]
const card=<> {pay.undertimeDeduction>0&&<div style={{ display:'flex', justifyContent:'space-between' }}><span>Automatic Undertime Deduction</span><span>{php(pay.undertimeDeduction)}</span></div>}
 {pay.sssDeduction>0&&<div/>}</>`
  const transformed = enforcePayrollOverbreakDeduction(fixture, '/repo/src/App.jsx')
  assert.match(transformed, /PAYROLL_OVERBREAK_DEDUCTION_V1/)
  assert.match(transformed, /excessBreakDeduction:excessBreakDeductionRounded/)
  assert.match(transformed, /excess_break_deduction:moneyRound\(pay\.excessBreakDeduction\|\|0\)/)
  assert.match(transformed, /totalExcessBreakDeduction/)
  assert.match(transformed, /Excess Break Deduction/)
  assert.equal(enforcePayrollOverbreakDeduction(transformed, '/repo/src/App.jsx'), transformed)
})
