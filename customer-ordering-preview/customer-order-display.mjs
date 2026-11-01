const CLOSED_STATUSES = new Set(['cancelled', 'declined']);

export function customerStatusLabel(status) {
  return ({
    pending_confirmation: 'Request received',
    accepted: 'Order confirmed',
    preparing: 'Being prepared',
    ready: 'Ready for pickup',
    out_for_delivery: 'Out for delivery',
    completed: 'Completed',
    cancelled: 'Order cancelled',
    declined: 'Request declined',
  })[status] || String(status || '').replaceAll('_', ' ');
}

export function customerOrderAmounts(order, money) {
  const closed = CLOSED_STATUSES.has(order.status);
  const unpaidClosed = closed && order.paymentStatus !== 'paid' && order.paymentStatus !== 'refunded';
  const awaitingDeliveryQuote = order.type === 'delivery' && !order.deliveryQuotedAt;

  if (unpaidClosed) {
    return {
      fee: 'Not charged', totalLabel: 'Amount due', total: money(0),
      note: order.status === 'cancelled'
        ? 'This order was cancelled. No payment is due.'
        : 'Roma’s team could not accept this request. No payment is due.',
    };
  }

  if (closed) {
    return {
      fee: awaitingDeliveryQuote ? 'Not quoted' : money(order.deliveryFee),
      totalLabel: 'Original order total',
      total: awaitingDeliveryQuote ? 'Not finalised' : money(order.total),
      note: 'This order is closed. See the payment or refund record below for its financial status.',
    };
  }

  return {
    fee: awaitingDeliveryQuote ? 'To be confirmed by Roma’s team' : money(order.deliveryFee),
    totalLabel: awaitingDeliveryQuote ? 'Final total' : 'Order total',
    total: awaitingDeliveryQuote ? 'Awaiting delivery quote' : money(order.total),
    note: awaitingDeliveryQuote
      ? 'Roma’s team will call to confirm the delivery charge and full total before accepting your request.'
      : '',
  };
}
