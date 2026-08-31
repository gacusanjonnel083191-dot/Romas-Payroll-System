const fs = require('fs')

const file = 'src/App.jsx'
let source = fs.readFileSync(file, 'utf8')

function fail(message) {
  console.error(`[invoice-4x6] ${message}`)
  process.exit(1)
}

function replaceOne(oldText, newText, label) {
  const first = source.indexOf(oldText)
  if (first < 0) fail(`Expected ${label} was not found.`)
  const second = source.indexOf(oldText, first + oldText.length)
  if (second >= 0) fail(`Expected exactly one ${label}, but found more than one.`)
  source = source.slice(0, first) + newText + source.slice(first + oldText.length)
}

function verifyApplied(text) {
  const required = [
    'const DELIVERY_INVOICE_SOURCE_WIDTH_MM = 105',
    'const DELIVERY_INVOICE_SOURCE_HEIGHT_MM = 165',
    'const DELIVERY_INVOICE_PAGE_WIDTH_MM = 101.6',
    'const DELIVERY_INVOICE_PAGE_HEIGHT_MM = 152.4',
    'const DELIVERY_INVOICE_SAFE_MARGIN_MM = 3',
    "invoicePage.querySelectorAll('img').forEach(img => img.remove())",
    'async function downloadDeliveryInvoiceWordImageFile(filename, invoices)',
    '<w:pgSz w:w="5760" w:h="8640"/>',
    'Romas_Donuts_Invoices_4x6_${date}',
    'Romas_Donuts_Invoice_4x6_${invoiceNumber}'
  ]
  for (const needle of required) {
    if (!text.includes(needle)) fail(`Verification failed: missing ${needle}`)
  }
  if (text.includes('await downloadDeliveryInvoicePdfFile(`Romas_Donuts_Delivery_Invoices_${date}`, dayInvoices)')) {
    fail('Verification failed: bulk print still calls the PDF exporter.')
  }
  if (text.includes('await downloadDeliveryInvoicePdfFile(`Romas_Donuts_Invoice_${invoiceNumber}`, [freshInvoice])')) {
    fail('Verification failed: single print still calls the PDF exporter.')
  }
}

if (source.includes('async function downloadDeliveryInvoiceWordImageFile(filename, invoices)')) {
  verifyApplied(source)
  console.log('[invoice-4x6] Patch already applied; no changes needed.')
  process.exit(0)
}

replaceOne(
`const DELIVERY_INVOICE_PAGE_WIDTH_MM = 105
 const DELIVERY_INVOICE_PAGE_HEIGHT_MM = 165
 const DELIVERY_INVOICE_SAFE_MARGIN_MM = 6
 const DELIVERY_INVOICE_EXPORT_DPI = 300`,
`const DELIVERY_INVOICE_SOURCE_WIDTH_MM = 105
 const DELIVERY_INVOICE_SOURCE_HEIGHT_MM = 165
 const DELIVERY_INVOICE_PAGE_WIDTH_MM = 101.6
 const DELIVERY_INVOICE_PAGE_HEIGHT_MM = 152.4
 const DELIVERY_INVOICE_SAFE_MARGIN_MM = 3
 const DELIVERY_INVOICE_EXPORT_DPI = 300`,
'invoice export size constants'
)

const renderStartToken = 'async function renderDeliveryInvoicePageCanvas(invoice) {'
const renderEndToken = 'async function downloadDeliveryInvoicePdfFile(filename, invoices) {'
const renderStart = source.indexOf(renderStartToken)
const renderEnd = source.indexOf(renderEndToken, renderStart)
if (renderStart < 0 || renderEnd < 0 || renderEnd <= renderStart) fail('Could not locate invoice canvas renderer boundaries.')

