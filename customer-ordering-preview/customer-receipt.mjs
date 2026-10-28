const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
}[char]));
const cents = value => Math.round(Number(value) * 100);
const peso = value => `₱${(value / 100).toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

export function customerPaymentReceiptHtml(order) {
  if (order?.paymentStatus !== 'paid' || !order.paidAt || !order.orderCode || !Array.isArray(order.items) || !order.items.length
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order.receipt?.saleId || '')) {
    throw new Error('A paid customer order with a linked online sale is required for a payment receipt.');
  }
  const paidAt = new Date(order.paidAt);
  const subtotal = cents(order.subtotal), fee = cents(order.deliveryFee), total = cents(order.total);
  const saleAmount = cents(order.receipt.amount);
  const method = order.receipt.paymentMethod;
  const reference = String(order.receipt.referenceNumber || '').trim();
  if (!Number.isFinite(paidAt.getTime()) || ![subtotal, fee, total, saleAmount].every(Number.isSafeInteger)
    || subtotal < 0 || fee < 0 || total <= 0 || saleAmount !== total
    || !['Cash','GCash','Maya','Bank Transfer','QR PH'].includes(method)
    || (method === 'Cash' && reference) || (method !== 'Cash' && !reference)) {
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
    <p><strong>Order reference:</strong> ${escapeHtml(order.orderCode)}<br><strong>Online sale ID:</strong> ${escapeHtml(order.receipt.saleId)}<br><strong>Paid:</strong> ${escapeHtml(paid)} (Philippine time)<br><strong>Payment method:</strong> ${escapeHtml(method)}${reference ? `<br><strong>Payment reference:</strong> ${escapeHtml(reference)}` : ''}<br><strong>Customer:</strong> ${escapeHtml(order.name)}</p>
    <p><strong>Scheduled pickup:</strong> ${schedule}<br><strong>Pickup point:</strong> ${pickup}${address ? `<br>${address}` : ''}</p>
    <h2>Items</h2>${lines.map(line => `<div class="row"><span>${line.quantity} × ${line.name}${line.unit ? ` / ${line.unit}` : ''}</span><span>${peso(line.lineTotal)}</span></div>`).join('')}
    <div class="row"><span>Subtotal</span><span>${peso(subtotal)}</span></div><div class="row"><span>Delivery fee</span><span>${peso(fee)}</span></div><div class="row total"><span>Amount paid</span><span>${peso(total)}</span></div>
    <p class="muted">This receipt belongs to a direct customer order. It is separate from reseller invoices and outlet POS sales.</p><div class="actions"><button onclick="window.print()">Print or save PDF</button></div></body></html>`;
}

export function customerRefundReceiptHtml(order) {
  if (order?.paymentStatus !== 'refunded' || !order.refundedAt || !order.receipt?.refund) {
    throw new Error('A refunded order with a linked reversal is required.');
  }
  // Validate the original sale, item snapshots, and totals before showing a refund.
  customerPaymentReceiptHtml({...order, paymentStatus:'paid'});
  const refund = order.receipt.refund;
  const refundAt = new Date(order.refundedAt);
  const refundCents = cents(refund.amount);
  const orderCents = cents(order.total);
  const reference = String(refund.referenceNumber || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(refund.id || '')
    || !Number.isFinite(refundAt.getTime()) || !Number.isSafeInteger(refundCents)
    || refundCents !== -orderCents
    || !['Cash','GCash','Maya','Bank Transfer','QR PH'].includes(refund.paymentMethod)
    || (refund.paymentMethod === 'Cash' && reference)
    || (refund.paymentMethod !== 'Cash' && !reference)) {
    throw new Error('This order has invalid refund details.');
  }
  const refunded = new Intl.DateTimeFormat('en-PH', {
    timeZone:'Asia/Manila', dateStyle:'medium', timeStyle:'short',
  }).format(refundAt);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Customer refund confirmation · ${escapeHtml(order.orderCode)}</title><style>
    body{font:15px Arial,sans-serif;color:#321a19;max-width:680px;margin:24px auto;padding:0 20px}header{border-bottom:3px solid #96191d;padding-bottom:14px}h1{font-size:23px;margin:0;color:#96191d}.refunded{font-weight:bold;color:#8b4a14}.row{display:flex;justify-content:space-between;gap:20px;padding:8px 0;border-bottom:1px solid #eaded7}.row span:last-child{text-align:right}.total{font-size:20px;font-weight:bold;border-top:2px solid #96191d}.muted{color:#725d55;font-size:13px}.actions{margin-top:22px}button{border:0;border-radius:8px;background:#96191d;color:white;padding:11px 18px;font-weight:bold}@media print{body{margin:0;max-width:none}.actions{display:none}}
  </style></head><body><header><h1>Roma’s Donuts</h1><p>Customer refund confirmation</p><span class="refunded">REFUNDED</span></header>
    <p><strong>Order reference:</strong> ${escapeHtml(order.orderCode)}<br><strong>Original online sale ID:</strong> ${escapeHtml(order.receipt.saleId)}<br><strong>Refund entry ID:</strong> ${escapeHtml(refund.id)}<br><strong>Refund recorded:</strong> ${escapeHtml(refunded)} (Philippine time)<br><strong>Refund method:</strong> ${escapeHtml(refund.paymentMethod)}${reference ? `<br><strong>Refund reference:</strong> ${escapeHtml(reference)}` : ''}<br><strong>Customer:</strong> ${escapeHtml(order.name)}</p>
    <div class="row"><span>Original payment</span><span>${peso(orderCents)}</span></div>
    <div class="row total"><span>Full refund</span><span>${peso(-refundCents)}</span></div>
    <p class="muted">The original payment remains in Roma’s records and this separate entry reverses its revenue. This confirmation is separate from reseller invoices and outlet POS sales.</p>
    <div class="actions"><button onclick="window.print()">Print or save PDF</button></div></body></html>`;
}
