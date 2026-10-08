import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20261008150000_offboarding_session_and_schedule_security.sql', import.meta.url),
  'utf8'
)

test('employee deactivation revokes portal sessions and linked admin status', () => {
  assert.match(migration, /before update of is_active on public\.employees/i)
  assert.match(migration, /delete from private\.employee_cash_advance_sessions\s+s where s\.employee_id = new\.id/i)
  assert.match(migration, /update public\.admin_users\s+au set is_active = false/i)
  assert.match(migration, /linked owner account cannot be deactivated/i)
})

test('employee financial RPCs use the shared active-status validation helper', () => {
  for (const functionName of ['employee_cash_advance_ledgers', 'employee_cash_advance_requests']) {
    const body = migration.split('create or replace function public.' + functionName)[1]?.split('$$;')[0]
    assert.ok(body, functionName + ' must exist')
    assert.match(body, /private\.employee_portal_session_employee\(p_session_token\)/)
    assert.doesNotMatch(body, /from private\.employee_cash_advance_sessions/)
  }
})

test('anonymous clients cannot write schedules after applying the staged migration', () => {
  assert.match(migration, /alter table public\.daily_schedules enable row level security/i)
  assert.match(migration, /revoke insert, update, delete, truncate, references, trigger on public\.daily_schedules from anon/i)
  assert.match(migration, /daily_schedules_admin_insert/)
  assert.match(migration, /daily_schedules_admin_update/)
  assert.match(migration, /daily_schedules_admin_delete/)
  assert.match(migration, /private\.cash_advance_admin_has_role/)
})

test('employee browser deletes are owner-only; no financial cascade', () => {
  assert.match(migration, /drop policy if exists employees_authenticated_delete/i)
  assert.match(migration, /create policy employees_owner_delete/)
  assert.doesNotMatch(migration, /delete from public\.(?:payroll_records|attendance_logs|cash_advances)/i)
  assert.doesNotMatch(migration, /on delete cascade/i)
})

test('migration explicitly commits and does not drop payroll or attendance structures', () => {
  assert.match(migration, /^begin;/im)
  assert.match(migration, /commit;\s*$/i)
  assert.doesNotMatch(migration, /drop (?:table|schema)/i)
})
