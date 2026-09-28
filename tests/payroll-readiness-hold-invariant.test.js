import test from 'node:test'
import assert from 'node:assert/strict'
import { enforcePayrollMealBreakExemptions } from '../vite.payroll-meal-break-exemption-invariant.js'

const fixture = `
function buildPayrollMealBreakReviewException(employee = {}, attendanceDate = '', dayLogs = [], breakRowsByLogId = {}) {
 const integrity = getAttendanceDayIntegrity(dayLogs)
 if (!integrity.isValidCompleted) return null

 const resolvedBreakRowsByLogId = { ...(breakRowsByLogId || {}) }
 const metrics = getAttendanceDayWorkMetrics(integrity.completedLogs, resolvedBreakRowsByLogId)
 const breakEvidence = getAttendanceBreakPunchEvidence({ breakRowsByLogId:resolvedBreakRowsByLogId, metrics })
 const isShortScheduledDay = metrics.rawSpanMinutes > 0
  && metrics.rawSpanMinutes < REQUIRED_PAID_WORK_MINUTES + ALLOWED_BREAK_MINUTES
 const requiresReview = !metrics.breakOverrideApplied
  && !breakEvidence.hasBreakEvidence
  && isShortScheduledDay
  && metrics.undertimeMinutes > 0
 if (!requiresReview) return null
 return buildPayrollAttendanceException(employee, attendanceDate, dayLogs, { code:'meal_break_review' })
}
async function inspectPayrollReadiness() {
 const { data:activeEmployees } = await supabase
  .from('employees')
  .select('id,employee_code,full_name,position,is_active,shift_start,shift_end,grace_period_minutes')
 const activeList = activeEmployees || []
 const attendanceExceptions = []
 const payrollRowsByEmployee = {}
 const missingEmployees = activeList
  .filter(emp => !(payrollRowsByEmployee[String(emp.id)] || []).length)
  .map(emp => ({ employeeId:emp.id }))
 const duplicateEmployees = []
 const heldEmployeeIds = Array.from(new Set(attendanceExceptions.map(item => String(item.employeeId || '')).filter(Boolean)))
 const readiness = {
  readyPayrollEmployeeCount:activeList.length - missingEmployees.length,
  attendanceExceptions,
  heldEmployeeIds,
  missingEmployees,
  duplicateEmployees
 }
 return readiness
}`

test('missing break punches use the standard 60-minute deduction and do not create a payroll hold', () => {
 const transformed = enforcePayrollMealBreakExemptions(fixture, '/repo/src/App.jsx')
 assert.match(transformed, /DEFAULT_60_MIN_BREAK_ASSUMPTION/)
 assert.match(transformed, /const requiresReview = false/)
 assert.doesNotMatch(transformed, /!breakEvidence\.hasBreakEvidence\s*\n\s*&& isShortScheduledDay/)
})

test('payroll readiness does not double-count held employees as missing payroll rows', () => {
 const transformed = enforcePayrollMealBreakExemptions(fixture, '/repo/src/App.jsx')
 assert.match(transformed, /payrollExemptFromBreakSensitivePay/)
 assert.match(transformed, /overtime_pay_eligible,undertime_deduction_applicable,night_differential_pay_eligible/)
 assert.match(transformed, /!attendanceExceptions\.some\(item => String\(item\.employeeId \|\| ''\) === String\(emp\.id\)\)/)
 assert.match(transformed, /readyPayrollEmployeeCount:Math\.max\(0, activeList\.length - missingEmployees\.length - heldEmployeeIds\.length\)/)
})

test('transformation is idempotent for App.jsx', () => {
 const once = enforcePayrollMealBreakExemptions(fixture, '/repo/src/App.jsx')
 const twice = enforcePayrollMealBreakExemptions(once, '/repo/src/App.jsx')
 assert.equal(twice, once)
})

test('unrelated modules are unchanged', () => {
 assert.equal(enforcePayrollMealBreakExemptions(fixture, '/repo/src/Other.jsx'), fixture)
})
