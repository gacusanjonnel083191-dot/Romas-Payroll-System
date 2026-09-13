// Reproduce the defects from the inspected baseline with synthetic data only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import vm from 'node:vm'
const baseline=execFileSync('git',['show','0c27318d119656fb22cc754d63d67effe5ec2fb3:src/App.jsx'],{encoding:'utf8',maxBuffer:6*1024*1024})
function extract(a,b){const start=baseline.indexOf(a);return baseline.slice(start,baseline.indexOf(b,start))}
function reproduce({auditError=false,secondLoanError=false}={}){
  const loans=[{id:'loan-1',employee_id:'one',amount:1000,amount_paid:0,balance:1000,status:'Unpaid',advance_date:'2026-09-11'},
    {id:'loan-2',employee_id:'two',amount:1000,amount_paid:0,balance:1000,status:'Unpaid',advance_date:'2026-09-11'}]
  let auditWritten=false
  const client={from(table){let op='read',patch,filters={};const q={select(){return q},eq(k,v){filters[k]=v;return q},ilike(){return q},order(){return q},limit(){return q},update(v){op='update';patch=v;return q},then(resolve,reject){
    let result
    if(table==='audit_logs')result=auditError?{error:{message:'Request timed out'}}:{data:[]}
    else if(table==='payroll_records')result={data:[{employee_id:'one',cash_advance_deduction:1000},...(secondLoanError?[{employee_id:'two',cash_advance_deduction:1000}]:[])]}
    else if(op==='update'){Object.assign(loans.find(l=>l.id===filters.id),patch);result={error:null}}
    else result=secondLoanError&&filters.employee_id==='two'?{error:{message:'Request timed out'}}:{data:loans.filter(l=>l.employee_id===filters.employee_id)}
    return Promise.resolve(result).then(resolve,reject)
  }};return q}}
  const context=vm.createContext({supabase:client,console,moneyRound:n=>Math.round(Number(n)*100)/100,safeNum:(n,d=0)=>Number.isFinite(Number(n))?Number(n):d,
    getCashAdvanceEffectiveBalance:ca=>ca.amount-ca.amount_paid,getCashAdvancePaidAmount:ca=>ca.amount_paid,
    getCashAdvanceRemainingInstallments:ca=>ca.balance>0?1:0,getCashAdvanceStatusForBalance:b=>b<=0?'Paid':'Unpaid',
    isOutstandingCashAdvance:ca=>ca.balance>0,php:String,logAudit:async()=>{auditWritten=true}})
  vm.runInContext(extract(' function buildCADeductionTag(', ' async function reverseCashAdvanceDeductionsForPayrollPeriod('),context)
  return {loans,context,getAudit:()=>auditWritten}
}
test('baseline continues after duplicate-check timeout and consumes a future loan',async()=>{
  const r=reproduce({auditError:true})
  const result=await r.context.applyCashAdvanceDeductionsForPayrollPeriod('2026-07-11','2026-07-25')
  assert.equal(result.applied,true)
  assert.equal(r.loans[0].advance_date,'2026-09-11')
  assert.equal(r.loans[0].status,'Paid')
  assert.equal(r.loans[0].amount_paid,1000)
})
test('baseline leaves earlier balance writes committed when a later query times out',async()=>{
  const r=reproduce({secondLoanError:true})
  const result=await r.context.applyCashAdvanceDeductionsForPayrollPeriod('2026-07-11','2026-07-25')
  assert.match(result.error,/timed out/)
  assert.equal(r.loans[0].amount_paid,1000)
  assert.equal(r.loans[1].amount_paid,0)
  assert.equal(r.getAudit(),false)
})
