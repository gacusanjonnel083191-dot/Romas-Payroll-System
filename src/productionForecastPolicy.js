const NON_PRODUCTION_INVOICE_STATUSES = new Set(['cancelled', 'void', 'voided', 'deleted'])

export function isInvoiceExcludedFromProductionForecastPolicy(invoice = {}, excludedInvoiceIds = []) {
  const status = String(invoice?.status || '').toLowerCase()
  if (NON_PRODUCTION_INVOICE_STATUSES.has(status)) return true

  const invoiceId = String(invoice?.id || '')
  if (!invoiceId) return false

  const excludedIds = excludedInvoiceIds instanceof Set
    ? excludedInvoiceIds
    : new Set((excludedInvoiceIds || []).map(String))

  return excludedIds.has(invoiceId)
}

export function filterProductionForecastInvoices(invoiceRows = [], dateValue = '', excludedInvoiceIds = []) {
  const deliveryDate = String(dateValue || '').slice(0, 10)
  const excludedIds = excludedInvoiceIds instanceof Set
    ? excludedInvoiceIds
    : new Set((excludedInvoiceIds || []).map(String))

  return (invoiceRows || []).filter(invoice => (
    String(invoice?.delivery_date || '').slice(0, 10) === deliveryDate
    && !isInvoiceExcludedFromProductionForecastPolicy(invoice, excludedIds)
  ))
}
