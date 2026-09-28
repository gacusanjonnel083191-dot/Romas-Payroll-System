import test from 'node:test'
import assert from 'node:assert/strict'
import { latestApprovedOutletCounts, outletMovementSummary, projectedOutletBalance } from '../src/crateReconciliation.js'

test('a delayed count is projected using later dated handovers, not the reply date', () => {
  const count = { status:'approved', reseller_id:'outlet-1', count_date:'2026-09-26', crate_qty:8, cover_qty:7 }
  const movements = [
    { reseller_id:'outlet-1', movement_date:'2026-09-26', asset_type:'crate', direction:'out', quantity:4 },
    { reseller_id:'outlet-1', movement_date:'2026-09-27', asset_type:'crate', direction:'out', quantity:3 },
    { reseller_id:'outlet-1', movement_date:'2026-09-27', asset_type:'crate', direction:'in', quantity:2 },
    { reseller_id:'outlet-1', movement_date:'2026-09-28', asset_type:'cover', direction:'out', quantity:3 },
    { reseller_id:'outlet-2', movement_date:'2026-09-28', asset_type:'crate', direction:'out', quantity:99 },
    { reseller_id:'outlet-1', movement_date:'2026-09-28', asset_type:'crate', direction:'out', quantity:99, is_deleted:true },
  ]
  assert.deepEqual(projectedOutletBalance(count, movements, 'crate'), { counted:8, changes:1, expected:9 })
  assert.deepEqual(projectedOutletBalance(count, movements, 'cover'), { counted:7, changes:3, expected:10 })
})

test('only the latest approved count becomes an outlet baseline', () => {
  const old = { id:'a', status:'approved', location_type:'outlet', reseller_id:'outlet-1', count_date:'2026-09-24', approved_at:'2026-09-25' }
  const current = { id:'b', status:'approved', location_type:'outlet', reseller_id:'outlet-1', count_date:'2026-09-27', approved_at:'2026-09-28' }
  const pending = { id:'c', status:'pending', location_type:'outlet', reseller_id:'outlet-1', count_date:'2026-09-28' }
  assert.equal(latestApprovedOutletCounts([pending,old,current]).get('outlet-1'), current)
  assert.equal(projectedOutletBalance(pending, [], 'crate'), null)
})

test('latest handovers sum crates and covers without counting replaced settlements', () => {
  const count = { status:'approved', reseller_id:'a', count_date:'2026-09-26', crate_qty:8, cover_qty:8 }
  const movements = [
    { reseller_id:'a', movement_date:'2026-09-27', movement_type:'dispatch', direction:'out', asset_type:'crate', quantity:2 },
    { reseller_id:'a', movement_date:'2026-09-28', movement_type:'settlement_dispatch', direction:'out', asset_type:'crate', quantity:3 },
    { reseller_id:'a', movement_date:'2026-09-28', movement_type:'settlement_dispatch', direction:'out', asset_type:'cover', quantity:4 },
    { reseller_id:'a', movement_date:'2026-09-28', movement_type:'settlement_collection', direction:'in', asset_type:'crate', quantity:1 },
    { reseller_id:'a', movement_date:'2026-09-28', movement_type:'collection', direction:'in', asset_type:'cover', quantity:2 },
    { reseller_id:'a', movement_date:'2026-09-28', movement_type:'dispatch', direction:'out', asset_type:'crate', quantity:99, is_deleted:true },
    { reseller_id:'b', movement_date:'2026-09-28', movement_type:'dispatch', direction:'out', asset_type:'crate', quantity:50 },
    { reseller_id:'a', movement_date:'2026-09-28', movement_type:'adjustment_reduce', direction:'in', asset_type:'crate', quantity:1 },
  ]
  const summary = outletMovementSummary('a', movements, count)
  assert.deepEqual(summary.delivered, { date:'2026-09-28', crates:3, covers:4 })
  assert.deepEqual(summary.returned, { date:'2026-09-28', crates:1, covers:2 })
  assert.deepEqual(summary.ledgerNet, { crates:3, covers:2 })
  assert.equal(projectedOutletBalance(count, movements, 'crate').expected, 11)
})
