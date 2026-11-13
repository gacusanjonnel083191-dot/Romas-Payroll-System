import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const sql=fs.readFileSync(new URL('../supabase/migrations/20261113023100_payroll_expense_source_unique.sql',import.meta.url),'utf8')
const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')

test('legacy expense rows survive while new payroll postings are unique per cutoff',async()=>{
  const db=new PGlite()
  try {
    await db.exec(`create table public.daily_expenses(id uuid primary key default gen_random_uuid(),category text,description text,amount numeric);
      insert into public.daily_expenses(category,description,amount) values
        ('Payroll Expense','PAYROLL:2026-06-26|2026-07-10 legacy first',100),
        ('Payroll Expense','PAYROLL:2026-06-26|2026-07-10 legacy duplicate',100);`)
    await db.exec(sql)
    assert.equal((await db.query('select count(*)::int as n from public.daily_expenses')).rows[0].n,2)
    await db.exec(`insert into public.daily_expenses(category,description,amount,payroll_start,payroll_end)
      values('Payroll Expense','PAYROLL:2026-10-26|2026-11-10',100,'2026-10-26','2026-11-10')`)
    await assert.rejects(db.exec(`insert into public.daily_expenses(category,description,amount,payroll_start,payroll_end)
      values('Payroll Expense','PAYROLL:2026-10-26|2026-11-10 again',100,'2026-10-26','2026-11-10')`),/duplicate key/)
    assert.equal((await db.query('select count(*)::int as n from public.daily_expenses')).rows[0].n,3)
  } finally { await db.close() }
})

test('expense posting fails closed on lookup error, duplicates, and mismatched amount',()=>{
  const posting=app.slice(app.indexOf('async function postPayrollToExpenses('),app.indexOf('async function handleManualPayrollExpensePost('))
  assert.match(posting,/if \(existing\.error\) return/)
  assert.match(posting,/if \(existing\.duplicate\) return/)
  assert.match(posting,/existing\.record\?\.amount\)!==moneyRound\(amount\)/)
  assert.match(posting,/payroll_start:start/)
  assert.match(posting,/payroll_end:end/)
})
