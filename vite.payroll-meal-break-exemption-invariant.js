const APP_MODULE_RE = /[\\/]src[\\/]App\.jsx(?:\?.*)?$/

const MEAL_BREAK_REVIEW_FUNCTION_START = `function buildPayrollMealBreakReviewException(employee = {}, attendanceDate = '', dayLogs = [], breakRowsByLogId = {}) {
 const integrity = getAttendanceDayIntegrity(dayLogs)`

const MEAL_BREAK_REVIEW_FUNCTION_START_WITH_EXEMPTION = `function buildPayrollMealBreakReviewException(employee = {}, attendanceDate = '', dayLogs = [], breakRowsByLogId = {}) {
 const payrollExemptFromBreakSensitivePay = !employeeRuleEnabled(employee?.overtime_pay_eligible, true)
  && !employeeRuleEnabled(employee?.undertime_deduction_applicable, true)
  && !employeeRuleEnabled(employee?.night_differential_pay_eligible, true)
 if (payrollExemptFromBreakSensitivePay) return null

 const integrity = getAttendanceDayIntegrity(dayLogs)`

const PAYROLL_READINESS_EMPLOYEE_SELECT = `.select('id,employee_code,full_name,position,is_active,shift_start,shift_end,grace_period_minutes')`
const PAYROLL_READINESS_EMPLOYEE_SELECT_WITH_PAY_RULES = `.select('id,employee_code,full_name,position,is_active,shift_start,shift_end,grace_period_minutes,overtime_pay_eligible,undertime_deduction_applicable,night_differential_pay_eligible')`

function replaceExactlyOnce(source, from, to, label) {
  const firstIndex = source.indexOf(from)
  if (firstIndex < 0) throw new Error(`Payroll meal-break exemption invariant failed: ${label} was not found.`)
  const secondIndex = source.indexOf(from, firstIndex + from.length)
  if (secondIndex >= 0) throw new Error(`Payroll meal-break exemption invariant failed: ${label} matched more than once.`)
  return source.slice(0, firstIndex) + to + source.slice(firstIndex + from.length)
}

export function enforcePayrollMealBreakExemptions(source, id = '') {
  if (!APP_MODULE_RE.test(id)) return source
  let transformed = replaceExactlyOnce(
    source,
    MEAL_BREAK_REVIEW_FUNCTION_START,
    MEAL_BREAK_REVIEW_FUNCTION_START_WITH_EXEMPTION,
    'buildPayrollMealBreakReviewException start'
  )
  transformed = replaceExactlyOnce(
    transformed,
    PAYROLL_READINESS_EMPLOYEE_SELECT,
    PAYROLL_READINESS_EMPLOYEE_SELECT_WITH_PAY_RULES,
    'payroll readiness employee policy select'
  )
  return transformed
}

export function payrollMealBreakExemptionInvariant() {
  return {
    name: 'romas-payroll-meal-break-exemption-invariant',
    enforce: 'pre',
    transform(code, id) {
      if (!APP_MODULE_RE.test(id)) return null
      return {
        code: enforcePayrollMealBreakExemptions(code, id),
        map: null,
      }
    },
  }
}
