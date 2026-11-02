import html2canvas from 'html2canvas'
import {strToU8, zipSync} from 'fflate'
import {customerRetailInvoiceHtml} from '../../customer-ordering-preview/customer-invoice.mjs'

// Match the reseller invoice's Word paper, image area, and print resolution.
export const RETAIL_INVOICE_WORD_PAGE = Object.freeze({widthMm:110, heightMm:165, marginMm:5, dpi:300})
const {widthMm, heightMm, marginMm, dpi} = RETAIL_INVOICE_WORD_PAGE
const imageWidthMm = widthMm - marginMm * 2
const imageHeightMm = heightMm - marginMm * 2
const px = mm => Math.round(mm / 25.4 * dpi)
const twips = mm => Math.round(mm / 25.4 * 1440)

const drawing = (id, relId) => {
  const width = imageWidthMm * 36000, height = imageHeightMm * 36000, margin = marginMm * 36000
  return `<w:r><w:drawing><wp:anchor xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="0"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>${margin}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${margin}</wp:posOffset></wp:positionV><wp:extent cx="${width}" cy="${height}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${id}" name="Roma's Donuts Retail Invoice ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="Retail Invoice ${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`
}

export function retailInvoiceWordBlob(pngPages) {
  if (!Array.isArray(pngPages) || pngPages.length !== 1) throw new Error('Exactly one invoice image is required for Word export.')
  const body = pngPages.map((_, index) => `<w:p><w:pPr>${index ? '<w:pageBreakBefore/>' : ''}<w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr>${drawing(index + 1, `rIdInvoice${index + 1}`)}</w:p>`).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="${twips(widthMm)}" w:h="${twips(heightMm)}"/><w:pgMar w:top="${twips(marginMm)}" w:right="${twips(marginMm)}" w:bottom="${twips(marginMm)}" w:left="${twips(marginMm)}" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="0"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>`
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  const imageRels = pngPages.map((_, index) => `<Relationship Id="rIdInvoice${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/invoice-${index + 1}.png"/>`).join('')
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${imageRels}</Relationships>`
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`
  const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:doNotAutoCompressPictures/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`
  const entries = {'[Content_Types].xml':strToU8(types),'_rels/.rels':strToU8(rootRels),'word/document.xml':strToU8(xml),'word/_rels/document.xml.rels':strToU8(docRels),'word/styles.xml':strToU8(styles),'word/settings.xml':strToU8(settings)}
  pngPages.forEach((data,index) => { entries[`word/media/invoice-${index + 1}.png`] = data })
  return new Blob([zipSync(entries,{level:0})],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
}

const canvasPng = canvas => new Promise((resolve,reject) => canvas.toBlob(blob => blob ? blob.arrayBuffer().then(buffer => resolve(new Uint8Array(buffer)),reject) : reject(new Error('Could not render the invoice image.')),'image/png'))

async function retailInvoicePngPage(invoice) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden','true')
  Object.assign(frame.style,{position:'fixed',left:'-20000px',top:'0',width:'100mm',height:'165mm',border:'0',opacity:'0',pointerEvents:'none'})
  document.body.appendChild(frame)
  try {
    const doc = frame.contentDocument
    if (!doc) throw new Error('Could not prepare the invoice page.')
    doc.open()
    doc.write(customerRetailInvoiceHtml(invoice).replace('</style>', `
      html,body{box-sizing:border-box;width:100mm!important;max-width:none!important;margin:0!important;padding:0!important;background:#fff!important;font-size:10px!important;line-height:1.2!important}
      body{padding:1.5mm!important}.actions{display:none!important}header{padding-bottom:4px!important}
      h1{font-size:16px!important}.invoice-meta{font-size:9px!important}
      h2{font-size:11px!important;margin:6px 0 2px!important}
      p{margin:4px 0!important}.details{line-height:1.15!important}.muted{font-size:8px!important}.row{gap:6px!important;padding:1px 0!important}
    </style>`))
    doc.close()
    if (doc.fonts?.ready) await doc.fonts.ready
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const body = doc.body
    const captured = await html2canvas(body,{backgroundColor:'#fff',logging:false,scale:dpi/96,windowWidth:Math.ceil(body.scrollWidth),windowHeight:Math.ceil(body.scrollHeight),scrollX:0,scrollY:0})
    const targetWidth = px(imageWidthMm), targetHeight = px(imageHeightMm)
    if (!captured.width || !captured.height) throw new Error('The invoice layout is empty.')
    const scale = Math.min(targetWidth / captured.width, targetHeight / captured.height)
    const drawWidth = Math.max(1,Math.floor(captured.width * scale))
    const drawHeight = Math.max(1,Math.floor(captured.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth; canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not create the invoice page image.')
    ctx.fillStyle = '#fff';ctx.fillRect(0,0,targetWidth,targetHeight)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(captured,Math.floor((targetWidth-drawWidth)/2),0,drawWidth,drawHeight)
    return canvasPng(canvas)
  } finally { frame.remove() }
}

export async function downloadRetailInvoiceWord(invoice) {
  const image = await retailInvoicePngPage(invoice)
  const blob = retailInvoiceWordBlob([image])
  const link = document.createElement('a')
  const objectUrl = URL.createObjectURL(blob)
  link.href = objectUrl
  link.download = `Romas_Donuts_Retail_Invoice_11x16.5cm_${invoice.invoice_number}.docx`
  document.body.appendChild(link)
  try { link.click() } finally { link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),60000) }
}
