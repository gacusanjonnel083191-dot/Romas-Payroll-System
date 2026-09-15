import test from 'node:test'
import assert from 'node:assert/strict'
import { enforceEmployeeOTFilingBehavior } from '../vite.employee-ot-filing-invariant.js'

const fixture = `
async function loadMyAttendanceHistory(emp) {
 const { data, error } = await supabase.from('attendance_logs').select('*').eq('employee_id', emp.id).order('attendance_date', { ascending:false }).limit(30)
 if (error) {
  console.error('Attendance history load failed:', error)
  setMyAttendance([])
  return
 }
 const scheduleAwareLogs = await hydrateAttendanceLogsWithScheduleFallback(data || [], emp)
 const enrichedLogs = await enrichAttendanceLogsWithBreakRows(scheduleAwareLogs)
 setMyAttendance(attachAttendanceEmployeePolicy(enrichedLogs, emp))
 }

 async function toggleTimeAdjustmentFilingPanel() {
  return true
 }

function View({log}) {
 return <>{getDTRActualOvertimeMinutes(log)>0&&<p style={{...cps, color:'#2d8a4e' }}>Actual OT: {getDTRActualOvertimeMinutes(log)} min {getDTRApprovedOvertimeMinutes(log)>0?' Approved':' Pending filing/approval'}</p>}</>
}`

test('DTR OT filing action is exact-date and state aware', () => {
 const transformed = enforceEmployeeOTFilingBehavior(fixture, '/repo/src/App.jsx')
 assert.match(transformed, /openOTRequestForAttendanceDate\(attendanceDate\)/)
 assert.match(transformed, /setOtRequestDate\(targetDate\)/)
 assert.match(transformed, /refreshTimeAdjustmentPreview\(targetDate, 'overtime', '', ''\)/)
 assert.match(transformed, /FILE \/ CHECK OT/)
 assert.match(transformed, /OT FILED — Pending approval/)
 assert.match(transformed, /OT APPROVED/)
 assert.match(transformed, /No Meal Break review pending/)
 assert.doesNotMatch(transformed, /Pending filing\/approval/)
})

test('attendance history loads active OT and No Meal Break filing statuses without changing business records', () => {
 const transformed = enforceEmployeeOTFilingBehavior(fixture, '/repo/src/App.jsx')
 assert.match(transformed, /from\('time_adjustment_requests'\)/)
 assert.match(transformed, /in\('request_type', \['overtime','meal_break'\]\)/)
 assert.match(transformed, /in\('status', \['pending','approved'\]\)/)
 assert.match(transformed, /__ot_request_status:filingStatus\.ot/)
 assert.match(transformed, /__meal_break_request_status:filingStatus\.mealBreak/)
})

test('transformation is idempotent and does not touch unrelated modules', () => {
 const once = enforceEmployeeOTFilingBehavior(fixture, '/repo/src/App.jsx')
 const twice = enforceEmployeeOTFilingBehavior(once, '/repo/src/App.jsx')
 assert.equal(twice, once)
 assert.equal(enforceEmployeeOTFilingBehavior(fixture, '/repo/src/Other.jsx'), fixture)
})
