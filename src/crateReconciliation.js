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
