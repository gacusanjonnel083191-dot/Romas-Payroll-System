import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const migration = fs.readFileSync(new URL('../supabase/migrations/20261113032653_payroll_birthday_eligibility_secure_view_access.sql', import.meta.url), 'utf8')

test('payroll computation and pre-check use protected employee view for birthday eligibility', () => {
  const protectedReads = app.match(/\.from\('employee_access'\)\s*\.select\('id,birthday_pay_eligible'\)/g) || []
  assert.equal(protectedReads.length, 2)
  assert.doesNotMatch(app, /\.from\('employees'\)\s*\.select\('id,birthday_pay_eligible'\)/)
})

test('eligibility is role-masked and no broad employee-table access is added', () => {
  assert.match(migration, /case when access\.full_access then e\.birthday_pay_eligible end as birthday_pay_eligible/)
  assert.match(migration, /create or replace view public\.employee_access with \(security_barrier = true\)/i)
  assert.doesNotMatch(migration, /grant\s+select\s+.*\bon\s+public\.employees/i)
})
