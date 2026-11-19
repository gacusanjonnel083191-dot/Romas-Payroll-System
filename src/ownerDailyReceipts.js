const cents = value => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
const money = value => value / 100
const sourceMetadata = (row, source) => ({
  recordId:row.id, invoiceId:source === 'Reseller invoice' ? row.id : row.invoice_id,
  invoiceNumber:row.invoice_number || '',
  recordedBy:row.recorded_by || row.verified_by || row.encoded_by || row.created_by || row.submitted_by || row.closed_by || ''
})
const sum = (rows, field) => (rows || []).reduce((total, row) => total + cents(row[field]), 0)

export function manilaDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone:'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit'
  }).formatToParts(date)
  const get = type => parts.find(part => part.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function paymentBucket(method) {
  const name = String(method || '').trim().toLowerCase()
  if (name === 'cash') return 'cash'
  if (name.includes('gcash')) return 'gcash'
  if (['maya','bank','online','card','qr','check'].some(part => name.includes(part))) return 'otherOnline'
  return 'unknown'
}

export function buildOwnerDailyReceipts(data = {}, date, cashExpenseRows = []) {
  const sales = data.daily_sales || []
  const online = data.daily_online || []
  const reseller = data.reseller_payments || []
  // Only admin-recorded daily summaries belong in owner entry activity.
  // Cashier shift closings remain in the POS sales reports.
  const pos = (data.pos_closings || []).filter(row => !row.shift_id && manilaDate(row.created_at) === date)
  const remittances = data.outlet_remittances || []
  const invoices = data.invoices || []
  const receipts = []
  const entered = []
  const totals = { cash:0, gcash:0, otherOnline:0, unknown:0, unpaid:0, trackingOnly:0, duplicateTracked:0, salesEntered:0, resellerReceived:0 }
  const addReceipt = (source, row, amount, method, businessDate, description) => {
    const value = cents(amount)
    if (value <= 0) return
    const bucket = paymentBucket(method)
    totals[bucket] += value
    receipts.push({ ...sourceMetadata(row, source), id:`${source}-${row.id}-${bucket}`, source, description, method:method || 'Unknown',
      amount:money(value), businessDate, enteredAt:row.created_at || '', bucket })
  }
  const addEntered = (source, row, amount, description, businessDate) => {
    if (manilaDate(row.created_at) !== date) return
    const value = cents(amount)
    totals.salesEntered += value
    entered.push({ ...sourceMetadata(row, source), countsAsSale:true, id:`${source}-${row.id}`, source, description,
      amount:money(value), businessDate, enteredAt:row.created_at || '' })
  }
  const closingKeys = new Set(pos
    .map(row => `${row.outlet_id}|${row.business_date}`))
  for (const row of sales) {
    const amount = cents(row.total_walkin) + cents(row.total_messenger)
    const marker = String(row.notes || '').match(/SAGS-POS-SHIFT-CLOSING\|([^|\s;]+)\|(\d{4}-\d{2}-\d{2})/)
    const matchedPos = marker && closingKeys.has(`${marker[1]}|${marker[2]}`)
    addEntered('Daily Sales', row, money(amount), row.encoded_by || 'Daily Sales', row.sale_date)
    if (manilaDate(row.created_at) !== date || amount <= 0 || matchedPos) continue
    const fields = ['cash_received','gcash_received','other_online_received','unpaid_amount']
    const splitRecorded = fields.every(field => row[field] !== null && row[field] !== undefined)
    if (!splitRecorded) {
      totals.unknown += amount
      continue
    }
    addReceipt('Daily Sales', row, row.cash_received, 'Cash', row.sale_date, row.encoded_by || 'Daily Sales')
    addReceipt('Daily Sales GCash', row, row.gcash_received, 'GCash', row.sale_date, row.encoded_by || 'Daily Sales')
    addReceipt('Daily Sales Online', row, row.other_online_received, 'Other Online', row.sale_date, row.encoded_by || 'Daily Sales')
    totals.unpaid += cents(row.unpaid_amount)
  }
  for (const row of pos) {
    addReceipt('POS', row, row.cash_sales, 'Cash', row.business_date, row.outlet_id || 'POS shift')
    addReceipt('POS GCash', row, row.gcash_sales, 'GCash', row.business_date, row.outlet_id || 'POS shift')
    addReceipt('POS Online', row, row.online_sales, 'Other Online', row.business_date, row.outlet_id || 'POS shift')
    const matchingSale = sales.some(sale => manilaDate(sale.created_at) === date && String(sale.notes || '').includes(`SAGS-POS-SHIFT-CLOSING|${row.outlet_id}|${row.business_date}`))
    if (!matchingSale) addEntered('POS', row, row.total_sales, row.outlet_id || 'POS shift', row.business_date)
  }
  for (const row of online) {
    if (String(row.status || 'active').toLowerCase() === 'void') continue
    const amount = cents(row.amount)
    if (row.count_as_revenue === false) {
      if (manilaDate(row.created_at) === date) {
        if (row.receipt_already_counted === false) addReceipt('Earlier sale paid online', row, row.amount, row.payment_method,
          row.payment_date, row.customer_name || row.sales_channel || 'Daily Sales')
        else if (row.receipt_already_counted === true) totals.duplicateTracked += amount
        else totals.trackingOnly += amount
      }
      if (manilaDate(row.created_at) === date) entered.push({ id:`online-tracking-${row.id}`,
        source:row.receipt_already_counted === false ? 'Earlier sale payment' : 'Online tracking only',
        description:row.customer_name || row.sales_channel || 'Daily Sales',
        amount:money(amount), businessDate:row.payment_date, enteredAt:row.created_at || '' })
      continue
    }
    addEntered('Online Sale', row, row.amount, row.customer_name || row.sales_channel || 'Daily Sales', row.payment_date)
    if (manilaDate(row.created_at) === date) addReceipt('Online Sale', row, row.amount, row.payment_method, row.payment_date,
      row.customer_name || row.sales_channel || 'Daily Sales')
  }
  for (const row of reseller) {
    if (manilaDate(row.created_at) === date) entered.push({ id:`reseller-payment-${row.id}`,
      source:'Reseller payment', description:row.reseller_name || 'Reseller',
      amount:money(cents(row.amount)), businessDate:row.payment_date, enteredAt:row.created_at || '' })
    if (manilaDate(row.created_at) === date) {
      totals.resellerReceived += cents(row.amount)
      addReceipt('Reseller payment', row, row.amount, row.payment_method,
        row.payment_date, [row.reseller_name || 'Reseller', row.invoice_number].filter(Boolean).join(' · '))
    }
  }
  for (const row of remittances) {
    if (String(row.status || '').toLowerCase() !== 'approved' || manilaDate(row.created_at) !== date) continue
    addEntered('Outlet weekly sales', row, row.total_sales_amount, row.reseller_name || 'Outlet', row.week_end)
    addReceipt('Outlet remittance', row, row.actual_remitted_amount, row.payment_method,
      date, row.reseller_name || 'Outlet')
  }
  for (const row of invoices) {
    if (['void','voided','cancelled','deleted'].includes(String(row.status || '').toLowerCase())) continue
    addEntered('Reseller invoice', row, row.total_amount, row.reseller_name || row.invoice_number || 'Invoice',
      row.delivery_date)
  }
  const deliveredUnpaidInvoices = invoices.filter(row => row.delivery_date === date &&
    !['void','voided','cancelled','deleted'].includes(String(row.status || '').toLowerCase()) &&
    (row.delivered_at || ['delivered','partial'].includes(String(row.status || '').toLowerCase())))
    .map(row => ({ ...sourceMetadata(row, 'Reseller invoice'), id:row.id, source:'Delivered invoice',
      description:row.reseller_name, businessDate:row.delivery_date, enteredAt:row.created_at,
      amount:money(Math.max(0, cents(row.total_amount) - cents(row.paid_amount))),
      detail:`Invoice ${money(cents(row.total_amount))} − paid ${money(cents(row.paid_amount))}` }))
    .filter(row => row.amount > 0)
  const deliveredUnpaid = sum(deliveredUnpaidInvoices, 'amount')
  const counts = (data.cash_counts || []).filter(row => row.reconciliation_date === date)
    .sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  const handover = (data.cash_handovers || []).filter(row => row.business_date === date)
    .sort((a,b) => b.revision - a.revision)[0]
  const deposits = (data.bank_deposits || []).filter(row => row.deposit_date === date &&
    String(row.status || '').toLowerCase() === 'deposited')
  const expenses = (data.expenses || []).filter(row => row.expense_date === date && row.status === 'approved')
  const confirmedCashExpenses = cashExpenseRows.filter(row =>
    row.payment_method === 'cash' && row.paid_date === date)
  const expensesNeedingReview = cashExpenseRows.filter(row => row.status === 'approved' &&
    row.expense_date === date && !row.payment_method)
  const cashExpensesPaid = confirmedCashExpenses.reduce((total, row) =>
    total + cents(row.classified_amount), 0)
  const cashDeposited = sum(deposits,'amount')
  receipts.sort((a,b) => String(b.enteredAt).localeCompare(String(a.enteredAt)))
  entered.sort((a,b) => String(b.enteredAt).localeCompare(String(a.enteredAt)))
  totals.totalReceived = totals.cash + totals.gcash + totals.otherOnline
  return {
    totals:Object.fromEntries(Object.entries(totals).map(([key,value]) => [key,money(value)])),
    receipts, entered, deliveredUnpaidInvoices, deliveredUnpaid:money(deliveredUnpaid),
    bankDeposits:money(cashDeposited), approvedExpenses:money(sum(expenses,'amount')),
    cashExpenseRows, cashExpensesPaid:money(cashExpensesPaid),
    expensesNeedingReview, netRecordedCash:money(totals.cash - cashExpensesPaid - cashDeposited),
    cashExpectedComplete:expensesNeedingReview.length === 0,
    actualCashCount:handover ? (handover.owner_physical_count == null ? null : Number(handover.owner_physical_count)) : counts.length ? Number(counts[0].actual_cash) : null,
    cashCountSource:handover || counts[0] || null,
    cashCountAt:handover ? handover.owner_count_at || '' : counts[0]?.created_at || ''
  }
}

export function ownerReceiptBreakdown(report, key) {
  if (key === 'salesEntered') return report.entered.filter(row=>row.countsAsSale)
  if (key === 'deliveredUnpaid') return report.deliveredUnpaidInvoices
  if (key === 'resellerReceived') return report.receipts.filter(row=>row.source === 'Reseller payment')
  if (key === 'totalReceived') return report.receipts.filter(row=>row.bucket !== 'unknown')
  if (key === 'actualCashCount') {
    const row = report.cashCountSource
    return report.actualCashCount == null ? [] : [{ id:row.id, recordId:row.id,
      source:row.business_date ? 'Owner cash handover count' : 'Legacy cash reconciliation',
      description:'Physical company cash count', amount:report.actualCashCount,
      businessDate:row.business_date || row.reconciliation_date, enteredAt:report.cashCountAt,
      recordedBy:row.received_by || row.submitted_by || '',
      detail:row.revision ? `Handover revision ${row.revision}` : '' }]
  }
  return report.receipts.filter(row=>row.bucket === key)
}
