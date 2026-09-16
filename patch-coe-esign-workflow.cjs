'use strict'

const fs = require('node:fs')
const { applyCoeEsignWorkflow } = require('./scripts/coe-esign-workflow.cjs')

const appPath = 'src/App.jsx'
const source = fs.readFileSync(appPath, 'utf8')
const patched = applyCoeEsignWorkflow(source)

if (patched !== source) {
  fs.writeFileSync(appPath, patched, 'utf8')
  console.log('COE e-signature workflow patch applied: draft routing, signatory inbox, controlled e-sign approval, signature integrity, and signed outputs enabled.')
} else {
  console.log('COE e-signature workflow already present; no source changes were needed.')
}
