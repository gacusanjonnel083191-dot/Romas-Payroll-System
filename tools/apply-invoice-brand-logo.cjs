const fs = require('fs')

const file = 'src/App.jsx'
let source = fs.readFileSync(file, 'utf8')

function fail(message) {
  console.error(`[invoice-brand-logo] ${message}`)
  process.exit(1)
}

function replaceRequired(oldText, newText, label) {
  if (source.includes(newText)) return
  if (!source.includes(oldText)) fail(`Expected ${label} was not found.`)
  source = source.replace(oldText, newText)
}

function getBlock(startToken, endToken, label) {
  const start = source.indexOf(startToken)
  const end = source.indexOf(endToken, start + startToken.length)
  if (start < 0 || end < 0 || end <= start) fail(`Could not locate ${label}.`)
  return { start, end, text: source.slice(start, end) }
}

function setBlock(startToken, endToken, updater, label) {
  const found = getBlock(startToken, endToken, label)
  const next = updater(found.text)
  if (next === found.text) fail(`No change produced for ${label}.`)
  source = source.slice(0, found.start) + next + source.slice(found.end)
}

for (const needle of [
  '<w:pgSz w:w="5760" w:h="8640"/>',
  'const MARGIN = 170',
  'function buildDeliveryInvoiceDocxTable(invoice)',
  'function buildDeliveryInvoicesDocxDocument(invoices)',
  'function buildDeliveryInvoicesDocxBlob(invoices)',
  'function downloadDeliveryInvoiceDocxFile(filename, invoices)'
]) {
  if (!source.includes(needle)) fail(`Required current native Word structure is missing: ${needle}`)
}

// Reintroduce the app's real /logo.png as an OOXML media part. This keeps the
// document native/editable in Microsoft Word instead of flattening the invoice
// into a screenshot.
if (!source.includes('async function fetchLogoImageBytes()')) {
  const anchor = 'function buildInvoiceDocxTopSpacer'
  const pos = source.indexOf(anchor)
  if (pos < 0) fail('Could not locate invoice DOCX spacer insertion point.')
  const helpers = `function buildLogoDrawingRun(relId, sizeTwips) {
   const emu = Math.round(sizeTwips * 635)
   return \`<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="\${emu}" cy="\${emu}"/><wp:docPr id="1" name="Roma's Donuts Logo"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="Roma's Donuts Logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="\${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="\${emu}" cy="\${emu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>\`
 }

 function wordImageCell(relId, sizeTwips, opts = {}) {
   const width = safeNum(opts.width, 1000)
   const span = opts.span ? \`<w:gridSpan w:val="\${opts.span}"/>\` : ''
   const paragraph = \`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>\${buildLogoDrawingRun(relId, sizeTwips)}</w:p>\`
   return \`<w:tc><w:tcPr><w:tcW w:w="\${width}" w:type="dxa"/>\${span}<w:vAlign w:val="center"/><w:tcMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tcMar></w:tcPr>\${paragraph}</w:tc>\`
 }

 async function fetchLogoImageBytes() {
   try {
     const response = await fetch('/logo.png', { cache:'no-store' })
     if (!response.ok) throw new Error(\`HTTP \${response.status}\`)
     return new Uint8Array(await response.arrayBuffer())
   } catch (error) {
     console.warn('Roma invoice logo could not be loaded; continuing without logo.', error)
     return null
   }
 }

 `
  source = source.slice(0, pos) + helpers + source.slice(pos)
}

replaceRequired('function buildDeliveryInvoiceDocxTable(invoice) {', 'function buildDeliveryInvoiceDocxTable(invoice, hasLogo) {', 'DOCX table logo flag')
setBlock(
  'function buildDeliveryInvoiceDocxTable(invoice, hasLogo) {',
  'function buildDeliveryInvoicesDocxDocument(invoices) {',
  text => {
    let out = text
    if (!out.includes("wordImageCell('rIdLogo'")) {
      out = out.replace('const rows = []', "const rows = []\n   if (hasLogo) rows.push(wordRow([wordImageCell('rIdLogo', 420, { width:full, span:5 })], 500))")
    }

    const loopStart = out.indexOf('data.productRows.forEach(row => {')
    const loopEnd = out.indexOf('})', loopStart)
    if (loopStart < 0 || loopEnd < 0) fail('Could not locate native Word product loop.')
    const loop = out.slice(loopStart, loopEnd + 2)
    if (!loop.includes('], 280))')) {
      if (!loop.includes('], 320))') && !loop.includes('], 290))')) fail('Unexpected product row height.')
      const patched = loop.replace('], 320))', '], 280))').replace('], 290))', '], 280))')
      out = out.slice(0, loopStart) + patched + out.slice(loopEnd + 2)
    }

    const headers = [['Product',0],['Delivered',1],['Price',2],['Amount',3],['Unsold',4]]
    for (const [label, index] of headers) {
      const plain = `wordCell('${label}', { width:widths[${index}], align:'center', bold:true, size:20 })`
      const branded = `wordCell('${label}', { width:widths[${index}], align:'center', bold:true, size:20, shade:BRAND_RED, color:'FFFFFF' })`
      if (out.includes(plain)) out = out.replace(plain, branded)
      else if (!out.includes(branded)) fail(`Could not brand ${label} header.`)
    }
    return out
  },
  'native Word table'
)

replaceRequired('function buildDeliveryInvoicesDocxDocument(invoices) {', 'function buildDeliveryInvoicesDocxDocument(invoices, hasLogo) {', 'DOCX document logo flag')
setBlock(
  'function buildDeliveryInvoicesDocxDocument(invoices, hasLogo) {',
  'function createCrc32Table()',
  text => {
    if (text.includes('buildDeliveryInvoiceDocxTable(invoice, hasLogo)')) return text + ' '
    if (!text.includes('buildDeliveryInvoiceDocxTable(invoice)')) fail('Could not locate table call in DOCX document.')
    return text.replace('buildDeliveryInvoiceDocxTable(invoice)', 'buildDeliveryInvoiceDocxTable(invoice, hasLogo)')
  },
  'DOCX document table call'
)

