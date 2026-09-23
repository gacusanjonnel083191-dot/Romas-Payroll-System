export function getChargeableEarlyOutMinutes({
 earlyOutMinutes = 0,
 deductedBreakMinutes = 0,
 breakOverrideApplied = false,
 standardBreakMinutes = 60
} = {}) {
 const earlyOut = Math.max(0, Math.round(Number(earlyOutMinutes) || 0))
 const deductedBreak = Math.max(0, Math.round(Number(deductedBreakMinutes) || 0))
 const standardBreak = Math.max(0, Math.round(Number(standardBreakMinutes) || 0))
 const mealBreakScheduleCreditMinutes = breakOverrideApplied
  ? Math.max(0, standardBreak - deductedBreak)
  : 0
 return {
  mealBreakScheduleCreditMinutes,
  chargeableEarlyOutMinutes:Math.max(0, earlyOut - mealBreakScheduleCreditMinutes)
 }
}

export function getAppliedPaidWorkGraceMinutes({
 rawPaidWorkShortageMinutes = 0,
 hasSchedule = true,
 scheduleGraceAppliedMinutes = 0,
 gracePeriodMinutes = 0
} = {}) {
 const shortage = Math.max(0, Math.round(Number(rawPaidWorkShortageMinutes) || 0))
 const scheduleGrace = Math.max(0, Math.round(Number(scheduleGraceAppliedMinutes) || 0))
 const configuredGrace = Math.max(0, Math.round(Number(gracePeriodMinutes) || 0))
 const applicableGrace = hasSchedule ? scheduleGrace : configuredGrace
 return Math.min(shortage, applicableGrace)
}

function safePolicyNumber(value = 0) {
 const numeric = Number(value)
 return Number.isFinite(numeric) ? numeric : 0
}

function isReleasedPayrollRecordLike(record = {}) {
 const status = String(record?.payroll_status || '').trim().toLowerCase()
 return record?.payroll_approved === true
  || record?.payroll_released === true
  || !!record?.approved_at
  || !!record?.released_at
  || ['released', 'approved'].includes(status)
}

export function isApprovedTimeAdjustmentConsumedByReleasedPayroll(approvedTime = {}, payrollRecords = [], attendanceLogs = []) {
 const requestType = String(approvedTime?.request_type || '').trim().toLowerCase()
 const sourceDate = String(approvedTime?.attendance_date || '').slice(0, 10)
 const minutes = Math.max(0, Math.round(safePolicyNumber(approvedTime?.minutes, 0)))
 if (!sourceDate || !['overtime', 'undertime'].includes(requestType)) return false

 const releasedPayroll = (payrollRecords || []).find(record => {
  const start = String(record?.payroll_start || '').slice(0, 10)
  const end = String(record?.payroll_end || '').slice(0, 10)
  return isReleasedPayrollRecordLike(record) && start && end && start <= sourceDate && end >= sourceDate
 })
 if (!releasedPayroll) return false

 if (requestType === 'undertime') {
  const attendanceHasStoredMinutes = (attendanceLogs || []).some(log =>
   String(log?.attendance_date || '').slice(0, 10) === sourceDate
   && Math.max(0, Math.round(safePolicyNumber(log?.undertime_minutes, 0))) === minutes
  )
  return attendanceHasStoredMinutes
   && Math.max(0, Math.round(safePolicyNumber(releasedPayroll?.undertime_minutes, 0))) >= minutes
 }

 const attendanceHasStoredMinutes = (attendanceLogs || []).some(log =>
  String(log?.attendance_date || '').slice(0, 10) === sourceDate
  && Math.max(0, Math.round(safePolicyNumber(log?.overtime_minutes, 0))) === minutes
  && (log?.overtime_approved === true || String(log?.overtime_approved || '').trim().toLowerCase() === 'true')
 )
 return attendanceHasStoredMinutes
  && Math.max(0, Math.round(safePolicyNumber(releasedPayroll?.overtime_minutes, 0))) >= minutes
}

export function getUnconsumedApprovedTimeAdjustmentConflict(approvedTimeRows = [], payrollRecords = [], attendanceLogs = []) {
 return (approvedTimeRows || []).find(row =>
  !isApprovedTimeAdjustmentConsumedByReleasedPayroll(row, payrollRecords, attendanceLogs)
 ) || null
}
