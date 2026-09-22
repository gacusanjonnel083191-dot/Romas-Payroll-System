export function toWholeQuantity(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.floor(parsed)
}

export function calculateResellerLine(line = {}) {
  const ordered = toWholeQuantity(line.ordered)
  const delivered = toWholeQuantity(line.delivered)
  const added = toWholeQuantity(line.added)
  const deducted = toWholeQuantity(line.deducted)
  const unsold = toWholeQuantity(line.unsold)
  const resellerPrice = Math.max(0, Number(line.resellerPrice) || 0)
  const retailPrice = Math.max(resellerPrice, Number(line.retailPrice) || 0)
  const availableBeforeUnsold = Math.max(0, delivered + added - deducted)
  const sold = Math.max(0, availableBeforeUnsold - unsold)
  const amountDue = sold * resellerPrice

  return {
    ordered,
    delivered,
    added,
    deducted,
    unsold,
    availableBeforeUnsold,
    sold,
    amountDue,
    retailValue: sold * retailPrice,
    estimatedProfit: sold * Math.max(0, retailPrice - resellerPrice),
    hasDeductionError: deducted > delivered + added,
    hasUnsoldError: unsold > availableBeforeUnsold,
  }
}

export function calculateResellerTotals(lines = []) {
  return lines.reduce((totals, line) => {
    const result = calculateResellerLine(line)
    totals.ordered += result.ordered
    totals.delivered += result.delivered
    totals.added += result.added
    totals.deducted += result.deducted
    totals.unsold += result.unsold
    totals.sold += result.sold
    totals.amountDue += result.amountDue
    totals.retailValue += result.retailValue
    totals.estimatedProfit += result.estimatedProfit
    totals.hasErrors ||= result.hasDeductionError || result.hasUnsoldError
    return totals
  }, {
    ordered: 0,
    delivered: 0,
    added: 0,
    deducted: 0,
    unsold: 0,
    sold: 0,
    amountDue: 0,
    retailValue: 0,
    estimatedProfit: 0,
    hasErrors: false,
  })
}

