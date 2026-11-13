import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { getPayrollReleaseState } from '../src/payrollReleaseState.js'

const isReleased = r => r.payroll_released === true || r.payroll_approved === true ||
  !!r.approved_at || !!r.released_at || ['released','approved'].includes(r.payroll_status)

test('fully released saved payroll is an idempotent release, not a fresh release',()=>{
 const rows=Array.from({length:25},()=>({payroll_status:'released',payroll_released:true}))
 assert.deepEqual(getPayrollReleaseState(rows,isReleased),{
   total:25,released:25,allReleased:true,partiallyReleased:false
 })
})
test('unreleased and mixed payroll retain release safety gates',()=>{
 assert.equal(getPayrollReleaseState([{payroll_status:'under_review'}],isReleased).allReleased,false)
 assert.equal(getPayrollReleaseState([{payroll_released:true},{payroll_status:'under_review'}],isReleased).partiallyReleased,true)
 assert.equal(getPayrollReleaseState([],isReleased).allReleased,false)
})
test('release handler checks saved release state first and keeps original expense guard',()=>{
 const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
 const flow=app.slice(app.indexOf('async function approvePayroll('),app.indexOf('function buildPayrollExpenseTag('))
 assert.ok(flow.indexOf('const releaseState = getPayrollReleaseState(records, isReleasedPayrollRecord)') < flow.indexOf('const expensePreflight'))
 assert.ok(flow.indexOf('if (releaseState.allReleased)') < flow.indexOf('await applyCashAdvanceDeductionsForPayrollPeriod(start, end)'))
 assert.match(flow,/if \(releaseState\.partiallyReleased\)/)
 assert.match(flow,/if \(expensePreflight\.error \|\| expensePreflight\.duplicate \|\| expensePreflight\.exists\)/)
 assert.match(flow,/await loadSavedPayrollForPeriod\(start, end, \{ silent:true \}\)/)
 assert.match(app,/PAYROLL ALREADY RELEASED/)
})
