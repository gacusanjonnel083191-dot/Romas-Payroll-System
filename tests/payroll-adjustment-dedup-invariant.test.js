import test from 'node:test'
import assert from 'node:assert/strict'
import {
  enforcePayrollAdjustmentDedup,
  filterDuplicatePriorCutoffOTAdjustments,
} from '../vite.payroll-adjustment-dedup-invariant.js'

const base = {
  employee_id: 'erwin',
  adjustment_type: 'addition',
  category: 'Prior-Cutoff OT Correction - 2026-08-26 to 2026-09-10',
  adjustment_date: '2026-09-11',
  source_payroll_start: '2026-08-26',
  source_payroll_end: '2026-09-10',
  source_rate: 57.5,
  source_multiplier: 1.25,
}

const canonical = [
  { ...base, id:'c1', source_type:'time_adjustment_carry_forward', source_id:'533', source_attendance_date:'2026-08-26', source_minutes:150, amount:179.69 },
  { ...base, id:'c2', source_type:'time_adjustment_carry_forward', source_id:'534', source_attendance_date:'2026-09-06', source_minutes:240, amount:287.50 },
  { ...base, id:'c3', source_type:'time_adjustment_carry_forward', source_id:'535', source_attendance_date:'2026-09-07', source_minutes:240, amount:287.50 },
  { ...base, id:'c4', source_type:'time_adjustment_carry_forward', source_id:'536', source_attendance_date:'2026-09-09', source_minutes:60, amount:71.88 },
  { ...base, id:'c5', source_type:'time_adjustment_carry_forward', source_id:'539', source_payroll_start:'2026-07-11', source_payroll_end:'2026-07-25', source_attendance_date:'2026-07-21', source_minutes:120, amount:143.75 },
  { ...base, id:'c6', source_type:'time_adjustment_carry_forward', source_id:'540', source_payroll_start:'2026-08-11', source_payroll_end:'2026-08-25', source_attendance_date:'2026-08-16', source_minutes:300, amount:359.38 },
  { ...base, id:'c7', source_type:'time_adjustment_carry_forward', source_id:'541', source_payroll_start:'2026-07-11', source_payroll_end:'2026-07-25', source_attendance_date:'2026-07-24', source_minutes:30, amount:35.94 },
]

const manualDuplicates = canonical.slice(0,4).map((row, index) => ({
  ...row,
  id:`m${index+1}`,
  source_type:'manual_prior_cutoff_ot_adjustment',
  source_id:`manual-${index+1}`,
}))

test('Erwin duplicate fixture retains only canonical OT additions', () => {
  const filtered = filterDuplicatePriorCutoffOTAdjustments([...canonical, ...manualDuplicates])
  assert.equal(filtered.length, 7)
  assert.deepEqual(filtered.map(row => row.id), canonical.map(row => row.id))
  const total = filtered.reduce((sum,row) => sum + Number(row.amount || 0), 0)
  assert.equal(Number(total.toFixed(2)), 1365.64)
})

test('manual-only adjustments are not silently collapsed without a canonical carry-forward', () => {
  const rows = manualDuplicates.slice(0,2)
  assert.deepEqual(filterDuplicatePriorCutoffOTAdjustments(rows), rows)
})

test('unrelated additions are preserved', () => {
  const bonus = { id:'bonus', employee_id:'erwin', adjustment_type:'addition', category:'Performance Bonus', amount:500 }
  const filtered = filterDuplicatePriorCutoffOTAdjustments([canonical[0], manualDuplicates[0], bonus])
  assert.deepEqual(filtered.map(row => row.id), ['c1','bonus'])
})

test('App.jsx transformation injects dedup guard before payroll snapshot', () => {
  const fixture = `
function buildPayrollAdjustmentSnapshot(rows = []) { return rows }
async function computePayroll() {
 const adjs = []
 const adjustmentBreakdown = buildPayrollAdjustmentSnapshot(adjs || [])
 return adjustmentBreakdown
}`
  const transformed = enforcePayrollAdjustmentDedup(fixture, '/repo/src/App.jsx')
  assert.match(transformed, /PAYROLL_PRIOR_CUTOFF_OT_DEDUP_GUARD/)
  assert.match(transformed, /buildPayrollAdjustmentSnapshot\(filterDuplicatePriorCutoffOTAdjustments\(adjs \|\| \[\]\)\)/)
  assert.equal(enforcePayrollAdjustmentDedup(transformed, '/repo/src/App.jsx'), transformed)
})

test('unrelated modules are unchanged', () => {
  const source = 'const x = 1'
  assert.equal(enforcePayrollAdjustmentDedup(source, '/repo/src/Other.jsx'), source)
})
