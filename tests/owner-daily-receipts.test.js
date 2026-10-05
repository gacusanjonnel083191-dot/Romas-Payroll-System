import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { buildOwnerDailyReceipts, manilaDate } from '../src/ownerDailyReceipts.js'

const date = '2026-10-05'
const at = '2026-10-05T04:00:00Z'

test('daily receipts count actual payment dates and methods without unpaid invoices or duplicate POS sales', () => {
  assert.equal(manilaDate('2026-10-04T17:00:00Z'), date)
  const report = buildOwnerDailyReceipts({
    daily_sales:[
      { id:'manual', sale_date:date, created_at:at, total_walkin:100, total_messenger:50,
        cash_received:80, gcash_received:40, other_online_received:20, unpaid_amount:10 },
      { id:'legacy', sale_date:date, created_at:at, total_walkin:30, total_messenger:0,
        cash_received:null, gcash_received:null, other_online_received:null, unpaid_amount:null },
      { id:'pos', sale_date:date, created_at:at, total_walkin:60, total_messenger:0,
        notes:'SAGS-POS-SHIFT-CLOSING|SAGS|2026-10-05' }
    ],
    pos_closings:[{ id:'shift', business_date:date, created_at:at, outlet_id:'SAGS', total_sales:60,
      cash_sales:30, gcash_sales:20, online_sales:10, actual_cash:35 }],
    daily_online:[
      { id:'online', payment_date:date, created_at:at, amount:15, payment_method:'GCash', count_as_revenue:true, status:'active' },
      { id:'duplicate', payment_date:date, created_at:at, amount:40, payment_method:'GCash', count_as_revenue:false, receipt_already_counted:true, status:'active' },
      { id:'legacy-online', payment_date:date, created_at:at, amount:12, payment_method:'GCash', count_as_revenue:false, receipt_already_counted:null, status:'active' },
      { id:'later-payment', payment_date:date, created_at:at, amount:18, payment_method:'GCash', count_as_revenue:false, receipt_already_counted:false, status:'active' },
      { id:'void', payment_date:date, created_at:at, amount:999, payment_method:'GCash', count_as_revenue:true, status:'void' }
    ],
    reseller_payments:[
      { id:'cash', payment_date:date, created_at:at, reseller_name:'Outlet A', amount:100, payment_method:'Cash' },
      { id:'bank', payment_date:date, created_at:at, reseller_name:'Outlet B', amount:25, payment_method:'Bank Transfer' },
      { id:'later', payment_date:'2026-10-04', created_at:at, reseller_name:'Outlet C', amount:70, payment_method:'Cash' }
    ],
    outlet_remittances:[{ id:'remit', created_at:at, status:'approved', week_end:'2026-10-03',
      total_sales_amount:200, actual_remitted_amount:75, payment_method:'Cash' }],
    invoices:[{ id:'unpaid', created_at:at, delivery_date:date, status:'delivered',
      delivered_at:at, total_amount:500, paid_amount:0 }],
    cash_counts:[{ id:'count', reconciliation_date:date, created_at:at, actual_cash:240 }],
    bank_deposits:[{ id:'deposit', deposit_date:date, amount:50, status:'deposited' }],
    expenses:[{ id:'expense', expense_date:date, amount:15, status:'approved' }]
  }, date)
  assert.deepEqual(report.totals, {
    cash:285, gcash:93, otherOnline:55, unknown:30, unpaid:10, trackingOnly:12, duplicateTracked:40, salesEntered:955, resellerReceived:125, totalReceived:433
  })
  assert.equal(report.deliveredUnpaid,500)
  assert.equal(report.actualCashCount,240)
  assert.equal(report.bankDeposits,50)
  assert.equal(report.approvedExpenses,15)
  assert.ok(report.entered.some(row => row.id === 'reseller-payment-later'))
  assert.ok(!report.receipts.some(row => row.id.startsWith('Reseller payment-later-')))
})

test('daily cash movement deducts only owner-confirmed cash expense payments and deposits', () => {
  const data = {
    reseller_payments:[{ id:'cash', payment_date:date, created_at:at, amount:200, payment_method:'Cash' }],
    bank_deposits:[
      { id:'deposit', deposit_date:date, amount:40, status:'deposited' },
      { id:'pending', deposit_date:date, amount:500, status:'pending' }
    ],
    expenses:[{ id:'today', expense_date:date, amount:90, status:'approved' }]
  }
  const rows = [
    { id:'cash-expense', expense_date:'2026-10-04', amount:30, classified_amount:30, status:'approved', payment_method:'cash', paid_date:date },
    { id:'online-expense', expense_date:date, amount:20, classified_amount:20, status:'approved', payment_method:'gcash', paid_date:date },
    { id:'unknown-expense', expense_date:date, amount:70, status:'approved', payment_method:null, paid_date:null },
    { id:'pending-expense', expense_date:date, amount:60, status:'pending', payment_method:null, paid_date:null }
  ]
  const report = buildOwnerDailyReceipts(data, date, rows)
  assert.equal(report.cashExpensesPaid, 30)
  assert.equal(report.bankDeposits, 40)
  assert.equal(report.netRecordedCash, 130)
  assert.equal(report.cashExpectedComplete, false)
  assert.deepEqual(report.expensesNeedingReview.map(row=>row.id), ['unknown-expense'])
  const reconciled = buildOwnerDailyReceipts(data, date, rows.map(row=>row.id === 'unknown-expense' ? { ...row, payment_method:'unpaid' } : row))
  assert.equal(reconciled.cashExpectedComplete, true)
  assert.equal(reconciled.netRecordedCash, 130)
})

