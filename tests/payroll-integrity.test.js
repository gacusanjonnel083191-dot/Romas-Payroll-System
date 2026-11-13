import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calculateSpecialHolidayPay } from '../src/specialHolidayPayrollPolicy.js'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const computation = app.slice(app.indexOf('async function computePayroll()'), app.indexOf('// Auto-acknowledge expired payslips'))

test('a monthly employee exempt from absence deductions keeps fixed salary on an unworked special day', () => {
  const dayRate = Math.round(20000 * 12 / 313 * 100) / 100
  assert.equal(dayRate, 766.77)
  assert.equal(calculateSpecialHolidayPay({ payrollBasis:'monthly', dailyRate:dayRate,
    hasWorked:false, deductUnworkedFixedDay:false }).unworkedFixedDayDeduction, 0)
  assert.match(computation, /deductUnworkedFixedDay:absenceDeductionApplicable/)
})

test('birthday eligibility is read from employee records and unavailable eligibility blocks payroll', () => {
  assert.match(computation, /\.select\('id,birthday_pay_eligible'\)/)
  assert.match(computation, /birthdayEligibilityById\.size !== empList\.length/)
  assert.match(computation, /birthdayEligibilityById\.get\(String\(emp\.id\)\) === true && emp\.date_of_birth/)
})

test('computation does not move payroll adjustment dates or write audit records before saving', () => {
  assert.doesNotMatch(computation, /from\('payroll_adjustments'\)\.update/)
  assert.doesNotMatch(computation, /adjustment_date:nextPayrollStart/)
  assert.match(computation, /if \(nonCADeductionOverflow > 0\)/)
})

test('saved totals are reloaded and compared before the computed draft is shown', () => {
  assert.match(computation, /savedResults=await loadSavedPayrollForPeriod/)
  assert.match(computation, /Saved payroll differs from calculation/)
  assert.doesNotMatch(computation, /setPayrollResults\(results\)/)
})

test('review readiness rejects saved arithmetic and birthday eligibility discrepancies', () => {
  const readiness = app.slice(app.indexOf('async function inspectPayrollReadiness('), app.indexOf('async function openPayrollAttendanceExceptionDTR('))
  assert.match(readiness, /earnings-deductions!==net/)
  assert.match(readiness, /eligibilityById\.get\(String\(row\.employee_id\)\)===false/)
  assert.match(readiness, /financialExceptions\.length === 0/)
})
