import test from 'node:test'
import assert from 'node:assert/strict'
import { formatProductionScreens } from '../src/productionScreenBreakdown.js'

test('shows whole screens and actual excess pieces for each merged group', () => {
  assert.equal(formatProductionScreens(394), '9 + 34 pcs')
  assert.equal(formatProductionScreens(73 + 86 + 89), '6 + 8 pcs')
  assert.equal(formatProductionScreens(846 + 421), '31 + 27 pcs')
})

test('handles exact, small, and empty screen counts', () => {
  assert.equal(formatProductionScreens(400), '10 + 0 pcs')
  assert.equal(formatProductionScreens(39), '0 + 39 pcs')
  assert.equal(formatProductionScreens(0), '0 + 0 pcs')
  assert.equal(formatProductionScreens(-1), '—')
})
