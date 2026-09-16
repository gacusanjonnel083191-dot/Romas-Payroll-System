import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import {
  filterProductionForecastInvoices,
  isInvoiceExcludedFromProductionForecastPolicy,
} from '../src/productionForecastPolicy.js'

test('pending deletion exclusion removes invoice demand and rejection restores it', () => {
  const invoices = [
    { id:'keep', delivery_date:'2026-09-17', status:'unpaid' },
    { id:'pending-delete', delivery_date:'2026-09-17', status:'unpaid' },
    { id:'other-date', delivery_date:'2026-09-18', status:'unpaid' },
  ]

  assert.deepEqual(
    filterProductionForecastInvoices(invoices, '2026-09-17', ['pending-delete']).map(row => row.id),
    ['keep'],
  )

  assert.deepEqual(
    filterProductionForecastInvoices(invoices, '2026-09-17', []).map(row => row.id),
    ['keep', 'pending-delete'],
  )
})

test('voided and cancelled invoices never return to production demand', () => {
  assert.equal(isInvoiceExcludedFromProductionForecastPolicy({ id:'voided', status:'voided' }, []), true)
  assert.equal(isInvoiceExcludedFromProductionForecastPolicy({ id:'cancelled', status:'cancelled' }, []), true)
  assert.equal(isInvoiceExcludedFromProductionForecastPolicy({ id:'active', status:'unpaid' }, []), false)
})

test('reseller automatic ordering is absent from the portal and build pipeline', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const viteConfig = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')
  const manualCopyPlugin = fs.readFileSync(new URL('../vite.reseller-manual-copy-last-order.js', import.meta.url), 'utf8')

  assert.doesNotMatch(app, /resellerPortalView==='automatic_orders'/)
  assert.doesNotMatch(app, /reseller_auto_order_get/)
  assert.doesNotMatch(app, /reseller_auto_order_set_enabled/)
  assert.doesNotMatch(viteConfig, /resellerAutoOrder10amInvariant/)
  assert.match(viteConfig, /resellerManualCopyLastOrder/)
  assert.match(manualCopyPlugin, /COPY FROM LAST ORDER/)
  assert.match(app, /reseller_auto_order_review/)
})

test('retirement migration disables generation and exposes only forecast exclusion IDs', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migrations/20260916040000_remove_reseller_auto_orders_and_exclude_pending_invoice_forecast.sql', import.meta.url),
    'utf8',
  )

  assert.match(migration, /update public\.reseller_auto_order_settings[\s\S]*enabled = false/)
  assert.match(migration, /cron\.unschedule/)
  assert.match(migration, /get_production_forecast_excluded_invoice_ids/)
  assert.match(migration, /request\.status = 'pending'/)
  assert.match(migration, /grant execute[\s\S]*to authenticated/)
})
