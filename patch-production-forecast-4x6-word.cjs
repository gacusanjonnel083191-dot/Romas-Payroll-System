const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

function fail(message) {
  throw new Error(`Production Forecast 4x6 Word patch aborted safely: ${message}`)
}

function findMatchingBrace(source, openIndex) {
  let depth = 0
  let state = 'code'
  let quote = ''
  let escaped = false
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i]
    const next = source[i + 1]
    if (state === 'line') { if (ch === '\n') state = 'code'; continue }
    if (state === 'block') { if (ch === '*' && next === '/') { state = 'code'; i++ } continue }
    if (state === 'string') {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === quote) state = 'code'
      continue
    }
    if (state === 'template') {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '`') state = 'code'
      continue
    }
    if (ch === '/' && next === '/') { state = 'line'; i++; continue }
    if (ch === '/' && next === '*') { state = 'block'; i++; continue }
    if (ch === '"' || ch === "'") { state = 'string'; quote = ch; continue }
    if (ch === '`') { state = 'template'; continue }
    if (ch === '{') depth++
    if (ch === '}') { depth--; if (depth === 0) return i }
  }
  return -1
}

const printMarkerCandidates = [' const printForecast = () => {', 'const printForecast = () => {', ' const printForecast=()=>{', 'const printForecast=()=>{']
let fnStart = -1
let matchedMarker = ''
for (const marker of printMarkerCandidates) {
  const idx = src.indexOf(marker)
  if (idx >= 0) { fnStart = idx; matchedMarker = marker; break }
}
if (fnStart < 0) fail('printForecast function marker not found.')
const openIndex = src.indexOf('{', fnStart)
const closeIndex = findMatchingBrace(src, openIndex)
if (openIndex < 0 || closeIndex < 0) fail('Could not determine printForecast function boundaries.')
let fnEnd = closeIndex + 1
if (src[fnEnd] === ';') fnEnd++

const exportFunction = String.raw` const printForecast = async () => {
  let exportNode = null
  try {
   const rows = Array.isArray(forecastRows) ? forecastRows : []
   const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))
   const fmtPieces = value => safeNum(value, 0).toLocaleString('en-PH')
   const dateText = (() => {
    const raw = String(forecastDate || '').slice(0, 10)
    const parts = raw.split('-')
    return parts.length === 3 ? parts[1] + ' / ' + parts[2] + ' / ' + parts[0] : raw
   })()
   const rowHtml = rows.map(r => {
    const name = r.variant_name || r.variant || r.product_name || r.name || r.product || 'Variant'
    return '<tr><td>' + esc(name) + '</td><td class="qty">' + fmtPieces(getForecastRowTotal(r)) + '</td></tr>'
   }).join('')

   exportNode = document.createElement('div')
   exportNode.setAttribute('data-production-forecast-word-export', 'true')
   exportNode.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:1200px;background:#fff;z-index:-1;overflow:hidden;'
   exportNode.innerHTML = `
    <div style="width:800px;height:1200px;padding:34px 38px 28px;background:#fff;color:#171717;font-family:Arial,sans-serif;box-sizing:border-box;display:flex;flex-direction:column;">
     <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #d91c1c;padding-bottom:12px;margin-bottom:18px;">
      <div><div style="font-size:28px;font-weight:900;color:#d91c1c;line-height:1;">Roma's Donuts</div><div style="font-size:15px;margin-top:7px;font-weight:700;">Delivery Date: ${esc(dateText)}</div></div>
      <div style="font-size:20px;font-weight:900;color:#d91c1c;letter-spacing:.6px;">PRODUCTION ORDER</div>
     </div>
     <div style="border:3px solid #178b3d;border-radius:14px;padding:14px 16px;text-align:center;background:#f0faf2;margin-bottom:14px;">
      <div style="font-size:14px;font-weight:900;letter-spacing:1.4px;color:#178b3d;">TOTAL DRY PREMIX TO KNEAD</div>
      <div style="font-size:52px;font-weight:900;color:#178b3d;line-height:1.05;margin-top:4px;">${esc(totalDryPremixKg)}</div>
      <div style="font-size:17px;font-weight:800;color:#178b3d;">kilograms</div>
     </div>
     <div style="border:2px solid #e22;border-radius:10px;padding:10px 12px;text-align:center;margin-bottom:14px;">
      <div style="font-size:13px;font-weight:700;">TOTAL PIECES</div>
      <div style="font-size:30px;font-weight:900;color:#d91c1c;line-height:1.1;">${fmtPieces(totalPieces)} pcs</div>
     </div>
     <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:18px;line-height:1.12;">
      <thead><tr><th style="text-align:left;background:#d91c1c;color:#fff;padding:8px 10px;width:72%;">VARIANT</th><th style="text-align:right;background:#d91c1c;color:#fff;padding:8px 10px;width:28%;">PIECES</th></tr></thead>
      <tbody>${rowHtml}</tbody>
      <tfoot><tr><td style="border-top:3px solid #d91c1c;padding:9px 10px;font-weight:900;">TOTAL</td><td style="border-top:3px solid #d91c1c;padding:9px 10px;text-align:right;font-weight:900;color:#d91c1c;">${fmtPieces(totalPieces)}</td></tr></tfoot>
     </table>
     <div style="margin-top:auto;padding-top:15px;border-top:1px solid #888;display:flex;justify-content:space-between;font-size:13px;font-weight:700;"><span>Prepared by: ____________________</span><span>Checked by: ____________________</span></div>
    </div>`
   document.body.appendChild(exportNode)

   const style = document.createElement('style')
   style.textContent = '[data-production-forecast-word-export] tbody td{padding:6px 10px;border-bottom:1px solid #ddd;font-weight:700;}[data-production-forecast-word-export] tbody td.qty{text-align:right;font-weight:900;color:#d91c1c;}'
   exportNode.appendChild(style)

   const canvas = await html2canvas(exportNode.firstElementChild, { scale:2, backgroundColor:'#ffffff', useCORS:true, logging:false, width:800, height:1200 })
   const dataUrl = canvas.toDataURL('image/png', 1)
   const binary = atob(dataUrl.split(',')[1])
   const pngBytes = new Uint8Array(binary.length)
   for (let i = 0; i < binary.length; i++) pngBytes[i] = binary.charCodeAt(i)

   const { zipSync, strToU8 } = await import('fflate')
   const xmlEscape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]))
   const createdIso = new Date().toISOString()
   const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'
   const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'
   const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/production-forecast.png"/></Relationships>'
   const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="3474720" cy="5212080"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="1" name="Production Forecast"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="production-forecast.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3474720" cy="5212080"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><w:sectPr><w:pgSz w:w="5760" w:h="8640"/><w:pgMar w:top="144" w:right="144" w:bottom="144" w:left="144" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>'
   const coreXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Roma\'s Donuts Production Forecast</dc:title><dc:creator>Roma\'s Donuts</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + xmlEscape(createdIso) + '</dcterms:created></cp:coreProperties>'
   const appXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Roma\'s Donuts Business System</Application></Properties>'
   const zipBytes = zipSync({
    '[Content_Types].xml':strToU8(contentTypes),
    '_rels/.rels':strToU8(rootRels),
    'word/document.xml':strToU8(documentXml),
    'word/_rels/document.xml.rels':strToU8(docRels),
    'word/media/production-forecast.png':pngBytes,
    'docProps/core.xml':strToU8(coreXml),
    'docProps/app.xml':strToU8(appXml)
   }, { level:6 })
   const blob = new Blob([zipBytes], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
   const url = URL.createObjectURL(blob)
   const a = document.createElement('a')
   a.href = url
   a.download = 'Romas_Production_Forecast_' + String(forecastDate || 'date').replace(/[^0-9-]/g,'') + '_4x6.docx'
   document.body.appendChild(a)
   a.click()
   a.remove()
   setTimeout(() => URL.revokeObjectURL(url), 1500)
   showToast('Production forecast Word file downloaded (4 x 6 inches).', 'green')
  } catch (err) {
   console.error('Production forecast Word export failed:', err)
   showToast('Could not create the production forecast Word file. Please try again.', 'red')
  } finally {
   if (exportNode?.parentNode) exportNode.parentNode.removeChild(exportNode)
  }
 }`

