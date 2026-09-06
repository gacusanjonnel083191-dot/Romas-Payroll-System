const fs = require('fs')
const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

const requiredMarker = 'PRODUCTION_FORECAST_4X6_WORD_SAFE_V2'
const marker = 'PRODUCTION_FORECAST_4X6_WORD_HD_V3'

const markerIndex = src.indexOf(requiredMarker)
if (markerIndex < 0) throw new Error('Production Forecast HD patch aborted safely: safe v2 export is not present.')
if (src.includes(marker)) { console.log('Production Forecast HD 4x6 patch already applied.'); process.exit(0) }

// Scope every XML edit to the Production Forecast export function only.
const regionStart = Math.max(0, markerIndex - 500)
const regionEnd = Math.min(src.length, markerIndex + 30000)
let region = src.slice(regionStart, regionEnd)

function replaceOnceInRegion(from, to, label) {
  const first = region.indexOf(from)
  if (first < 0) throw new Error(`Production Forecast HD patch aborted safely: ${label} anchor not found.`)
  if (region.indexOf(from, first + from.length) >= 0) throw new Error(`Production Forecast HD patch aborted safely: ${label} anchor is not unique inside forecast export.`)
  region = region.slice(0, first) + to + region.slice(first + from.length)
}

// 800 x 1200 CSS layout rendered at scale 3 = 2400 x 3600 px (600 DPI at 4 x 6 inches).
replaceOnceInRegion(
  "const canvas=await html2canvas(node.firstElementChild,{scale:2,backgroundColor:'#fff',useCORS:true,logging:false,width:800,height:1200})",
  "const canvas=await html2canvas(node.firstElementChild,{scale:3,backgroundColor:'#fff',useCORS:true,logging:false,width:800,height:1200})",
  'HD canvas scale'
)

// The DOCX page is 5760 x 8640 twips = 4 x 6 inches. Tighten margins to 0.05 inch.
const pageRe = /<w:pgSz[^>]*\/><w:pgMar[^>]*\/>/
const pageMatch = region.match(pageRe)
if (!pageMatch) throw new Error('Production Forecast HD patch aborted safely: forecast Word page geometry not found.')
if (!pageMatch[0].includes('5760') || !pageMatch[0].includes('8640')) {
  throw new Error('Production Forecast HD patch aborted safely: forecast Word page is not the expected 4 x 6 size.')
}
region = region.replace(pageRe, pageMatch[0].replace(/144/g, '72'))

// Resize only the forecast image drawing box from 3.8 x 5.7 to 3.9 x 5.9 inches.
const extentRe = /<wp:extent[^>]*\/>/
const extentMatch = region.match(extentRe)
if (!extentMatch) throw new Error('Production Forecast HD patch aborted safely: forecast inline image extent not found.')
const resizedExtent = extentMatch[0].replace('3474720', '3566160').replace('5212080', '5394960')
if (resizedExtent === extentMatch[0]) {
  throw new Error('Production Forecast HD patch aborted safely: forecast inline extent values were unexpected: ' + extentMatch[0].slice(0,180))
}
region = region.replace(extentRe, resizedExtent)

// Critical desktop Word fix: add a picture transform matching the inline extent.
const spPrRe = /<pic:spPr><a:prstGeom[^>]*><a:avLst\/><\/a:prstGeom><\/pic:spPr>/
const spPrMatch = region.match(spPrRe)
if (!spPrMatch) throw new Error('Production Forecast HD patch aborted safely: forecast picture shape properties not found.')
const eq = '\\' + '"'
const xfrm = '<pic:spPr><a:xfrm><a:off x=' + eq + '0' + eq + ' y=' + eq + '0' + eq + '/><a:ext cx=' + eq + '3566160' + eq + ' cy=' + eq + '5394960' + eq + '/></a:xfrm><a:prstGeom prst=' + eq + 'rect' + eq + '><a:avLst/></a:prstGeom></pic:spPr>'
region = region.replace(spPrRe, xfrm)

replaceOnceInRegion(
  `/* ${requiredMarker} */`,
  `/* ${requiredMarker} */\n /* ${marker} */`,
  'HD marker'
)

src = src.slice(0, regionStart) + region + src.slice(regionEnd)
fs.writeFileSync(path, src, 'utf8')
console.log('Production Forecast HD v3 applied: exact 4x6 page, 3.9x5.9 image, 600-DPI PNG, desktop Word transform fixed.')
