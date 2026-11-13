import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcilePayrollExport } from '../src/payrollExportReconciliation.js'

const saved=[
  {employee_id:'a',employee_code:'EMP-001',net_pay:'100.01',total_earnings:'110.01',total_deductions:'10.00'},
  {employee_id:'b',employee_code:'EMP-002',net_pay:'200.02',total_earnings:'200.02',total_deductions:'0.00'},
]
const displayed=saved.map(row=>({employeeId:row.employee_id,netPay:Number(row.net_pay)}))

test('bank inclusion and separate-payment exclusion reconcile to saved net pay',()=>{
  assert.deepEqual(reconcilePayrollExport(displayed,saved,[displayed[0]]),{
    savedTotal:300.03,includedTotal:100.01,excludedTotal:200.02,includedCount:1,excludedCount:1
  })
})

test('stale browser, duplicate, and unsaved bank rows block export',()=>{
  assert.throws(()=>reconcilePayrollExport([{...displayed[0],netPay:101.01},displayed[1]],saved,[displayed[0]]),/differs/)
  assert.throws(()=>reconcilePayrollExport([...displayed,displayed[1]],saved,[displayed[0]]),/Duplicate/)
  assert.throws(()=>reconcilePayrollExport(displayed,saved,[{employeeId:'c',netPay:1}]),/unsaved/)
})

test('saved row with broken earnings-deductions identity blocks export',()=>{
  assert.throws(()=>reconcilePayrollExport(displayed,[{...saved[0],total_deductions:'9.00'},saved[1]],[displayed[0]]),/does not reconcile/)
})
