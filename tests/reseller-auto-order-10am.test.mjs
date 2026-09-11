import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { enforceResellerAutoOrder10am } from '../vite.reseller-auto-order-10am-invariant.js'

const appPath = new URL('../src/App.jsx', import.meta.url)
const migrationPath = new URL('../supabase/migrations/20260911033000_reseller_auto_order_10am_ph.sql', import.meta.url)
const app = readFileSync(appPath, 'utf8')
const migration = readFileSync(migrationPath, 'utf8')
const transformed = enforceResellerAutoOrder10am(app, appPath.pathname)

// Automatic ordering must be 10:00 AM Philippine time everywhere the reseller sees it.
assert.match(transformed, /Automatic submission: <strong>10:00 AM Philippine time<\/strong>/)
assert.match(transformed, /Manual order deadline: <strong>1:00 PM<\/strong>/)
assert.match(transformed, /fixed 10:00 AM Philippine-time cutoff/)
assert.match(transformed, /Active day templates will submit automatically at 10:00 AM\./)
assert.match(transformed, /Template changes for tomorrow lock at 10:00 AM\./)
assert.match(transformed, /Tomorrow can only be changed before 10:00 AM\./)
assert.match(transformed, /value="10:00 AM every day \(fixed\)"/)
assert.match(transformed, /getPHDateTimeParts\(\)\.totalMinutes >= minutesFromTime\('10:00'\)/)

// The manual-order cutoff is a separate business rule and must stay at 1:00 PM.
assert.match(transformed, /const ORDER_CUTOFF_TIME = '13:00'/)
assert.match(transformed, /const ORDER_CUTOFF_LABEL = '1:00 PM'/)

// The versioned database migration must move only the auto-order machinery to 10 AM.
assert.match(migration, /submission_time set default time '10:00'/)
assert.match(migration, /set submission_time = time '10:00'/)
assert.match(migration, /'0 2 \* \* \*'/)
assert.match(migration, /romas-reseller-auto-orders-10am-ph/)
assert.match(migration, /generate_reseller_auto_orders_with_weekly_skips/)
assert.match(migration, /guard_reseller_order_write/)
assert.match(migration, /Manual-order 1:00 PM guard is missing or was changed unexpectedly/)

console.log('PASS: automatic orders use 10:00 AM PH; manual ordering remains 1:00 PM; UI and migration invariants agree.')
