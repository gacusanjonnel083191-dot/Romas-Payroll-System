import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { buildOwnerDailyReceipts } from '../src/ownerDailyReceipts.js'
import { cashVariances, validCashAmount, canReconcile } from '../src/cashHandover.js'

const day='2026-09-20'
const raw = { daily_sales:[{id:'s',sale_date:day,total_walkin:1000,total_messenger:0,cash_received:600,gcash_received:200,other_online_received:100,unpaid_amount:100}], daily_online:[],reseller_payments:[{id:'r',payment_date:day,amount:400,payment_method:'Cash'}],pos_closings:[],outlet_remittances:[],invoices:[{id:'i',delivery_date:day,total_amount:900,paid_amount:0,status:'delivered'}],cash_counts:[],bank_deposits:[{deposit_date:day,amount:200,status:'deposited'},{deposit_date:day,amount:500,status:'pending'}],expenses:[] }
const expenses=[{expense_date:day,status:'approved',payment_method:'cash',paid_date:day,classified_amount:100},{expense_date:day,status:'approved',payment_method:'gcash',paid_date:day,classified_amount:300}]
const migration=fs.readFileSync(new URL('../supabase/migrations/20261005170522_cash_handover_reconciliation.sql',import.meta.url),'utf8')
const owner=randomUUID(), staff=randomUUID()
const schema=`create role anon; create role authenticated; create schema auth; create schema private;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table admin_users(id uuid primary key default gen_random_uuid(),auth_user_id uuid,full_name text,is_active boolean,role text);
insert into admin_users(auth_user_id,full_name,is_active,role) values('${owner}','QA Owner',true,'owner'),('${staff}','QA Staff',true,'manager');
create function public.business_control_has_role(text[]) returns boolean language sql security definer as $$select exists(select 1 from public.admin_users where auth_user_id=auth.uid() and is_active and role=any($1))$$;
create table qa_source(raw jsonb,expenses jsonb);
create function public.owner_daily_receipts(date) returns jsonb language sql security definer as $$select raw from public.qa_source$$;
create function public.owner_cash_expenses_for_day(date) returns jsonb language sql security definer as $$select expenses from public.qa_source$$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`

test('variances use cents, distinguish declaration from count, and accept zero',()=>{
  assert.deepEqual(cashVariances(700,680,675),{collection:-20,counting:-5,final:-25,status:'SHORTAGE'})
  assert.equal(cashVariances(700,690,700).status,'BALANCED')
  assert.equal(cashVariances(700,700,710).status,'OVERAGE')
  assert.equal(cashVariances(0,0,null).status,'AWAITING OWNER COUNT')
  assert.equal(cashVariances(0.3,0.1,0.2).final,-0.1)
  for(const value of ['','-1','1.001','Infinity','NaN','1e3']) assert.equal(validCashAmount(value),false)
  assert.equal(validCashAmount('0'),true)
})

test('Dashboard card uses latest owner revision, preserves zero and excludes superseded counts',()=>{
  const data={...raw,cash_counts:[{reconciliation_date:day,actual_cash:999}],cash_handovers:[{business_date:day,revision:1,owner_physical_count:100},{business_date:day,revision:2,owner_physical_count:0,owner_count_at:'2026-09-20T12:00:00Z'}]}
  assert.equal(buildOwnerDailyReceipts(data,day,expenses).actualCashCount,0)
  data.cash_handovers.push({business_date:day,revision:3,owner_physical_count:null})
  assert.equal(buildOwnerDailyReceipts(data,day,expenses).actualCashCount,null)
})

