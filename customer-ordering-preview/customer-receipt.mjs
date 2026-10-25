const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
}[char]));
const cents = value => Math.round(Number(value) * 100);
const peso = value => `₱${(value / 100).toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

export function customerPaymentReceiptHtml(order) {
  if (order?.paymentStatus !== 'paid' || !order.paidAt || !order.orderCode || !Array.isArray(order.items) || !order.items.length) {
    throw new Error('A paid customer order is required for a payment receipt.');
  }
  const paidAt = new Date(order.paidAt);
  const subtotal = cents(order.subtotal), fee = cents(order.deliveryFee), total = cents(order.total);
  if (!Number.isFinite(paidAt.getTime()) || ![subtotal, fee, total].every(Number.isSafeInteger) || subtotal < 0 || fee < 0 || total <= 0) {
    throw new Error('This order has invalid payment details.');
  }
  const lines = order.items.map(item => {
    const quantity = Number(item.quantity);
    const lineTotal = cents(item.lineTotal);
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isSafeInteger(lineTotal) || lineTotal < 0) {
      throw new Error('This order has invalid item amounts.');
    }
    return {quantity, lineTotal, name:escapeHtml(item.name), unit:escapeHtml(item.unitLabel)};
  });
  if (lines.reduce((sum, line) => sum + line.lineTotal, 0) !== subtotal || subtotal + fee !== total) {
    throw new Error('Receipt amounts do not match the recorded order.');
  }
  const paid = new Intl.DateTimeFormat('en-PH', {timeZone:'Asia/Manila', dateStyle:'medium', timeStyle:'short'}).format(paidAt);
  const pickup = escapeHtml(order.branch);
  const address = escapeHtml(order.pickupAddress);
  const schedule = escapeHtml(`${order.date} ${order.time}`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Customer payment receipt · ${escapeHtml(order.orderCode)}</title><style>
    body{font:15px Arial,sans-serif;color:#321a19;max-width:680px;margin:24px auto;padding:0 20px}header{border-bottom:3px solid #96191d;padding-bottom:14px}h1{font-size:23px;margin:0;color:#96191d}h2{font-size:19px;margin:18px 0 7px}.muted{color:#725d55;font-size:13px}.paid{font-weight:bold;color:#176532}.row{display:flex;justify-content:space-between;gap:20px;padding:8px 0;border-bottom:1px solid #eaded7}.row span:last-child{text-align:right}.total{font-size:20px;font-weight:bold;border-top:2px solid #96191d;border-bottom:0}.actions{margin-top:22px}button{border:0;border-radius:8px;background:#96191d;color:white;padding:11px 18px;font-weight:bold}@media print{body{margin:0;max-width:none}.actions{display:none}}
  </style></head><body><header><h1>Roma’s Donuts</h1><p>Customer payment receipt</p><span class="paid">PAID</span></header>
    <p><strong>Order reference:</strong> ${escapeHtml(order.orderCode)}<br><strong>Paid:</strong> ${escapeHtml(paid)} (Philippine time)<br><strong>Customer:</strong> ${escapeHtml(order.name)}</p>
    <p><strong>Scheduled pickup:</strong> ${schedule}<br><strong>Pickup point:</strong> ${pickup}${address ? `<br>${address}` : ''}</p>
    <h2>Items</h2>${lines.map(line => `<div class="row"><span>${line.quantity} × ${line.name}${line.unit ? ` / ${line.unit}` : ''}</span><span>${peso(line.lineTotal)}</span></div>`).join('')}
    <div class="row"><span>Subtotal</span><span>${peso(subtotal)}</span></div><div class="row"><span>Delivery fee</span><span>${peso(fee)}</span></div><div class="row total"><span>Amount paid</span><span>${peso(total)}</span></div>
    <p class="muted">This receipt belongs to a direct customer order. It is separate from reseller invoices and outlet POS sales.</p><div class="actions"><button onclick="window.print()">Print or save PDF</button></div></body></html>`;
}
