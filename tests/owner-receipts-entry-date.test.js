import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
import {buildOwnerDailyReceipts} from '../src/ownerDailyReceipts.js'
const day='2026-11-18'
const data={daily_sales:[{id:'linked',sale_date:'2026-11-17',created_at:'2026-11-18T06:22:05Z',total_walkin:2009.79,notes:'SAGS-POS-SHIFT-CLOSING|OUTLET-MALUED|2026-11-17'}],pos_closings:[
{id:'original',shift_id:'old-shift',business_date:'2026-11-17',created_at:'2026-11-17T09:25:23Z',cash_sales:2009.79,outlet_id:'OUTLET-MALUED'},
{id:'admin',shift_id:null,business_date:'2026-11-17',created_at:'2026-11-18T06:22:05Z',cash_sales:2009.79,total_sales:2009.79,outlet_id:'OUTLET-MALUED',verified_by:'Myra Romero'},
{id:'new-shift',shift_id:'new-shift',business_date:day,created_at:'2026-11-18T09:27:04Z',cash_sales:2068.10,total_sales:2068.10,outlet_id:'OUTLET-MALUED'}],daily_online:[],reseller_payments:[],outlet_remittances:[],bank_deposits:[]}
test('November 17 admin entry on November 18 replaces automatic shift totals, once only',()=>{
 const r=buildOwnerDailyReceipts(data,day)
 assert.equal(r.totals.cash,2009.79)
 assert.equal(r.totals.salesEntered,2009.79)
 assert.equal(r.receipts.length,1)
 assert.equal(r.receipts[0].businessDate,'2026-11-17')
 assert.equal(r.receipts[0].recordedBy,'Myra Romero')
 assert.equal(buildOwnerDailyReceipts(data,'2026-11-17').totals.cash,0)
 assert.equal(buildOwnerDailyReceipts(data,'2026-11-19').totals.cash,0)
})
test('entry date uses Manila midnight and never moves a record on later edits',()=>{
 const payments=[['before','2026-11-17T15:59:59Z'],['start','2026-11-17T16:00:00Z'],['end','2026-11-18T15:59:59Z'],['after','2026-11-18T16:00:00Z']].map(([id,created_at])=>({id,created_at,updated_at:'2026-11-19T06:00:00Z',payment_date:'2026-11-01',amount:10,payment_method:'Cash'}))
 const r=buildOwnerDailyReceipts({reseller_payments:payments},day)
 assert.equal(r.totals.cash,20)
 assert.deepEqual(r.receipts.map(x=>x.recordId).sort(),['end','start'])
 assert.ok(r.receipts.every(x=>x.businessDate==='2026-11-01'))
})
test('server cash handover matches the entry-date report for the real discrepancy',async()=>{
 const db=new PGlite()
 try{
 await db.exec('create schema private; create role anon; create role authenticated;')
 const sql=readFileSync(new URL('../supabase/migrations/20261119020000_owner_receipts_entry_date.sql',import.meta.url),'utf8')
 await db.exec(sql.slice(sql.indexOf('create or replace function private.cash_handover_expected')))
 for(const selected of ['2026-11-17',day,'2026-11-19']){
 const result=await db.query('select private.cash_handover_expected($1,$2,$3) n',[selected,data,[]])
 assert.equal(Number(result.rows[0].n),buildOwnerDailyReceipts(data,selected).netRecordedCash)
 }
 }finally{await db.close()}
})
