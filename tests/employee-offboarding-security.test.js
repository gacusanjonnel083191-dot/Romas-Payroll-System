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

const registryMigration = readFileSync(
  new URL('../supabase/migrations/20261008150100_employee_registry_and_owner_removal.sql', import.meta.url), 'utf8'
)
const pinMigration = readFileSync(
  new URL('../supabase/migrations/20261008150200_hash_employee_pins.sql', import.meta.url), 'utf8'
)

test('historical records are linked to non-login employee registry', () => {
  assert.match(registryMigration, /create table if not exists public\.employee_registry/i)
  assert.match(registryMigration, /insert into public\.employee_registry/i)
  assert.match(registryMigration, /alter table public\.employee_registry enable row level security/i)
  assert.match(registryMigration, /references public\.employee_registry\(id\)/i)
  assert.match(registryMigration, /private\.employee_cash_advance_sessions'::regclass/)
  assert.match(registryMigration, /public\.notifications'::regclass/)
})

test('owner removal audits action and preserves payroll and attendance', () => {
  assert.match(registryMigration, /function public\.owner_permanently_remove_employee/i)
  assert.match(registryMigration, /private\.cash_advance_admin_has_role\(array\['owner'\]/i)
  assert.match(registryMigration, /from public\.payroll_records where employee_id=emp\.id/i)
  assert.match(registryMigration, /from public\.attendance_logs where employee_id=emp\.id/i)
  assert.match(registryMigration, /from public\.cash_advances where employee_id=emp\.id/i)
  assert.match(registryMigration, /outstanding>0/)
  assert.match(registryMigration, /delete from public\.employees where id=emp\.id/i)
  assert.doesNotMatch(registryMigration, /delete from public\.(?:payroll_records|attendance_logs|cash_advances|daily_schedules)/i)
  assert.match(registryMigration, /EMPLOYEE ACCOUNT PERMANENTLY REMOVED/)
})

test('employee PIN migration hashes existing and future credentials', () => {
  assert.match(pinMigration, /create extension if not exists pgcrypto/i)
  assert.match(pinMigration, /update public\.employees\s+set pin = extensions\.crypt\(pin, extensions\.gen_salt/i)
  assert.match(pinMigration, /before insert or update of pin on public\.employees/i)
  assert.match(pinMigration, /extensions\.crypt\(btrim\(coalesce\(p_pin,''\)\),e\.pin\)/)
  assert.match(pinMigration, /to_jsonb\(v_employee\)-'pin'/)
})

test('owner-only UI calls removal RPC and uses archive-safe schedule lookups', () => {
  const app = readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
  assert.match(app, /adminRole==='owner' && \([\s\S]*?PERMANENTLY REMOVE/)
  assert.match(app, /rpc\('owner_permanently_remove_employee'/)
  assert.match(app, /loadDeactivatedEmployees\(\)/)
  assert.doesNotMatch(app, /\.select\('\*,employees\(full_name,employee_code\)'\)/)
})
