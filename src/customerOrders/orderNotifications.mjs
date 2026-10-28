const CLOSED_STATUSES = new Set(['completed', 'declined', 'cancelled', 'canceled'])

export function countActiveCustomerOrders(orders) {
  if (!Array.isArray(orders)) return 0
  return orders.filter(order => order && !CLOSED_STATUSES.has(String(order.status || '').toLowerCase())).length
}
