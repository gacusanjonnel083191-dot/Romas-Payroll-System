// Run with PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node tests/reseller-auto-order.mjs
// Isolated synthetic database. Cron's extension and scheduler are stubbed; business SQL runs unchanged.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create schema cron;
create table cron.job(jobid bigint generated always as identity,jobname text,schedule text,command text);
create function cron.schedule(text,text,text) returns bigint language sql as $$ insert into cron.job(jobname,schedule,command) values ($1,$2,$3) returning jobid $$;
create function cron.unschedule(bigint) returns boolean language sql as $$ delete from cron.job where jobid=$1 returning true $$;
create table admin_users(auth_user_id uuid,full_name text,role text,extra_roles text,is_active boolean,id uuid default gen_random_uuid());
create table invoice_deletion_requesters(admin_user_id uuid,is_active boolean);
create table reseller_accounts(id uuid primary key,access_code text,access_pin text,is_active boolean);
create table resellers(id uuid primary key,name text,reseller_account_id uuid,access_code text,access_pin text,is_active boolean);
create table donut_variants(id uuid primary key,name text,selling_price numeric,is_active boolean);
create table delivery_invoices(id uuid primary key default gen_random_uuid(),invoice_number text unique,reseller_id uuid,reseller_name text,delivery_date date,due_date date,subtotal numeric,discount_pct numeric,total_amount numeric,paid_amount numeric default 0,returns_amount numeric default 0,status text,prepared_by text,dispatched_by text,notes text,created_by text);
create table delivery_invoice_items(id uuid primary key default gen_random_uuid(),invoice_id uuid references delivery_invoices,variant_id uuid,variant_name text,retail_price numeric,reseller_price numeric,quantity integer,total_price numeric);
create table reseller_orders(id uuid primary key default gen_random_uuid(),reseller_id uuid,reseller_name text,order_date date,delivery_date date,status text,notes text,total_qty integer,estimated_amount numeric,approved_by text,approved_at timestamptz,invoice_id uuid,created_at timestamptz default now());
create table reseller_order_items(id uuid primary key default gen_random_uuid(),order_id uuid references reseller_orders on delete cascade,variant_id uuid,variant_name text,quantity integer,retail_price numeric,reseller_price numeric);
create table reseller_returns(id uuid primary key default gen_random_uuid(),invoice_id uuid,reseller_id uuid);
create table reseller_return_items(id uuid primary key default gen_random_uuid(),return_id uuid,variant_id uuid,returned_quantity integer);
`)
const migration = readFileSync(new URL('../supabase/migrations/20260909050000_reseller_automatic_ordering.sql',import.meta.url),'utf8')
const testSql = migration.replace('create extension if not exists pg_cron with schema pg_catalog;','')
await db.exec(testSql)
await db.exec(testSql) // migration must be rerunnable
assert.equal((await db.query('select * from cron.job')).rows.length,1)
assert.equal((await db.query('select schedule from cron.job')).rows[0].schedule,'0 5 * * *')
const rid='00000000-0000-0000-0000-000000000001', vid='00000000-0000-0000-0000-000000000002', uid='00000000-0000-0000-0000-000000000003'
await db.query("insert into resellers values ($1,'Test Reseller',null,'TEST','1234',true)",[rid])
await db.query("insert into donut_variants values ($1,'Test Donut',6,true)",[vid])
await db.query("insert into admin_users(auth_user_id,full_name,role,extra_roles,is_active) values ($1,'Test Staff','manager','',true)",[uid])
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid])
const one=async(sql,args=[]) => (await db.query(sql,args)).rows[0]
await db.exec("update admin_users set role='hr'")
assert.equal((await one('select private.is_reseller_order_admin() ok')).ok,true)
await db.exec("update admin_users set role='payroll'")
assert.equal((await one('select private.is_reseller_order_admin() ok')).ok,false)
await db.exec('insert into invoice_deletion_requesters select id,true from admin_users')
assert.equal((await one('select private.is_reseller_order_admin() ok')).ok,true)
await db.exec("update admin_users set role='manager'")
assert.equal((await one("select private.verify_reseller_portal_credentials($1,'','') ok",[rid])).ok,false)
await assert.rejects(db.query("select public.reseller_auto_order_get($1,'TEST','WRONG')",[rid]),/credentials/)
await db.query("insert into reseller_auto_order_settings(reseller_id,enabled,notify_on_approved) values ($1,true,false)",[rid])
const {id:sid}=await one("insert into reseller_auto_order_schedules(reseller_id,delivery_weekday,template_name,effective_start_date) values ($1,6,'Saturday','2026-01-01') returning id",[rid])
await db.query("insert into reseller_auto_order_template_items(schedule_id,variant_id,variant_name,template_quantity,minimum_quantity,maximum_quantity) values ($1,$2,'Test Donut',100,0,120)",[sid,vid])
// Four Saturdays: 100 delivered, 20 returned -> 80 sold; +10% -> 88 pieces.
for (const date of ['2026-08-15','2026-08-22','2026-08-29','2026-09-05']) {
 const inv=await one("insert into delivery_invoices(reseller_id,delivery_date,total_amount,status) values ($1,$2,384,'paid') returning id",[rid,date])
 await db.query("insert into delivery_invoice_items(invoice_id,variant_id,quantity) values ($1,$2,100)",[inv.id,vid])
 const ret=await one('insert into reseller_returns(invoice_id,reseller_id) values ($1,$2) returning id',[inv.id,rid])
 await db.query('insert into reseller_return_items(return_id,variant_id,returned_quantity) values ($1,$2,20)',[ret.id,vid])
}
assert.equal((await one("select private.generate_reseller_auto_orders('2026-09-11 04:59:59+00') result")).result.reason,'before_cutoff')
let run=(await one("select private.generate_reseller_auto_orders('2026-09-11 05:00:00+00') result")).result
assert.equal(run.generated_count,1)
const order=await one("select * from reseller_orders where order_source='automatic'")
const item=await one('select * from reseller_order_items where order_id=$1',[order.id])
await db.exec('grant select,insert,update,delete on reseller_orders,reseller_order_items to anon; set role anon;')
await assert.rejects(db.query("update reseller_orders set status='approved' where id=$1",[order.id]),/staff review/)
await assert.rejects(db.query('update reseller_order_items set quantity=999 where id=$1',[item.id]),/staff review/)
await assert.rejects(db.query('select * from reseller_auto_order_settings'),/permission denied/)
assert.equal((await one("select public.reseller_auto_order_get($1,'TEST','1234') result",[rid])).result.settings.enabled,true)
await db.exec('reset role')
assert.equal(item.quantity,88); assert.equal(Number(item.average_ordered_quantity),100); assert.equal(Number(item.average_sold_quantity),80); assert.equal(Number(item.average_returned_quantity),20)
const removed=await one("insert into reseller_order_items(order_id,variant_id,variant_name,quantity,retail_price,suggested_quantity) values ($1,gen_random_uuid(),'Zeroed Product',10,6,10) returning id",[order.id])
run=(await one("select private.generate_reseller_auto_orders('2026-09-11 05:00:01+00') result")).result
assert.equal(run.generated_count,0)
assert.equal((await one('select count(*)::int n from reseller_orders')).n,1)
// A changed quantity without a reason must roll back every write.
const items=JSON.stringify([{id:item.id,quantity:50},{id:removed.id,quantity:0}])
await assert.rejects(db.query("select public.reseller_auto_order_review($1,'approve',$2::jsonb,null)",[order.id,items]),/Explain/)
assert.equal((await one('select quantity from reseller_order_items where id=$1',[item.id])).quantity,88)
await db.query("select public.reseller_auto_order_review($1,'hold','[]','Awaiting staff review')",[order.id])
assert.equal((await one('select status from reseller_orders where id=$1',[order.id])).status,'on_hold')
// Force an invoice-line failure: no order, total, or partial invoice may survive.
await db.exec("alter table delivery_invoice_items add constraint fixture_failure check(quantity<>50)")
await assert.rejects(db.query("select public.reseller_auto_order_review($1,'approve',$2::jsonb,'School event ended')",[order.id,items]),/fixture_failure/)
assert.equal((await one('select quantity from reseller_order_items where id=$1',[item.id])).quantity,88)
assert.equal((await one("select count(*)::int n from delivery_invoices where delivery_date='2026-09-12'")).n,0)
await db.exec('alter table delivery_invoice_items drop constraint fixture_failure')
const approved=(await one("select public.reseller_auto_order_review($1,'approve',$2::jsonb,'School event ended') result",[order.id,items])).result
assert.equal(approved.total_qty,50); assert.equal(Number(approved.total_amount),240)
assert.equal((await one('select quantity from reseller_order_items where id=$1',[removed.id])).quantity,0)
assert.equal((await one('select count(*)::int n from delivery_invoice_items where invoice_id=$1',[approved.invoice_id])).n,1)
assert.equal((await one("select notify_reseller from reseller_auto_order_events where event_type='approved'")).notify_reseller,false)
await assert.rejects(db.query("select public.reseller_auto_order_review($1,'approve',$2::jsonb,'Retry')",[order.id,items]),/already been reviewed/)
assert.equal((await one("select count(*)::int n from delivery_invoices where delivery_date='2026-09-12'")).n,1)
await db.query("select set_config('request.jwt.claim.sub','',false)")
await assert.rejects(db.query("select public.reseller_auto_order_review($1,'reject','[]','Unauthorized')",[order.id]),/authorized/)
// Future runs: disabled, skipped, manual duplicate, and overdue account.
await db.query('update reseller_auto_order_settings set enabled=false where reseller_id=$1',[rid])
assert.equal((await one("select private.generate_reseller_auto_orders('2026-09-18 05:00+00') result")).result.generated_count,0)
await db.query('update reseller_auto_order_settings set enabled=true where reseller_id=$1',[rid])
await db.query("insert into reseller_auto_order_skips(reseller_id,schedule_id,skip_date) values($1,$2,'2026-09-19')",[rid,sid])
assert.equal((await one("select private.generate_reseller_auto_orders('2026-09-18 05:00+00') result")).result.skipped_count,1)
await db.query("insert into reseller_orders(reseller_id,delivery_date,status) values ($1,'2026-09-26','pending')",[rid])
assert.equal((await one("select private.generate_reseller_auto_orders('2026-09-25 05:00+00') result")).result.generated_count,0)
await db.query("insert into delivery_invoices(reseller_id,delivery_date,due_date,total_amount,paid_amount,returns_amount,status) values ($1,'2026-09-01','2026-09-08',100,80,50,'partial')",[rid])
assert.equal((await one("select private.generate_reseller_auto_orders('2026-10-02 05:00+00') result")).result.generated_count,0)
assert.equal((await one("select details->>'reason' reason from reseller_auto_order_runs where delivery_date='2026-10-03'")).reason,'overdue_account')
await db.close()
// Test the actual app helpers with the Philippines boundary, independent of host timezone.
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
function extract(name) {
 const start=app.indexOf('function '+name+'(')
 let end=app.indexOf('\n}',start)
 return app.slice(start,end+2)
}
const context=vm.createContext({Intl,Date})
vm.runInContext("const PH_TIME_ZONE='Asia/Manila',ORDER_CUTOFF_TIME='13:00',ORDER_CUTOFF_LABEL='1:00 PM';\n"+['safeNum','formatDateLocal','minutesFromTime','getPHDateTimeParts','getPHDateOffsetString','getOrderCutoffStatus','getDefaultResellerOrderDeliveryDate'].map(extract).join('\n'),context)
for (const [time,locked,next] of [['2026-09-11T04:59:59Z',false,'2026-09-12'],['2026-09-11T05:00:00Z',true,'2026-09-13'],['2026-09-11T16:00:00Z',false,'2026-09-13']]) {
 assert.equal(vm.runInContext(`getOrderCutoffStatus(null,new Date('${time}')).locked`,context),locked)
 assert.equal(vm.runInContext(`getDefaultResellerOrderDeliveryDate(new Date('${time}'))`,context),next)
}
console.log('PASS: rerunnable migration; cron schedule; credential checks; sales/returns formula; cutoff; duplicate prevention; atomic approval rollback; hold; reason required; notification preferences; disabled/skip/overdue rules; Philippine date boundary.')
