export const ATTENDANCE_POLICY_EFFECTIVE_DATE = '2026-10-06'
export function usesMinuteAttendancePolicy(date = '') {
 return /^\d{4}-\d{2}-\d{2}$/.test(String(date).slice(0,10)) && String(date).slice(0,10) >= ATTENDANCE_POLICY_EFFECTIVE_DATE
}
export function payableOvertimeMinutes(minutes = 0, date = '') {
 const value = Number(minutes)
 const whole = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
 return usesMinuteAttendancePolicy(date) ? whole : Math.floor(whole / 30) * 30
}
export function policyBreakMinutes({date = '', spanMinutes = 0, recordedMinutes = 0, legacyOverride = null} = {}) {
 const span = Math.max(0, Number(spanMinutes) || 0)
 const recorded = Math.max(0, Number(recordedMinutes) || 0)
 const standard = usesMinuteAttendancePolicy(date) && span < 540 ? recorded : Math.max(60, recorded)
 return Math.min(span, !usesMinuteAttendancePolicy(date) && legacyOverride !== null ? Math.max(0, Number(legacyOverride) || 0) : standard)
}
export function policyOvertimeBasis(metrics = {}, date = '') {
 const paidExcess = Math.max(0, (Number(metrics.paidWorkedMinutes) || 0) - 480)
 return usesMinuteAttendancePolicy(date) && metrics.hasSchedule
  ? Math.min(paidExcess, Math.max(0, Number(metrics.postShiftMinutes) || 0))
  : paidExcess
}
