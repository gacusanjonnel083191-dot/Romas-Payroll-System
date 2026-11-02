import assert from 'node:assert/strict'
import {test} from 'node:test'
import {strFromU8, unzipSync} from 'fflate'
import {RETAIL_INVOICE_WORD_PAGE, retailInvoiceWordBlob} from '../../src/customerOrders/retailInvoiceWord.mjs'

test('retail invoice Word export matches reseller paper and embeds exactly one invoice image', async () => {
  const image = new Uint8Array([137,80,78,71,13,10,26,10])
  const blob = retailInvoiceWordBlob([image])
  const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  const documentXml = strFromU8(entries['word/document.xml'])
  const relationships = strFromU8(entries['word/_rels/document.xml.rels'])
  assert.equal(blob.type,'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  assert.deepEqual(RETAIL_INVOICE_WORD_PAGE,{widthMm:110,heightMm:165,marginMm:5,dpi:300})
  assert.match(documentXml,/<w:pgSz w:w="6236" w:h="9354"\/>/)
  assert.match(documentXml,/<w:pgMar w:top="283" w:right="283" w:bottom="283" w:left="283"/)
  assert.equal((documentXml.match(/<wp:anchor /g)||[]).length,1)
  assert.doesNotMatch(documentXml,/<w:pageBreakBefore\/>/)
  assert.match(relationships,/Target="media\/invoice-1.png"/)
  assert.deepEqual(entries['word/media/invoice-1.png'],image)
  assert.equal(entries['word/media/invoice-2.png'],undefined)
  assert.throws(()=>retailInvoiceWordBlob([image,image]),/Exactly one/)
})
