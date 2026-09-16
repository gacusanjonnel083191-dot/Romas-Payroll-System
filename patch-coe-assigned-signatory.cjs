'use strict'

const fs = require('node:fs')
const path = require('node:path')

const BEFORE = "  const signatoryName = String(signatureState?.signed_name || record?.approved_by || values?.approvedBy || '').trim()"
const AFTER = "  const signatoryName = String(signatureState?.signed_name || signatureState?.assigned_signatory_name || '').trim()"

function applyCoeAssignedSignatoryFix(source) {
  const text = String(source || '')
  if (text.includes(AFTER)) return text
  const first = text.indexOf(BEFORE)
  if (first < 0) throw new Error('COE assigned-signatory fix aborted: expected e-sign signatory-name anchor was not found.')
  if (text.indexOf(BEFORE, first + BEFORE.length) >= 0) throw new Error('COE assigned-signatory fix aborted: multiple signatory-name anchors were found.')
  return text.slice(0, first) + AFTER + text.slice(first + BEFORE.length)
}

function verifyCoeAssignedSignatoryFix(source) {
  const text = String(source || '')
  if (!text.includes(AFTER)) throw new Error('COE assigned-signatory verification failed: assigned signatory is not preferred for pending drafts.')
  if (text.includes(BEFORE)) throw new Error('COE assigned-signatory verification failed: stale approved_by fallback remains.')
}

if (require.main === module) {
  const appPath = path.join(__dirname, 'src', 'App.jsx')
  const original = fs.readFileSync(appPath, 'utf8')
  const patched = applyCoeAssignedSignatoryFix(original)
  verifyCoeAssignedSignatoryFix(patched)
  if (patched !== original) fs.writeFileSync(appPath, patched, 'utf8')
  console.log('COE assigned-signatory patch applied: pending previews show the assigned e-signatory, signed documents show the actual signer, and unassigned drafts remain blank.')
}

module.exports = { applyCoeAssignedSignatoryFix, verifyCoeAssignedSignatoryFix, BEFORE, AFTER }
