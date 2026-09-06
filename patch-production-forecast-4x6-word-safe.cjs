const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

const marker = 'PRODUCTION_FORECAST_4X6_WORD_SAFE_V1'
if (src.includes(marker)) {
  console.log('Safe Production Forecast 4x6 Word patch already applied.')
  process.exit(0)
}

function fail(message) {
  throw new Error(`Production Forecast safe 4x6 patch aborted: ${message}`)
}

function findMatchingBrace(source, openIndex) {
  let depth = 0
  let mode = 'code'
  let quote = ''
  let escaped = false
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i]
    const next = source[i + 1]
    if (mode === 'line') { if (ch === '\n') mode = 'code'; continue }
    if (mode === 'block') { if (ch === '*' && next === '/') { mode = 'code'; i++ } continue }
    if (mode === 'string') {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === quote) mode = 'code'
      continue
    }
    if (mode === 'template') {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '`') mode = 'code'
      continue
    }
    if (ch === '/' && next === '/') { mode = 'line'; i++; continue }
    if (ch === '/' && next === '*') { mode = 'block'; i++; continue }
    if (ch === '"' || ch === "'") { mode = 'string'; quote = ch; continue }
    if (ch === '`') { mode = 'template'; continue }
    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

const fnAnchors = [' const printForecast = () => {', 'const printForecast = () => {', ' const printForecast=()=>{', 'const printForecast=()=>{']
let fnStart = -1
for (const anchor of fnAnchors) {
  const idx = src.indexOf(anchor)
  if (idx >= 0) { fnStart = idx; break }
}
if (fnStart < 0) fail('printForecast function not found.')
const openIndex = src.indexOf('{', fnStart)
const closeIndex = findMatchingBrace(src, openIndex)
if (openIndex < 0 || closeIndex < 0) fail('printForecast boundaries could not be resolved.')
let fnEnd = closeIndex + 1
if (src[fnEnd] === ';') fnEnd++

