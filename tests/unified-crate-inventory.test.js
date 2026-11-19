import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
import {crateRequest,dailyCrateMovements} from '../src/crateInventory.js'
const outlet='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', invoice='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

test('new inventory cycle preserves history; transfers, recounts, permissions and duplicate protection reconcile',async()=>{
 const db=new PGlite()
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;
 create function public.business_control_has_role(roles text[]) returns boolean language sql as $$select coalesce(current_setting('test.role',true),'owner')=any(roles)$$;
 create table public.admin_users(auth_user_id uuid,full_name text);
 insert into public.admin_users values(auth.uid(),'Test owner');
 create table public.resellers(id uuid primary key,reseller_account_id uuid);insert into public.resellers(id) values('${outlet}');
 create table public.delivery_invoices(id uuid primary key,reseller_id uuid,status text);insert into public.delivery_invoices values('${invoice}','${outlet}','paid');
 create table public.crate_movements(id integer);insert into public.crate_movements values(1),(2);
 create table public.crate_physical_counts(id integer);`)
 await db.exec(await readFile(new URL('../supabase/migrations/20261118090000_unified_crate_inventory.sql',import.meta.url),'utf8'))
 await db.exec(await readFile(new URL('../supabase/migrations/20261119030000_mother_account_shared_crate_inventory.sql',import.meta.url),'utf8'))
 const day=(await db.query("select (now() at time zone 'Asia/Manila')::date::text as day")).rows[0].day
 const request=(values)=>crateRequest({day,requestId:randomUUID(),...values})
 const save=async args=>(await db.query('select public.crate_inventory_save($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as result',Object.values(args))).rows[0].result
 const balances=async()=>(await db.query('select location_key,crates,covers,counted from public.crate_inventory_locations order by location_key')).rows
 assert.deepEqual((await balances()).map(x=>[x.crates,x.covers,x.counted]),[[0,0,false],[0,0,false]])
 assert.equal((await db.query('select count(*)::int as n from public.crate_movements')).rows[0].n,2)
 await save(request({action:'count',crates:30,covers:10,notes:'Production physical count'}))
 await save(request({action:'count',resellerId:outlet,crates:8,covers:2,notes:'Outlet physical count'}))
 const pickup=request({action:'collection',resellerId:outlet,crates:4,covers:1,driver:'Driver A',reference:'1',invoiceId:invoice})
 await save(pickup)
 assert.deepEqual((await balances()).map(x=>[x.crates,x.covers]),[[4,1],[34,11]])
 assert.equal((await save(pickup)).duplicate,true)
 await assert.rejects(save({...pickup,p_crates:5}),/different values/)
 await assert.rejects(save({...pickup,p_request_id:randomUUID()}),/already recorded/)
 await assert.rejects(save(request({action:'collection',resellerId:outlet,crates:5,covers:0,driver:'Driver A',reference:'2'})),/exceeds/)
 assert.deepEqual((await balances()).map(x=>[x.crates,x.covers]),[[4,1],[34,11]])
 await save(request({action:'dispatch',resellerId:outlet,crates:6,covers:2,driver:'Dispatcher',reference:'INV-1',invoiceId:invoice}))
 assert.deepEqual((await balances()).map(x=>[x.crates,x.covers]),[[10,3],[28,9]])
 await db.exec("select set_config('test.role','hr',false)")
 const count=request({action:'count',resellerId:outlet,crates:9,covers:3,notes:'Recount sheet'})
 assert.equal((await save(count)).status,'pending')
 assert.equal((await balances())[0].crates,10)
 await assert.rejects(save(request({action:'approve',resellerId:outlet,countEventId:count.p_request_id})),/Owner approval/)
 await save(request({action:'collection',resellerId:outlet,crates:2,covers:1,driver:'Driver A',reference:'2'}))
 await db.exec("select set_config('test.role','owner',false)")
 await save(request({action:'approve',resellerId:outlet,countEventId:count.p_request_id}))
 assert.equal((await balances())[0].crates,7,'approval keeps movements after count submission')
 await assert.rejects(save(request({action:'approve',resellerId:outlet,countEventId:count.p_request_id})),/already reviewed/)
 await db.exec("select set_config('test.role','employee',false)")
 await assert.rejects(save(request({action:'count',crates:100,covers:10,notes:'Unauthorized'})),/access denied/)
 await db.exec('set role anon')
 await assert.rejects(db.query('select * from public.crate_inventory_locations'),/permission denied/)
 await assert.rejects(save(pickup),/permission denied/)
 await db.exec('reset role;set role authenticated')
 await assert.rejects(db.query("update public.crate_inventory_locations set crates=999"),/permission denied/)
 await db.exec('reset role')
 assert.equal((await db.query('select count(*)::int as n from public.crate_movements')).rows[0].n,2)
 // A pickup through another outlet in the same mother account uses shared stock.
 await db.exec("select set_config('test.role','owner',false)")
 const other='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
 const account='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 await db.query('update public.resellers set reseller_account_id=$1 where id=$2',[account,outlet])
 await db.query('insert into public.resellers(id,reseller_account_id) values($1,$2)',[other,account])
 await save(request({action:'collection',resellerId:other,crates:2,driver:'Driver C',reference:'shared-trip-1'}))
 const groupBalance=async()=>(await db.query('select sum(crates)::integer as crates from public.crate_inventory_locations where reseller_id in ($1,$2)',[outlet,other])).rows[0].crates
 assert.equal(await groupBalance(),5,'collection is shared even when this outlet has zero local crates')
 await assert.rejects(save(request({action:'collection',resellerId:outlet,crates:1,driver:'driver c',reference:'SHARED-TRIP-1'})),/already recorded today under this mother account/)
 await assert.rejects(save(request({action:'collection',resellerId:other,crates:6,driver:'Driver C',reference:'shared-trip-2'})),/exceeds the shared mother-account/)
 await save(request({action:'count',resellerId:outlet,crates:9,covers:2,notes:'Shared group physical recount'}))
 assert.equal(await groupBalance(),9,'mother-account count replaces the group balance')
 }finally{await db.close()}
})
test('daily movements show both ends without double counting and ignore count requests',()=>{
 const events=[{location_key:outlet,action:'collection',business_date:'2026-11-18',crates:4,covers:2},{location_key:outlet,action:'dispatch',business_date:'2026-11-18',crates:6,covers:1},{location_key:outlet,action:'count',business_date:'2026-11-18',crates:99,covers:99}]
 assert.deepEqual(dailyCrateMovements(events,outlet,'2026-11-18'),{sent:[4,2],received:[6,1]})
 assert.deepEqual(dailyCrateMovements(events,'production','2026-11-18'),{sent:[6,1],received:[4,2]})
 assert.deepEqual(dailyCrateMovements(events,outlet,'2026-11-17'),{sent:[0,0],received:[0,0]})
 assert.throws(()=>crateRequest({crates:1.5}),/whole quantities/)
})
