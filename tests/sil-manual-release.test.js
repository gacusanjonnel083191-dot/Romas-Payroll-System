import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSILCashoutCycle, runManualSILReleaseCommand } from '../src/silManualReleaseIntegrity.js'

test('parses exactly the existing SIL conversion cycle metadata', () => {
  assert.deepEqual(
    parseSILCashoutCycle('Unused SIL cash conversion: 5 day(s) from 2025-08-04 to 2026-08-03'),
    { days: 5, start: '2025-08-04', end: '2026-08-03' }
  )
  assert.equal(parseSILCashoutCycle('unrelated adjustment'), null)
})

test('requires a secure owner session before any database write', async () => {
  let called = false
  const res = await runManualSILReleaseCommand({
    auth: { getSession: async () => ({ data: { session: null } }) },
    rpc: async () => { called = true; return { data: { ok: true } } }
  }, {})
  assert.equal(res.ok, false)
  assert.equal(called, false)
})

test('returns verified ledger + linked expense on success', async () => {
  const payload = { p_request_id: 'req-1' }
  const res = await runManualSILReleaseCommand({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'owner' } } } }) },
    rpc: async (name, sent) => {
      assert.equal(name, 'record_manual_sil_release')
      assert.deepEqual(sent, payload)
      return { data: { ok: true, release_id: 'sil-1', expense_id: 'expense-1', existing: false } }
    }
  }, payload)
  assert.equal(res.ok, true)
  assert.equal(res.release_id, 'sil-1')
  assert.equal(res.expense_id, 'expense-1')
})

test('never writes a browser fallback if the database transaction fails', async () => {
  const res = await runManualSILReleaseCommand({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'owner' } } } }) },
    rpc: async () => ({ error: { message: 'already paid' } })
  }, {})
  assert.equal(res.ok, false)
  assert.match(res.error, /already paid/)
})
