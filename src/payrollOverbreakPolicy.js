export function getPayrollOverbreakDeduction({
  overbreakMinutes = 0,
  minuteRate = 0,
  deductionApplicable = true,
} = {}) {
  const minutes = Math.max(0, Math.round(Number(overbreakMinutes) || 0))
  const rate = Math.max(0, Number(minuteRate) || 0)
  if (!deductionApplicable || minutes <= 0 || rate <= 0) return { minutes: 0, amount: 0 }
  const amount = Math.round(((minutes * rate) + Number.EPSILON) * 100) / 100
  return { minutes, amount }
}
