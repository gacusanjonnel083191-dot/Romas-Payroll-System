import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDeterministicAdjustmentSnapshot, sumAdjustmentCents } from '../src/payrollAdjustmentIntegrity.js'

const rows = [
  { id:'b', employee_id:'employee', adjustment_type:'deduction', adjustment_date:'2026-11-02', amount:'800.00', category:'Helmet' },
  { id:'a', employee_id:'employee', adjustment_type:'addition', adjustment_date:'2026-11-01', amount:'0.10' },
  { id:'c', employee_id:'employee', adjustment_type:'addition', adjustment_date:'2026-11-01', amount:'0.20' }
]

test('the same approved adjustments give the same ordered cent totals on repeated calculations', () => {
  const first=buildDeterministicAdjustmentSnapshot(rows)
  const second=buildDeterministicAdjustmentSnapshot([...rows].reverse())
  assert.deepEqual(first,second)
  assert.equal(sumAdjustmentCents(first,'addition'),30)
  assert.equal(sumAdjustmentCents(first,'deduction'),80000)
  assert.equal(rows[0].adjustment_date,'2026-11-02')
})

test('unidentified, duplicate, or malformed adjustment sources block calculation', () => {
  assert.throws(()=>buildDeterministicAdjustmentSnapshot([...rows,rows[0]]),/Duplicate/)
  assert.throws(()=>buildDeterministicAdjustmentSnapshot([{...rows[0],id:''}]),/unidentified/)
  assert.throws(()=>buildDeterministicAdjustmentSnapshot([{...rows[0],amount:'0.001'}]),/cent value/)
  assert.throws(()=>buildDeterministicAdjustmentSnapshot([{...rows[0],adjustment_type:'unknown'}]),/invalid type/)
})