const exportFunction = ` const printForecast = async () => {\n  /* ${marker} */\n  let exportNode = null\n  try {\n   const rows = Array.isArray(forecastRows) ? forecastRows : []\n   const esc = value => String(value ?? '').replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[ch]))\n   const fmt = value => safeNum(value, 0).toLocaleString('en-PH')\n   const rawDate = String(forecastDate || '').slice(0, 10)\n   const dateParts = rawDate.split('-')\n   const dateText = dateParts.length === 3 ? dateParts[1] + ' / ' + dateParts[2] + ' / ' + dateParts[0] : rawDate\n   const rowHtml = rows.map(row => {\n    const name = row.variant_name || row.variant || row.product_name || row.name || row.product || 'Variant'\n    return '<tr><td>' + esc(name) + '</td><td class=\"qty\">' + fmt(getForecastRowTotal(row)) + '</td></tr>'\n   }).join('')\n\n   exportNode = document.createElement('div')\n   exportNode.setAttribute('data-rd-forecast-export', 'true')\n   exportNode.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:1200px;background:#fff;overflow:hidden;pointer-events:none;'\n   exportNode.innerHTML = '<div style=\"width:800px;height:1200px;padding:32px 36px 26px;background:#fff;color:#171717;font-family:Arial,sans-serif;box-sizing:border-box;display:flex;flex-direction:column;\">' +\n    '<div style=\"display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #d91c1c;padding-bottom:11px;margin-bottom:14px;\">' +\n     '<div><div style=\"font-size:27px;font-weight:900;color:#d91c1c;line-height:1;\">Roma\\'s Donuts</div><div style=\"font-size:14px;margin-top:6px;font-weight:700;\">Delivery Date: ' + esc(dateText) + '</div></div>' +\n     '<div style=\"font-size:19px;font-weight:900;color:#d91c1c;letter-spacing:.5px;\">PRODUCTION ORDER</div>' +\n    '</div>' +\n    '<div style=\"border:3px solid #178b3d;border-radius:12px;padding:12px 14px;text-align:center;background:#f0faf2;margin-bottom:11px;\">' +\n     '<div style=\"font-size:13px;font-weight:900;letter-spacing:1.2px;color:#178b3d;\">TOTAL DRY PREMIX TO KNEAD</div>' +\n     '<div style=\"font-size:48px;font-weight:900;color:#178b3d;line-height:1.03;margin-top:3px;\">' + esc(totalDryPremixKg) + '</div>' +\n     '<div style=\"font-size:16px;font-weight:800;color:#178b3d;\">kilograms</div>' +\n    '</div>' +\n    '<div style=\"border:2px solid #e22;border-radius:9px;padding:8px 10px;text-align:center;margin-bottom:11px;\">' +\n     '<div style=\"font-size:12px;font-weight:700;\">TOTAL PIECES</div><div style=\"font-size:28px;font-weight:900;color:#d91c1c;line-height:1.1;\">' + fmt(totalPieces) + ' pcs</div>' +\n    '</div>' +\n    '<table style=\"width:100%;border-collapse:collapse;table-layout:fixed;font-size:17px;line-height:1.08;\"><thead><tr>' +\n     '<th style=\"text-align:left;background:#d91c1c;color:#fff;padding:7px 9px;width:72%;\">VARIANT</th>' +\n     '<th style=\"text-align:right;background:#d91c1c;color:#fff;padding:7px 9px;width:28%;\">PIECES</th>' +\n    '</tr></thead><tbody>' + rowHtml + '</tbody><tfoot><tr>' +\n     '<td style=\"border-top:3px solid #d91c1c;padding:8px 9px;font-weight:900;\">TOTAL</td>' +\n     '<td style=\"border-top:3px solid #d91c1c;padding:8px 9px;text-align:right;font-weight:900;color:#d91c1c;\">' + fmt(totalPieces) + '</td>' +\n    '</tr></tfoot></table>' +\n    '<div style=\"margin-top:auto;padding-top:13px;border-top:1px solid #888;display:flex;justify-content:space-between;font-size:12px;font-weight:700;\"><span>Prepared by: __________________</span><span>Checked by: __________________</span></div>' +\n   '</div>'\n   document.body.appendChild(exportNode)\n\n   const css = document.createElement('style')\n   css.textContent = '[data-rd-forecast-export] tbody td{padding:5px 9px;border-bottom:1px solid #ddd;font-weight:700}[data-rd-forecast-export] tbody td.qty{text-align:right;font-weight:900;color:#d91c1c}'\n   exportNode.appendChild(css)\n\n   const canvas = await html2canvas(exportNode.firstElementChild, { scale:2, backgroundColor:'#ffffff', useCORS:true, logging:false, width:800, height:1200 })\n   const dataUrl = canvas.toDataURL('image/png', 1)\n   const binary = atob(dataUrl.split(',')[1])\n   const pngBytes = new Uint8Array(binary.length)\n   for (let i = 0; i < binary.length; i++) pngBytes[i] = binary.charCodeAt(i)\n\n   const { zipSync, strToU8 } = await import('fflate')\n   const createdIso = new Date().toISOString()\n   const contentTypes = '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Default Extension=\"png\" ContentType=\"image/png\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/><Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/><Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/></Types>'\n   const rootRels = '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/><Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties\" Target=\"docProps/app.xml\"/></Relationships>'\n   const docRels = '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image\" Target=\"media/production-forecast.png\"/></Relationships>'\n   const documentXml = '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><w:body><w:p><w:pPr><w:jc w:val=\"center\"/><w:spacing w:before=\"0\" w:after=\"0\"/></w:pPr><w:r><w:drawing><wp:inline distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\"><wp:extent cx=\"3474720\" cy=\"5212080\"/><wp:docPr id=\"1\" name=\"Production Forecast\"/><a:graphic><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><pic:pic><pic:nvPicPr><pic:cNvPr id=\"0\" name=\"production-forecast.png\"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed=\"rId1\"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"3474720\" cy=\"5212080\"/></a:xfrm><a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><w:sectPr><w:pgSz w:w=\"5760\" w:h=\"8640\"/><w:pgMar w:top=\"144\" w:right=\"144\" w:bottom=\"144\" w:left=\"144\" w:header=\"0\" w:footer=\"0\" w:gutter=\"0\"/></w:sectPr></w:body></w:document>'\n   const coreXml = '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><dc:title>Roma&apos;s Donuts Production Forecast</dc:title><dc:creator>Roma&apos;s Donuts</dc:creator><dcterms:created xsi:type=\"dcterms:W3CDTF\">' + createdIso + '</dcterms:created></cp:coreProperties>'\n   const appXml = '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\"><Application>Roma&apos;s Donuts Business System</Application></Properties>'\n   const zipBytes = zipSync({ '[Content_Types].xml':strToU8(contentTypes), '_rels/.rels':strToU8(rootRels), 'word/document.xml':strToU8(documentXml), 'word/_rels/document.xml.rels':strToU8(docRels), 'word/media/production-forecast.png':pngBytes, 'docProps/core.xml':strToU8(coreXml), 'docProps/app.xml':strToU8(appXml) }, { level:6 })\n   const blob = new Blob([zipBytes], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })\n   const url = URL.createObjectURL(blob)\n   const link = document.createElement('a')\n   link.href = url\n   link.download = 'Romas_Production_Forecast_' + String(forecastDate || 'date').replace(/[^0-9-]/g,'') + '_4x6.docx'\n   document.body.appendChild(link)\n   link.click()\n   link.remove()\n   setTimeout(() => URL.revokeObjectURL(url), 1500)\n   showToast('Production forecast Word file downloaded (4 x 6 inches).', 'green')\n  } catch (err) {\n   console.error('Production forecast 4x6 Word export failed:', err)\n   showToast('Could not create the 4 x 6 Word forecast. Please try again.', 'red')\n  } finally {\n   if (exportNode?.parentNode) exportNode.parentNode.removeChild(exportNode)\n  }\n }`

