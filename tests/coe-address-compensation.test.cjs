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

test('employee address and compensation render in the certificate', () => {
  const patched = applyCoeAddressCompensation(app)
  assert.match(patched, /const addressStatement = employeeAddress/)
  assert.match(patched, /addressStatement \? '<p>' \+ addressStatement \+ '<\/p>' : ''/)
  assert.match(patched, />COMPENSATION<\/div>/)
})

test('new address-aware hashes preserve legacy signed COE hash behavior', () => {
  const patched = applyCoeAddressCompensation(app)
  assert.match(patched, /const COE_HASH_FIELDS = \['employeeName','employeeCode','employmentStatus','employmentStartDate','employmentEndDate','positionTitle','assignedDepartment','addressee'/)
  assert.match(patched, /const COE_HASH_FIELDS_WITH_ADDRESS = \['employeeName','employeeCode','employmentStatus','employmentStartDate','employmentEndDate','positionTitle','assignedDepartment','employeeAddress','addressee'/)
  assert.match(patched, /Object\.prototype\.hasOwnProperty\.call\(cf, 'employeeAddress'\) \? COE_HASH_FIELDS_WITH_ADDRESS : COE_HASH_FIELDS/)
  assert.equal(applyCoeAddressCompensation(patched), patched)
})
