'use strict'

const fs = require('fs')
const { applyPayrollAdjustmentDeferral } = require('./scripts/payroll-adjustment-deferral.cjs')

const path = 'src/App.jsx'
const source = fs.readFileSync(path, 'utf8')
const patched = applyPayrollAdjustmentDeferral(source)

if (patched !== source) {
  fs.writeFileSync(path, patched, 'utf8')
  console.log('Payroll adjustment deferral applied: excess payroll adjustments move to the next cutoff instead of blocking release.')
} else {
  console.log('Payroll adjustment deferral already present; no source changes were needed.')
}
