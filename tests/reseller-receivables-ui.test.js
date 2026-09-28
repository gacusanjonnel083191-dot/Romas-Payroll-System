import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithOxc } from 'vite'

const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const start = source.indexOf("{salesView==='resellers' && (")
const end = source.indexOf(" {/* Sheryl's read-only returns view", start)
assert.ok(start > 0 && end > start, 'Actual Resellers view must be found')
const section = source.slice(start, end).trimEnd()
const view = section.slice(0, section.lastIndexOf('\n </div>\n )}'))
const { code } = await transformWithOxc(`return <>${view}</>`, 'resellers-fixture.jsx', { jsx: { runtime: 'classic' } })
const renderView = new Function('React', 'scope', `with (scope) { ${code} }`)
const noop = () => {}

export function renderResellers(overrides = {}) {
  const scope = {
    salesView: 'resellers', resellers: [{ id: 'branch-a', name: 'Test Outlet', delivery_day: 'Daily' }],
    resellerReceivables: null, resellerReceivablesLoading: false, resellerReceivablesError: '', resellerReceivablesUpdatedAt: null,
    resellerAccountsLoading: false, resellerAccounts: [], showResellerAccountForm: false, showResellerForm: false,
    resellersLoading: false, editingDefaultOrder: null, resellerDefaultOrders: {},
    btnGreen: {}, btnRed: {}, btnBlack: {}, btnYellow: {}, cardS: {}, lblS: {}, inputStyle: {},
    refreshResellerReceivables: noop,
    php: amount => `₱${amount.toFixed(2)}`,
    Badge: ({ label }) => React.createElement('span', null, label),
    ...overrides,
  }
  return renderToStaticMarkup(renderView(React, scope))
}

test('actual reseller cards show outlet balances and unpaid counts, including zero', () => {
  const html = renderResellers({ resellerReceivables: { 'branch-a': { balance: 123.45, unpaidCount: 2 } } })
  assert.match(html, /AR: ₱123.45/)
  assert.match(html, /2 unpaid invoice\(s\)/)
  const zero = renderResellers({ resellerReceivables: {} })
  assert.match(zero, /AR: ₱0.00/)
  assert.match(zero, /0 unpaid invoice\(s\)/)
})

test('loading and first-load failure never show a false zero; refresh is disabled while loading', () => {
  const html = renderResellers({ resellerReceivablesLoading: true })
  assert.match(html, /disabled=""/)
  assert.match(html, /REFRESHING/)
  assert.match(html, /AR: unavailable/)
  assert.match(html, /Unpaid count: unavailable/)
  assert.match(html, /min-height:44px/)
})

test('failed refresh labels retained figures as previous and supplies a Manila timestamp', () => {
  const html = renderResellers({
    resellerReceivables: { 'branch-a': { balance: 50, unpaidCount: 1 } },
    resellerReceivablesError: 'Unable to refresh invoice balances.',
    resellerReceivablesUpdatedAt: new Date('2026-09-28T00:00:00Z'),
  })
  assert.match(html, /AR: ₱50.00/)
  assert.match(html, /Unable to refresh/)
  assert.match(html, /Showing previous figures/)
  assert.match(html, /Manila/)
})

test('actual refresh handler rejects overlapping requests, preserves prior values on error, and can retry', async () => {
  const handlerStart = source.indexOf('async function refreshResellerReceivables()')
  const handlerEnd = source.indexOf('async function loadResellers()', handlerStart)
  const state = { loading: false, error: '', values: { previous: true }, updated: null }
  let calls = 0
  let resolve
  let fail = false
  const scope = {
    resellerReceivablesInFlight: { current: false }, supabase: {},
    setResellerReceivablesLoading: value => { state.loading = value },
    setResellerReceivablesError: value => { state.error = value },
    setResellerReceivables: value => { state.values = value },
    setResellerReceivablesUpdatedAt: value => { state.updated = value },
    fetchResellerReceivables: async () => {
      calls++
      if (fail) throw new Error('network')
      return new Promise(done => { resolve = done })
    },
  }
  const refresh = new Function('scope', `with(scope) { ${source.slice(handlerStart, handlerEnd)} return refreshResellerReceivables }`)(scope)
  const pending = refresh()
  await refresh()
  assert.equal(calls, 1)
  assert.equal(state.loading, true)
  const summary = { 'branch-a': { balance: 50, unpaidCount: 1 } }
  resolve(summary)
  await pending
  assert.equal(state.values, summary)
  assert.equal(state.loading, false)
  assert.ok(state.updated instanceof Date)
  fail = true
  await refresh()
  assert.equal(state.values, summary)
  assert.match(state.error, /Unable to refresh/)
  assert.equal(state.loading, false)
  assert.equal(scope.resellerReceivablesInFlight.current, false)
  fail = false
  const retry = refresh()
  resolve({})
  await retry
  assert.deepEqual(state.values, {})
  assert.equal(state.error, '')
})
