const fs = require('fs')
const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

const requiredMarker = 'PRODUCTION_FORECAST_4X6_WORD_SAFE_V2'
const marker = 'PRODUCTION_FORECAST_HALF_LONG_BOND_PORTRAIT_FILLED_V7'
const markerIndex = src.indexOf(requiredMarker)
if (markerIndex < 0) throw new Error('Production Forecast filled portrait patch aborted safely: safe v2 export is not present.')
if (src.includes(marker)) { console.log('Production Forecast filled portrait patch already applied.'); process.exit(0) }

const regionStart = Math.max(0, markerIndex - 500)
const regionEnd = Math.min(src.length, markerIndex + 30000)
let region = src.slice(regionStart, regionEnd)
function replaceOnce(from,to,label){const i=region.indexOf(from);if(i<0)throw new Error(`Production Forecast filled portrait patch aborted safely: ${label} not found.`);if(region.indexOf(from,i+from.length)>=0)throw new Error(`Production Forecast filled portrait patch aborted safely: ${label} not unique.`);region=region.slice(0,i)+to+region.slice(i+from.length)}

replaceOnce("const canvas=await html2canvas(node.firstElementChild,{scale:2,backgroundColor:'#fff',useCORS:true,logging:false,width:800,height:1200})","const canvas=await html2canvas(node.firstElementChild,{scale:3,backgroundColor:'#fff',useCORS:true,logging:false,width:1300,height:1700})",'HD portrait canvas')

const pageRe=/<w:pgSz[^>]*\/><w:pgMar[^>]*\/>/;const pm=region.match(pageRe);if(!pm||!pm[0].includes('5760')||!pm[0].includes('8640'))throw new Error('Production Forecast filled portrait patch aborted safely: source Word page geometry unexpected.')
region=region.replace(pageRe,'<w:pgSz w:w=\\"9360\\" w:h=\\"12240\\"/><w:pgMar w:top=\\"72\\" w:right=\\"72\\" w:bottom=\\"72\\" w:left=\\"72\\" w:header=\\"0\\" w:footer=\\"0\\" w:gutter=\\"0\\"/>')
const extentRe=/<wp:extent[^>]*\/>/;if(!region.match(extentRe))throw new Error('Production Forecast filled portrait patch aborted safely: image extent missing.');region=region.replace(extentRe,'<wp:extent cx=\\"5852160\\" cy=\\"7680960\\"/>')
const spPrRe=/<pic:spPr><a:prstGeom[^>]*><a:avLst\/><\/a:prstGeom><\/pic:spPr>/;if(!region.match(spPrRe))throw new Error('Production Forecast filled portrait patch aborted safely: picture properties missing.');const eq='\\'+'"';region=region.replace(spPrRe,'<pic:spPr><a:xfrm><a:off x='+eq+'0'+eq+' y='+eq+'0'+eq+'/><a:ext cx='+eq+'5852160'+eq+' cy='+eq+'7680960'+eq+'/></a:xfrm><a:prstGeom prst='+eq+'rect'+eq+'><a:avLst/></a:prstGeom></pic:spPr>')

const oldDims='width:800px;height:1200px;';const dimCount=region.split(oldDims).length-1;if(dimCount<1)throw new Error('Production Forecast filled portrait patch aborted safely: artwork dimensions missing.');region=region.split(oldDims).join('width:1300px;height:1700px;')

replaceOnce('margin-top:auto;padding-top:13px;border-top:1px solid #888;display:flex','margin-top:28px;padding-top:18px;border-top:2px solid #888;display:flex','bottom spacer')

replaceOnce('<table style=\\"width:100%;border-collapse:collapse;table-layout:fixed;font-size:17px\\"','<table style=\\"width:86%;margin:0 auto;border-collapse:collapse;table-layout:fixed;font-size:22px\\"','table width')
replaceOnce('padding:7px 9px;width:72%','padding:10px 14px;width:68%','variant header width')
replaceOnce('padding:7px 9px;width:28%','padding:10px 14px;width:32%','pieces header width')

replaceOnce("td.style.padding='5px 9px';td.style.borderBottom='1px solid #ddd';td.style.fontWeight='700'","td.style.padding='16px 16px';td.style.border='1.5px solid #a9a9a9';td.style.fontWeight='700';td.style.fontSize='24px';td.style.lineHeight='1.08'",'table cell styling')
replaceOnce("td.style.textAlign='right';td.style.fontWeight='900';td.style.color='#d91c1c'","td.style.textAlign='right';td.style.fontWeight='900';td.style.color='#d91c1c';td.style.borderLeft='2.5px solid #777';td.style.fontSize='25px'",'pieces column styling')

replaceOnce('padding:32px 36px 26px','padding:42px 54px 34px','page inner padding')
replaceOnce('font-size:27px;font-weight:900;color:#d91c1c','font-size:34px;font-weight:900;color:#d91c1c','brand heading')
replaceOnce('font-size:19px;font-weight:900;color:#d91c1c','font-size:26px;font-weight:900;color:#d91c1c','production order heading')
replaceOnce('font-size:48px;font-weight:900;color:#178b3d','font-size:62px;font-weight:900;color:#178b3d','premix total size')
replaceOnce('font-size:28px;font-weight:900;color:#d91c1c','font-size:38px;font-weight:900;color:#d91c1c','pieces total size')

replaceOnce(`/* ${requiredMarker} */`,`/* ${requiredMarker} */\n /* ${marker} */`,'filled portrait marker')
src=src.slice(0,regionStart)+region+src.slice(regionEnd)
fs.writeFileSync(path,src,'utf8')
console.log(`Production Forecast V7 applied: 6.5 x 8.5 portrait, page-filled readable layout, centered compact-width table, ruled cells; resized ${dimCount} artwork anchor(s).`)
