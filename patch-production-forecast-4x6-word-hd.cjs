const fs = require('fs')
const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

const requiredMarker = 'PRODUCTION_FORECAST_4X6_WORD_SAFE_V2'
const marker = 'PRODUCTION_FORECAST_4X6_WORD_HD_V3'

if (!src.includes(requiredMarker)) {
  throw new Error('Production Forecast HD patch aborted safely: safe v2 export is not present.')
}
if (src.includes(marker)) {
  console.log('Production Forecast HD 4x6 patch already applied.')
  process.exit(0)
}

function replaceOnce(from, to, label) {
  const first = src.indexOf(from)
  if (first < 0) throw new Error(`Production Forecast HD patch aborted safely: ${label} anchor not found.`)
  if (src.indexOf(from, first + from.length) >= 0) throw new Error(`Production Forecast HD patch aborted safely: ${label} anchor is not unique.`)
  src = src.slice(0, first) + to + src.slice(first + from.length)
}

// 800 x 1200 CSS layout rendered at scale 3 = 2400 x 3600 pixels,
// equivalent to 600 DPI on a 4 x 6 inch output.
replaceOnce(
  "const canvas=await html2canvas(node.firstElementChild,{scale:2,backgroundColor:'#fff',useCORS:true,logging:false,width:800,height:1200})",
  "const canvas=await html2canvas(node.firstElementChild,{scale:3,backgroundColor:'#fff',useCORS:true,logging:false,width:800,height:1200})",
  'HD canvas scale'
)

// The existing DOCX already declares 5760 x 8640 twips = exactly 4 x 6 inches.
// Tighten its margins from 0.10 inch to 0.05 inch while preserving Word's quote escaping.
const pageRe = /<w:pgSz[^>]*\/><w:pgMar[^>]*\/>/
const pageMatch = src.match(pageRe)
if (!pageMatch) throw new Error('Production Forecast HD patch aborted safely: Word page geometry not found.')
if (!pageMatch[0].includes('5760') || !pageMatch[0].includes('8640')) {
  throw new Error('Production Forecast HD patch aborted safely: Word page is not the expected 4 x 6 geometry.')
}
const newPage = pageMatch[0].replace(/144/g, '72')
src = src.replace(pageRe, newPage)

// Enlarge Word's inline drawing box to 3.9 x 5.9 inches (0.05-inch margins).
// 1 inch = 914400 EMU.
const extentRe = /<wp:extent[^>]*cx=[^>]*cy=[^>]*\/>/
const extentMatch = src.match(extentRe)
if (!extentMatch || !extentMatch[0].includes('3474720') || !extentMatch[0].includes('5212080')) {
  throw new Error('Production Forecast HD patch aborted safely: expected inline image extent not found.')
}
src = src.replace(extentRe, extentMatch[0].replace('3474720', '3566160').replace('5212080', '5394960'))

// Critical Microsoft Word fix: define the picture transform itself.
// Without a:xfrm Word may display the PNG at a small native/default size even when wp:extent is correct.
const spPrRe = /<pic:spPr><a:prstGeom[^>]*><a:avLst\/><\/a:prstGeom><\/pic:spPr>/
const spPrMatch = src.match(spPrRe)
if (!spPrMatch) throw new Error('Production Forecast HD patch aborted safely: picture shape properties not found.')
const escapedQuote = '\\' + '"'
const xfrm = '<pic:spPr><a:xfrm><a:off x=' + escapedQuote + '0' + escapedQuote + ' y=' + escapedQuote + '0' + escapedQuote + '/><a:ext cx=' + escapedQuote + '3566160' + escapedQuote + ' cy=' + escapedQuote + '5394960' + escapedQuote + '/></a:xfrm><a:prstGeom prst=' + escapedQuote + 'rect' + escapedQuote + '><a:avLst/></a:prstGeom></pic:spPr>'
src = src.replace(spPrRe, xfrm)

replaceOnce(
  `/* ${requiredMarker} */`,
  `/* ${requiredMarker} */\n /* ${marker} */`,
  'HD marker'
)

fs.writeFileSync(path, src, 'utf8')
console.log('Production Forecast HD v3 applied: exact 4x6 Word page, near-full-page image, 600-DPI render, Word picture transform fixed.')
