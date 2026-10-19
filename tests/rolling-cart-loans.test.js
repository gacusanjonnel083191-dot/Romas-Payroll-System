import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

const sql=fs.readFileSync(new URL('../supabase/migrations/20261019030000_rolling_cart_loans.sql',import.meta.url),'utf8')
const itemSql=fs.readFileSync(new URL('../supabase/migrations/20261019044500_rolling_cart_additional_items.sql',import.meta.url),'utf8')

test('cart installments are atomic, idempotent, owner-only and reversible',async()=>{
 const db=new PGlite(), owner=randomUUID(), staff=randomUUID(), employee=randomUUID(), reseller=randomUUID()
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table public.admin_users(auth_user_id uuid,role text,is_active boolean);
   insert into public.admin_users values('${owner}','owner',true),('${staff}','manager',true);
   create function public.business_control_has_role(text[]) returns boolean language sql security definer as $$select exists(select 1 from public.admin_users where auth_user_id=auth.uid() and is_active and role=any($1))$$;
   create table public.employees(id uuid primary key);
   create table public.resellers(id uuid primary key);
   create table public.company_document_records(id uuid primary key,form_key text,reseller_id uuid);
   insert into public.employees values('${employee}'); insert into public.resellers values('${reseller}');
   grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
  await db.exec(sql)
  await db.exec(itemSql)
  await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false); set role authenticated;`)
  const create=()=>db.query('select public.create_rolling_cart_loan($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) id',
   ['employee',employee,reseller,'Cart QA-01',null,'2026-10-19',36500,5000,1500,'Weekly','2026-10-26','Signed separately','Cash','DP-01'])
  const loan=(await create()).rows[0].id
  const balance=async()=>Number((await db.query('select balance from public.rolling_cart_loans where id=$1',[loan])).rows[0].balance)
  assert.equal(await balance(),31500)
  const events=async()=> (await db.query('select event_type,amount from public.rolling_cart_payments where loan_id=$1',[loan])).rows
  assert.equal((await events()).length,1)
  const token=randomUUID()
  const pay=(amount,id=token)=>db.query('select public.record_rolling_cart_payment($1,$2,$3,$4,$5,$6,$7) id',[loan,amount,'2026-10-20','GCash','G-01','First installment',id])
  await pay(1500);await pay(1500)
  assert.equal(await balance(),30000);assert.equal((await events()).length,2)
  await assert.rejects(pay(1600),/already used/)
  await assert.rejects(pay(30000.01,randomUUID()),/exceeds outstanding/)
  const paymentId=(await db.query("select id from public.rolling_cart_payments where event_type='payment' and amount=1500")).rows[0].id
  await db.query('select public.reverse_rolling_cart_payment($1,$2)',[paymentId,'Incorrect payment encoded'])
  assert.equal(await balance(),31500);assert.equal((await events()).length,3)
  await assert.rejects(db.query('select public.reverse_rolling_cart_payment($1,$2)',[paymentId,'Duplicate correction']),/already reversed/)
  const chargeToken=randomUUID()
  const add=(category,description,quantity,unitAmount,id=chargeToken)=>db.query(
   'select public.add_rolling_cart_charge($1,$2,$3,$4,$5,$6,$7,$8) id',
   [loan,category,description,'2026-10-21',quantity,unitAmount,'Issued to borrower',id])
  await add('Additional Tray','Tray for rolling cart',2,450)
  await add('Additional Tray','Tray for rolling cart',2,450)
  assert.equal(await balance(),32400,'two trays add 900 to the balance only once')
  assert.equal(Number((await db.query('select total_amount from public.rolling_cart_charges where event_type=$1',['charge'])).rows[0].total_amount),900)
  await assert.rejects(add('Others','',1,100,randomUUID()),/valid item/)
  await assert.rejects(add('Uniform','',0,200,randomUUID()),/valid item/)
  await assert.rejects(add('Uniform','',1,200.001,randomUUID()),/valid item/)
  const chargeId=(await db.query("select id from public.rolling_cart_charges where event_type='charge'")).rows[0].id
  const coveringPayment=(await pay(32000,randomUUID())).rows[0].id
  assert.equal(await balance(),400)
  await assert.rejects(db.query('select public.reverse_rolling_cart_charge($1,$2)',[chargeId,'Incorrect tray charge']),/reconcile payments first/)
  await db.query('select public.reverse_rolling_cart_payment($1,$2)',[coveringPayment,'Incorrect payment entry'])
  await db.query('select public.reverse_rolling_cart_charge($1,$2)',[chargeId,'Incorrect tray charge'])
  assert.equal(await balance(),31500)
  await assert.rejects(db.query('select public.reverse_rolling_cart_charge($1,$2)',[chargeId,'Duplicate correction']),/already reversed/)
  await assert.rejects(db.exec('update public.rolling_cart_loans set balance=0'),/permission denied/)
  await db.exec(`select set_config('request.jwt.claim.sub','${staff}',false);`)
  assert.equal((await db.query('select * from public.rolling_cart_loans')).rows.length,0)
  await assert.rejects(pay(1,randomUUID()),/Owner access required/)
  await assert.rejects(add('Solar Light',null,1,500,randomUUID()),/Owner access required/)
 } finally { await db.close() }
})
