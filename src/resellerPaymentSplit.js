export function getResellerPaymentParts(method, amount, cashAmount, gcashAmount) {
  const parse = value => {
    if (value === '' || value == null) return 0
    const number = Number(value)
    if (!Number.isFinite(number) || number < 0 || Math.abs(Math.round(number * 100) - number * 100) > 0.000001) {
      throw new Error('Enter valid payment amounts with no more than two decimal places.')
    }
    return number
  }
  if (method === 'Cash + GCash') {
    const cash = parse(cashAmount)
    const gcash = parse(gcashAmount)
    if (cash <= 0 || gcash <= 0) throw new Error('Enter an amount greater than zero for both Cash and GCash.')
    return [{ method:'Cash', amount:cash }, { method:'GCash', amount:gcash }]
  }
  const single = parse(amount)
  return single > 0 ? [{ method:method || 'Cash', amount:single }] : []
}

export function getResellerPaymentTotal(parts) {
  return (parts || []).reduce((total, part) => total + Math.round(part.amount * 100), 0) / 100
}