const newRenderer = `async function renderDeliveryInvoicePageCanvas(invoice) {
   const iframe = document.createElement('iframe')
   iframe.setAttribute('aria-hidden', 'true')
   iframe.style.position = 'fixed'
   iframe.style.left = '-20000px'
   iframe.style.top = '0'
   iframe.style.width = \`\${DELIVERY_INVOICE_SOURCE_WIDTH_MM}mm\`
   iframe.style.height = \`\${DELIVERY_INVOICE_SOURCE_HEIGHT_MM}mm\`
   iframe.style.border = '0'
   iframe.style.opacity = '0'
   iframe.style.pointerEvents = 'none'
   document.body.appendChild(iframe)

   try {
     const frameDocument = iframe.contentDocument
     if (!frameDocument) throw new Error('The browser could not prepare the invoice export page.')
     frameDocument.open()
     frameDocument.write(\`<!doctype html><html><head><meta charset="utf-8">\${buildDeliveryInvoicePrintCSS()}<style>
       html,body{width:\${DELIVERY_INVOICE_SOURCE_WIDTH_MM}mm!important;min-height:\${DELIVERY_INVOICE_SOURCE_HEIGHT_MM}mm!important;height:auto!important;overflow:visible!important;background:#fff!important;}
       .invoice-page{width:\${DELIVERY_INVOICE_SOURCE_WIDTH_MM}mm!important;min-height:\${DELIVERY_INVOICE_SOURCE_HEIGHT_MM}mm!important;height:auto!important;margin:0!important;overflow:visible!important;background:#fff!important;}
       .title-row td{justify-content:center!important;text-align:center!important;}
       .title-row img,.invoice-logo,img[alt*="logo" i]{display:none!important;}
     </style></head><body>\${buildDeliveryInvoicePrintPage(invoice)}</body></html>\`)
     frameDocument.close()

     if (frameDocument.fonts?.ready) await frameDocument.fonts.ready
     await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
     const invoicePage = frameDocument.querySelector('.invoice-page')
     if (!invoicePage) throw new Error('The invoice export layout could not be rendered.')

     // The Word export uses the invoice itself as an image. Remove image branding
     // from the invoice body so only the Roma's Donuts wordmark/title remains.
     invoicePage.querySelectorAll('img').forEach(img => img.remove())

     const pageRect = invoicePage.getBoundingClientRect()
     const sourceWindowWidth = Math.ceil(Math.max(pageRect.width, (DELIVERY_INVOICE_SOURCE_WIDTH_MM / 25.4) * 96))
     const sourceWindowHeight = Math.ceil(Math.max(pageRect.height, invoicePage.scrollHeight, (DELIVERY_INVOICE_SOURCE_HEIGHT_MM / 25.4) * 96))
     const contentCanvas = await html2canvas(invoicePage, {
       backgroundColor:'#ffffff',
       logging:false,
       scale:DELIVERY_INVOICE_EXPORT_DPI / 96,
       useCORS:true,
       windowWidth:sourceWindowWidth,
       windowHeight:sourceWindowHeight,
       scrollX:0,
       scrollY:0
     })

     const pageCanvas = document.createElement('canvas')
     pageCanvas.width = Math.round((DELIVERY_INVOICE_PAGE_WIDTH_MM / 25.4) * DELIVERY_INVOICE_EXPORT_DPI)
     pageCanvas.height = Math.round((DELIVERY_INVOICE_PAGE_HEIGHT_MM / 25.4) * DELIVERY_INVOICE_EXPORT_DPI)
     const marginPx = Math.round((DELIVERY_INVOICE_SAFE_MARGIN_MM / 25.4) * DELIVERY_INVOICE_EXPORT_DPI)
     const targetWidth = pageCanvas.width - (marginPx * 2)
     const targetHeight = pageCanvas.height - (marginPx * 2)
     const scale = Math.min(targetWidth / contentCanvas.width, targetHeight / contentCanvas.height)
     const drawWidth = Math.max(1, Math.round(contentCanvas.width * scale))
     const drawHeight = Math.max(1, Math.round(contentCanvas.height * scale))
     const drawX = Math.round((pageCanvas.width - drawWidth) / 2)
     const drawY = Math.round((pageCanvas.height - drawHeight) / 2)
     const ctx = pageCanvas.getContext('2d')
     if (!ctx) throw new Error('The browser could not create the invoice export canvas.')
     ctx.fillStyle = '#ffffff'
     ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
     ctx.imageSmoothingEnabled = true
     ctx.imageSmoothingQuality = 'high'
     ctx.drawImage(contentCanvas, drawX, drawY, drawWidth, drawHeight)
     return pageCanvas
   } finally {
     iframe.remove()
   }
 }

 `
source = source.slice(0, renderStart) + newRenderer + source.slice(renderEnd)

