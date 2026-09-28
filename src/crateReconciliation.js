// Counts are taken at the end of a Philippine business day, after all handovers.
// A count replaces the old running balance for that location only. Later movements
// are added to the count without modifying or deleting historical ledger entries.
export function projectedOutletBalance(count, movements, assetType) {
  if (!count || count.status !== 'approved') return null
  const base = Number(assetType === 'cover' ? count.cover_qty : count.crate_qty)
  const changes = (movements || []).filter(m =>
    m.is_deleted !== true && String(m.reseller_id) === String(count.reseller_id) &&
    String(m.asset_type || 'crate') === assetType &&
    String(m.movement_date || '').slice(0, 10) > count.count_date
  ).reduce((sum, m) => {
    const direction = String(m.direction || '').toLowerCase()
    const qty = Number(m.quantity) || 0
    return sum + (['out', 'increase_balance'].includes(direction) ? qty : -qty)
  }, 0)
  return { counted:base, changes, expected:base + changes }
}

export function latestApprovedOutletCounts(counts) {
  const latest = new Map()
  for (const count of counts || []) {
    if (count.status !== 'approved' || count.location_type !== 'outlet') continue
    const key = String(count.reseller_id)
    const previous = latest.get(key)
    if (!previous || count.count_date > previous.count_date ||
      (count.count_date === previous.count_date && count.approved_at > previous.approved_at)) latest.set(key, count)
  }
  return latest
}

// The crate movement ledger includes manual handovers and invoice settlements.
// Donut quantities on invoices are never used as a proxy for crate quantities.
export function outletMovementSummary(resellerId, movements, count = null) {
  const result = { delivered:{ date:'', crates:0, covers:0 }, returned:{ date:'', crates:0, covers:0 },
    sinceCount:{ cratesDelivered:0, cratesReturned:0, coversDelivered:0, coversReturned:0 },
    ledgerNet:{ crates:0, covers:0 } }
  for (const m of movements || []) {
    if (m.is_deleted === true || String(m.reseller_id) !== String(resellerId) ||
      String(m.movement_type || '').toLowerCase().startsWith('company_') ||
      String(m.reseller_name || '').toLowerCase() === 'company inventory') continue
    const type = String(m.movement_type || '').toLowerCase()
    const direction = String(m.direction || '').toLowerCase()
    const event = ['dispatch','released','settlement_dispatch'].includes(type) ? 'delivered' :
      ['collection','returned','return','settlement_collection'].includes(type) ? 'returned' : null
    const qty = Number(m.quantity)
    if (!Number.isFinite(qty) || qty <= 0) continue
    const asset = String(m.asset_type || 'crate').toLowerCase() === 'cover' ? 'covers' : 'crates'
    const sign = ['out','increase_balance'].includes(direction) ? 1 :
      ['in','reduce_balance'].includes(direction) ? -1 : event === 'delivered' ? 1 : -1
    result.ledgerNet[asset] += sign * qty
    if (!event) continue
    const date = String(m.movement_date || '').slice(0,10)
    if (date > result[event].date) result[event] = { date, crates:0, covers:0 }
    if (date === result[event].date) result[event][asset] += qty
    if (count?.status === 'approved' && date > count.count_date) {
      const key = asset + (event === 'delivered' ? 'Delivered' : 'Returned')
      result.sinceCount[key] += qty
    }
  }
  return result
}
