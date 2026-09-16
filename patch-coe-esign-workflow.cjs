'use strict'

const fs = require('node:fs')
const { applyCoeEsignWorkflow } = require('./scripts/coe-esign-workflow.cjs')

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source
  const first = source.indexOf(before)
  if (first < 0) throw new Error(`COE e-sign RPC list fix aborted: ${label} anchor was not found.`)
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`COE e-sign RPC list fix aborted: multiple ${label} anchors were found.`)
  return source.slice(0, first) + after + source.slice(first + before.length)
}

function fixCoeRpcListResults(source) {
  let app = source

  app = replaceOnce(
    app,
    ` const coeGetActiveSignatories = async () => {\n  const { data, error } = await supabase.rpc('list_active_coe_signatories')\n  if (error) throw error\n  const normalized = coeNormalizeRpcJson(data)\n  return Array.isArray(normalized) ? normalized : (Array.isArray(normalized?.items) ? normalized.items : [])\n }`,
    ` const coeGetActiveSignatories = async () => {\n  const { data, error } = await supabase.rpc('list_active_coe_signatories')\n  if (error) throw error\n  return Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : [])\n }`,
    'active signatories list'
  )

  app = replaceOnce(
    app,
    `   const normalized = coeNormalizeRpcJson(data)\n   const items = Array.isArray(normalized) ? normalized : (normalized?.items || [])\n   const modal = coeOpenModal({ title:'COE Authorized Signatories'`,
    `   const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : [])\n   const modal = coeOpenModal({ title:'COE Authorized Signatories'`,
    'signatory settings list'
  )

  app = replaceOnce(
    app,
    `   const normalized = coeNormalizeRpcJson(data)\n   const items = Array.isArray(normalized) ? normalized : (normalized?.items || [])\n   const modal = coeOpenModal({ title:'COE Signature Inbox'`,
    `   const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : [])\n   const modal = coeOpenModal({ title:'COE Signature Inbox'`,
    'signature inbox list'
  )

  if (!app.includes("return Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : [])")) {
    throw new Error('COE e-sign RPC list fix verification failed for active signatories.')
  }
  if (!app.includes("const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : [])\n   const modal = coeOpenModal({ title:'COE Authorized Signatories'")) {
    throw new Error('COE e-sign RPC list fix verification failed for signatory settings.')
  }
  if (!app.includes("const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : [])\n   const modal = coeOpenModal({ title:'COE Signature Inbox'")) {
    throw new Error('COE e-sign RPC list fix verification failed for signature inbox.')
  }

  return app
}

const appPath = 'src/App.jsx'
const source = fs.readFileSync(appPath, 'utf8')
const workflowPatched = applyCoeEsignWorkflow(source)
const patched = fixCoeRpcListResults(workflowPatched)

if (patched !== source) {
  fs.writeFileSync(appPath, patched, 'utf8')
  console.log('COE e-signature workflow patch applied: draft routing, signatory inbox, controlled e-sign approval, signature integrity, signed outputs, and RPC list handling enabled.')
} else {
  console.log('COE e-signature workflow already present; RPC list handling verified.')
}
