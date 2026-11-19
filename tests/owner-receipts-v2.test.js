import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
import {buildOwnerDailyReceipts,supportsReceiptBasis,ownerReceiptBreakdown} from '../src/ownerDailyReceipts.js'
const day='2026-11-19', stamp=day+'T02:00:00Z'
const raw={receipt_basis:'entry_date_v2_myra_cash',daily_sales:[
 {id:'direct',sale_date:day,created_at:stamp,total_walkin:100,cash_received:60,gcash_received:30,other_online_received:10,unpaid_amount:0},
 {id:'linked',sale_date:day,created_at:stamp,total_walkin:1000,cash_received:900,gcash_received:80,other_online_received:20,unpaid_amount:0,notes:'SAGS-POS-SHIFT-CLOSING|OUTLET-MALUED|2026-11-19'}
],pos_closings:[{id:'summary',outlet_id:'OUTLET-MALUED',business_date:day,created_at:stamp,shift_id:null,total_sales:1000,cash_sales:900,gcash_sales:80,online_sales:20}],
 pos_cash_receipts:[{id:'receipt',outlet_id:'OUTLET-MALUED',business_date:'2026-11-18',received_at:stamp,created_at:'2026-11-20T02:00:00Z',actual_received:850,received_by:'QA receiver'}],pos_pending_receipts:[{id:'pending'}],
 daily_online:[],reseller_payments:[{id:'payment',created_at:stamp,payment_date:'2026-11-18',amount:200,payment_method:'Cash'}],outlet_remittances:[],bank_deposits:[{deposit_date:day,amount:100,status:'deposited'}]}
const expenses=[{status:'approved',expense_date:day,paid_date:day,payment_method:'cash',classified_amount:50}]
test('supports deployed report contracts but rejects unknown versions',()=>{
 assert.equal(supportsReceiptBasis('entry_date_v1'),true)
 assert.equal(supportsReceiptBasis(raw.receipt_basis),true)
 for(const basis of [undefined,'','entry_date_v3'])assert.equal(supportsReceiptBasis(basis),false)
})
test('v2 counts received cash once; keeps sales and online totals separate',()=>{
 const r=buildOwnerDailyReceipts(raw,day,expenses)
 assert.equal(r.totals.cash,1110)
 assert.equal(r.netRecordedCash,960)
 assert.equal(r.totals.gcash,110)
 assert.equal(r.totals.otherOnline,30)
 assert.equal(r.totals.salesEntered,1100)
 assert.equal(r.pendingPosReceipts.length,1)
 const receipt=r.receipts.find(x=>x.source==='POS cash received')
 assert.equal(receipt.recordedBy,'QA receiver')
 assert.equal(receipt.businessDate,'2026-11-18')
 assert.equal(receipt.enteredAt,stamp)
 assert.equal(ownerReceiptBreakdown(r,'cash').reduce((s,x)=>s+x.amount,0),1110)
 assert.equal(buildOwnerDailyReceipts({...raw,pos_cash_receipts:[]},day).totals.cash,260)
 assert.equal(buildOwnerDailyReceipts({...raw,pos_closings:[],pos_cash_receipts:[]},day).totals.cash,260)
})
test('v2 matches the actual production handover function, including Manila date boundaries',async()=>{
 const db=new PGlite()
 try{
 await db.exec('create schema private;')
 await db.exec(readFileSync(new URL('./fixtures/cash-handover-v2-live.sql',import.meta.url),'utf8'))
 for(const data of [raw,{...raw,pos_cash_receipts:[]},{...raw,pos_closings:[]}, {...raw,pos_cash_receipts:[{...raw.pos_cash_receipts[0],received_at:'2026-11-18T15:59:59Z'}]}, {...raw,pos_cash_receipts:[{...raw.pos_cash_receipts[0],received_at:'2026-11-18T16:00:00Z'}]}]){
 const result=await db.query('select private.cash_handover_expected($1,$2,$3) n',[day,data,expenses])
 assert.equal(Number(result.rows[0].n),buildOwnerDailyReceipts(data,day,expenses).netRecordedCash)
 }
 }finally{await db.close()}
})