test('owner receipt migration compiles and its RPC denies a non-owner', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql as $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;
      create function public.business_control_has_role(text[]) returns boolean language sql as $$ select false $$;
      create table daily_sales (id uuid default gen_random_uuid(), sale_date date, created_at timestamptz default now(),
        encoded_by text, total_walkin numeric, total_messenger numeric, total_reseller numeric, total_revenue numeric, notes text);
      create table daily_sales_online_payments (id uuid, payment_date date, created_at timestamptz,
        sales_channel text, payment_method text, amount numeric, count_as_revenue boolean, status text,
        customer_name text, reference_number text);
      create table reseller_payments (id uuid, payment_date date, created_at timestamptz,
        reseller_name text, invoice_id uuid, amount numeric, payment_method text, recorded_by text);
      create table pos_shift_closings (id uuid, business_date date, created_at timestamptz,
        outlet_id text, total_sales numeric, cash_sales numeric, gcash_sales numeric, online_sales numeric,
        actual_cash numeric, opening_cash numeric, shift_id text);
      create table outlet_weekly_remittance_reports (id uuid, week_end date, created_at timestamptz,
        reseller_name text, total_sales_amount numeric, actual_remitted_amount numeric, payment_method text, status text);
      create table delivery_invoices (id uuid, invoice_number text, created_at timestamptz,
        delivery_date date, reseller_name text, total_amount numeric, paid_amount numeric, status text, delivered_at timestamptz);
      create table cash_reconciliations (id uuid, reconciliation_date date, created_at timestamptz, actual_cash numeric, submitted_by text);
      create table bank_deposits (id uuid, deposit_date date, created_at timestamptz, amount numeric, bank_name text, status text);
      create table daily_expenses (id uuid primary key, expense_date date, created_at timestamptz, amount numeric, category text, description text, status text);`)
    const migration = new URL('../supabase/migrations/20261005103351_owner_daily_receipts.sql', import.meta.url)
    await db.exec(await readFile(migration, 'utf8'))
    await assert.rejects(db.query('select public.owner_daily_receipts($1)', [date]), /Owner access required/)
    await db.exec('set role anon')
    await assert.rejects(db.query('select public.owner_daily_receipts($1)', [date]), /permission denied/)
    await db.exec('reset role')
    await db.exec('create or replace function public.business_control_has_role(text[]) returns boolean language sql as $$ select true $$')
    const result = await db.query('select public.owner_daily_receipts($1) as report', [date])
    assert.equal(result.rows[0].report.date,date)
    assert.deepEqual(result.rows[0].report.daily_sales,[])
    await db.exec("insert into daily_sales(sale_date,total_walkin,total_messenger,cash_received,gcash_received,other_online_received,unpaid_amount) values ('2026-10-05',100,0,90,10,0,0)")
    await assert.rejects(db.exec("insert into daily_sales(sale_date,total_walkin,total_messenger,cash_received,gcash_received,other_online_received,unpaid_amount) values ('2026-10-05',100,0,100,10,0,0)"), /daily_sales_receipt_split_valid/)
    await db.exec('create or replace function public.business_control_has_role(text[]) returns boolean language sql as $$ select false $$')
    const cashMigration = new URL('../supabase/migrations/20261005115845_owner_expense_cash_tracking.sql', import.meta.url)
    await db.exec(await readFile(cashMigration, 'utf8'))
    await assert.rejects(db.query('select public.owner_cash_expenses_for_day($1)', [date]), /Owner access required/)
    await db.exec('set role anon')
    await assert.rejects(db.query('select public.owner_record_expense_payment($1,$2,$3,$4)', ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cash',date,null]), /permission denied/)
    await db.exec('reset role')
    await db.exec('create or replace function public.business_control_has_role(text[]) returns boolean language sql as $$ select true $$')
    await db.exec("insert into daily_expenses(id,expense_date,created_at,amount,category,status) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-10-04',now(),25,'Fuel','approved')")
    await db.query('select public.owner_record_expense_payment($1,$2,$3,$4)', ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cash',date,null])
    await assert.rejects(db.query('select public.owner_record_expense_payment($1,$2,$3,$4)', ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cash',date,null]), /already recorded/)
    await assert.rejects(db.query('select public.owner_record_expense_payment($1,$2,$3,$4)', ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','unpaid',null,null]), /correction note is required/)
    const paid = await db.query('select public.owner_cash_expenses_for_day($1) as expenses', [date])
    assert.equal(paid.rows[0].expenses[0].payment_method, 'cash')
    assert.equal(Number(paid.rows[0].expenses[0].classified_amount), 25)
    await db.query('select public.owner_record_expense_payment($1,$2,$3,$4)', ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','unpaid',null,'Corrected payment status'])
    const audit = await db.query('select count(*)::int as events from public.owner_expense_payment_events')
    assert.equal(audit.rows[0].events, 2)
  } finally { await db.close() }
})
