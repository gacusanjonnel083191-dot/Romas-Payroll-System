// Run against an isolated PostgreSQL WASM engine, never the connected database:
// PGLITE_MODULE_PATH=/absolute/path/to/@electric-sql/pglite/dist/index.js node --test tests/cash-advance-database.test.js
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ? pathToFileURL(process.env.PGLITE_MODULE_PATH).href : '@electric-sql/pglite')
const db = new PGlite()
after(async()=>db.close())
const migration=fs.readFileSync(new URL('../supabase/migrations/20260913230212_cash_advance_integrity.sql',import.meta.url),'utf8')
const separationMigration=fs.readFileSync(new URL('../supabase/migrations/20260914003820_employee_separation_cash_advance_safeguards.sql',import.meta.url),'utf8')
await db.exec(fs.readFileSync(new URL('fixtures/cash-advance-schema.sql',import.meta.url),'utf8'))
await db.exec(migration)
await db.exec(separationMigration)
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`
const admin=id(1), employee=id(2), loan=id(3), pay=id(4)
const start='2026-09-11',end='2026-09-25'
async function query(sql,args=[]){return (await db.query(sql,args)).rows}
async function reset(){
  await db.exec(`reset role; truncate private.ca_final_pay_allocations,private.ca_payroll_allocations,private.ca_payroll_batches,private.ca_integrity_events,public.final_pay_records,public.cash_advances,public.employees,public.payroll_records,public.payroll_periods,public.daily_expenses,public.time_adjustment_requests,public.audit_logs,public.admin_users;
    update private.ca_integrity_control set release_hold=false,reconciled_at=null;`)
  await db.query('insert into public.admin_users(id,auth_user_id,full_name,role,is_active) values($1,$1,$2,$3,true)',[admin,'Test Owner','owner'])
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin])
  await db.query('insert into public.employees(id,employee_code,full_name,is_active,daily_rate) values($1,$2,$3,true,500)',[employee,'EMP-001','Test Employee'])
  await db.query(`insert into public.cash_advances(id,employee_id,amount,amount_paid,balance,status,advance_date,created_at,per_payroll_deduction,installments_total,installments_remaining)
    values($1,$2,5000,0,5000,'Unpaid','2026-09-11','2026-09-11',1000,5,5)`,[loan,employee])
  await db.query(`insert into public.payroll_records(id,employee_id,payroll_start,payroll_end,cash_advance_deduction,cash_advance_breakdown,created_at,review_sent_at,payroll_status,employee_acknowledgement,total_earnings,total_deductions,payroll_approved,payroll_released,payroll_locked)
    values($1,$2,$3,$4,1000,$5,'2026-09-26','2026-09-26','review','acknowledged',5000,1000,false,false,false)`,[pay,employee,start,end,JSON.stringify([{id:loan,amount:1000}])])
  await db.query('insert into public.payroll_periods(id,payroll_start,payroll_end,payroll_status) values(1,$1,$2,$3)',[start,end,'review'])
}
async function command(action='release'){
  await db.exec('set role authenticated')
  try{return (await query('select public.cash_advance_payroll_command($1,$2,$3) result',[action,start,end]))[0].result}
  finally{await db.exec('reset role')}
}
async function loanState(){const row=(await query('select amount_paid,balance,status from public.cash_advances where id=$1',[loan]))[0]; return {...row,amount_paid:String(Number(row.amount_paid)),balance:String(Number(row.balance))}}
async function browser(sql,args=[]){await db.exec('set role authenticated');try{return await db.query(sql,args)}finally{await db.exec('reset role')}}
async function separate(options={}){
  await db.exec('set role authenticated')
  try {
    return (await query(`select public.employee_separation_command(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
    ) result`,[
      employee,options.reason||'resigned',options.lastDate||'2026-09-30',options.lastSalary??1200,
      options.proRated13th??0,options.silPay??0,options.separationPay??0,options.settle??false,
      options.authorizationReference??null,options.receivableNote??null
    ]))[0].result
  } finally { await db.exec('reset role') }
}

test('migration is idempotent and starts under reconciliation hold',async()=>{
  await db.exec(migration)
  await db.exec(separationMigration)
  assert.equal((await query('select release_hold from private.ca_integrity_control'))[0].release_hold,true)
})
test('null command cannot fall through into reopening',async()=>{
  await reset();await command()
  await assert.rejects(command(null),/Invalid cash-advance payroll command/)
  assert.equal((await loanState()).amount_paid,'1000')
})
test('release, repeat release, reopen and re-release reconcile exact loan allocations',async()=>{
  await reset()
  assert.equal((await command()).amount,1000)
  assert.deepEqual(await loanState(),{amount_paid:'1000',balance:'4000',status:'Unpaid'})
  assert.equal((await command()).existing,true)
  assert.equal((await loanState()).amount_paid,'1000')
  assert.equal((await command('reopen')).amount,1000)
  assert.equal((await command('reopen')).existing,true)
  assert.deepEqual(await loanState(),{amount_paid:'0',balance:'5000',status:'Unpaid'})
  const state=(await query('select payroll_approved,payroll_released,payroll_locked,approved_at,released_at,payroll_status from public.payroll_records'))[0]
  assert.deepEqual(state,{payroll_approved:false,payroll_released:false,payroll_locked:false,approved_at:null,released_at:null,payroll_status:'draft'})
  await db.exec("update public.payroll_records set payroll_status='review',employee_acknowledgement='acknowledged',review_sent_at=now()")
  assert.equal((await command()).amount,1000)
  assert.equal((await loanState()).balance,'4000')
  assert.equal((await query('select count(*)::int n from private.ca_payroll_allocations'))[0].n,2)
})
test('an error after balance updates rolls back loans, payroll state, receipts and audit together',async()=>{
  await reset()
  await db.exec("update public.payroll_records set cash_advance_deduction=1500")
  await assert.rejects(command(),/snapshot total/)
  assert.equal((await loanState()).amount_paid,'0')
  assert.equal((await query('select count(*)::int n from private.ca_payroll_batches'))[0].n,0)
  assert.equal((await query('select count(*)::int n from private.ca_payroll_allocations'))[0].n,0)
  assert.equal((await query('select payroll_released from public.payroll_records'))[0].payroll_released,false)
})
test('failed audit insertion rolls back the entire release',async()=>{
  await reset()
  await db.exec("alter table public.audit_logs add constraint test_audit_failure check(action<>'CA PAYROLL DEDUCTIONS APPLIED')")
  await assert.rejects(command(),/test_audit_failure/)
  assert.equal((await loanState()).amount_paid,'0')
  assert.equal((await query('select payroll_released from public.payroll_records'))[0].payroll_released,false)
  await db.exec('alter table public.audit_logs drop constraint test_audit_failure')
  assert.equal((await command()).amount,1000)
})
test('legacy released period cannot replay or guess a reversal',async()=>{
  await reset()
  await db.exec("update public.payroll_records set payroll_status='released'")
  await db.exec(migration)
  assert.equal((await command()).existing,true)
  assert.equal((await loanState()).amount_paid,'0')
  await assert.rejects(command('reopen'),/Historical payroll/)
})
test('future advance, wrong employee and over-installment snapshot all block release',async()=>{
  await reset()
  await db.exec("update public.cash_advances set advance_date='2026-09-26'")
  await assert.rejects(command(),/eligible loan/)
  await db.exec("update public.cash_advances set advance_date='2026-09-11'")
  await db.query('update public.cash_advances set employee_id=$1',[id(8)])
  await assert.rejects(command(),/eligible loan/)
  await db.query('update public.cash_advances set employee_id=$1,per_payroll_deduction=500',[employee])
  await assert.rejects(command(),/installment changed/)
})
test('duplicate snapshot ID is rejected without any partial repayment',async()=>{
  await reset()
  await db.query('update public.payroll_records set cash_advance_deduction=2000,cash_advance_breakdown=$1',[JSON.stringify([{id:loan,amount:1000},{id:loan,amount:1000}])])
  await assert.rejects(command(),/duplicate key/)
  assert.equal((await loanState()).balance,'5000')
})
test('hold and stale draft after reconciliation both prevent release',async()=>{
  await reset()
  await db.exec('update private.ca_integrity_control set release_hold=true')
  await assert.rejects(command(),/reconciliation is required/)
  await db.exec("update private.ca_integrity_control set release_hold=false,reconciled_at='2026-09-27'")
  await assert.rejects(command(),/Rebuild this draft/)
})
test('old browser balance writes and direct payroll release are blocked',async()=>{
  await reset()
  await assert.rejects(browser("update public.cash_advances set amount_paid=5000,balance=0,status='Paid'"),/Direct repayment changes/)
  await assert.rejects(browser("update public.payroll_records set payroll_status='released'"),/verified payroll/)
  assert.equal((await loanState()).balance,'5000')
})
test('owner can edit an unpaid installment plan; payroll cannot change the plan',async()=>{
  await reset()
  await browser('update public.cash_advances set per_payroll_deduction=500,installments_total=10,installments_remaining=10')
  await db.exec("update public.admin_users set role='payroll'")
  await assert.rejects(browser('update public.cash_advances set per_payroll_deduction=1000'),/Owner access/)
})
test('payroll role may release; HR, reseller, employee and inactive admin may not',async()=>{
  await reset()
  for(const role of ['hr','reseller','employee']){
    await db.query('update public.admin_users set role=$1',[role])
    await assert.rejects(command(),/Owner or payroll access/)
  }
  await db.exec("update public.admin_users set role='payroll',is_active=false")
  await assert.rejects(command(),/Owner or payroll access/)
  await db.exec('update public.admin_users set is_active=true')
  assert.equal((await command()).amount,1000)
})
test('anonymous caller cannot invoke settlement or read private receipts',async()=>{
  await reset()
  await db.exec('set role anon')
  try{
    await assert.rejects(db.query('select public.cash_advance_payroll_command($1,$2,$3)',['release',start,end]),/permission denied/)
    await assert.rejects(db.query('select * from private.ca_payroll_allocations'),/permission denied/)
  }finally{await db.exec('reset role')}
})
test('reopen reverses the exact original loan even after another loan is created',async()=>{
  await reset(); await command()
  await db.query("insert into public.cash_advances(id,employee_id,amount,amount_paid,balance,status,advance_date,created_at) values($1,$2,2000,500,1500,'Unpaid','2026-09-28','2026-09-28')",[id(9),employee])
  await command('reopen')
  assert.equal((await loanState()).amount_paid,'0')
  assert.equal((await query('select amount_paid from public.cash_advances where id=$1',[id(9)]))[0].amount_paid,'500')
})
test('posted expenses block reopening, with no repayment change',async()=>{
  await reset();await command()
  await db.query("insert into public.daily_expenses(id,category,description) values($1,'Payroll Expense',$2)",[id(10),`PAYROLL:${start}|${end} | Test expense`])
  await assert.rejects(command('reopen'),/posted to expenses/)
  assert.equal((await loanState()).amount_paid,'1000')
})

test('direct deactivation is blocked when a cash advance remains outstanding',async()=>{
  await reset()
  await assert.rejects(browser('update public.employees set is_active=false where id=$1',[employee]),/outstanding cash advance/)
  assert.equal((await query('select is_active from public.employees where id=$1',[employee]))[0].is_active,true)
})

test('final-pay separation requires documented receivable handling when debt remains',async()=>{
  await reset()
  await assert.rejects(separate(),/former-employee receivable note/)
  assert.equal((await query('select count(*)::int n from public.final_pay_records'))[0].n,0)
  assert.equal((await query('select is_active from public.employees where id=$1',[employee]))[0].is_active,true)
  assert.equal((await loanState()).balance,'5000')
})

test('written-authorized final pay settlement applies only available final pay and leaves an exact receivable',async()=>{
  await reset()
  const result=await separate({settle:true,authorizationReference:'CA Agreement RD-001',receivableNote:'Collection owner: Payroll; follow up after separation.'})
  assert.deepEqual(result,{ok:true,final_pay_record_id:1,gross_final_pay:1200,cash_advance_deduction:1200,former_employee_receivable:3800,total_final_pay:0})
  assert.equal((await query('select is_active from public.employees where id=$1',[employee]))[0].is_active,false)
  assert.deepEqual(await loanState(),{amount_paid:'1200',balance:'3800',status:'Unpaid'})
  assert.deepEqual((await query('select cash_advance_deduction,total_final_pay from public.final_pay_records'))[0],{cash_advance_deduction:'1200.00',total_final_pay:'0.00'})
  assert.deepEqual((await query('select amount,authorization_reference from private.ca_final_pay_allocations'))[0],{amount:'1200.00',authorization_reference:'CA Agreement RD-001'})
})

test('no-authorization separation preserves the debt as a documented former-employee receivable',async()=>{
  await reset()
  const result=await separate({receivableNote:'Collection owner: Owner; employee will settle outside final pay.'})
  assert.equal(result.cash_advance_deduction,0)
  assert.equal(result.former_employee_receivable,5000)
  assert.equal(result.total_final_pay,1200)
  assert.equal((await loanState()).balance,'5000')
  assert.equal((await query('select count(*)::int n from private.ca_final_pay_allocations'))[0].n,0)
})

test('a failed final-pay audit rolls back settlement, final pay, and deactivation together',async()=>{
  await reset()
  await db.exec("alter table public.audit_logs add constraint final_pay_audit_failure check(action<>'FINAL PAY PROCESSED')")
  await assert.rejects(separate({settle:true,authorizationReference:'CA Agreement RD-001',receivableNote:'Collection owner: Payroll.'}),/final_pay_audit_failure/)
  assert.equal((await loanState()).balance,'5000')
  assert.equal((await query('select is_active from public.employees where id=$1',[employee]))[0].is_active,true)
  assert.equal((await query('select count(*)::int n from public.final_pay_records'))[0].n,0)
  await db.exec('alter table public.audit_logs drop constraint final_pay_audit_failure')
})
