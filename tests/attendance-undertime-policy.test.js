import test from 'node:test'
import assert from 'node:assert/strict'
import {
 getAppliedPaidWorkGraceMinutes,
 getChargeableEarlyOutMinutes,
 getUnconsumedApprovedTimeAdjustmentConflict,
 isApprovedTimeAdjustmentConsumedByReleasedPayroll
} from '../src/attendancePolicy.js'
import { enforceNoScheduleGraceBehavior } from '../vite.no-schedule-grace-invariant.js'

test('approved no-meal-break removes the unused meal hour from early-out shortage', () => {
 assert.deepEqual(getChargeableEarlyOutMinutes({
  earlyOutMinutes:300,
  deductedBreakMinutes:0,
  breakOverrideApplied:true
 }), {
  mealBreakScheduleCreditMinutes:60,
  chargeableEarlyOutMinutes:240
 })
})

test('normal unpaid meal break keeps the complete early-out shortage', () => {
 assert.deepEqual(getChargeableEarlyOutMinutes({
  earlyOutMinutes:300,
  deductedBreakMinutes:60,
  breakOverrideApplied:false
 }), {
  mealBreakScheduleCreditMinutes:0,
  chargeableEarlyOutMinutes:300
 })
})

test('approved partial unpaid break credits only the waived portion', () => {
 assert.deepEqual(getChargeableEarlyOutMinutes({
  earlyOutMinutes:180,
  deductedBreakMinutes:30,
  breakOverrideApplied:true
 }), {
  mealBreakScheduleCreditMinutes:30,
  chargeableEarlyOutMinutes:150
 })
})

test('approved no-meal-break never creates negative early-out minutes', () => {
 assert.deepEqual(getChargeableEarlyOutMinutes({
  earlyOutMinutes:30,
  deductedBreakMinutes:0,
  breakOverrideApplied:true
 }), {
  mealBreakScheduleCreditMinutes:60,
  chargeableEarlyOutMinutes:0
 })
})

test('reconciled Sheryl and Myra short shifts produce the expected 30-minute UT blocks', () => {
 const cases = [
  { employee:'Myra', date:'2026-08-24', earlyOutMinutes:298, expectedUndertime:240 },
  { employee:'Sheryl', date:'2026-08-19', earlyOutMinutes:290, expectedUndertime:240 },
  { employee:'Sheryl', date:'2026-08-20', earlyOutMinutes:297, expectedUndertime:240 },
  { employee:'Sheryl', date:'2026-08-24', earlyOutMinutes:297, expectedUndertime:240 },
  { employee:'Sheryl', date:'2026-08-25', earlyOutMinutes:299, expectedUndertime:240 },
  { employee:'Sheryl', date:'2026-08-28', earlyOutMinutes:293, expectedUndertime:240 },
  { employee:'Sheryl', date:'2026-09-01', earlyOutMinutes:415, expectedUndertime:360 },
  { employee:'Sheryl', date:'2026-09-03', earlyOutMinutes:353, expectedUndertime:300 },
  { employee:'Sheryl', date:'2026-09-07', earlyOutMinutes:174, expectedUndertime:120 }
 ]

 cases.forEach(({ employee, date, earlyOutMinutes, expectedUndertime }) => {
  const { chargeableEarlyOutMinutes } = getChargeableEarlyOutMinutes({
   earlyOutMinutes,
   deductedBreakMinutes:0,
   breakOverrideApplied:true
  })
  const roundedUndertime = Math.ceil(chargeableEarlyOutMinutes / 30) * 30
  assert.equal(roundedUndertime, expectedUndertime, `${employee} ${date}`)
 })
})

test('released-payroll approved UT can stay as audit history during no-meal-break refund', () => {
 const approvedUT = { id:386, request_type:'undertime', attendance_date:'2026-08-20', minutes:300 }
 const releasedPayroll = {
  payroll_start:'2026-08-11',
  payroll_end:'2026-08-25',
  payroll_approved:true,
  payroll_status:'released',
  undertime_minutes:780
 }
 const attendanceLog = { attendance_date:'2026-08-20', undertime_minutes:300 }

 assert.equal(isApprovedTimeAdjustmentConsumedByReleasedPayroll(approvedUT, [releasedPayroll], [attendanceLog]), true)
 assert.equal(getUnconsumedApprovedTimeAdjustmentConflict([approvedUT], [releasedPayroll], [attendanceLog]), null)
})

test('approved UT still blocks no-meal-break approval when it is not in released payroll', () => {
 const approvedUT = { id:501, request_type:'undertime', attendance_date:'2026-09-14', minutes:60 }
 const draftPayroll = {
  payroll_start:'2026-09-11',
  payroll_end:'2026-09-25',
  payroll_status:'draft',
  undertime_minutes:60
 }
 const attendanceLog = { attendance_date:'2026-09-14', undertime_minutes:60 }

 assert.equal(isApprovedTimeAdjustmentConsumedByReleasedPayroll(approvedUT, [draftPayroll], [attendanceLog]), false)
 assert.equal(getUnconsumedApprovedTimeAdjustmentConflict([approvedUT], [draftPayroll], [attendanceLog]), approvedUT)
})

