export function toWholeQuantity(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.floor(parsed)
}

export function buildResetQuantities(products = []) {
  return Object.fromEntries(products.map(product => {
    const key = String(product.key || product.variant_id || product.variant_name || '')
    const orderedValue = product.ordered ?? product.quantity
    return [key, {
      ordered: orderedValue === '' || orderedValue == null ? '' : String(toWholeQuantity(orderedValue)),
      delivered: '',
      unsold: '',
    }]
  }))
}

export function calculateResellerLine(line = {}) {
  const ordered = toWholeQuantity(line.ordered)
  const delivered = toWholeQuantity(line.delivered)
  const unsold = toWholeQuantity(line.unsold)
  const resellerPrice = Math.max(0, Number(line.resellerPrice) || 0)
  const retailPrice = Math.max(resellerPrice, Number(line.retailPrice) || 0)
  const sold = Math.max(0, delivered - unsold)
  const amountDue = sold * resellerPrice

  return {
    ordered,
    delivered,
    unsold,
    sold,
    amountDue,
    retailValue: sold * retailPrice,
    estimatedProfit: sold * Math.max(0, retailPrice - resellerPrice),
    hasUnsoldError: unsold > delivered,
  }
}

export function calculateResellerTotals(lines = []) {
  return lines.reduce((totals, line) => {
    const result = calculateResellerLine(line)
    totals.ordered += result.ordered
    totals.delivered += result.delivered
    totals.unsold += result.unsold
    totals.sold += result.sold
    totals.amountDue += result.amountDue
    totals.retailValue += result.retailValue
    totals.estimatedProfit += result.estimatedProfit
    totals.hasErrors ||= result.hasUnsoldError
    return totals
  }, {
    ordered: 0,
    delivered: 0,
    unsold: 0,
    sold: 0,
    amountDue: 0,
    retailValue: 0,
    estimatedProfit: 0,
    hasErrors: false,
  })
}
