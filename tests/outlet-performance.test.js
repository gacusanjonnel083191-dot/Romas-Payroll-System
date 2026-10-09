import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOutletDeliveryHistory, calculateOutletClosingLine, getOutletSlowWeekdays, outletWeekdayStats, summarizeOutletClosing } from '../src/outletPerformance.js'

test('delivery history groups active invoices by outlet business date without claiming sales', () => {
  const rows = buildOutletDeliveryHistory([
    { delivery_date:'2026-10-07', status:'delivered', total_amount:120, delivery_invoice_items:[{ variant_id:'a', variant_name:'Glazed', quantity:5, total_price:100 }] },
    { delivery_date:'2026-10-07', status:'paid', total_amount:90, delivery_invoice_items:[{ variant_id:'a', variant_name:'Glazed', quantity:3, total_price:60 }] },
    { delivery_date:'2026-10-08', status:'cancelled', total_amount:999, delivery_invoice_items:[{ variant_name:'Glazed', quantity:99 }] },
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].delivered_qty, 8)
  assert.equal(rows[0].invoiced_amount, 210)
  assert.equal(rows[0].invoice_count, 2)
  assert.equal(rows[0].items[0].quantity, 8)
})

test('daily closing reconciles physical stock into sold pieces and pesos', () => {
  const result = summarizeOutletClosing([
    { beginning:4, delivered:20, manualDelivered:2, wastage:1, ending:5, price:18.5 },
    { beginning:0, delivered:10, manualDelivered:0, wastage:0, ending:4, price:20 },
  ])
  assert.equal(result.sold, 26)
  assert.equal(result.delivered, 32)
  assert.equal(result.wastage, 1)
  assert.equal(result.sales, 490)
})

test('closing rejects impossible counts and missing prices', () => {
  assert.throws(() => calculateOutletClosingLine({ beginning:0, delivered:5, manualDelivered:0, wastage:2, ending:4, price:20 }), /exceed/)
  assert.throws(() => calculateOutletClosingLine({ beginning:0, delivered:5, manualDelivered:0, wastage:0, ending:0, price:0 }), /price/)
  assert.throws(() => calculateOutletClosingLine({ beginning:0, delivered:1.5, manualDelivered:0, wastage:0, ending:0, price:20 }), /whole/)
})

test('weekday averages use recorded days only and require four samples before a slow-day flag', () => {
  const rows = [
    ...['2026-09-09', '2026-09-16', '2026-09-23', '2026-09-30'].map(business_date => ({ business_date, sold_qty:20 })),
    ...['2026-09-10', '2026-09-17', '2026-09-24', '2026-10-01'].map(business_date => ({ business_date, sold_qty:100 })),
  ]
  assert.equal(outletWeekdayStats(rows, 'sold_qty')[3].average, 20)
  assert.deepEqual(getOutletSlowWeekdays(rows, 'sold_qty').map(row => row.name), ['Wednesday'])
  assert.deepEqual(getOutletSlowWeekdays(rows.slice(1), 'sold_qty').map(row => row.name), [])
})
