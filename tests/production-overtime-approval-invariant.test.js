import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
const migration=readFileSync(new URL('../supabase/migrations/20261102010000_production_overtime_supervisor_owner_approval.sql',import.meta.url),'utf8')

test('overtime requires a specific free-text reason; unrelated meal-break form retained',()=>{
 assert.match(app,/Describe the actual work performed during overtime/)
 assert.match(app,/otRequestType==='overtime'\?\([\s\S]*?<textarea value=\{otRequestReason\}/)
 assert.match(app,/validateOvertimeReasonFields\(detailedOTReason, otRequestJustification\)/)
 assert.match(app,/otRequestReasonPreset==='Others'/)
 assert.doesNotMatch(app.slice(app.indexOf('Locked OT:'),app.indexOf("{otRequestType === 'meal_break' && (",app.indexOf('Locked OT:'))),/Operational requirements \/ volume of work/)
 assert.match(migration,/OT_SPECIFIC_REASON_REQUIRED/)
})

test('production review forwards without payroll approval',()=>{
 const start=app.indexOf('async function forwardProductionOvertimeToOwner(req)')
 const end=app.indexOf('async function approveTimeAdj(req)',start)
 assert.ok(start>=0&&end>start)
 const forward=app.slice(start,end)
 assert.match(forward,/supervisor_reviewed_by:adminAuthUser\.id/)
 assert.match(forward,/\.eq\('status','pending'\)/)
 assert.doesNotMatch(forward,/status:'approved'/)
 assert.doesNotMatch(forward,/overtime_approved:true/)
 assert.match(migration,/status in \('pending', 'rejected'\)/)
})

test('owner cannot finalize production OT without persisted supervisor verification',()=>{
 assert.match(app,/isProductionOT&&\(!isOwnerRole\|\|!req\.supervisor_reviewed_by\|\|!req\.supervisor_reviewed_at\)/)
 assert.match(app,/\.select\('supervisor_reviewed_by,supervisor_reviewed_at'\)/)
 assert.match(app,/!reviewProof\?\.supervisor_reviewed_by\|\|!reviewProof\?\.supervisor_reviewed_at/)
 assert.match(migration,/OWNER_FINAL_APPROVAL_REQUIRED/)
 assert.match(migration,/old\.supervisor_reviewed_by = actor_id/)
 assert.match(app,/OWNER FINAL APPROVE/)
})

test('existing payroll calculation remains approved-status only',()=>{
 const start=app.indexOf('const { data:approvedOvertimeRequests, error:timeAdjError }')
 const end=app.indexOf('const payrollLogsByDate',start)
 assert.ok(start>0 && end>start)
 const query=app.slice(start,end)
 assert.match(query,/\.eq\('status', 'approved'\)/)
 assert.match(query,/\.eq\('request_type', 'overtime'\)/)
 assert.match(app,/Math\.min\(Math\.max\(0, approvedMinutes\), actualMinutes\)/)
})

test('existing approved payroll history is not rewritten by migration',()=>{
 assert.doesNotMatch(migration,/update\s+(?:public\.)?time_adjustment_requests\s+set/i)
 assert.doesNotMatch(migration,/delete\s+from\s+(?:public\.)?time_adjustment_requests/i)
})
