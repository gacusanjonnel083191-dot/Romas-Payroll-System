import test from 'node:test'
import assert from 'node:assert/strict'
import {canPerformStaffAction} from '../supabase/functions/public-ordering/staff-access.mjs'

const readActions = ['staff-list', 'staff-get', 'staff-forecast']
const writeActions = ['staff-status', 'staff-phone-confirm', 'staff-message', 'staff-pay', 'staff-refund']

test('view-only admins can read orders and forecast but cannot change an order', () => {
  for (const action of readActions) assert.equal(canPerformStaffAction('view', action), true, action)
  for (const action of writeActions) assert.equal(canPerformStaffAction('view', action), false, action)
})

test('full access permits all staff workflows; missing access permits none', () => {
  for (const action of [...readActions, ...writeActions]) {
    assert.equal(canPerformStaffAction('full', action), true, action)
    assert.equal(canPerformStaffAction(null, action), false, action)
  }
})
