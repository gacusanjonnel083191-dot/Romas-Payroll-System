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
