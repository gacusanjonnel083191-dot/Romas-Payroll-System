export const OUTLET_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function calculateOutletClosingLine(line) {
  const fields = ['beginning', 'delivered', 'manualDelivered', 'wastage', 'ending', 'price']
  if (fields.some(field => !Number.isFinite(Number(line[field])) || Number(line[field]) < 0)) {
    throw new Error('Counts and prices must be zero or greater.')
  }
  const values = Object.fromEntries(fields.map(field => [field, Number(line[field])]))
  if (['beginning', 'delivered', 'manualDelivered', 'wastage', 'ending'].some(field => !Number.isInteger(values[field]))) {
    throw new Error('Product counts must be whole numbers.')
  }
  const available = values.beginning + values.delivered + values.manualDelivered
  if (values.ending + values.wastage > available) throw new Error('Ending count and wastage exceed available stock.')
  const sold = available - values.ending - values.wastage
  if (sold > 0 && values.price <= 0) throw new Error('Enter a price for every sold product.')
  return { ...line, ...values, sold, amount:Math.round(sold * values.price * 100) / 100 }
}

export function summarizeOutletClosing(lines) {
  const computed = lines.map(calculateOutletClosingLine)
  return {
    items:computed,
    delivered:computed.reduce((sum, row) => sum + row.delivered + row.manualDelivered, 0),
    sold:computed.reduce((sum, row) => sum + row.sold, 0),
    wastage:computed.reduce((sum, row) => sum + row.wastage, 0),
    sales:Math.round(computed.reduce((sum, row) => sum + row.amount, 0) * 100) / 100,
  }
}

export function outletWeekdayStats(rows, metric = 'sold') {
  const groups = OUTLET_WEEKDAYS.map((name, day) => ({ name, day, count:0, total:0, average:null }))
  rows.forEach(row => {
    const date = String(row.business_date || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
    groups[weekday].count += 1
    groups[weekday].total += Number(row[metric] || 0)
  })
  return groups.map(group => ({ ...group, average:group.count ? group.total / group.count : null }))
}

export function getOutletSlowWeekdays(rows, metric = 'sold', minimumSamples = 4) {
  const stats = outletWeekdayStats(rows, metric)
  const baseline = rows.length ? rows.reduce((sum, row) => sum + Number(row[metric] || 0), 0) / rows.length : 0
  return stats.filter(group => group.count >= minimumSamples && baseline > 0 && group.average < baseline * 0.8)
}