src = src.slice(0, fnStart) + exportFunction + src.slice(fnEnd)

const baselineIndex = src.indexOf('Invoice Production Baseline')
const nextSectionIndex = src.indexOf("Tomorrow's Risk & Release Plan", baselineIndex)
if (baselineIndex < 0 || nextSectionIndex < 0) fail('Production Forecast UI section anchors were not found.')
const tableIndex = src.indexOf('<table', baselineIndex)
if (tableIndex < 0 || tableIndex > nextSectionIndex) fail('Production Forecast table was not found inside its section.')
const tableOpenEnd = src.indexOf('>', tableIndex)
if (tableOpenEnd < 0 || tableOpenEnd > nextSectionIndex) fail('Production Forecast table opening tag is malformed.')

const opening = src.slice(tableIndex, tableOpenEnd + 1)
if (!opening.includes('data-rd-production-forecast-table')) {
  const markedOpening = opening.slice(0, -1) + ' data-rd-production-forecast-table="true">'
  src = src.slice(0, tableIndex) + markedOpening + src.slice(tableOpenEnd + 1)
}

const styleInsertIndex = src.indexOf('<table', baselineIndex)
const styleJsx = `<style>{\`[data-rd-production-forecast-table="true"] th:nth-child(n+3),[data-rd-production-forecast-table="true"] td:nth-child(n+3){display:none!important}[data-rd-production-forecast-table="true"]{table-layout:auto!important}\`}</style>\n`
src = src.slice(0, styleInsertIndex) + styleJsx + src.slice(styleInsertIndex)

if (!src.includes(marker)) fail('Export marker missing after patch.')
if (!src.includes('data-rd-production-forecast-table="true"')) fail('Forecast table marker missing after patch.')
if (src.includes('PRODUCTION_FORECAST_HIDE_DRY_PREMIX_COLUMN_V1')) fail('Unsafe legacy forecast observer marker is still present.')

fs.writeFileSync(path, src, 'utf8')
console.log('Production Forecast safely updated: only Variant/Pieces remain; PRINT downloads 4x6 Word image report.')
