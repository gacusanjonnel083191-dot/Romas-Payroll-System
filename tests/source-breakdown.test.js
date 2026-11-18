import test from 'node:test'
import assert from 'node:assert/strict'
import {buildOwnerDailyReceipts, ownerReceiptBreakdown} from '../src/ownerDailyReceipts.js'
const day='2026-11-18', at='2026-11-17T17:00:00Z'
const sum=rows=>Math.round(rows.reduce((s,r)=>s+r.amount,0)*100)/100

test('every owner card reconciles to its own source rows without payment-only sales or duplicate POS receipts',()=>{
 const report=buildOwnerDailyReceipts({
 daily_sales:[{id:'sale',created_at:at,sale_date:day,encoded_by:'Encoder',total_walkin:20,total_messenger:10,cash_received:10,gcash_received:10,other_online_received:5,unpaid_amount:5}],
 reseller_payments:[{id:'p',invoice_id:'inv',invoice_number:'INV-1',recorded_by:'Collector',created_at:at,payment_date:day,amount:100,payment_method:'Cash'}, {id:'old',created_at:at,payment_date:'2026-11-16',amount:400,payment_method:'Cash'}],
 invoices:[{id:'inv',invoice_number:'INV-1',created_at:at,delivery_date:day,status:'partial',total_amount:400,paid_amount:100}, {id:'void',created_at:at,delivery_date:day,status:'void',total_amount:999}],
 daily_online:[{id:'later',created_at:at,payment_date:day,count_as_revenue:false,receipt_already_counted:false,amount:15,payment_method:'GCash'}, {id:'dup',created_at:at,payment_date:day,count_as_revenue:false,receipt_already_counted:true,amount:10,payment_method:'GCash'}],
 cash_handovers:[{id:'h',business_date:day,revision:2,owner_physical_count:0}]
 },day)
 for(const key of ['cash','gcash','otherOnline','totalReceived','resellerReceived','salesEntered']) assert.equal(sum(ownerReceiptBreakdown(report,key)),report.totals[key],key)
 for(const key of ['deliveredUnpaid','actualCashCount']) assert.equal(sum(ownerReceiptBreakdown(report,key)),report[key],key)
 const payment=ownerReceiptBreakdown(report,'resellerReceived')[0]
 assert.equal(payment.invoiceId,'inv');assert.equal(payment.recordedBy,'Collector')
 assert.equal(report.totals.salesEntered,430)
 assert.equal(report.deliveredUnpaid,300)
 assert.equal(ownerReceiptBreakdown(report,'actualCashCount').length,1)
})
test('missing count differs from counted zero and empty date has no invented records',()=>{
 const report=buildOwnerDailyReceipts({},day)
 assert.equal(report.actualCashCount,null)
 for(const key of ['cash','gcash','otherOnline','totalReceived','resellerReceived','salesEntered','deliveredUnpaid','actualCashCount']) assert.deepEqual(ownerReceiptBreakdown(report,key),[])
})
test('backdated sale retains business date while entry selection uses Manila day',()=>{
 const report=buildOwnerDailyReceipts({invoices:[{id:'backdated',created_at:at,delivery_date:'2026-11-01',total_amount:12.34}]},day)
 const rows=ownerReceiptBreakdown(report,'salesEntered')
 assert.equal(rows[0].businessDate,'2026-11-01');assert.equal(rows[0].invoiceId,'backdated')
 assert.equal(sum(rows),12.34)
 assert.deepEqual(ownerReceiptBreakdown(report,'deliveredUnpaid'),[])
})