test('approved time blocks no-meal-break approval when released payroll does not contain the approved minutes', () => {
 const approvedUT = { id:502, request_type:'undertime', attendance_date:'2026-09-01', minutes:300 }
 const releasedPayroll = {
  payroll_start:'2026-08-26',
  payroll_end:'2026-09-10',
  payroll_approved:true,
  payroll_status:'released',
  undertime_minutes:120
 }
 const attendanceLog = { attendance_date:'2026-09-01', undertime_minutes:300 }

 assert.equal(isApprovedTimeAdjustmentConsumedByReleasedPayroll(approvedUT, [releasedPayroll], [attendanceLog]), false)
 assert.equal(getUnconsumedApprovedTimeAdjustmentConflict([approvedUT], [releasedPayroll], [attendanceLog]), approvedUT)
})

test('Marynessa no-schedule 2-minute shortage is fully covered by the 10-minute grace', () => {
 const rawPaidWorkShortageMinutes = 2
 const graceApplied = getAppliedPaidWorkGraceMinutes({
  rawPaidWorkShortageMinutes,
  hasSchedule:false,
  scheduleGraceAppliedMinutes:0,
  gracePeriodMinutes:10
 })
 const remainingShortage = Math.max(0, rawPaidWorkShortageMinutes - graceApplied)
 assert.equal(graceApplied, 2)
 assert.equal(remainingShortage, 0)
})

test('no-schedule grace preserves the 10-minute threshold and charges the 11th minute', () => {
 const withinGrace = getAppliedPaidWorkGraceMinutes({
  rawPaidWorkShortageMinutes:10,
  hasSchedule:false,
  gracePeriodMinutes:10
 })
 const beyondGrace = getAppliedPaidWorkGraceMinutes({
  rawPaidWorkShortageMinutes:11,
  hasSchedule:false,
  gracePeriodMinutes:10
 })
 assert.equal(10 - withinGrace, 0)
 assert.equal(11 - beyondGrace, 1)
 assert.equal(Math.ceil((11 - beyondGrace) / 30) * 30, 30)
})

test('scheduled attendance still uses only verified schedule grace, not a generic shortage allowance', () => {
 assert.equal(getAppliedPaidWorkGraceMinutes({
  rawPaidWorkShortageMinutes:8,
  hasSchedule:true,
  scheduleGraceAppliedMinutes:0,
  gracePeriodMinutes:10
 }), 0)
 assert.equal(getAppliedPaidWorkGraceMinutes({
  rawPaidWorkShortageMinutes:8,
  hasSchedule:true,
  scheduleGraceAppliedMinutes:7,
  gracePeriodMinutes:10
 }), 7)
})

const noScheduleGraceFixture = `import {
 getChargeableEarlyOutMinutes,
 getUnconsumedApprovedTimeAdjustmentConflict,
 isApprovedTimeAdjustmentConsumedByReleasedPayroll
} from './attendancePolicy.js'

function getAttendanceDayWorkMetrics() {
 const rawPaidWorkShortageMinutes = Math.max(0, REQUIRED_PAID_WORK_MINUTES - paidWorkedMinutes)
 const scheduleMetrics = getScheduleAnchoredAttendanceMetrics(completedLogs)

 // Apply the grace period to UT, not only to the Late label. Credit only the
 // verified within-grace arrival minutes, capped by the raw paid-work shortage.
 // This prevents 1-10 minute arrivals from becoming Automatic UT. Grace never
 // creates OT.
 const graceAppliedMinutes = Math.min(
  rawPaidWorkShortageMinutes,
  Math.max(0, Math.round(scheduleMetrics.graceAppliedMinutes || 0))
 )
 const paidWorkShortageMinutes = Math.max(0, rawPaidWorkShortageMinutes - graceAppliedMinutes)
 return paidWorkShortageMinutes
}`

test('no-schedule Vite invariant wires the policy helper into App.jsx exactly once', () => {
 const transformed = enforceNoScheduleGraceBehavior(noScheduleGraceFixture, '/repo/src/App.jsx')
 assert.match(transformed, /getAppliedPaidWorkGraceMinutes,/)
 assert.match(transformed, /hasSchedule:scheduleMetrics\.hasSchedule/)
 assert.match(transformed, /gracePeriodMinutes:scheduleMetrics\.gracePeriodMinutes/)
 assert.equal(enforceNoScheduleGraceBehavior(transformed, '/repo/src/App.jsx'), transformed)
})

test('no-schedule Vite invariant leaves unrelated modules unchanged', () => {
 assert.equal(enforceNoScheduleGraceBehavior(noScheduleGraceFixture, '/repo/src/Other.jsx'), noScheduleGraceFixture)
})
