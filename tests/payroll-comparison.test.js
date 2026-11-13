import test from 'node:test'
import assert from 'node:assert/strict'
import { comparePayrollSnapshots, payrollCents } from '../src/payrollComparison.js'

const prior = { employee_id:'ronald', employee_code:'EMP-017', employee_name:'Ronald',
  basic_pay:'9100.00', birthday_pay:'700.00', total_earnings:'9800.00', total_deductions:'0.00', net_pay:'9800.00',
  adjustment_breakdown:[], cash_advance_breakdown:[] }
const saved = { ...prior, birthday_pay:'0.00', total_earnings:'9100.00', net_pay:'9100.00' }

test('cent conversion preserves exact two-decimal money', () => {
  assert.equal(payrollCents('85391.30'),8539130)
  assert.equal(payrollCents('0.01'),1)
  assert.throws(()=>payrollCents('1.005'),/Invalid payroll amount/)
})

test('recomputed saved figures expose the Ronald 700-peso discrepancy', () => {
  const result=comparePayrollSnapshots([{payroll_record:prior}],[saved])
  assert.equal(result.previousTotal,9800)
  assert.equal(result.currentTotal,9100)
  assert.equal(result.difference,-700)
  assert.deepEqual(result.changes[0].fields.map(field=>field.field),['birthday_pay','total_earnings','net_pay'])
})

test('identical repeated computations show no changes', () => {
  const result=comparePayrollSnapshots([{payroll_record:saved}],[{...saved}])
  assert.equal(result.difference,0)
  assert.deepEqual(result.changes,[])
})

test('employee inclusion changes appear in comparison', () => {
  const result=comparePayrollSnapshots([], [saved])
  assert.equal(result.changes[0].status,'added')
  assert.equal(result.difference,9100)
})

test('a changed source record is visible even when total pay is unchanged', () => {
  const oldRow={ ...saved, adjustment_breakdown:[{id:'old',date:'2026-11-01',category:'Charge',amount:100}] }
  const newRow={ ...saved, adjustment_breakdown:[{id:'new',date:'2026-11-02',category:'Charge',amount:100}] }
  const result=comparePayrollSnapshots([oldRow],[newRow])
  assert.equal(result.difference,0)
  assert.equal(result.changes[0].sourcesChanged,true)
  assert.deepEqual(result.changes[0].fields,[])
})

test('duplicate employee rows block comparison', () => {
  assert.throws(()=>comparePayrollSnapshots([prior,prior],[saved]),/Duplicate employee/)
})