setBlock(
  'function buildDeliveryInvoicesDocxBlob(invoices) {',
  'function downloadDeliveryInvoiceDocxFile(filename, invoices) {',
  text => {
    let out = text
    out = out.replace('function buildDeliveryInvoicesDocxBlob(invoices) {', 'function buildDeliveryInvoicesDocxBlob(invoices, logoBytes) {')
    if (!out.includes('const hasLogo = logoBytes instanceof Uint8Array')) {
      out = out.replace(
        'const documentXml = buildDeliveryInvoicesDocxDocument(invoices)',
        'const hasLogo = logoBytes instanceof Uint8Array && logoBytes.length > 0\n   const documentXml = buildDeliveryInvoicesDocxDocument(invoices, hasLogo)'
      )
    }
    if (!out.includes('buildDeliveryInvoicesDocxDocument(invoices, hasLogo)')) fail('Could not connect logo flag to DOCX document.')

    if (!out.includes('Default Extension="png"')) {
      out = out.replace(
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>${hasLogo ? \'<Default Extension="png" ContentType="image/png"/>\' : \'\'}'
      )
    }
    if (!out.includes('Id="rIdLogo"')) {
      const marker = '</Relationships>`\n   const styles ='
      const relation = '${hasLogo ? \'<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>\' : \'\'}'
      const docRelsPos = out.indexOf('const docRels =')
      const stylesPos = out.indexOf('const styles =', docRelsPos)
      if (docRelsPos < 0 || stylesPos < 0) fail('Could not locate DOCX relationships block.')
      const relSegment = out.slice(docRelsPos, stylesPos)
      if (!relSegment.includes('</Relationships>`')) fail('Unexpected DOCX relationships format.')
      const patchedSegment = relSegment.replace('</Relationships>`', `${relation}</Relationships>\``)
      out = out.slice(0, docRelsPos) + patchedSegment + out.slice(stylesPos)
    }

    if (!out.includes("name:'word/media/logo.png'")) {
      const mime = "'application/vnd.openxmlformats-officedocument.wordprocessingml.document'"
      const callStart = out.indexOf('return createStoredZipBlob([')
      const callEnd = out.indexOf(`], ${mime})`, callStart)
      if (callStart < 0 || callEnd < 0) fail('Could not locate DOCX ZIP file list.')
      out = out.slice(0, callEnd) + ",\n     ...(hasLogo ? [{ name:'word/media/logo.png', data:logoBytes }] : [])" + out.slice(callEnd)
    }
    return out
  },
  'DOCX ZIP logo media infrastructure'
)

replaceRequired('function downloadDeliveryInvoiceDocxFile(filename, invoices) {', 'function downloadDeliveryInvoiceDocxFile(filename, invoices, logoBytes) {', 'DOCX download logo parameter')
replaceRequired('const blob = buildDeliveryInvoicesDocxBlob(invoices)', 'const blob = buildDeliveryInvoicesDocxBlob(invoices, logoBytes)', 'DOCX blob logo argument')

replaceRequired(
  'downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoices_4x6_${date}`, dayInvoices)',
  'const logoBytes = await fetchLogoImageBytes()\n     downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoices_4x6_${date}`, dayInvoices, logoBytes)',
  'PRINT ALL branded Word call'
)
replaceRequired(
  'downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoice_4x6_${invoiceNumber}`, [freshInvoice])',
  'const logoBytes = await fetchLogoImageBytes()\n   downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoice_4x6_${invoiceNumber}`, [freshInvoice], logoBytes)',
  'PRINT branded Word call'
)

const requiredFinal = [
  'async function fetchLogoImageBytes()',
  'function buildDeliveryInvoiceDocxTable(invoice, hasLogo)',
  "wordImageCell('rIdLogo', 420, { width:full, span:5 })], 500)",
  'function buildDeliveryInvoicesDocxDocument(invoices, hasLogo)',
  'function buildDeliveryInvoicesDocxBlob(invoices, logoBytes)',
  'function downloadDeliveryInvoiceDocxFile(filename, invoices, logoBytes)',
  "name:'word/media/logo.png'",
  'Id="rIdLogo"',
  'Default Extension="png" ContentType="image/png"',
  '<w:pgSz w:w="5760" w:h="8640"/>',
  'const MARGIN = 170',
  'downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoices_4x6_${date}`, dayInvoices, logoBytes)',
  'downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoice_4x6_${invoiceNumber}`, [freshInvoice], logoBytes)',
  '> PRINT ALL ({invoiceDayFilter})</button>',
  '> PRINT</button>'
]
for (const needle of requiredFinal) if (!source.includes(needle)) fail(`Final verification missing: ${needle}`)

for (const needle of [
  'await downloadDeliveryInvoiceWordImageFile(`Romas_Donuts_Invoices_4x6_${date}`, dayInvoices)',
  'await downloadDeliveryInvoiceWordImageFile(`Romas_Donuts_Invoice_4x6_${invoiceNumber}`, [freshInvoice])',
  '> PRINT ALL PDF ({invoiceDayFilter})</button>',
  '> DOWNLOAD IMAGES</button>',
  '> DOWNLOAD PDF</button>'
]) if (source.includes(needle)) fail(`Old invoice behavior remains: ${needle}`)

fs.writeFileSync(file, source)
console.log('[invoice-brand-logo] Native 4x6 Word invoice now includes Roma branding and logo support.')
