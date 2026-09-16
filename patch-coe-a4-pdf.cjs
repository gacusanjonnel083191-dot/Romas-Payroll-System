'use strict'

const fs = require('fs')
const { applyCoeA4PdfFix } = require('./scripts/coe-a4-pdf.cjs')

const path = 'src/App.jsx'
const source = fs.readFileSync(path, 'utf8')
const patched = applyCoeA4PdfFix(source)

if (patched !== source) {
  fs.writeFileSync(path, patched, 'utf8')
  console.log('COE A4 PDF patch applied: professional document layout and direct A4 PDF download enabled.')
} else {
  console.log('COE A4 PDF patch already present; no source changes were needed.')
}
