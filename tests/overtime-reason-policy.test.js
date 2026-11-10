import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateOvertimeReasonFields, formatOvertimeReasonForStorage } from '../src/overtimeReasonPolicy.js'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

test('specific overtime work and business necessity are both required', () => {
  assert.equal(validateOvertimeReasonFields('Packed 85 boxes for reseller deliveries', 'Orders had a verified 7 AM loading deadline').valid, true)
  assert.equal(validateOvertimeReasonFields('Packed 85 boxes for reseller deliveries', '').valid, false)
  assert.equal(validateOvertimeReasonFields('Packed 85 boxes for reseller deliveries', 'Too busy').valid, false)
  assert.equal(validateOvertimeReasonFields('Helped in work', 'Orders had a verified 7 AM loading deadline').valid, false)
})

test('reject generic placeholders even when their length meets the minimum', () => {
  for (const phrase of ['Operational requirements / volume of work', 'Staff shortage / manpower gap', 'Management request', 'Due to workload']) {
    assert.equal(validateOvertimeReasonFields(phrase, 'Needed to meet the morning delivery deadline').valid, false, phrase)
    assert.equal(validateOvertimeReasonFields('Packed 85 boxes for reseller deliveries', phrase).valid, false, phrase)
  }
  assert.equal(validateOvertimeReasonFields('Packed 85 boxes for reseller deliveries', 'Packed 85 boxes for reseller deliveries').valid, false)
})

test('persist a reviewable narrative without changing the existing time range structure', () => {
  const reason = formatOvertimeReasonForStorage('Packed 85 boxes for reseller deliveries', 'Orders had a verified 7 AM loading deadline')
  assert.match(reason, /^Work performed: Packed 85 boxes/m)
  assert.match(reason, /Why overtime was necessary: Orders had a verified/)
  assert.match(app, /buildTimeAdjustmentEmployeeReason\(formatOvertimeReasonForStorage\(otRequestReason, otRequestJustification\)/)
})

test('File Overtime opens overtime and does not inherit a previous meal-break selection', () => {
  assert.match(app, /async function toggleTimeAdjustmentFilingPanel\(\) \{\s*await openEmployeeTimeAdjustmentFilingPanel\('overtime'\)/)
  assert.match(app, /async function openNoMealBreakFilingPanel\(\) \{\s*await openEmployeeTimeAdjustmentFilingPanel\('meal_break'\)/)
  assert.match(app, /setOtRequestType\(selectedType\)/)
  assert.match(app, /refreshTimeAdjustmentPreview\(defaultDate, selectedType, '', ''\)/)
  assert.match(app, /setOtRequestJustification\(''\)/)
})

test('overtime and no-meal-break have separate entry points and separate reason controls', () => {
  assert.match(app, /label:'File Overtime',[^\n]*action:toggleTimeAdjustmentFilingPanel/)
  assert.match(app, /label:'No Meal Break Review',[^\n]*action:openNoMealBreakFilingPanel/)
  assert.doesNotMatch(app, /<label style=\{lblS\}>Request Type:<\/label>/)
  assert.match(app, /otRequestType==='overtime'\?\([\s\S]*?<textarea value=\{otRequestReason\}/)
  assert.match(app, /<textarea value=\{otRequestJustification\}/)
  assert.match(app, /otRequestReasonPreset==='Others'/)
})

test('employee overtime narratives are validated and cleared after successful filing', () => {
  assert.match(app, /validateOvertimeReasonFields\(detailedOTReason, otRequestJustification\)/)
  assert.match(app, /setOtRequestJustification\(''\)/)
})
