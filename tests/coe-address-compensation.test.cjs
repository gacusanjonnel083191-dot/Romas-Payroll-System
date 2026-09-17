'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { applyCoeAddressCompensation, verifyCoeAddressCompensation } = require('../patch-coe-address-compensation.cjs')

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8')

test('COE patch adds employee address and professional compensation fields', () => {
  const patched = applyCoeAddressCompensation(app)
  verifyCoeAddressCompensation(patched)
  assert.match(patched, /"key": "employeeAddress"/)
  assert.match(patched, /"label": "Compensation"/)
  assert.match(patched, /"placeholder": "Example: ₱610\/day or ₱18,000\/month"/)
})

test('selected employee address is auto-filled when a supported address field exists', () => {
  const patched = applyCoeAddressCompensation(app)
  assert.match(patched, /employeeAddress:employee\.address \|\| employee\.home_address \|\| employee\.residential_address \|\| employee\.current_address \|\| ''/)
})

test('employee address and compensation render in the certificate and are protected by the e-sign hash', () => {
  const patched = applyCoeAddressCompensation(app)
  assert.match(patched, /The employee\\'s address on record is <strong>/)
  assert.match(patched, />COMPENSATION<\/div>/)
  assert.match(patched, /'assignedDepartment','employeeAddress','addressee'/)
  assert.equal(applyCoeAddressCompensation(patched), patched)
})
