const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
}[char]))
const cents = value => Math.round(Number(value) * 100)
const peso = value => `₱${(value / 100).toLocaleString('en-PH', {
  minimumFractionDigits:2,maximumFractionDigits:2,
})}`
const manilaDate = value => new Intl.DateTimeFormat('en-PH',{
  timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short',
}).format(new Date(value))

export function customerRetailInvoiceHtml(invoice) {
  if (!invoice || invoice.status !== 'active' || !/^RI-\d{4}-[0-9A-F]{12}$/.test(invoice.invoice_number)
    || !Array.isArray(invoice.items) || invoice.items.length === 0
    || !['pickup','delivery'].includes(invoice.fulfillment_type)
    || !Number.isFinite(new Date(invoice.scheduled_at).getTime())
    || !Number.isFinite(new Date(invoice.issued_at).getTime())) {
    throw new Error('An active retail order invoice is required.')
  }
  const subtotal = cents(invoice.subtotal), fee = cents(invoice.delivery_fee), total = cents(invoice.total)
  if (![subtotal,fee,total].every(Number.isSafeInteger) || subtotal < 0 || fee < 0 || total <= 0
    || subtotal + fee !== total) throw new Error('The invoice amounts are invalid.')
  const rows = invoice.items.map(item => {
    const quantity = Number(item.quantity), unitPrice = cents(item.unit_price), lineTotal = cents(item.line_total)
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isSafeInteger(unitPrice)
      || unitPrice < 0 || !Number.isSafeInteger(lineTotal) || lineTotal !== quantity * unitPrice) {
      throw new Error('The invoice item amounts are invalid.')
    }
    return `<div class="row"><span>${quantity} × ${esc(item.product_name)} <small>/ ${esc(item.unit_label)}</small></span><span>${peso(lineTotal)}</span></div>`
  })
  if (invoice.items.reduce((sum,item)=>sum+cents(item.line_total),0) !== subtotal)
    throw new Error('The invoice items do not match the subtotal.')
  const destination = invoice.fulfillment_type === 'delivery'
    ? `<strong>Dispatch location:</strong> ${esc(invoice.dispatch_location)}<br><strong>Delivery address:</strong> ${esc(invoice.delivery_address)}, ${esc(invoice.delivery_municipality)}${invoice.delivery_landmark || invoice.distance_km != null ? `<br>${invoice.delivery_landmark ? `<strong>Landmark:</strong> ${esc(invoice.delivery_landmark)}` : ''}${invoice.delivery_landmark && invoice.distance_km != null ? ' · ' : ''}${invoice.distance_km != null ? `<strong>Road distance:</strong> ${esc(invoice.distance_km)} km` : ''}` : ''}`
    : `<strong>Pickup location:</strong> ${esc(invoice.pickup_location)}<br><strong>Pickup address:</strong> ${esc(invoice.pickup_address)}`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Retail order invoice · ${esc(invoice.invoice_number)}</title><style>
    body{font:14px Arial,sans-serif;color:#321a19;max-width:720px;margin:24px auto;padding:0 20px}header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:2px solid #96191d;padding-bottom:9px}h1{font-size:22px;margin:0;color:#96191d}h2{font-size:16px;margin:10px 0 4px}.brand p{margin:3px 0 0}.invoice-meta{text-align:right;font-size:12px;line-height:1.4}.details{line-height:1.4;margin:9px 0}.muted{color:#725d55;font-size:11px}.row{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #eaded7}.row span:last-child{text-align:right;white-space:nowrap}.total{font-size:17px;font-weight:bold;border-top:2px solid #96191d}.actions{margin-top:16px}button{border:0;border-radius:8px;background:#96191d;color:white;padding:11px 18px;font-weight:bold}@media print{body{margin:0;max-width:none}.actions{display:none}}
  </style></head><body><header><div class="brand"><h1>Roma’s Donuts</h1><p>Online order invoice</p></div><div class="invoice-meta"><strong>Invoice:</strong> ${esc(invoice.invoice_number)}<br><strong>Issued:</strong> ${esc(manilaDate(invoice.issued_at))}</div></header>
    <p class="details"><strong>Customer:</strong> ${esc(invoice.customer_name)} · <strong>Contact:</strong> ${esc(invoice.customer_phone)}<br><strong>Scheduled ${esc(invoice.fulfillment_type)}:</strong> ${esc(manilaDate(invoice.scheduled_at))}<br>${destination}<br><strong>Packaging:</strong> ${esc(invoice.packaging)}${invoice.order_notes ? `<br><strong>Order notes:</strong> ${esc(invoice.order_notes)}` : ''}</p>
    <h2>Items</h2>${rows.join('')}
    <div class="row"><span>Items subtotal</span><span>${peso(subtotal)}</span></div><div class="row"><span>Delivery fee</span><span>${peso(fee)}</span></div><div class="row total"><span>Total due</span><span>${peso(total)}</span></div>
    <p class="muted">This is the accepted online order invoice, separate from reseller invoices and the payment receipt. It is not represented as a BIR-registered tax invoice.</p>
    <div class="actions"><button onclick="window.print()">Print or save PDF</button></div></body></html>`
}
