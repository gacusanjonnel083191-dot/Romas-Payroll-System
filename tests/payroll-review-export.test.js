import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { payrollReviewRows } from '../src/payrollReviewExport.js'

const row={employee_id:'1',employee_code:'TEST',employee_name:'Test Employee',payroll_status:'under_review',
 basic_pay:1500,birthday_pay:0,overtime_pay:0,night_diff_pay:0,holiday_pay:0,other_earnings:0,
 total_earnings:1500,late_deduction:0,undertime_deduction:0,cash_advance_deduction:100,
 sss_deduction:0,pagibig_deduction:0,philhealth_deduction:0,other_deductions:0,
 total_deductions:100,net_pay:1400,bank_account_number:'DO-NOT-EXPORT'}
const displayed={employeeId:'1',totalEarnings:1500,totalDeductions:100,netPay:1400}

test('under-review payroll may be reviewed in Excel without disclosing bank account',()=>{
 const report=payrollReviewRows([displayed],[row],'2026-10-26','2026-11-10')
 assert.equal(report.count,1)
 assert.equal(report.totalNetPay,1400)
 assert.equal(report.rows[8][2],'UNDER_REVIEW')
 assert.doesNotMatch(JSON.stringify(report.rows),/DO-NOT-EXPORT/)
 assert.match(JSON.stringify(report.rows),/NOT FOR BANK UPLOAD/)
})
test('stale displayed pay and duplicate payroll fail closed',()=>{
 for(const bad of [{netPay:1401},{totalDeductions:200},{totalEarnings:1600}])
   assert.throws(()=>payrollReviewRows([{...displayed,...bad}],[row],'2026-10-26','2026-11-10'),/differs/)
 assert.throws(()=>payrollReviewRows([displayed,displayed],[row,row],'2026-10-26','2026-11-10'),/Duplicate/)
 assert.throws(()=>payrollReviewRows([displayed],[{...row,net_pay:1500}],'2026-10-26','2026-11-10'),/differs|reconcile/)
})
test('existing bank export release gate remains in place',()=>{
 const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
 assert.match(app,/savedRows\.some\(row=>!isReleasedPayrollRecord\(row\)\)/)
 assert.match(app,/EXPORT REVIEW EXCEL/)
 assert.match(app,/EXPORT RCBC PAYMENT EXCEL/)
})
