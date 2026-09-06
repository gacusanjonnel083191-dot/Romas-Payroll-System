const fs = require('fs')
const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

const requiredMarker = 'PRODUCTION_FORECAST_4X6_WORD_SAFE_V2'
const marker = 'PRODUCTION_FORECAST_HALF_LONG_BOND_PORTRAIT_V5'

const markerIndex = src.indexOf(requiredMarker)
if (markerIndex < 0) throw new Error('Production Forecast half-long-bond portrait patch aborted safely: safe v2 export is not present.')
if (src.includes(marker)) { console.log('Production Forecast half-long-bond portrait patch already applied.'); process.exit(0) }

const regionStart = Math.max(0, markerIndex - 500)
const regionEnd = Math.min(src.length, markerIndex + 30000)
let region = src.slice(regionStart, regionEnd)

function replaceOnceInRegion(from, to, label) {
  const first = region.indexOf(from)
  if (first < 0) throw new Error(`Production Forecast half-long-bond portrait patch aborted safely: ${label} anchor not found.`)
  if (region.indexOf(from, first + from.length) >= 0) throw new Error(`Production Forecast half-long-bond portrait patch aborted safely: ${label} anchor is not unique.`)
  region = region.slice(0, first) + to + region.slice(first + from.length)
}

// Half of 8.5 x 13 long coupon bond, rotated to portrait: 6.5 x 8.5 inches.
replaceOnceInRegion(
  "const canvas=await html2canvas(node.firstElementChild,{scale:2,backgroundColor:'#fff',useCORS:true,logging:false,width:800,height:1200})",
  "const canvas=await html2canvas(node.firstElementChild,{scale:3,backgroundColor:'#fff',useCORS:true,logging:false,width:1300,height:1700})",
  'HD canvas scale and portrait half-long-bond aspect ratio'
)

// DOCX page: exactly 6.5 x 8.5 inches (9360 x 12240 twips), portrait, 0.05-inch margins.
const pageRe = /<w:pgSz[^>]*\/><w:pgMar[^>]*\/>/
const pageMatch = region.match(pageRe)
if (!pageMatch) throw new Error('Production Forecast half-long-bond portrait patch aborted safely: Word page geometry not found.')
if (!pageMatch[0].includes('5760') || !pageMatch[0].includes('8640')) throw new Error('Production Forecast half-long-bond portrait patch aborted safely: source page is not expected 4 x 6 template.')
const pageXml = '<w:pgSz w:w=\\"9360\\" w:h=\\"12240\\"/><w:pgMar w:top=\\"72\\" w:right=\\"72\\" w:bottom=\\"72\\" w:left=\\"72\\" w:header=\\"0\\" w:footer=\\"0\\" w:gutter=\\"0\\"/>'
region = region.replace(pageRe, pageXml)

// Printable image area: 6.4 x 8.4 inches.
const extentRe = /<wp:extent[^>]*\/>/
if (!region.match(extentRe)) throw new Error('Production Forecast half-long-bond portrait patch aborted safely: inline image extent not found.')
region = region.replace(extentRe, '<wp:extent cx=\\"5852160\\" cy=\\"7680960\\"/>')

const spPrRe = /<pic:spPr><a:prstGeom[^>]*><a:avLst\/><\/a:prstGeom><\/pic:spPr>/
if (!region.match(spPrRe)) throw new Error('Production Forecast half-long-bond portrait patch aborted safely: picture shape properties not found.')
const eq = '\\' + '"'
const xfrm = '<pic:spPr><a:xfrm><a:off x=' + eq + '0' + eq + ' y=' + eq + '0' + eq + '/><a:ext cx=' + eq + '5852160' + eq + ' cy=' + eq + '7680960' + eq + '/></a:xfrm><a:prstGeom prst=' + eq + 'rect' + eq + '><a:avLst/></a:prstGeom></pic:spPr>'
region = region.replace(spPrRe, xfrm)

// Safe-v2 uses this in both the off-screen host and artwork. Make both portrait.
const oldDims = 'width:800px;height:1200px;'
const dimCount = region.split(oldDims).length - 1
if (dimCount < 1) throw new Error('Production Forecast half-long-bond portrait patch aborted safely: forecast artwork dimensions not found.')
region = region.split(oldDims).join('width:1300px;height:1700px;')

replaceOnceInRegion(
  `/* ${requiredMarker} */`,
  `/* ${requiredMarker} */\n /* ${marker} */`,
  'half-long-bond portrait marker'
)

src = src.slice(0, regionStart) + region + src.slice(regionEnd)
fs.writeFileSync(path, src, 'utf8')
console.log(`Production Forecast V5 applied: exact 6.5 x 8.5 in portrait half-long-bond Word page, HD image; resized ${dimCount} artwork dimension anchor(s).`)
