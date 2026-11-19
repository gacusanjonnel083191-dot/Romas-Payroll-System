// Mother accounts may physically mix crates from every linked outlet.
// Financial transactions still belong to their individual outlet.
export function getMotherAccountCratePool(outletId, resellers = [], accounts = []) {
  const outlet = resellers.find(r => String(r.id) === String(outletId))
  if (!outlet) return null
  const accountId = outlet.reseller_account_id || null
  const outlets = accountId
    ? resellers.filter(r => String(r.reseller_account_id || '') === String(accountId))
    : [outlet]
  const account = accountId ? accounts.find(a => String(a.id) === String(accountId)) : null
  return {
    key: accountId ? 'account:' + accountId : 'outlet:' + outlet.id,
    accountId,
    name: accountId ? (account?.account_name || account?.owner_name || 'Mother account') : outlet.name,
    outlets,
    outletIds: outlets.map(r => String(r.id))
  }
}

export function listCrateInventoryPools(resellers = [], accounts = []) {
  const pools = new Map()
  for (const reseller of resellers) {
    const pool = getMotherAccountCratePool(reseller.id, resellers, accounts)
    if (pool && !pools.has(pool.key)) pools.set(pool.key, pool)
  }
  return [...pools.values()]
}

export function summarizeCratesRecordedToday(events = [], pool, day) {
  if (!pool) return { crates: 0, covers: 0, entries: [] }
  const members = new Set(pool.outletIds.map(String))
  const names = new Map(pool.outlets.map(r => [String(r.id), r.name]))
  const entries = events.filter(e =>
    e.action === 'collection' &&
    String(e.business_date || '').slice(0, 10) === day &&
    members.has(String(e.location_key))
  ).map(e => ({
    ...e,
    outletName: names.get(String(e.location_key)) || 'Linked outlet'
  })).sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  return {
    crates: entries.reduce((n,e) => n + Number(e.crates || 0),0),
    covers: entries.reduce((n,e) => n + Number(e.covers || 0),0),
    entries
  }
}

export function isRepeatedAccountCrateTrip(entries = [], driver = '', reference = '') {
  const d = String(driver).trim().toLowerCase()
  const r = String(reference).trim().toLowerCase()
  return Boolean(d && r && entries.some(e =>
    String(e.driver || '').trim().toLowerCase() === d &&
    String(e.reference || '').trim().toLowerCase() === r
  ))
}
