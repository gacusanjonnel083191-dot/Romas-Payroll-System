const cents = value => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
const money = value => value / 100
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
  const pos = data.pos_closings || []
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
    receipts.push({ id:`${source}-${row.id}-${bucket}`, source, description, method:method || 'Unknown',
      amount:money(value), businessDate, enteredAt:row.created_at || '', bucket })
  }
  const addEntered = (source, row, amount, description, businessDate) => {
    if (manilaDate(row.created_at) !== date) return
    const value = cents(amount)
    totals.salesEntered += value
    entered.push({ id:`${source}-${row.id}`, source, description,
      amount:money(value), businessDate, enteredAt:row.created_at || '' })
  }
  const closingKeys = new Set(pos.filter(row => row.business_date === date)
    .map(row => `${row.outlet_id}|${row.business_date}`))
  for (const row of sales) {
    const amount = cents(row.total_walkin) + cents(row.total_messenger)
    const marker = String(row.notes || '').match(/SAGS-POS-SHIFT-CLOSING\|([^|\s;]+)\|(\d{4}-\d{2}-\d{2})/)
    const matchedPos = marker && closingKeys.has(`${marker[1]}|${marker[2]}`)
    addEntered('Daily Sales', row, money(amount), row.encoded_by || 'Daily Sales', row.sale_date)
    if (row.sale_date !== date || amount <= 0 || matchedPos) continue
    const fields = ['cash_received','gcash_received','other_online_received','unpaid_amount']
    const splitRecorded = fields.every(field => row[field] !== null && row[field] !== undefined)
    if (!splitRecorded) {
      totals.unknown += amount
      continue
    }
    addReceipt('Daily Sales', row, row.cash_received, 'Cash', date, row.encoded_by || 'Daily Sales')
    addReceipt('Daily Sales GCash', row, row.gcash_received, 'GCash', date, row.encoded_by || 'Daily Sales')
    addReceipt('Daily Sales Online', row, row.other_online_received, 'Other Online', date, row.encoded_by || 'Daily Sales')
    totals.unpaid += cents(row.unpaid_amount)
  }
  for (const row of pos) {
    if (row.business_date !== date) continue
    addReceipt('POS', row, row.cash_sales, 'Cash', date, row.outlet_id || 'POS shift')
    addReceipt('POS GCash', row, row.gcash_sales, 'GCash', date, row.outlet_id || 'POS shift')
    addReceipt('POS Online', row, row.online_sales, 'Other Online', date, row.outlet_id || 'POS shift')
    const matchingSale = sales.some(sale => String(sale.notes || '').includes(`SAGS-POS-SHIFT-CLOSING|${row.outlet_id}|${date}`))
    if (!matchingSale) addEntered('POS', row, row.total_sales, row.outlet_id || 'POS shift', date)
  }
  for (const row of online) {
    if (String(row.status || 'active').toLowerCase() === 'void') continue
    const amount = cents(row.amount)
    if (row.count_as_revenue === false) {
      if (row.payment_date === date) {
        if (row.receipt_already_counted === false) addReceipt('Earlier sale paid online', row, row.amount, row.payment_method,
          date, row.customer_name || row.sales_channel || 'Daily Sales')
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
    if (row.payment_date === date) addReceipt('Online Sale', row, row.amount, row.payment_method, date,
      row.customer_name || row.sales_channel || 'Daily Sales')
  }
  for (const row of reseller) {
    if (manilaDate(row.created_at) === date) entered.push({ id:`reseller-payment-${row.id}`,
      source:'Reseller payment', description:row.reseller_name || 'Reseller',
      amount:money(cents(row.amount)), businessDate:row.payment_date, enteredAt:row.created_at || '' })
    if (row.payment_date === date) {
      totals.resellerReceived += cents(row.amount)
      addReceipt('Reseller payment', row, row.amount, row.payment_method,
        date, [row.reseller_name || 'Reseller', row.invoice_number].filter(Boolean).join(' · '))
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
  const deliveredUnpaid = invoices.filter(row => row.delivery_date === date &&
    !['void','voided','cancelled','deleted'].includes(String(row.status || '').toLowerCase()) &&
    (row.delivered_at || ['delivered','partial'].includes(String(row.status || '').toLowerCase())))
    .reduce((total, row) => total + Math.max(0, cents(row.total_amount) - cents(row.paid_amount)), 0)
  const counts = (data.cash_counts || []).filter(row => row.reconciliation_date === date)
    .sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
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
    receipts, entered, deliveredUnpaid:money(deliveredUnpaid),
    bankDeposits:money(cashDeposited), approvedExpenses:money(sum(expenses,'amount')),
    cashExpenseRows, cashExpensesPaid:money(cashExpensesPaid),
    expensesNeedingReview, netRecordedCash:money(totals.cash - cashExpensesPaid - cashDeposited),
    cashExpectedComplete:expensesNeedingReview.length === 0,
    actualCashCount:counts.length ? Number(counts[0].actual_cash) : null,
    cashCountAt:counts[0]?.created_at || ''
  }
}
