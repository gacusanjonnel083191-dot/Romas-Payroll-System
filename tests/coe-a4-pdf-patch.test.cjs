'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { applyCoeA4PdfFix, verifyCoeA4PdfFix } = require('../scripts/coe-a4-pdf.cjs')

const appPath = path.join(__dirname, '..', 'src', 'App.jsx')
const source = fs.readFileSync(appPath, 'utf8')

test('COE A4 PDF patch applies cleanly to the current App.jsx and is idempotent', () => {
  const patched = applyCoeA4PdfFix(source)
  verifyCoeA4PdfFix(patched)
  assert.equal(applyCoeA4PdfFix(patched), patched)
})

test('COE PDF export stays A4 and remains available for current and saved certificates', () => {
  const patched = applyCoeA4PdfFix(source)
  assert.match(patched, /new jsPDF\(\{ orientation:'portrait', unit:'mm', format:'a4', compress:true \}\)/)
  assert.match(patched, /pdf\.addImage\([^\n]+0, 0, 210, Math\.min\(imageHeightMm, 297\)/)
  assert.match(patched, /DOWNLOAD PDF \(A4\)/)
  assert.match(patched, />PDF<\/button>/)
  assert.match(patched, /The COE content exceeds one A4 page/)
})

test('COE document polish preserves the existing Word path while improving formal output', () => {
  const patched = applyCoeA4PdfFix(source)
  assert.match(patched, /const downloadCertificateOfEmploymentWord =/)
  assert.match(patched, /DOWNLOAD WORD \(A4\)/)
  assert.match(patched, /month:'long', day:'numeric', year:'numeric'/)
  assert.match(patched, /Issued on <strong>/)
  assert.match(patched, /timeZone:'Asia\/Manila'/)
  assert.match(patched, /signatoryName \? esc\(signatoryName\) : '&nbsp;'/)
})
