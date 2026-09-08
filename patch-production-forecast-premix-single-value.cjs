const fs = require('fs')
const path = process.env.ROMAS_APP_PATH || 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

const marker = 'PRODUCTION_FORECAST_PREMIX_SINGLE_VALUE_V1'
const desiredValue = "'+esc(totalDryPremixKg)+' KG"
if (src.includes(marker) || src.includes(desiredValue)) {
  console.log('Production Forecast premix single-value patch already present; no changes needed.')
  process.exit(0)
}

const safeMarker = 'PRODUCTION_FORECAST_4X6_WORD_SAFE_V2'
const safeIndex = src.indexOf(safeMarker)
if (safeIndex < 0) throw new Error('Production Forecast Word export marker not found. Patch aborted safely.')
const regionStart = Math.max(0, safeIndex - 500)
const regionEnd = Math.min(src.length, safeIndex + 35000)
let region = src.slice(regionStart, regionEnd)

const premixBlockRe = /<div style="border:3px solid #178b3d;border-radius:12px;padding:12px;text-align:center;background:#f0faf2;margin-bottom:11px"><div style="font-size:13px;font-weight:900;color:#178b3d">TOTAL DRY PREMIX TO KNEAD<\/div><div style="font-size:(?:48|62)px;font-weight:900;color:#178b3d">'\+esc\(totalDryPremixKg\)\+'<\/div><div style="font-size:16px;font-weight:800;color:#178b3d">kilograms<\/div><\/div>/
const match = region.match(premixBlockRe)
if (!match) throw new Error('Production Forecast premix summary block not found in expected export region. Patch aborted safely.')

const replacement = `<div style="border:3px solid #178b3d;border-radius:12px;padding:18px 12px;text-align:center;background:#f0faf2;margin-bottom:11px;display:flex;align-items:center;justify-content:center;min-height:92px;box-sizing:border-box"><div style="font-size:58px;line-height:1.10;font-weight:900;color:#178b3d;white-space:nowrap">'+esc(totalDryPremixKg)+' KG</div></div>`
region = region.replace(premixBlockRe, replacement)
region = region.replace(`/* ${safeMarker} */`, `/* ${safeMarker} */\n /* ${marker} */`)

if (!region.includes(desiredValue)) throw new Error('Production Forecast premix value was not converted to the required single-line KG format.')
if (region.includes('TOTAL DRY PREMIX TO KNEAD') || region.includes('>kilograms</div>')) throw new Error('Old premix labels still remain in the Word export region.')

src = src.slice(0, regionStart) + region + src.slice(regionEnd)
fs.writeFileSync(path, src, 'utf8')
console.log('Production Forecast premix summary fixed: single centered value only (example: 59.78 KG).')
