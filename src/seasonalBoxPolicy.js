// Sales and POS quantities are BOXES. Only production planning expands them.
export const SEASONAL_BOXES = Object.freeze([
  Object.freeze({ name:'Spooky Donuts - 6-piece box', code:'SPOOKY-6', printLabel:'Spooky 6pc BOX', price:160, pieces:6, shells:3, rings:3 }),
  Object.freeze({ name:'Spooky Donuts - 12-piece box', code:'SPOOKY-12', printLabel:'Spooky 12pc BOX', price:315, pieces:12, shells:5, rings:7 }),
])
const key = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
export function seasonalBoxFor(value) {
  const name = typeof value === 'string' ? value : value?.variant_name || value?.product_name || value?.name
  return SEASONAL_BOXES.find(box => [box.name, box.printLabel].some(label => key(label) === key(name))) || null
}
export function assertWholeSeasonalBoxes(items = [], quantityField = 'quantity') {
  for (const item of items) {
    if (!seasonalBoxFor(item)) continue
    const quantity = Number(item[quantityField] ?? 0)
    if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error('Spooky Donuts quantities must be whole boxes. Choose the 6-piece or 12-piece box; individual pieces are not sold.')
  }
}
export function physicalDonutQuantity(item = {}, quantityField = 'quantity') {
  return (Number(item[quantityField]) || 0) * (seasonalBoxFor(item)?.pieces || 1)
}
export function expandSeasonalProductionItems(items = [], variants = []) {
  return items.flatMap(item => {
    const box = seasonalBoxFor(item)
    if (!box) return [item]
    return [['Shells', box.shells], ['Rings', box.rings]].map(([name, pieces]) => ({
      variant_id:variants.find(variant => key(variant.name || variant.variant_name) === key(name))?.id || null,
      variant_name:name,
      quantity:(Number(item.quantity) || 0) * pieces,
      seasonal_pieces:(Number(item.quantity) || 0) * pieces,
      seasonal_box_name:box.name,
    }))
  })
}
export function seasonalPackingSummary(items = []) {
  return SEASONAL_BOXES.map(box => {
    const boxes = items.filter(item => seasonalBoxFor(item)?.code === box.code).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
    return { ...box, boxes, shellPieces:boxes * box.shells, ringPieces:boxes * box.rings, totalPieces:boxes * box.pieces }
  }).filter(row => row.boxes > 0)
}