test('isolated PostgreSQL: calculation parity, append/reload, retries, stale submissions, permissions and immutability',async()=>{
  const db=new PGlite()
  try {
    await db.exec(schema)
    await db.query('insert into qa_source values ($1,$2)',[raw,expenses])
    await db.exec(migration)
    const expected=async(data=raw,ex=expenses)=> (await db.query('select private.cash_handover_expected($1,$2,$3) as n',[day,data,ex])).rows[0].n
    assert.equal(Number(await expected()),700)
    assert.equal(Number(await expected()),buildOwnerDailyReceipts(raw,day,expenses).netRecordedCash)
    const variants=[
      {...raw,daily_online:[{payment_date:day,amount:50,payment_method:'Cash',count_as_revenue:false,receipt_already_counted:false}]},
      {...raw,daily_online:[{payment_date:day,amount:50,payment_method:'GCash',count_as_revenue:false,receipt_already_counted:true}]},
      {...raw,pos_closings:[{business_date:day,outlet_id:'out',cash_sales:200}],daily_sales:[{...raw.daily_sales[0],notes:`SAGS-POS-SHIFT-CLOSING|out|${day}`}]},
      {...raw,outlet_remittances:[{status:'approved',created_at:day+'T02:00:00Z',actual_remitted_amount:300,payment_method:'Cash'}]}
    ]
    for(const data of variants) assert.equal(Number(await expected(data)),buildOwnerDailyReceipts(data,day,expenses).netRecordedCash)
    await assert.rejects(expected({...raw,daily_sales:[{...raw.daily_sales[0],cash_received:null}]}),/Review Daily Sales/)
    await assert.rejects(expected(raw,[{status:'approved',expense_date:day}]),/Review expense/)
    await assert.rejects(expected({...raw,daily_online:[{payment_date:day,amount:10,count_as_revenue:false}]}),/ambiguous/)
    await assert.rejects(expected({...raw,reseller_payments:[{payment_date:day,amount:10,payment_method:''}]}),/unknown/)
    assert.equal(canReconcile(buildOwnerDailyReceipts(raw,day,expenses)),true)
    await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false); set role authenticated;`)
    const save=async(values)=> (await db.query('select public.owner_save_cash_handover($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as id',values)).rows[0].id
    const first=[day,null,'handover',700,680,null,'QA Myra',day+'T10:00:00+08:00',null,randomUUID()]
    const id=await save(first)
    assert.equal(await save(first),id)
    await assert.rejects(save([...first.slice(0,9),randomUUID()]),/History changed/)
    await assert.rejects(save([...first.slice(0,4),681,...first.slice(5)]),/token already/)
    await db.exec('reset role;')
    await db.query('update qa_source set raw=$1',[{...raw,daily_sales:[{...raw.daily_sales[0],cash_received:1200}]}])
    await db.exec('set role authenticated;')
    const count=[day,id,'count',700,680,675,'QA Myra',first[7],'Counted',randomUUID()]
    const counted=await save(count)
    let rows=(await db.query('select * from cash_handover_events order by revision desc')).rows
    assert.equal(rows.length,2);assert.equal(Number(rows[0].collection_variance),-20);assert.equal(Number(rows[0].counting_variance),-5);assert.equal(Number(rows[0].final_variance),-25)
    assert.equal(rows[1].owner_physical_count,null)
    assert.equal(Number(rows[0].system_expected_cash),700, 'owner count preserves the handover snapshot despite later source changes')
    await db.exec('reset role;')
    await db.query('update qa_source set raw=$1',[raw])
    await db.exec('set role authenticated;')
    await assert.rejects(save([day,counted,'handover',700,680,700,'QA Myra',first[7],null,randomUUID()]),/Correction reason/)
    await assert.rejects(save([day,counted,'handover',700,680,675,'QA Myra',first[7],'No change',randomUUID()]),/already recorded/)
    await assert.rejects(save([day,counted,'handover',701,680,700,'QA Myra',first[7],'Wrong expected',randomUUID()]),/Expected cash changed/)
    await save([day,counted,'handover',700,680,700,'QA Myra',first[7],'Recount correction',randomUUID()])
    rows=(await db.query('select * from cash_handover_events order by revision desc')).rows
    assert.equal(rows.length,3); assert.equal(rows[0].previous_id,counted); assert.equal(Number(rows[0].final_variance),0)
    assert.equal(buildOwnerDailyReceipts({...raw,cash_handovers:rows.map(row=>({...row,business_date:day}))},day,expenses).actualCashCount,700)
    await assert.rejects(db.exec('update cash_handover_events set notes=\'changed\''),/permission denied/)
    await assert.rejects(db.exec('delete from cash_handover_events'),/permission denied/)
    await assert.rejects(db.exec(`insert into cash_handover_events(business_date) values ('2026-09-20')`),/permission denied/)
    await db.exec(`select set_config('request.jwt.claim.sub','${staff}',false);`)
    assert.equal((await db.query('select * from cash_handover_events')).rows.length,0)
    await assert.rejects(save([day,null,'handover',700,680,null,'QA Myra',first[7],null,randomUUID()]),/Owner access required/)
    await db.exec('reset role; update admin_users set is_active=false;')
    await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false); set role authenticated;`)
    await assert.rejects(save(first),/Owner access required/)
    await db.exec('reset role; set role anon;')
    await assert.rejects(save(first),/permission denied/)
    await db.exec('reset role;')
    await assert.rejects(db.exec('delete from cash_handover_events'),/immutable/)
  } finally { await db.close() }
})

