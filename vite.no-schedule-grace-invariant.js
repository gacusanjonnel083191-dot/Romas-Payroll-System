const APP_MODULE_RE = /[\\/]src[\\/]App\.jsx(?:\?.*)?$/

const ATTENDANCE_POLICY_IMPORT = `import {
 getChargeableEarlyOutMinutes,
 getUnconsumedApprovedTimeAdjustmentConflict,
 isApprovedTimeAdjustmentConsumedByReleasedPayroll
} from './attendancePolicy.js'`

const ATTENDANCE_POLICY_IMPORT_WITH_GRACE = `import {
 getAppliedPaidWorkGraceMinutes,
 getChargeableEarlyOutMinutes,
 getUnconsumedApprovedTimeAdjustmentConflict,
 isApprovedTimeAdjustmentConsumedByReleasedPayroll
} from './attendancePolicy.js'`

const GRACE_BLOCK = ` // Apply the grace period to UT, not only to the Late label. Credit only the
 // verified within-grace arrival minutes, capped by the raw paid-work shortage.
 // This prevents 1-10 minute arrivals from becoming Automatic UT. Grace never
 // creates OT.
 const graceAppliedMinutes = Math.min(
  rawPaidWorkShortageMinutes,
  Math.max(0, Math.round(scheduleMetrics.graceAppliedMinutes || 0))
 )`

const GRACE_BLOCK_WITH_NO_SCHEDULE = ` // Apply the grace period to UT, not only to the Late label. Scheduled days use
 // verified within-grace arrival minutes. When no shift is assigned, use the
 // configured grace as a tolerance on the paid-work shortage itself. This keeps
 // a 1-10 minute shortage from becoming a 30-minute Automatic UT while still
 // charging shortages beyond the grace threshold. Grace never creates OT.
 const graceAppliedMinutes = getAppliedPaidWorkGraceMinutes({
  rawPaidWorkShortageMinutes,
  hasSchedule:scheduleMetrics.hasSchedule,
  scheduleGraceAppliedMinutes:scheduleMetrics.graceAppliedMinutes,
  gracePeriodMinutes:scheduleMetrics.gracePeriodMinutes
 })`

function replaceExactlyOnce(source, from, to, label) {
 const firstIndex = source.indexOf(from)
 if (firstIndex < 0) throw new Error(`No-schedule grace invariant failed: ${label} was not found.`)
 const secondIndex = source.indexOf(from, firstIndex + from.length)
 if (secondIndex >= 0) throw new Error(`No-schedule grace invariant failed: ${label} matched more than once.`)
 return source.slice(0, firstIndex) + to + source.slice(firstIndex + from.length)
}

export function enforceNoScheduleGraceBehavior(source, id = '') {
 if (!APP_MODULE_RE.test(id)) return source
 let transformed = source
 if (!transformed.includes('getAppliedPaidWorkGraceMinutes,')) {
  transformed = replaceExactlyOnce(
   transformed,
   ATTENDANCE_POLICY_IMPORT,
   ATTENDANCE_POLICY_IMPORT_WITH_GRACE,
   'attendance policy import'
  )
 }
 if (!transformed.includes('hasSchedule:scheduleMetrics.hasSchedule')) {
  transformed = replaceExactlyOnce(
   transformed,
   GRACE_BLOCK,
   GRACE_BLOCK_WITH_NO_SCHEDULE,
   'paid-work grace block'
  )
 }
 return transformed
}

export function noScheduleGraceInvariant() {
 return {
  name:'romas-no-schedule-grace-invariant',
  enforce:'pre',
  transform(code, id) {
   if (!APP_MODULE_RE.test(id)) return null
   return { code:enforceNoScheduleGraceBehavior(code, id), map:null }
  }
 }
}
