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
      added: '',
      deducted: '',
      unsold: '',
    }]
  }))
}

export function calculateResellerLine(line = {}) {
  const ordered = toWholeQuantity(line.ordered)
  const delivered = toWholeQuantity(line.delivered)
  const added = toWholeQuantity(line.added)
  const deducted = toWholeQuantity(line.deducted)
  const unsold = toWholeQuantity(line.unsold)
  const resellerPrice = Math.max(0, Number(line.resellerPrice) || 0)
  const retailPrice = Math.max(resellerPrice, Number(line.retailPrice) || 0)
  const accountable = Math.max(0, delivered + added - deducted)
  const sold = Math.max(0, accountable - unsold)
  const amountDue = sold * resellerPrice

  return {
    ordered,
    delivered,
    added,
    deducted,
    unsold,
    accountable,
    availableBeforeUnsold: accountable,
    sold,
    amountDue,
    retailValue: sold * retailPrice,
    estimatedProfit: sold * Math.max(0, retailPrice - resellerPrice),
    hasDeductionError: deducted > delivered + added,
    hasUnsoldError: unsold > accountable,
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
    totals.accountable += result.accountable
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
    accountable: 0,
    sold: 0,
    amountDue: 0,
    retailValue: 0,
    estimatedProfit: 0,
    hasErrors: false,
  })
}
