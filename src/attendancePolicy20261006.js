export const ATTENDANCE_POLICY_EFFECTIVE_DATE = '2026-10-06'
export const OVERTIME_THRESHOLD_POLICY_EFFECTIVE_DATE = '2026-10-11'
export const EARLY_ARRIVAL_START_POLICY_EFFECTIVE_DATE = '2026-10-11'
export const SHORT_SHIFT_MEAL_POLICY_EFFECTIVE_DATE = '2026-10-11'
export const SHORT_SHIFT_MAX_MINUTES = 300
export function usesShortShiftMealPolicy(date = '') {
 return /^\d{4}-\d{2}-\d{2}$/.test(String(date).slice(0,10)) && String(date).slice(0,10) >= SHORT_SHIFT_MEAL_POLICY_EFFECTIVE_DATE
}
export function usesEarlyArrivalStartPolicy(date = '') {
 return /^\d{4}-\d{2}-\d{2}$/.test(String(date).slice(0,10)) && String(date).slice(0,10) >= EARLY_ARRIVAL_START_POLICY_EFFECTIVE_DATE
}
export function creditedAttendanceStartMinute(actualMinute, scheduledMinute = null) {
 const actual = Number(actualMinute)
 if (!Number.isFinite(actual)) return null
 const scheduled = Number(scheduledMinute)
 if (scheduledMinute !== null && scheduledMinute !== undefined && Number.isFinite(scheduled)) {
  return Math.max(actual, scheduled)
 }
 return Math.ceil(actual / 60) * 60
}
export function usesOvertimeThresholdPolicy(date = '') {
 return /^\d{4}-\d{2}-\d{2}$/.test(String(date).slice(0,10)) && String(date).slice(0,10) >= OVERTIME_THRESHOLD_POLICY_EFFECTIVE_DATE
}
export function usesMinuteAttendancePolicy(date = '') {
 return /^\d{4}-\d{2}-\d{2}$/.test(String(date).slice(0,10)) && String(date).slice(0,10) >= ATTENDANCE_POLICY_EFFECTIVE_DATE
}
export function payableOvertimeMinutes(minutes = 0, date = '') {
 const value = Number(minutes)
 const whole = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
 if (usesOvertimeThresholdPolicy(date) && whole < 30) return 0
 return usesMinuteAttendancePolicy(date) ? whole : Math.floor(whole / 30) * 30
}
export function policyBreakMinutes({date = '', spanMinutes = 0, recordedMinutes = 0, legacyOverride = null} = {}) {
 const span = Math.max(0, Number(spanMinutes) || 0)
 const recorded = Math.max(0, Number(recordedMinutes) || 0)
 if (usesShortShiftMealPolicy(date)) {
  if (span <= SHORT_SHIFT_MAX_MINUTES) return Math.min(span, recorded)
  if (legacyOverride !== null) return Math.min(span, Math.max(0, Number(legacyOverride) || 0))
  // An unpunched longer shift is held for review before payroll is computed.
  return Math.min(span, recorded > 0 ? Math.max(60, recorded) : 0)
 }
 const standard = !usesOvertimeThresholdPolicy(date) && usesMinuteAttendancePolicy(date) && span < 540 ? recorded : Math.max(60, recorded)
 return Math.min(span, !usesMinuteAttendancePolicy(date) && legacyOverride !== null ? Math.max(0, Number(legacyOverride) || 0) : standard)
}
export function policyOvertimeBasis(metrics = {}, date = '') {
 const paidExcess = Math.max(0, (Number(metrics.paidWorkedMinutes) || 0) - 480)
 return usesMinuteAttendancePolicy(date) && metrics.hasSchedule
  ? Math.min(paidExcess, Math.max(0, Number(metrics.postShiftMinutes) || 0))
  : paidExcess
}
