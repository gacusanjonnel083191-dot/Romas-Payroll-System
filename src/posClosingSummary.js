// Cashier snapshots are per shift; the admin may also save a daily summary.
// Prefer the explicit daily summary for the monitor, and never add it to shifts.
export function dailyPosClosing(rows = []) {
  const summaries = rows.filter(row => !row.shift_id)
  if (summaries.length) return summaries[0]
  if (!rows.length) return null
  if (rows.length === 1) return rows[0]
  const result = { ...rows[0], shift_id:null, closed_by:rows.map(row => row.closed_by).filter(Boolean).join(', ') }
  for (const key of ['opening_cash','cash_sales','gcash_sales','online_sales','total_sales','expected_cash','actual_cash','cash_variance','transaction_count']) {
    result[key] = Math.round(rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) * 100) / 100
  }
  return result
}

// Receipts use the underlying shift snapshots when available, not both layers.
export function posClosingReceipts(rows = []) {
  const keys = new Set(rows.filter(row => row.shift_id).map(row => `${row.outlet_id}|${row.business_date}`))
  return rows.filter(row => row.shift_id || !keys.has(`${row.outlet_id}|${row.business_date}`))
}
