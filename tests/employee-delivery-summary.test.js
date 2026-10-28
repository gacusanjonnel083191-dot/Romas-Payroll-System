import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { DELIVERY_SUMMARY_EMPLOYEE_IDS as ids, canViewEmployeeDeliverySummary, tomorrowInManila } from '../src/employeeDeliverySummaryPolicy.js'

test('Manila tomorrow handles midnight and month/year boundaries independently of host timezone', () => {
  assert.equal(tomorrowInManila(new Date('2026-10-28T15:59:59Z')), '2026-10-29')
  assert.equal(tomorrowInManila(new Date('2026-10-28T16:00:00Z')), '2026-10-30')
  assert.equal(tomorrowInManila(new Date('2026-12-31T00:00:00Z')), '2027-01-01')
  assert.equal(tomorrowInManila(new Date('2028-02-28T00:00:00Z')), '2028-02-29')
})

test('UI permission uses active employee IDs, never matching names or broad roles', () => {
  for (const id of ids) assert.equal(canViewEmployeeDeliverySummary({ id, is_active: true }), true)
  assert.equal(canViewEmployeeDeliverySummary({ id: ids[0], is_active: false }), false)
  assert.equal(canViewEmployeeDeliverySummary({ id: 'other', full_name: 'Jomar', is_active: true }), false)
  assert.equal(canViewEmployeeDeliverySummary(null), false)
})

test('RPC enforces sessions and names-only, date-filtered, deduplicated delivery access', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema private;
      create table public.employees(id uuid primary key, is_active boolean);
      create table private.employee_cash_advance_sessions(token uuid, employee_id uuid, expires_at timestamptz);
      create table public.resellers(id uuid primary key, name text);
      create table public.delivery_invoices(id uuid, reseller_id uuid, reseller_name text, delivery_date date, customer_type text, status text, delivery_status text, voided_at timestamptz);
      create table public.reseller_orders(reseller_id uuid, reseller_name text, delivery_date date, status text, invoice_id uuid);`)
    const sessionMigration = readFileSync(new URL('../supabase/migrations/20260923140640_secure_payslip_access.sql', import.meta.url), 'utf8')
    await db.exec(sessionMigration.split('create or replace function public.employee_payslips')[0])
    await db.exec(readFileSync(new URL('../supabase/migrations/20261028140901_employee_delivery_summary.sql', import.meta.url), 'utf8'))
    const other = '00000000-0000-0000-0000-000000000003'
    for (const id of [...ids, other]) {
      await db.query('insert into employees values ($1,true)', [id])
      await db.query("insert into private.employee_cash_advance_sessions values ($1,$1,now()+interval '1 hour')", [id])
    }
    await db.exec(`insert into delivery_invoices(id,reseller_name,delivery_date,status) values
      ('00000000-0000-0000-0000-000000000010','Alpha','2026-10-29','paid'),
      ('00000000-0000-0000-0000-000000000011','Void Outlet','2026-10-29','voided'),
      ('00000000-0000-0000-0000-000000000012','Another Day','2026-10-30','unpaid');
      insert into reseller_orders values
      (null,'Alpha','2026-10-29','pending',null),
      (null,'Beta','2026-10-29','pending',null),
      (null,'Rejected','2026-10-29','rejected',null),
      (null,'Void Outlet','2026-10-29','approved','00000000-0000-0000-0000-000000000011');`)
    const query = "select * from employee_delivery_summary($1,'2026-10-29')"
    for (const id of ids) assert.deepEqual((await db.query(query,[id])).rows, [{outlet_name:'Alpha'},{outlet_name:'Beta'}])
    assert.deepEqual((await db.query("select * from employee_delivery_summary($1,'2026-10-30')",[ids[0]])).rows, [{outlet_name:'Another Day'}])
    assert.deepEqual((await db.query("select * from employee_delivery_summary($1,'2026-11-01')",[ids[0]])).rows, [])
    await assert.rejects(db.query(query,[other]), /access is not enabled/)
    await assert.rejects(db.query(query,[null]), /session expired/)
    await assert.rejects(db.query('select * from employee_delivery_summary($1,null)',[ids[0]]), /Choose a delivery date/)
    await db.query('update employees set is_active=false where id=$1',[ids[0]])
    await assert.rejects(db.query(query,[ids[0]]), /session expired/)
    await db.query("update private.employee_cash_advance_sessions set expires_at=now()-interval '1 hour' where employee_id=$1",[ids[1]])
    await assert.rejects(db.query(query,[ids[1]]), /session expired/)
  } finally { await db.close() }
})
