const fs = require('fs')
const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

const requiredMarker = 'PRODUCTION_FORECAST_4X6_WORD_SAFE_V2'
const marker = 'PRODUCTION_FORECAST_HALF_LONG_BOND_V4'

const markerIndex = src.indexOf(requiredMarker)
if (markerIndex < 0) throw new Error('Production Forecast half-long-bond patch aborted safely: safe v2 export is not present.')
if (src.includes(marker)) { console.log('Production Forecast half-long-bond patch already applied.'); process.exit(0) }

// Scope every edit to the Production Forecast export function only.
const regionStart = Math.max(0, markerIndex - 500)
const regionEnd = Math.min(src.length, markerIndex + 30000)
let region = src.slice(regionStart, regionEnd)

function replaceOnceInRegion(from, to, label) {
  const first = region.indexOf(from)
  if (first < 0) throw new Error(`Production Forecast half-long-bond patch aborted safely: ${label} anchor not found.`)
  if (region.indexOf(from, first + from.length) >= 0) throw new Error(`Production Forecast half-long-bond patch aborted safely: ${label} anchor is not unique.`)
  region = region.slice(0, first) + to + region.slice(first + from.length)
}

// Half of Philippine long coupon bond (8.5 x 13 in) is 8.5 x 6.5 in.
// Render the forecast at the same physical aspect ratio, at 3x scale for a crisp Word image.
replaceOnceInRegion(
  "const canvas=await html2canvas(node.firstElementChild,{scale:2,backgroundColor:'#fff',useCORS:true,logging:false,width:800,height:1200})",
  "const canvas=await html2canvas(node.firstElementChild,{scale:3,backgroundColor:'#fff',useCORS:true,logging:false,width:1700,height:1300})",
  'HD canvas scale and half-long-bond aspect ratio'
)

// The safe-v2 template starts at 4 x 6. Replace the actual DOCX page with exactly 8.5 x 6.5 inches.
// 8.5 in = 12240 twips; 6.5 in = 9360 twips. Keep 0.05-in (72 twip) margins.
const pageRe = /<w:pgSz[^>]*\/><w:pgMar[^>]*\/>/
const pageMatch = region.match(pageRe)
if (!pageMatch) throw new Error('Production Forecast half-long-bond patch aborted safely: Word page geometry not found.')
if (!pageMatch[0].includes('5760') || !pageMatch[0].includes('8640')) {
  throw new Error('Production Forecast half-long-bond patch aborted safely: source page is not expected 4 x 6 template.')
}
const pageXml = '<w:pgSz w:w=\\"12240\\" w:h=\\"9360\\" w:orient=\\"landscape\\"/><w:pgMar w:top=\\"72\\" w:right=\\"72\\" w:bottom=\\"72\\" w:left=\\"72\\" w:header=\\"0\\" w:footer=\\"0\\" w:gutter=\\"0\\"/>'
region = region.replace(pageRe, pageXml)

// Fill the printable area: 8.4 x 6.4 inches = 7,680,960 x 5,852,160 EMU.
const extentRe = /<wp:extent[^>]*\/>/
const extentMatch = region.match(extentRe)
if (!extentMatch) throw new Error('Production Forecast half-long-bond patch aborted safely: inline image extent not found.')
region = region.replace(extentRe, '<wp:extent cx=\\"7680960\\" cy=\\"5852160\\"/>')

// Desktop Word requires the picture transform to match the inline drawing extent.
const spPrRe = /<pic:spPr><a:prstGeom[^>]*><a:avLst\/><\/a:prstGeom><\/pic:spPr>/
const spPrMatch = region.match(spPrRe)
if (!spPrMatch) throw new Error('Production Forecast half-long-bond patch aborted safely: picture shape properties not found.')
const eq = '\\' + '"'
const xfrm = '<pic:spPr><a:xfrm><a:off x=' + eq + '0' + eq + ' y=' + eq + '0' + eq + '/><a:ext cx=' + eq + '7680960' + eq + ' cy=' + eq + '5852160' + eq + '/></a:xfrm><a:prstGeom prst=' + eq + 'rect' + eq + '><a:avLst/></a:prstGeom></pic:spPr>'
region = region.replace(spPrRe, xfrm)

// Make the generated forecast artwork itself use the full half-long-bond landscape canvas.
replaceOnceInRegion(
  'width:800px;height:1200px;',
  'width:1700px;height:1300px;',
  'forecast artwork dimensions'
)

replaceOnceInRegion(
  `/* ${requiredMarker} */`,
  `/* ${requiredMarker} */\n /* ${marker} */`,
  'half-long-bond marker'
)

src = src.slice(0, regionStart) + region + src.slice(regionEnd)
fs.writeFileSync(path, src, 'utf8')
console.log('Production Forecast V4 applied: exact 8.5 x 6.5 in half-long-bond Word page, full-page HD forecast image.')
