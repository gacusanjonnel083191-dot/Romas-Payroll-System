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
  const index = src.indexOf(from)
  if (index < 0) throw new Error(`Production Forecast HD patch aborted safely: ${label} anchor not found.`)
  if (src.indexOf(from, index + from.length) >= 0) throw new Error(`Production Forecast HD patch aborted safely: ${label} anchor is not unique.`)
  src = src.slice(0, index) + to + src.slice(index + from.length)
}

// Render the same 4:6 layout at 600 DPI equivalent for crisp text and lines.
replaceOnce(
  "const canvas=await html2canvas(node.firstElementChild,{scale:2,backgroundColor:'#fff',useCORS:true,logging:false,width:800,height:1200})",
  "const canvas=await html2canvas(node.firstElementChild,{scale:3,backgroundColor:'#fff',useCORS:true,logging:false,width:800,height:1200})",
  'HD canvas scale'
)

// Make the Word page explicitly 4 x 6 inches with narrow 0.05-inch margins.
replaceOnce(
  '<w:pgSz w:w=\\"5760\\" w:h=\\"8640\\"/><w:pgMar w:top=\\"144\\" w:right=\\"144\\" w:bottom=\\"144\\" w:left=\\"144\\"/>',
  '<w:pgSz w:w=\\"5760\\" w:h=\\"8640\\" w:orient=\\"portrait\\"/><w:pgMar w:top=\\"72\\" w:right=\\"72\\" w:bottom=\\"72\\" w:left=\\"72\\" w:header=\\"0\\" w:footer=\\"0\\" w:gutter=\\"0\\"/>',
  '4x6 page geometry'
)

// Force the embedded PNG to physically occupy the 3.9 x 5.9 inch printable area.
replaceOnce(
  '<wp:extent cx=\\"3474720\\" cy=\\"5212080\\"/><wp:docPr id=\\"1\\" name=\\"Production Forecast\\"/><a:graphic>',
  '<wp:extent cx=\\"3566160\\" cy=\\"5394960\\"/><wp:effectExtent l=\\"0\\" t=\\"0\\" r=\\"0\\" b=\\"0\\"/><wp:docPr id=\\"1\\" name=\\"Production Forecast\\"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect=\\"1\\"/></wp:cNvGraphicFramePr><a:graphic>',
  'inline image size'
)

// Word also needs the picture transform extent; without it, desktop Word may render the PNG at native/default size.
replaceOnce(
  '<pic:spPr><a:prstGeom prst=\\"rect\\"><a:avLst/></a:prstGeom></pic:spPr>',
  '<pic:spPr><a:xfrm><a:off x=\\"0\\" y=\\"0\\"/><a:ext cx=\\"3566160\\" cy=\\"5394960\\"/></a:xfrm><a:prstGeom prst=\\"rect\\"><a:avLst/></a:prstGeom></pic:spPr>',
  'picture transform'
)

// Add an explicit marker inside the export function for build verification.
replaceOnce(
  `/* ${requiredMarker} */`,
  `/* ${requiredMarker} */\n /* ${marker} */`,
  'HD marker'
)

fs.writeFileSync(path, src, 'utf8')
console.log('Production Forecast HD v3 applied: true 4x6 Word page, full-page image sizing, 600-DPI render.')
