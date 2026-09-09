const APP_FILE_RE = /(?:^|\/)src\/App\.jsx(?:\?|$)/
const ANALYTICS_START = 'const otUtAnalytics = (() => {'
const ANALYTICS_END = 'function getOtUtWarningInfo'

function replaceOnce(source, regex, replacement, label) {
  const matches = source.match(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`)) || []
  if (matches.length !== 1) {
    throw new Error(`[overtime-payroll-invariant] Expected exactly one ${label}; found ${matches.length}. Refusing an unsafe build-time patch.`)
  }
  return source.replace(regex, replacement)
}

export function applyOvertimePayrollInvariant(source) {
  if (!source.includes('function roundPayableOvertimeMinutes')) {
    throw new Error('[overtime-payroll-invariant] Missing roundPayableOvertimeMinutes policy helper.')
  }

  let output = source

  // Legacy approved requests keep their original audit minutes in the database,
  // but management analytics must report only current policy-qualified OT.
  const analyticsStart = output.indexOf(ANALYTICS_START)
  const analyticsEnd = output.indexOf(ANALYTICS_END, analyticsStart + ANALYTICS_START.length)
  if (analyticsStart < 0 || analyticsEnd < 0 || analyticsEnd <= analyticsStart) {
    throw new Error('[overtime-payroll-invariant] OT analytics block could not be located safely.')
  }
  const analyticsBlock = output.slice(analyticsStart, analyticsEnd)
  if (!analyticsBlock.includes("type === 'overtime' ? roundPayableOvertimeMinutes(rawMinutes) : rawMinutes")) {
    const patchedAnalytics = replaceOnce(
      analyticsBlock,
      /const minutes = Math\.max\(0,\s*safeNum\(req\?\.minutes,\s*0\)\)/,
      "const rawMinutes = Math.max(0, safeNum(req?.minutes, 0))\n  const minutes = type === 'overtime' ? roundPayableOvertimeMinutes(rawMinutes) : rawMinutes",
      'legacy OT analytics minute assignment'
    )
    output = output.slice(0, analyticsStart) + patchedAnalytics + output.slice(analyticsEnd)
  }

  // Payroll approval and payroll release are separate states. OT/meal-break history
  // becomes immutable only after the canonical release state is reached.
  if (!output.includes('payroll_released,payroll_locked,released_at')) {
    output = replaceOnce(
      output,
      /\.select\('id,employee_id,payroll_start,payroll_end,payroll_approved,approved_at,payroll_status,overtime_minutes,overtime_pay,undertime_minutes,undertime_deduction,late_minutes,late_deduction'\)/,
      ".select('id,employee_id,payroll_start,payroll_end,payroll_approved,approved_at,payroll_released,payroll_locked,released_at,payroll_status,overtime_minutes,overtime_pay,undertime_minutes,undertime_deduction,late_minutes,late_deduction')",
      'OT payroll-state select'
    )
  }

  if (!output.includes("released: records.some(r => r.payroll_released === true || String(r.payroll_status || '').toLowerCase() === 'released' || !!r.released_at)")) {
    output = replaceOnce(
      output,
      /released:\s*records\.some\(r => r\.payroll_approved === true \|\|\s*!!r\.approved_at\),/,
      "released: records.some(r => r.payroll_released === true || String(r.payroll_status || '').toLowerCase() === 'released' || !!r.released_at),",
      'legacy approval-as-release predicate'
    )
  }

  const finalAnalyticsStart = output.indexOf(ANALYTICS_START)
  const finalAnalyticsEnd = output.indexOf(ANALYTICS_END, finalAnalyticsStart + ANALYTICS_START.length)
  const finalAnalytics = output.slice(finalAnalyticsStart, finalAnalyticsEnd)
  if (!finalAnalytics.includes("type === 'overtime' ? roundPayableOvertimeMinutes(rawMinutes) : rawMinutes")) {
    throw new Error('[overtime-payroll-invariant] Policy-qualified OT analytics invariant failed.')
  }
  if (!output.includes("released: records.some(r => r.payroll_released === true || String(r.payroll_status || '').toLowerCase() === 'released' || !!r.released_at)")) {
    throw new Error('[overtime-payroll-invariant] Canonical payroll release invariant failed.')
  }

  return output
}

export function overtimePayrollInvariant() {
  return {
    name: 'roma-overtime-payroll-invariant',
    enforce: 'pre',
    transform(code, id) {
      if (!APP_FILE_RE.test(id)) return null
      const transformed = applyOvertimePayrollInvariant(code)
      return transformed === code ? null : { code: transformed, map: null }
    },
  }
}
