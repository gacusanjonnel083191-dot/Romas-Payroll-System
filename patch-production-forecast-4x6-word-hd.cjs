const fs = require('fs')
const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

const requiredMarker = 'PRODUCTION_FORECAST_4X6_WORD_SAFE_V2'
const marker = 'PRODUCTION_FORECAST_HALF_LONG_BOND_PORTRAIT_COMPACT_V6'
const markerIndex = src.indexOf(requiredMarker)
if (markerIndex < 0) throw new Error('Production Forecast compact portrait patch aborted safely: safe v2 export is not present.')
if (src.includes(marker)) { console.log('Production Forecast compact portrait patch already applied.'); process.exit(0) }

const regionStart = Math.max(0, markerIndex - 500)
const regionEnd = Math.min(src.length, markerIndex + 30000)
let region = src.slice(regionStart, regionEnd)
function replaceOnce(from,to,label){const i=region.indexOf(from);if(i<0)throw new Error(`Production Forecast compact portrait patch aborted safely: ${label} not found.`);if(region.indexOf(from,i+from.length)>=0)throw new Error(`Production Forecast compact portrait patch aborted safely: ${label} not unique.`);region=region.slice(0,i)+to+region.slice(i+from.length)}

// Exact half-long-bond portrait: 6.5 x 8.5 inches. Render at 3x for HD output.
replaceOnce("const canvas=await html2canvas(node.firstElementChild,{scale:2,backgroundColor:'#fff',useCORS:true,logging:false,width:800,height:1200})","const canvas=await html2canvas(node.firstElementChild,{scale:3,backgroundColor:'#fff',useCORS:true,logging:false,width:1300,height:1700})",'HD portrait canvas')

const pageRe=/<w:pgSz[^>]*\/><w:pgMar[^>]*\/>/;const pm=region.match(pageRe);if(!pm||!pm[0].includes('5760')||!pm[0].includes('8640'))throw new Error('Production Forecast compact portrait patch aborted safely: source Word page geometry unexpected.')
region=region.replace(pageRe,'<w:pgSz w:w=\\"9360\\" w:h=\\"12240\\"/><w:pgMar w:top=\\"72\\" w:right=\\"72\\" w:bottom=\\"72\\" w:left=\\"72\\" w:header=\\"0\\" w:footer=\\"0\\" w:gutter=\\"0\\"/>')
const extentRe=/<wp:extent[^>]*\/>/;if(!region.match(extentRe))throw new Error('Production Forecast compact portrait patch aborted safely: image extent missing.');region=region.replace(extentRe,'<wp:extent cx=\\"5852160\\" cy=\\"7680960\\"/>')
const spPrRe=/<pic:spPr><a:prstGeom[^>]*><a:avLst\/><\/a:prstGeom><\/pic:spPr>/;if(!region.match(spPrRe))throw new Error('Production Forecast compact portrait patch aborted safely: picture properties missing.');const eq='\\'+'"';region=region.replace(spPrRe,'<pic:spPr><a:xfrm><a:off x='+eq+'0'+eq+' y='+eq+'0'+eq+'/><a:ext cx='+eq+'5852160'+eq+' cy='+eq+'7680960'+eq+'/></a:xfrm><a:prstGeom prst='+eq+'rect'+eq+'><a:avLst/></a:prstGeom></pic:spPr>')

// Keep the physical 6.5 x 8.5 page but make the actual information block compact and top-aligned.
const oldDims='width:800px;height:1200px;';const dimCount=region.split(oldDims).length-1;if(dimCount<1)throw new Error('Production Forecast compact portrait patch aborted safely: artwork dimensions missing.');region=region.split(oldDims).join('width:1300px;height:1700px;')

// Remove the flex spacer that pushed Prepared/Checked to the very bottom. Put sign-off immediately below the table.
replaceOnce('margin-top:auto;padding-top:13px;border-top:1px solid #888;display:flex','margin-top:22px;padding-top:13px;border-top:1px solid #888;display:flex','bottom spacer')

// Make table rows substantially taller/easier to scan and add full cell borders + a strong vertical divider.
replaceOnce("td.style.padding='5px 9px';td.style.borderBottom='1px solid #ddd';td.style.fontWeight='700'","td.style.padding='10px 12px';td.style.border='1px solid #b8b8b8';td.style.fontWeight='700';td.style.fontSize='20px'",'table cell styling')
replaceOnce("td.style.textAlign='right';td.style.fontWeight='900';td.style.color='#d91c1c'","td.style.textAlign='right';td.style.fontWeight='900';td.style.color='#d91c1c';td.style.borderLeft='2px solid #888'",'pieces column styling')

replaceOnce(`/* ${requiredMarker} */`,`/* ${requiredMarker} */\n /* ${marker} */`,'compact portrait marker')
src=src.slice(0,regionStart)+region+src.slice(regionEnd)
fs.writeFileSync(path,src,'utf8')
console.log(`Production Forecast V6 applied: 6.5 x 8.5 portrait, compact top-aligned content, readable bordered table, no large bottom spacer; resized ${dimCount} artwork anchor(s).`)
