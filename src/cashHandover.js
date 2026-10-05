export function cashVariances(expected, handed, counted) {
  const cents = value => Math.round(Number(value) * 100)
  const collection = (cents(handed) - cents(expected)) / 100
  const counting = counted == null ? null : (cents(counted) - cents(handed)) / 100
  const final = counted == null ? null : (cents(counted) - cents(expected)) / 100
  return { collection, counting, final, status:final == null ? 'AWAITING OWNER COUNT' : final === 0 ? 'BALANCED' : final < 0 ? 'SHORTAGE' : 'OVERAGE' }
}

export function validCashAmount(value) {
  return /^\d+(\.\d{1,2})?$/.test(String(value)) && Number.isFinite(Number(value)) && Number(value) <= 9999999999.99
}

export function canReconcile(report) {
  return report.cashExpectedComplete && report.totals.unknown === 0 && report.totals.trackingOnly === 0
}
