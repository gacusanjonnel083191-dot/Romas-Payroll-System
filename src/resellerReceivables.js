const INVOICE_FIELDS = 'id,reseller_id,status,total_amount,paid_amount'

// Invoice totals already include saved returns/adjustments. Do not deduct them twice.
// Match the collection screens' existing one-cent settlement tolerance.
export function summarizeResellerReceivables(invoices) {
  const summaries = {}
  const seen = new Set()
  for (const invoice of invoices) {
    if (seen.has(invoice.id)) continue
    seen.add(invoice.id)
    if (!invoice.reseller_id || ['cancelled', 'void', 'voided', 'deleted'].includes(String(invoice.status || '').toLowerCase())) continue
    const total = Number(invoice.total_amount ?? 0)
    const paid = Number(invoice.paid_amount ?? 0)
    if (!Number.isFinite(total) || !Number.isFinite(paid)) throw new Error('Invalid invoice amount')
    const cents = Math.max(0, Math.round((total - paid + Number.EPSILON) * 100))
    if (cents <= 1) continue
    const summary = summaries[invoice.reseller_id] ||= { balanceCents: 0, unpaidCount: 0 }
    summary.balanceCents += cents
    summary.unpaidCount += 1
  }
  return Object.fromEntries(Object.entries(summaries).map(([id, summary]) => [id, {
    balance: summary.balanceCents / 100,
    unpaidCount: summary.unpaidCount,
  }]))
}

// Fetch only financial summary fields, across every date and page. No writes or
// status normalization: Refresh must not modify invoices or payment history.
export async function fetchResellerReceivables(client) {
  const pageSize = 1000
  const rows = []
  let totalCount = null
  for (let page = 0; page < 100; page++) {
    const { data, error, count } = await client.from('delivery_invoices')
      .select(INVOICE_FIELDS, { count: 'exact' })
      .order('id', { ascending: true })
      .range(rows.length, rows.length + pageSize - 1)
    if (error) throw error
    if (!Array.isArray(data) || !Number.isFinite(count)) throw new Error('Incomplete invoice response')
    if (totalCount === null) totalCount = count
    if (count !== totalCount) throw new Error('Invoices changed during refresh. Please retry.')
    rows.push(...data)
    if (rows.length === totalCount) {
      if (new Set(rows.map(row => row.id)).size !== totalCount) throw new Error('Invoices changed during refresh. Please retry.')
      return summarizeResellerReceivables(rows)
    }
    if (!data.length || rows.length > totalCount) throw new Error('Incomplete invoice response')
  }
  throw new Error('Invoice refresh exceeded its safety limit')
}
