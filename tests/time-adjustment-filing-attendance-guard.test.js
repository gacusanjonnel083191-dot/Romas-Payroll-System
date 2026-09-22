import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260922050000_enforce_time_adjustment_attendance_validation.sql', import.meta.url), 'utf8')

test('guard is insert-only and limited to OT / No Meal Break filing', () => {
  assert.match(migration, /if tg_op <> 'INSERT'/)
  assert.match(migration, /v_request_type not in \('overtime', 'meal_break'\)/)
  assert.match(migration, /before insert\s+on public\.time_adjustment_requests/i)
  assert.doesNotMatch(migration, /before insert or update/i)
})

test('filing requires completed non-absent Time In and Time Out', () => {
  assert.match(migration, /TIME_ADJUSTMENT_FILING_BLOCKED_INCOMPLETE_ATTENDANCE/)
  assert.match(migration, /TIME_ADJUSTMENT_FILING_BLOCKED_NO_COMPLETED_ATTENDANCE/)
  assert.match(migration, /al\.time_in is not null/)
  assert.match(migration, /al\.time_out is not null/)
  assert.match(migration, /<> 'absent'/)
})

test('short punch and overnight attendance are guarded', () => {
  assert.match(migration, /v_raw_span_minutes < 5/)
  assert.match(migration, /when al\.time_out < al\.time_in then 1440 else 0 end/)
})

test('OT is derived from paid attendance and completed 30-minute blocks', () => {
  assert.match(migration, /v_paid_worked_minutes := greatest\(0, v_raw_span_minutes - v_deducted_break_minutes\)/)
  assert.match(migration, /v_raw_overtime_minutes := greatest\(0, v_paid_worked_minutes - 480\)/)
  assert.match(migration, /floor\(v_raw_overtime_minutes::numeric \/ 30\)::integer \* 30/)
  assert.match(migration, /OT_FILING_BLOCKED_NO_PAYABLE_ATTENDANCE/)
  assert.match(migration, /OT_FILING_BLOCKED_MINUTES_MISMATCH/)
})

test('No Meal Break can only file zero adjustment minutes', () => {
  assert.match(migration, /if v_request_type = 'meal_break'/)
  assert.match(migration, /coalesce\(new\.minutes, 0\) <> 0/)
  assert.match(migration, /NO_MEAL_BREAK_FILING_BLOCKED_INVALID_MINUTES/)
})

test('guard preserves caller security context and fixes its lookup path', () => {
  assert.match(migration, /security invoker/i)
  assert.match(migration, /set search_path = pg_catalog, pg_temp/i)
  assert.doesNotMatch(migration, /security definer/i)
})
