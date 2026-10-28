import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {productionVariantForProduct, summarizeAcceptedOnlineOrders} from '../src/customerOrderForecast.js'

const catalog = JSON.parse(readFileSync(new URL('../supabase/functions/public-ordering/catalog.json', import.meta.url), 'utf8'))
const date = '2026-10-26'
const order = {id:'one', status:'accepted', scheduled_at:'2026-10-25T16:30:00Z'}

test('every sellable catalog SKU has a production category', () => {
  assert.deepEqual(catalog.filter(product => !productionVariantForProduct(product.id)).map(product => product.id), [])
})

test('accepted pieces include box multipliers and keep assorted flavors unallocated', () => {
  const summary = summarizeAcceptedOnlineOrders({ok:true, date, orders:[order], items:[
    {order_id:'one', product_id:'double-choco', quantity:2, pieces_per_unit:1},
    {order_id:'one', product_id:'assorted-rings-6', quantity:2, pieces_per_unit:6},
    {order_id:'one', product_id:'assorted-circlets-12', quantity:1, pieces_per_unit:12},
    {order_id:'one', product_id:'bavarian-bites-15', quantity:1, pieces_per_unit:15},
  ]}, date)
  assert.equal(summary.orderCount, 1)
  assert.equal(summary.totalPieces, 41)
  assert.deepEqual(summary.piecesByVariant, {
    Rings:2, 'Assorted Rings (unallocated)':12,
    'Assorted Circlets (unallocated)':12, 'Bavarian Bites':15,
  })
})

test('incomplete, duplicate, or unaccepted online orders fail rather than undercount', () => {
  const base = {ok:true, date, orders:[order], items:[{order_id:'one', product_id:'shells-6', quantity:1, pieces_per_unit:6}]}
  assert.throws(() => summarizeAcceptedOnlineOrders({...base, items:[]}, date), /no item snapshots/)
  assert.throws(() => summarizeAcceptedOnlineOrders({...base, items:[...base.items, ...base.items]}, date), /duplicate item/)
  assert.throws(() => summarizeAcceptedOnlineOrders({...base, orders:[{...order, status:'pending_confirmation'}]}, date), /not accepted/)
  assert.throws(() => summarizeAcceptedOnlineOrders({...base, items:[{...base.items[0], product_id:'unknown'}]}, date), /cannot classify/)
})
