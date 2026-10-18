import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { enforcePayrollMealBreakExemptions } from '../vite.payroll-meal-break-exemption-invariant.js'
import { usesShortShiftMealPolicy, SHORT_SHIFT_MAX_MINUTES } from '../src/attendancePolicy20261006.js'

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

test('meal break review remains active for qualifying shifts', () => {
 const transformed = enforcePayrollMealBreakExemptions(fixture, '/repo/src/App.jsx')
 assert.match(transformed, /!breakEvidence\.hasBreakEvidence\s*\n\s*&& isShortScheduledDay/)
 assert.doesNotMatch(transformed, /const requiresReview = false/)
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

test('cutoff review holds longer unpunched shifts, but releases short and approved shifts', () => {
 const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
 const start=app.indexOf('function buildPayrollMealBreakReviewException(')
 const end=app.indexOf('\nfunction ',start+1)
 const ctx={usesShortShiftMealPolicy,SHORT_SHIFT_MAX_MINUTES,REQUIRED_PAID_WORK_MINUTES:480,ALLOWED_BREAK_MINUTES:60,
  getAttendanceDayIntegrity:logs=>({isValidCompleted:true,completedLogs:logs}),
  getAttendanceDayWorkMetrics:logs=>logs[0].metrics,
  getAttendanceBreakPunchEvidence:()=>({hasBreakEvidence:false,hasCompletedBreakPunch:false}),
  buildPayrollAttendanceException:(_emp,_date,_logs,issue)=>issue}
 vm.createContext(ctx)
 vm.runInContext(app.slice(start,end),ctx)
 const issue=metrics=>ctx.buildPayrollMealBreakReviewException({},'2026-10-18',[{id:1,metrics}])
 assert.equal(issue({rawSpanMinutes:300,breakOverrideApplied:false,recordedBreakMinutes:0,undertimeMinutes:240}),null)
 assert.equal(issue({rawSpanMinutes:301,breakOverrideApplied:false,recordedBreakMinutes:0,undertimeMinutes:180}).code,'meal_break_review')
 assert.equal(issue({rawSpanMinutes:540,breakOverrideApplied:false,recordedBreakMinutes:0,undertimeMinutes:0}).code,'meal_break_review')
 assert.equal(issue({rawSpanMinutes:540,breakOverrideApplied:true,recordedBreakMinutes:0,undertimeMinutes:0}),null)
})