src = src.slice(0, fnStart) + exportFunction + src.slice(fnEnd)

const uiMarker = '/* PRODUCTION_FORECAST_HIDE_DRY_PREMIX_COLUMN_V1 */'
if (!src.includes(uiMarker)) {
  const insertAt = src.indexOf(' const printForecast = async () => {')
  if (insertAt < 0) fail('Could not locate replaced printForecast for UI integration.')
  const uiEffect = String.raw` /* PRODUCTION_FORECAST_HIDE_DRY_PREMIX_COLUMN_V1 */
 useEffect(() => {
  let observer = null
  let scheduled = false
  const styleId = 'rd-production-forecast-hide-premix'
  if (!document.getElementById(styleId)) {
   const style = document.createElement('style')
   style.id = styleId
   style.textContent = '.rd-forecast-premix-cell{display:none!important}.rd-forecast-clean-table{table-layout:auto!important}'
   document.head.appendChild(style)
  }
  const apply = () => {
   scheduled = false
   document.querySelectorAll('table').forEach(table => {
    const headers = Array.from(table.querySelectorAll('th'))
    const labels = headers.map(h => String(h.textContent || '').trim().toLowerCase())
    const premixIndex = labels.findIndex(label => label === 'dry premix' || label === 'dry premix weight')
    if (premixIndex < 0 || !labels.some(label => label.includes('variant')) || !labels.some(label => label.includes('total pieces'))) return
    table.classList.add('rd-forecast-clean-table')
    table.querySelectorAll('tr').forEach(row => {
     const cells = Array.from(row.children)
     if (cells[premixIndex]) cells[premixIndex].classList.add('rd-forecast-premix-cell')
    })
   })
  }
  const schedule = () => {
   if (scheduled) return
   scheduled = true
   requestAnimationFrame(apply)
  }
  apply()
  observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList:true, subtree:true })
  return () => observer?.disconnect()
 }, [forecastDate, showForecastVariants, deliveryInvoices])

`
  src = src.slice(0, insertAt) + uiEffect + src.slice(insertAt)
}

if (!src.includes('Romas_Production_Forecast_') || !src.includes('PRODUCTION_FORECAST_HIDE_DRY_PREMIX_COLUMN_V1')) fail('Verification markers missing after patch.')

fs.writeFileSync(path, src, 'utf8')
console.log('Production Forecast updated: dry-premix breakdown hidden; PRINT now downloads a 4x6 Word file containing a forecast image.')
