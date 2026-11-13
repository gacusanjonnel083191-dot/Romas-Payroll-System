// DOLE special non-working day: no work, no statutory holiday pay.
// This module computes the premium on actual work and removes the unearned
// holiday-day portion of a fixed salary, without changing paid-leave benefits.
export function isSpecialHolidayRestDay(date, schedule = null, annualWorkingDays = 313) {
  const start = String(date || '').slice(0, 10)
  const match = /^\d{4}-\d{2}-\d{2}$/.test(start) ? new Date(start + 'T12:00:00Z') : null
  if (!match || Number.isNaN(match.getTime())) return false
  if (schedule) {
    return !(String(schedule.shift_start || '').trim() && String(schedule.shift_end || '').trim())
  }
  const weekday = match.getUTCDay()
  // 313-day basis excludes Sundays; a 5-day basis excludes weekends.
  const workingDays = Number(annualWorkingDays) || 313
  if (workingDays >= 365) return false
  return workingDays <= 261 ? weekday === 0 || weekday === 6 : weekday === 0
}

export function calculateSpecialHolidayPay({
  hasWorked = false,
  workedMinutes = 480,
  restDay = false,
  payrollBasis = 'daily',
  dailyRate = 0,
  paidLeaveCovered = false,
  alreadyDeductedForAbsence = false,
  deductUnworkedFixedDay = true
} = {}) {
  const paidRegularMinutes = hasWorked === true ? Math.min(480, Math.max(0, Number(workedMinutes) || 0)) : 0
  const worked = paidRegularMinutes > 0
  const regularWorkFraction = paidRegularMinutes / 480
  const fixedSalary = ['monthly', 'semi_monthly'].includes(String(payrollBasis || '').toLowerCase())
  const rate = Math.max(0, Number(dailyRate) || 0)
  // Fixed monthly base excludes rest-day work when the day is already excluded
  // from annual working days; daily-pay base includes the completed workday.
  const holidayPremium = !worked ? 0
    : restDay ? rate * regularWorkFraction * (fixedSalary ? 1.5 : 0.5)
      : rate * regularWorkFraction * 0.3
  const unworkedFixedDayDeduction = fixedSalary && deductUnworkedFixedDay && !worked && !restDay && !paidLeaveCovered &&
    !alreadyDeductedForAbsence ? rate : 0
  return { holidayPremium, unworkedFixedDayDeduction }
}

export const specialHolidayOvertimeMultiplier = restDay => restDay ? 1.5 * 1.3 : 1.3 * 1.3
