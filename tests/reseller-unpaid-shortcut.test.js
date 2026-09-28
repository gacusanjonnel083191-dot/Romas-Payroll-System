import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { summarizeResellerReceivables } from '../src/resellerReceivables.js'

const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
function extract(start, end, scope, name) {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from)
  assert.ok(from > 0 && to > from)
  return new Function('scope', `with(scope) { ${source.slice(from, to)}; return ${name} }`)(scope)
}

test('shortcut selects exact outlet, clears stale search/date, opens receivables and loads read-only', () => {
  const state = {}
  const scope = Object.fromEntries(['ReceivableOutlet', 'InvoiceFilter', 'InvoiceSearchTerm', 'InvoiceDayFilter', 'SalesView'].map(key => [`set${key}`, value => { state[key] = value }]))
  scope.loadDeliveryInvoices = options => { state.load = options }
  scope.requestAnimationFrame = () => {}
  const open = extract('function openResellerUnpaidInvoices(', 'function invoiceMatchesReceivableOutlet(', scope, 'openResellerUnpaidInvoices')
  open({ id:'outlet-a', name:'Same Name' })
  assert.deepEqual(state, { ReceivableOutlet:{ id:'outlet-a', name:'Same Name' }, InvoiceFilter:'active', InvoiceSearchTerm:'', InvoiceDayFilter:'all', SalesView:'receivables', load:{ readOnly:true } })
})

test('outlet list matches badge count, includes partial payments and excludes other outlets and settled/void invoices', () => {
  const scope = { receivableOutlet:{ id:'a' }, invoiceFilter:'active', summarizeResellerReceivables }
  const matches = extract('function invoiceMatchesReceivableOutlet(', 'const openAnalyticsInvoiceStatus', scope, 'invoiceMatchesReceivableOutlet')
  const rows = [
    { id:1, reseller_id:'a', total_amount:100, paid_amount:0, status:'unpaid' },
    { id:2, reseller_id:'a', total_amount:100, paid_amount:40, status:'partial' },
    { id:3, reseller_id:'b', total_amount:100, paid_amount:0, status:'unpaid' },
    { id:4, reseller_id:'a', total_amount:100, paid_amount:100, status:'paid' },
    { id:5, reseller_id:'a', total_amount:100, paid_amount:0, status:'voided' },
    { id:6, reseller_id:'a', total_amount:100, paid_amount:99.99, status:'partial' },
  ]
  assert.deepEqual(rows.filter(matches).map(i=>i.id), [1,2])
  assert.equal(rows.filter(matches).length, summarizeResellerReceivables(rows).a.unpaidCount)
  scope.invoiceFilter = 'paid'
  assert.equal(matches(rows[3]), true)
  scope.receivableOutlet = null
  assert.equal(matches(rows[2]), true)
})

test('read-only invoice load skips status writes, supports query fallback and reports load failures', async () => {
  for (const mode of ['success', 'fallback', 'error']) {
    const state = {}
    let queries = 0
    const scope = {
      setInvoicesLoading: value => { state.loading = value },
      setInvoiceLoadError: value => { state.error = value },
      setDeliveryInvoices: value => { state.rows = value },
      autoMarkTodayDelivered: () => { throw new Error('Unexpected delivery write') },
      normalizePaidInvoiceRows: () => { throw new Error('Unexpected payment write') },
      fetchAllDeliveryInvoiceRows: async () => {
        queries++
        if (mode === 'error' || (mode === 'fallback' && queries === 1)) return { error:'mock failure' }
        return { data:[{ id:1 }] }
      },
      isSalesSummaryInvoiceCounted: () => true,
      attachReturnsToDeliveryInvoices: async rows => rows,
      sortDeliveryInvoicesNewestFirst: () => 0,
      console:{ warn:()=>{} },
    }
    const load = extract('async function loadDeliveryInvoices(', 'function getNextMonthStart(', scope, 'loadDeliveryInvoices')
    await load({ readOnly:true })
    assert.equal(state.loading, false)
    assert.deepEqual(state.rows, mode === 'error' ? [] : [{ id:1 }])
    assert.equal(!!state.error, mode === 'error')
    assert.equal(queries, mode === 'success' ? 1 : 2)
  }
})
