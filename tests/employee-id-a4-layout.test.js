import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { unzipSync, strFromU8 } from 'fflate'
import { buildEmployeeIdWordBlob } from '../src/employeeIdWord.js'

const templateBytes = readFileSync(new URL('../public/employee-id-a4-template.docx', import.meta.url))
const template = unzipSync(templateBytes)

test('approved A4 geometry retains both left-side ID anchors and blank signing area', () => {
 const xml = strFromU8(template['word/document.xml'])
 assert.match(xml, /<w:pgSz w:w="11909" w:h="16834"/)
 assert.match(xml, /<w:pgMar w:top="648" w:right="792" w:bottom="648" w:left="792"/)
 assert.equal((xml.match(/<wp:extent cx="2011680" cy="2941180"/g) || []).length, 2)
 for (const offset of ['677917', '3898046', '648291', '216907']) {
  assert.ok(xml.includes(`<wp:posOffset>${offset}</wp:posOffset>`))
 }
 assert.equal((xml.match(/<wp:anchor /g) || []).length, 2)
 assert.ok(!xml.includes('<w:t>'), 'no headings or employee text alter the reference layout')
 assert.ok(!Object.keys(template).some(name => name.startsWith('docProps/')))
 assert.ok(template['word/media/image1.png'].length < 100)
 assert.ok(template['word/media/image2.png'].length < 100)
})

test('export replaces only image bytes and keeps every template layout part unchanged', async () => {
 const frontImage = 'data:image/png;base64,' + Buffer.from('synthetic front').toString('base64')
 const backImage = 'data:image/png;base64,' + Buffer.from('synthetic back').toString('base64')
 const blob = buildEmployeeIdWordBlob({templateBytes, frontImage, backImage})
 const output = unzipSync(new Uint8Array(await blob.arrayBuffer()))
 assert.deepEqual(Object.keys(output).sort(),Object.keys(template).sort())
 for (const name of Object.keys(template)) {
  if (!name.startsWith('word/media/')) assert.deepEqual(output[name],template[name], name)
 }
 assert.equal(strFromU8(output['word/media/image2.png']), 'synthetic front')
 assert.equal(strFromU8(output['word/media/image1.png']), 'synthetic back')
})

test('invalid image or missing template cannot produce a document', () => {
 assert.throws(() => buildEmployeeIdWordBlob({templateBytes, frontImage:'invalid', backImage:'invalid'}), /not a PNG/)
})
