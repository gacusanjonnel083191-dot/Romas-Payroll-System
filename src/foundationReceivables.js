// Current outstanding balances are independent of the dashboard's sales month.
// Invoice total_amount already reflects saved returns and adjustments.
export function buildFoundationReceivables(invoices, asOfDate) {
  const rows = []
  const seen = new Set()
  for (const invoice of invoices) {
    if (seen.has(invoice.id)) continue
    seen.add(invoice.id)
    if (['cancelled', 'void', 'voided', 'deleted'].includes(String(invoice.status || '').toLowerCase())) continue
    const total = Number(invoice.total_amount ?? 0)
    const paid = Number(invoice.paid_amount ?? 0)
    if (!Number.isFinite(total) || !Number.isFinite(paid)) throw new Error('Invalid receivable invoice amount')
    const balanceCents = Math.max(0, Math.round((total - paid + Number.EPSILON) * 100))
    if (balanceCents <= 1) continue
    const deliveryDate = String(invoice.delivery_date || invoice.created_at || '').slice(0, 10)
    const dueDate = String(invoice.due_date || deliveryDate).slice(0, 10)
    const date = new Date(`${dueDate}T00:00:00`)
    const today = new Date(`${asOfDate}T00:00:00`)
    const age = Number.isNaN(date.getTime()) ? 0 : Math.max(0, Math.round((today - date) / 86400000))
    const balance = balanceCents / 100
    rows.push({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number || invoice.id,
      reseller: invoice.reseller_name || 'Unassigned',
      deliveryDate, dueDate, age, balance,
      total, paid,
      paidPct: total > 0 ? paid / total * 100 : 0,
      bucket: age <= 7 ? '0 7 days' : age <= 15 ? '8 15 days' : age <= 30 ? '16 30 days' : '31+ days',
      status: age <= 7 ? 'Current' : age <= 15 ? 'Watch' : age <= 30 ? 'Overdue' : 'Critical',
      color: age <= 7 ? '#2d8a4e' : age <= 15 ? '#f5a623' : '#ca1b1b',
    })
  }
  rows.sort((a, b) => b.age - a.age || b.balance - a.balance)
  const sumBalances = matching => matching.reduce((sum, row) => sum + Math.round(row.balance * 100), 0) / 100
  const totalAR = sumBalances(rows)
  const overdueAR = sumBalances(rows.filter(row => row.age > 7))
  const criticalAR = sumBalances(rows.filter(row => row.age >= 31))
  const arAging = ['0 7 days', '8 15 days', '16 30 days', '31+ days'].map(label => {
    const matching = rows.filter(row => row.bucket === label)
    return { label, total: sumBalances(matching), count: matching.length }
  })
  return { rows, totalAR, overdueAR, criticalAR, arAging }
}
