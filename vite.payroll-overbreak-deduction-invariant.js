const APP_MODULE_RE = /[\\/]src[\\/]App\.jsx(?:\?.*)?$/

function replaceExactlyOnce(source, from, to, label) {
  const firstIndex = source.indexOf(from)
  if (firstIndex < 0) throw new Error(\`Payroll overbreak invariant failed: \${label} was not found.\`)
  const secondIndex = source.indexOf(from, firstIndex + from.length)
  if (secondIndex >= 0) throw new Error(\`Payroll overbreak invariant failed: \${label} matched more than once.\`)
  return source.slice(0, firstIndex) + to + source.slice(firstIndex + from.length)
}

export function enforcePayrollOverbreakDeduction(source, id = '') {
  if (!APP_MODULE_RE.test(id)) return source
  if (source.includes('PAYROLL_OVERBREAK_DEDUCTION_V1')) return source

  let transformed = source

  transformed = replaceExactlyOnce(
    transformed,
    "import {\n getChargeableEarlyOutMinutes,",
    "import { getPayrollOverbreakDeduction } from './payrollOverbreakPolicy.js'\nimport {\n getChargeableEarlyOutMinutes,",
    'payroll overbreak policy import'
  )

  transformed = replaceExactlyOnce(
    transformed,
    "  const actualUndertimeCapacityByDate={}\n  const workDetailByDate={}",
    "  const actualUndertimeCapacityByDate={}\n  const actualOverbreakByDate={}\n  const workDetailByDate={}",
    'overbreak accumulator declaration'
  )

  transformed = replaceExactlyOnce(
    transformed,
    "   actualUndertimeCapacityByDate[logDateKey]=attendanceDeductionSplit.undertimeMinutes\n   const actualDayOvertimeMinutes",
    "   actualUndertimeCapacityByDate[logDateKey]=attendanceDeductionSplit.undertimeMinutes\n   actualOverbreakByDate[logDateKey]=Math.max(0, Math.round(safeNum(dayMetrics.overbreakMinutes, 0)))\n   const actualDayOvertimeMinutes",
    'daily overbreak accumulation'
  )

  transformed = replaceExactlyOnce(
    transformed,
    "  const undertimeDeduction=undertimeDeductionApplicable ? automaticUndertimeMinutes*minuteRate : 0\n\n  // Night differential premium",
    "  const undertimeDeduction=undertimeDeductionApplicable ? automaticUndertimeMinutes*minuteRate : 0\n  // PAYROLL_OVERBREAK_DEDUCTION_V1: Overbreak is a separate exact-minute deduction.\n  // It must not be rounded into UT or charged twice.\n  const rawOverbreakMinutes = Object.values(actualOverbreakByDate).reduce((sum, minutes) => sum + Math.max(0, safeNum(minutes, 0)), 0)\n  const { minutes:excessBreakMinutesInfo, amount:excessBreakDeduction } = getPayrollOverbreakDeduction({\n   overbreakMinutes:rawOverbreakMinutes,\n   minuteRate,\n   deductionApplicable:undertimeDeductionApplicable\n  })\n\n  // Night differential premium",
    'overbreak deduction calculation'
  )

  transformed = replaceExactlyOnce(
    transformed,
    "  const undertimeDeductionRounded=moneyRound(undertimeDeduction)\n  const absenceDeductionRounded=moneyRound(absenceDeduction)",
    "  const undertimeDeductionRounded=moneyRound(undertimeDeduction)\n  const excessBreakDeductionRounded=moneyRound(excessBreakDeduction)\n  const absenceDeductionRounded=moneyRound(absenceDeduction)",
    'rounded overbreak deduction'
  )

  transformed = replaceExactlyOnce(
    transformed,
    "  const mandatoryNonCADeductions=moneyRound(lateDeductionRounded+undertimeDeductionRounded+sssDeductionRounded+pagibigDeductionRounded+philhealthDeductionRounded+absenceDeductionRounded)",
    "  const mandatoryNonCADeductions=moneyRound(lateDeductionRounded+undertimeDeductionRounded+excessBreakDeductionRounded+sssDeductionRounded+pagibigDeductionRounded+philhealthDeductionRounded+absenceDeductionRounded)",
    'mandatory deduction total'
  )

  transformed = replaceExactlyOnce(
    transformed,
    "lateDeduction:lateDeductionRounded, undertimeDeduction:undertimeDeductionRounded, adjustmentDeductions:",
    "lateDeduction:lateDeductionRounded, undertimeDeduction:undertimeDeductionRounded, excessBreakDeduction:excessBreakDeductionRounded, excessBreakMinutes:excessBreakMinutesInfo, adjustmentDeductions:",
    'payroll result overbreak fields'
  )

  transformed = replaceExactlyOnce(
    transformed,
    "  late_deduction:moneyRound(pay.lateDeduction||0),\n  undertime_deduction:moneyRound(pay.undertimeDeduction||0),\n  cash_advance_deduction:",
    "  late_deduction:moneyRound(pay.lateDeduction||0),\n  undertime_deduction:moneyRound(pay.undertimeDeduction||0),\n  excess_break_deduction:moneyRound(pay.excessBreakDeduction||0),\n  cash_advance_deduction:",
    'payroll persistence field'
  )

  transformed = replaceExactlyOnce(
    transformed,
    "     late_deduction, undertime_deduction,\n     requested_cash_advance_deduction",
    "     late_deduction, undertime_deduction, excess_break_deduction,\n     requested_cash_advance_deduction",
    'compatibility fallback field'
  )

  transformed = replaceExactlyOnce(
    transformed,
    "  undertimeDeduction: safeNum(record.undertime_deduction, 0),\n  adjustmentDeductions:",
    "  undertimeDeduction: safeNum(record.undertime_deduction, 0),\n  excessBreakDeduction: safeNum(record.excess_break_deduction, 0),\n  adjustmentDeductions:",
    'saved payroll mapping'
  )

  transformed = replaceExactlyOnce(
    transformed,
    "  totalUndertimeDeduction: results.reduce((a,p)=>a+safeNum(p.undertimeDeduction,0),0),\n  totalCA:",
    "  totalUndertimeDeduction: results.reduce((a,p)=>a+safeNum(p.undertimeDeduction,0),0),\n  totalExcessBreakDeduction: results.reduce((a,p)=>a+safeNum(p.excessBreakDeduction,0),0),\n  totalCA:",
    'saved payroll summary total'
  )

  transformed = replaceExactlyOnce(
    transformed,
    "totalUndertimeDeduction:results.reduce((a,p)=>a+(p.undertimeDeduction||0),0), totalCA:",
    "totalUndertimeDeduction:results.reduce((a,p)=>a+(p.undertimeDeduction||0),0), totalExcessBreakDeduction:results.reduce((a,p)=>a+(p.excessBreakDeduction||0),0), totalCA:",
    'computed payroll summary total'
  )

  transformed = replaceExactlyOnce(
    transformed,
    "['Undertime Deduction',php(payrollSummary.totalUndertimeDeduction||0)],['SSS'",
    "['Undertime Deduction',php(payrollSummary.totalUndertimeDeduction||0)],['Excess Break',php(payrollSummary.totalExcessBreakDeduction||0)],['SSS'",
    'summary card'
  )

  transformed = replaceExactlyOnce(
    transformed,
    " {pay.undertimeDeduction>0&&<div style={{ display:'flex', justifyContent:'space-between' }}><span>Automatic Undertime Deduction</span><span>{php(pay.undertimeDeduction)}</span></div>}\n {pay.sssDeduction>0&&",
    " {pay.undertimeDeduction>0&&<div style={{ display:'flex', justifyContent:'space-between' }}><span>Automatic Undertime Deduction</span><span>{php(pay.undertimeDeduction)}</span></div>}\n {(pay.excessBreakDeduction||0)>0&&<div style={{ display:'flex', justifyContent:'space-between' }}><span>Excess Break Deduction ({pay.excessBreakMinutes||0}min)</span><span>{php(pay.excessBreakDeduction)}</span></div>}\n {pay.sssDeduction>0&&",
    'admin payslip overbreak row'
  )

  return transformed
}

export function payrollOverbreakDeductionInvariant() {
  return {
    name:'romas-payroll-overbreak-deduction-invariant',
    enforce:'pre',
    transform(code, id) {
      if (!APP_MODULE_RE.test(id)) return null
      return { code:enforcePayrollOverbreakDeduction(code, id), map:null }
    }
  }
}
