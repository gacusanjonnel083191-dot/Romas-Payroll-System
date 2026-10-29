export const ORDER_QUEUE_VIEWS = [
  {id:'pending', label:'Needs review', statuses:['pending_confirmation']},
  {id:'processing', label:'In process', statuses:['accepted','preparing','ready','out_for_delivery']},
  {id:'completed', label:'Completed', statuses:['completed']},
  {id:'voided', label:'Voided orders', statuses:['cancelled','declined']},
]

export function ordersForView(orders, view, voidedStatus = 'all') {
  const statuses = ORDER_QUEUE_VIEWS.find(item => item.id === view)?.statuses || []
  return (orders || []).filter(order => statuses.includes(order.status)
    && (view !== 'voided' || voidedStatus === 'all' || order.status === voidedStatus))
}

export function finalStatusEvent(order) {
  if (!['cancelled','declined'].includes(order?.status)) return null
  const events = [...(order.events || [])].reverse()
  return events.find(event => event.new_status === order.status && event.old_status !== event.new_status)
    || events.find(event => event.new_status === order.status) || null
}
