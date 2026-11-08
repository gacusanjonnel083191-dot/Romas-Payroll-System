import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { invoiceDeletionFullPreview } from '../vite.invoice-deletion-full-preview.js'

const fixture = `import React from 'react'
function sortDeliveryInvoiceItems(items) { return [...items] }
function renderInvoiceDeletionApprovalCenter() {
  return <button onClick={()=>reviewInvoiceDeletionRequest(request,'reject')}>{rejecting ? 'Processing...' : 'Reject'}</button>
}`

test('inserts read-only View Invoice component beside Reject in approval row', () => {
  const plugin = invoiceDeletionFullPreview()
  const result = plugin.transform.call({ error: message => { throw new Error(message) } }, fixture, '/repo/src/App.jsx')
  assert.match(result.code, /import InvoiceDeletionPreviewButton from '\.\/InvoiceDeletionPreviewButton\.jsx'/)
  assert.match(result.code, /Reject'}<\/button>\s*<InvoiceDeletionPreviewButton request=\{request\} disabled=\{approving \|\| rejecting\} sortItems=\{sortDeliveryInvoiceItems\}/)
  assert.equal((result.code.match(/InvoiceDeletionPreviewButton request=/g) || []).length, 1)
})

test('does not change unrelated modules', () => {
  const plugin = invoiceDeletionFullPreview()
  assert.equal(plugin.transform('export default 1', '/repo/src/Other.jsx'), null)
})

test('build refuses a changed approval anchor instead of silently omitting preview', () => {
  const plugin = invoiceDeletionFullPreview()
  assert.throws(() => plugin.transform.call({ error: message => { throw new Error(message) } },
    'function renderInvoiceDeletionApprovalCenter() { return null }', '/repo/src/App.jsx'),
  /could not find the unique deletion approval action/)
})


test('missing master invoice sorter blocks insertion', () => {
  const plugin = invoiceDeletionFullPreview()
  const unsafe = fixture.replace('function sortDeliveryInvoiceItems(items) { return [...items] }', '')
  assert.throws(() => plugin.transform.call({ error: message => { throw new Error(message) } }, unsafe, '/repo/src/App.jsx'),
    /could not find the unique deletion approval action/)
})

test('preview uses the canonical sorted items in its table and raw item details', () => {
  const source = readFileSync(new URL('../src/InvoiceDeletionPreviewButton.jsx', import.meta.url), 'utf8')
  assert.match(source, /const displayItems = typeof sortItems === 'function' \? sortItems\(items\) : items/)
  assert.equal((source.match(/displayItems\.map\(/g) || []).length, 2)
  assert.doesNotMatch(source, /\{items\.map\(/)
})
