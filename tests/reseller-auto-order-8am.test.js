import test from 'node:test'
import assert from 'node:assert/strict'
import { enforceResellerAutoOrder8am, resellerAutoOrder8amInvariant } from './vite.reseller-auto-order-10am-invariant.js'

const fixture = `
if (getOrderCutoffStatus().locked && activeSchedules.some(entry=>entry.weekday===tomorrowWeekday)) {
after the 1:00 PM cutoff.
Daily cutoff: <strong>1:00 PM Philippine time</strong> · Staff approval required
Orders are generated at the fixed 1:00 PM Philippine-time cutoff for the next delivery day, then wait for staff approval.
Active day templates will submit automatically at 1:00 PM.
One template per weekday. Template changes for tomorrow lock at 1:00 PM.
Choose a one-time future date or a delivery day to skip every week. Tomorrow can only be changed before 1:00 PM.
value="1:00 PM every day (fixed)"
`

test('moves reseller automatic-order UI and client lock to 8:00 AM', () => {
  const out = enforceResellerAutoOrder8am(fixture, '/work/src/App.jsx')
  assert.match(out, /minutesFromTime\('08:00'\)/)
  assert.match(out, /Automatic submission: <strong>8:00 AM Philippine time<\/strong>/)
  assert.match(out, /submit automatically at 8:00 AM/)
  assert.match(out, /changed before 8:00 AM/)
  assert.match(out, /value="8:00 AM every day \(fixed\)"/)
  assert.doesNotMatch(out, /10:00 AM/)
})

test('does not transform unrelated modules', () => {
  assert.equal(enforceResellerAutoOrder8am(fixture, '/work/src/Other.jsx'), fixture)
})

test('Vite invariant is pre-transform and targets App.jsx', () => {
  const plugin = resellerAutoOrder8amInvariant()
  assert.equal(plugin.enforce, 'pre')
  assert.equal(plugin.transform(fixture, '/work/src/Other.jsx'), null)
  assert.match(plugin.transform(fixture, '/work/src/App.jsx').code, /8:00 AM/)
})