const wordExporter = `
 function buildDeliveryInvoiceWordImageDrawing(relId, drawingId) {
   const widthEmu = 4 * 914400
   const heightEmu = 6 * 914400
   return \`<w:r><w:drawing><wp:anchor xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251658240" behindDoc="0" locked="1" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="\${widthEmu}" cy="\${heightEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="\${drawingId}" name="Roma's Donuts Invoice \${drawingId}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="\${drawingId}" name="Invoice \${drawingId}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="\${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="\${widthEmu}" cy="\${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>\`
 }

 async function downloadDeliveryInvoiceWordImageFile(filename, invoices) {
   const invoiceList = Array.isArray(invoices) ? invoices : []
   if (!invoiceList.length) throw new Error('No invoices are available for Word export.')

   const imageFiles = []
   for (let idx = 0; idx < invoiceList.length; idx++) {
     const canvas = await renderDeliveryInvoicePageCanvas(invoiceList[idx])
     const blob = await invoiceCanvasToBlob(canvas)
     imageFiles.push(new Uint8Array(await blob.arrayBuffer()))
   }

   const bodyXml = imageFiles.map((_, idx) => {
     const pageBreak = idx > 0 ? '<w:pageBreakBefore/>' : ''
     return \`<w:p><w:pPr>\${pageBreak}<w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr>\${buildDeliveryInvoiceWordImageDrawing(\`rIdInvoice\${idx + 1}\`, idx + 1)}</w:p>\`
   }).join('')

   // True 4 x 6 inch portrait pages. Each page contains one full-page PNG,
   // so Microsoft Word cannot reflow the invoice table or crop its bottom rows.
   const documentXml = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>\${bodyXml}<w:sectPr><w:pgSz w:w="5760" w:h="8640"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="0"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>\`
   const contentTypes = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>\`
   const rootRels = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>\`
   const imageRelationships = imageFiles.map((_, idx) => \`<Relationship Id="rIdInvoice\${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/invoice-\${idx + 1}.png"/>\`).join('')
   const docRels = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>\${imageRelationships}</Relationships>\`
   const styles = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>\`
   const settings = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:doNotAutoCompressPictures/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>\`

   const files = [
     { name:'[Content_Types].xml', data:contentTypes },
     { name:'_rels/.rels', data:rootRels },
     { name:'word/document.xml', data:documentXml },
     { name:'word/_rels/document.xml.rels', data:docRels },
     { name:'word/styles.xml', data:styles },
     { name:'word/settings.xml', data:settings }
   ]
   imageFiles.forEach((data, idx) => files.push({ name:\`word/media/invoice-\${idx + 1}.png\`, data }))

   const docxBlob = createStoredZipBlob(files, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
   downloadGeneratedInvoiceFile(\`\${filename}.docx\`, docxBlob)
 }

`

const payslipMarker = 'function buildPayslipDocxTable(pay, payrollStart, payrollEnd, idx = 0) {'
const payslipAt = source.indexOf(payslipMarker)
if (payslipAt < 0) fail('Could not locate insertion point before payslip DOCX builder.')
source = source.slice(0, payslipAt) + wordExporter + source.slice(payslipAt)

replaceOne(
  'showToast(` Preparing ${dayInvoices.length} printer-safe invoice PDF page(s)...`)',
  'showToast(` Preparing ${dayInvoices.length} 4x6 Word invoice page(s)...`)',
  'bulk PDF preparation toast'
)
replaceOne(
  'await downloadDeliveryInvoicePdfFile(`Romas_Donuts_Delivery_Invoices_${date}`, dayInvoices)',
  'await downloadDeliveryInvoiceWordImageFile(`Romas_Donuts_Invoices_4x6_${date}`, dayInvoices)',
  'bulk PDF exporter call'
)
replaceOne(
  'showToast(` Downloaded ${dayInvoices.length} verified invoice(s) as one printer-safe PDF.`)',
  'showToast(` Downloaded ${dayInvoices.length} verified invoice(s) as one 4x6 Word file.`)',
  'bulk PDF completion toast'
)
replaceOne(
  "showToast(' Preparing printer-safe invoice PDF...')",
  "showToast(' Preparing 4x6 Word invoice...')",
  'single PDF preparation toast'
)
replaceOne(
  'await downloadDeliveryInvoicePdfFile(`Romas_Donuts_Invoice_${invoiceNumber}`, [freshInvoice])',
  'await downloadDeliveryInvoiceWordImageFile(`Romas_Donuts_Invoice_4x6_${invoiceNumber}`, [freshInvoice])',
  'single PDF exporter call'
)
replaceOne(
  "showToast(' Downloaded verified invoice as a printer-safe PDF.')",
  "showToast(' Downloaded verified invoice as a 4x6 Word file.')",
  'single PDF completion toast'
)

verifyApplied(source)
fs.writeFileSync(file, source)
console.log('[invoice-4x6] Applied Word image-page export, true 4x6 sizing, fit-to-page scaling, and logo removal.')
