import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { runCashAdvancePayrollCommand } from '../src/cashAdvanceIntegrity.js'
import { runEmployeeSeparationCommand } from '../src/employeeSeparationIntegrity.js'

const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const between = (a,b) => source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)))
const context = vm.createContext({
  moneyRound: n => Math.round((Number(n)||0)*100)/100,
  safeNum: (n,d=0) => Number.isFinite(Number(n)) ? Number(n) : d,
  getCashAdvancePayslipReason: () => ''
})
vm.runInContext(between('function getCashAdvanceRawBalance(', 'function getCashAdvanceStatusForBalance('),context)
vm.runInContext(between('function buildCashAdvanceDeductionSnapshot(', 'function escapePayslipHtml('),context)

test('Paid label and zero balance cannot manufacture a repayment', () => {
  assert.equal(context.getCashAdvanceEffectiveBalance({amount:1000,amount_paid:0,balance:0,status:'Paid'}),1000)
  assert.equal(context.getCashAdvancePaidAmount({amount:1000,amount_paid:0,balance:0,status:'Paid'}),0)
})
test('paid amount is the accounting source, including a partially paid installment', () => {
  assert.equal(context.getCashAdvanceEffectiveBalance({amount:5000,amount_paid:1000,balance:4000}),4000)
  assert.equal(context.getCashAdvanceEffectiveBalance({amount:5000,amount_paid:0,balance:1000}),5000)
})
test('snapshot honors each loan installment and reconciles the payroll cap', () => {
  const rows = [{id:'b',advance_date:'2026-09-02',amount:3000,amount_paid:0,balance:3000,per_payroll_deduction:1000},
    {id:'a',advance_date:'2026-09-01',amount:10000,amount_paid:0,balance:10000,per_payroll_deduction:2000}]
  const items=context.buildCashAdvanceDeductionSnapshot(rows,2500)
  assert.deepEqual(Array.from(items,i=>[i.id,i.amount]),[['a',2000],['b',500]])
  assert.equal(items.reduce((s,i)=>s+i.amount,0),2500)
  assert.equal(items[1].deferred_amount,500)
})
test('no admin login or background function can apply repayments', () => {
  assert.ok(!source.includes('autoPostApprovedPayrollExpenses'))
  const calls=source.match(/applyCashAdvanceDeductionsForPayrollPeriod\(/g)||[]
  assert.equal(calls.length,2) // declaration and explicit release only
  assert.ok(source.includes(".eq('employee_id', emp.id).lte('advance_date', payrollEnd)"))
  assert.ok(!between(' async function applyCashAdvanceDeductionsForPayrollPeriod(', ' async function reopenReleasedPayroll(').includes(".from('cash_advances')"))
})
test('expired session stops before financial RPC',async()=>{
  let called=false
  const result=await runCashAdvancePayrollCommand({auth:{getSession:async()=>({data:{session:null}})},rpc:async()=>{called=true}},'release','2026-09-11','2026-09-25')
  assert.equal(result.ok,false);assert.equal(called,false)
})
test('network or migration failure never falls back to direct balance writes',async()=>{
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'admin'}}}})},rpc:async()=>({error:{message:'Request timed out'}}),from:()=>{throw new Error('Forbidden fallback')}}
  const result=await runCashAdvancePayrollCommand(client,'release','2026-09-11','2026-09-25')
  assert.equal(result.ok,false);assert.match(result.error,/Request timed out/)
})
test('verified retry returns existing receipt without pretending a new repayment',async()=>{
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'admin'}}}})},rpc:async()=>({data:{ok:true,existing:true,applied:false,amount:0}})}
  assert.equal((await runCashAdvancePayrollCommand(client,'release','2026-09-11','2026-09-25')).existing,true)
})
test('expired owner session stops before employee separation RPC',async()=>{
  let called=false
  const result=await runEmployeeSeparationCommand({auth:{getSession:async()=>({data:{session:null}})},rpc:async()=>{called=true}}, {})
  assert.equal(result.ok,false);assert.equal(called,false)
})
test('employee separation RPC failure never falls back to direct deactivation or repayment writes',async()=>{
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}})},rpc:async()=>({error:{message:'Request timed out'}}),from:()=>{throw new Error('Forbidden fallback')}}
  const result=await runEmployeeSeparationCommand(client,{p_employee_id:'employee'})
  assert.equal(result.ok,false);assert.match(result.error,/Request timed out/)
})
test('final pay uses the verified separation command, not browser-side financial writes',()=>{
  const finalPayBlock=between(' async function processFinalPay()', ' async function loadPayrollHistory()')
  assert.ok(finalPayBlock.includes('runEmployeeSeparationCommand(supabase'))
  assert.ok(!finalPayBlock.includes(".from('employees').update"))
  assert.ok(!finalPayBlock.includes(".from('final_pay_records').insert"))
  assert.ok(!finalPayBlock.includes(".from('cash_advances').update"))
})
