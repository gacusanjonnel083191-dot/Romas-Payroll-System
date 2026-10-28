const RING_IDS = new Set([
  'double-choco','nuts-kisses','choco-almonds','choco-nut','green-tealiscious',
  'cookie-crumble','cookies-cream','choco-drizzle','snow-sprinkle',
  'midnight-sprinkles','berry-crown','zigzag-supreme','choco-mallow',
])
const FILLED_IDS = new Set(['chocolate-filled','caramel-filled','bavarian-breeze','strawberry-filled'])
const NAMED_VARIANTS = {
  'bavarian-midnight':'Bavarian Midnight', 'matcha-supreme':'Matcha Supreme',
  fanfans:'Fanfans', 'oreo-dream':'Oreo Dream', 'almond-glitz':'Almond Glitz',
  'lotus-cloud':'Lotus Cloud', 'matcha-pops':'Matcha Pops',
  'strawberry-pops':'Strawberry Pops', 'taro-pops':'Taro Pops',
  'bavarian-bites':'Bavarian Bites', 'bavarian-pops':'Bavarian Pops',
  'choco-balls':'Choco Balls', 'choco-lollisticks':'Choco Lollisticks',
  'giant-donut':'Giant Donut', shells:'Shells',
}

export function productionVariantForProduct(productId) {
  const id = String(productId || '').trim()
  if (id === 'assorted-rings-6' || id === 'assorted-rings-12') return 'Assorted Rings (unallocated)'
  if (id === 'assorted-circlets-12' || id === 'assorted-circlets-20') return 'Assorted Circlets (unallocated)'
  if (RING_IDS.has(id)) return 'Rings'
  if (FILLED_IDS.has(id)) return 'Shells'
  if (id.startsWith('circlet-')) return 'Glazed Circlets'
  const baseId = id.replace(/-(?:6|12|15|20|30|60)$/, '')
  return NAMED_VARIANTS[baseId] || null
}

export function summarizeAcceptedOnlineOrders(payload, requestedDate) {
  if (!payload?.ok || payload.date !== requestedDate || !Array.isArray(payload.orders) || !Array.isArray(payload.items)) {
    throw new Error('Online forecast response is incomplete.')
  }
  const orderIds = new Set()
  for (const order of payload.orders) {
    if (!order?.id || orderIds.has(order.id)) throw new Error('Online forecast contains a duplicate or missing order ID.')
    if (!['accepted','preparing','ready','out_for_delivery','completed'].includes(order.status)) {
      throw new Error('Online forecast contains an order that is not accepted.')
    }
    if (new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date(order.scheduled_at)) !== requestedDate) {
      throw new Error('Online forecast contains an order for another production date.')
    }
    orderIds.add(order.id)
  }
  const piecesByVariant = new Map()
  const ordersWithItems = new Set()
  const itemKeys = new Set()
  let totalPieces = 0
  for (const item of payload.items) {
    if (!orderIds.has(item?.order_id)) throw new Error('Online forecast contains an item outside the selected orders.')
    const itemKey = `${item.order_id}:${item.product_id}`
    if (itemKeys.has(itemKey)) throw new Error('Online forecast contains a duplicate item snapshot.')
    itemKeys.add(itemKey)
    ordersWithItems.add(item.order_id)
    const variant = productionVariantForProduct(item.product_id)
    const quantity = Number(item.quantity)
    const piecesPerUnit = Number(item.pieces_per_unit)
    if (!variant || !Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isSafeInteger(piecesPerUnit) || piecesPerUnit <= 0) {
      throw new Error(`Online forecast cannot classify ${item?.product_name || item?.product_id || 'an item'}.`)
    }
    const pieces = quantity * piecesPerUnit
    if (!Number.isSafeInteger(pieces)) throw new Error('Online forecast quantity is too large.')
    piecesByVariant.set(variant, (piecesByVariant.get(variant) || 0) + pieces)
    totalPieces += pieces
  }
  if (ordersWithItems.size !== orderIds.size) throw new Error('An accepted online order has no item snapshots.')
  return {orderCount:orderIds.size, totalPieces, piecesByVariant:Object.fromEntries(piecesByVariant)}
}
