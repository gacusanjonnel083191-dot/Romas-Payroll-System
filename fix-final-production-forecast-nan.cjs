const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-final-production-forecast-nan-fix-${stamp}`

let src = fs.readFileSync(path, 'utf8')
fs.copyFileSync(path, backup)

let changes = 0

function logUpdate(label) {
  changes++
  console.log('UPDATED:', label)
}

const dryIdx = src.indexOf('const DRY_PREMIX_GRAMS = {')
if (dryIdx < 0) throw new Error('DRY_PREMIX_GRAMS block not found.')

const zeroPatchIdx = src.indexOf('// FORECAST ZERO-QTY ACTIVE VARIANTS PATCH', dryIdx)
if (zeroPatchIdx < 0) throw new Error('FORECAST ZERO-QTY ACTIVE VARIANTS PATCH block not found.')

// 1) Make invoice quantity accumulation safe.
const beforeQty = src
src = src.replaceAll(
  'forecastMap[key].total += Number(item.quantity||0)',
  'forecastMap[key].total = safeNum(forecastMap[key].total, 0) + safeNum(item.quantity, 0)'
)
if (src !== beforeQty) logUpdate('safe invoice quantity accumulation')

// 2) Add forecast helper functions in the correct outer scope.
if (!src.includes('// SAFE PRODUCTION FORECAST NUMBER HELPERS')) {
  const helperBlock = `
 // SAFE PRODUCTION FORECAST NUMBER HELPERS
 const getForecastRowTotal = (row) => {
  const raw = row?.total ?? row?.totalPieces ?? row?.total_pieces ?? row?.pieces ?? row?.forecast_qty ?? row?.quantity ?? row?.qty ?? 0
  const n = safeNum(raw, 0)
  return Number.isFinite(n) ? n : 0
 }

 const getDryPremixGramsPerPiece = (variantName) => {
  const name = String(variantName || '').trim()
  const normalizedName = typeof normalizeDonutVariantName === 'function'
   ? normalizeDonutVariantName(name)
   : name
  const direct = DRY_PREMIX_GRAMS[name]
  const normalized = DRY_PREMIX_GRAMS[normalizedName]
  const n = safeNum(direct ?? normalized ?? 0, 0)
  return Number.isFinite(n) ? n : 0
 }

`
  src = src.slice(0, zeroPatchIdx) + helperBlock + src.slice(zeroPatchIdx)
  logUpdate('outer-scope forecast helpers')
}

// 3) Add final sanitizer before totals are calculated.
const newZeroPatchIdx = src.indexOf('// FORECAST ZERO-QTY ACTIVE VARIANTS PATCH', dryIdx)
const totalIdx = src.indexOf('\n const totalPieces =', newZeroPatchIdx)
if (totalIdx < 0) throw new Error('totalPieces line not found after forecastRows block.')

const betweenZeroAndTotal = src.slice(newZeroPatchIdx, totalIdx)
if (!betweenZeroAndTotal.includes('// SAFE FINAL FORECAST ROW SANITIZER')) {
  const sanitizer = `
 // SAFE FINAL FORECAST ROW SANITIZER
 forecastRows = (forecastRows || [])
  .map((row) => {
   const cleanTotal = getForecastRowTotal(row)
   return {
    ...row,
    total: cleanTotal,
    totalPieces: cleanTotal,
    total_pieces: cleanTotal,
    pieces: cleanTotal,
    quantity: cleanTotal,
    qty: cleanTotal,
    forecast_qty: cleanTotal
   }
  })
  .sort(compareDonutVariantRowsByGuide)

`
  src = src.slice(0, totalIdx) + sanitizer + src.slice(totalIdx)
  logUpdate('final forecast row sanitizer')
}

// 4) Replace total calculations with safe calculations.
src = src.replace(
  / const totalPieces = .*forecastRows\.reduce.*\n/,
  " const totalPieces = safeNum((forecastRows || []).reduce((s,r)=>s+getForecastRowTotal(r),0),0)\n"
)

src = src.replace(
  / const totalDryPremixG = .*forecastRows\.reduce.*\n/,
  " const totalDryPremixG = safeNum((forecastRows || []).reduce((s,r)=>s+(getDryPremixGramsPerPiece(r.variant_name)*getForecastRowTotal(r)),0),0)\n"
)

src = src.replace(
  / const totalDryPremixKg = .*\n/,
  " const totalDryPremixKg = (safeNum(totalDryPremixG,0)/1000).toFixed(2)\n"
)
logUpdate('safe total pieces and dry premix calculations')

// 5) Make displayed grams/pieces safe everywhere in the forecast map.
src = src.replaceAll(
  'const grams = safeNum(getDryPremixGramsPerPiece(r.variant_name),0)*safeNum(r.total,0)',
  'const grams = getDryPremixGramsPerPiece(r.variant_name)*getForecastRowTotal(r)'
)

src = src.replaceAll(
  "safeNum(r.total,0).toLocaleString('en-PH')",
  "getForecastRowTotal(r).toLocaleString('en-PH')"
)

src = src.replaceAll(
  'safeNum(r.total,0).toLocaleString()',
  'getForecastRowTotal(r).toLocaleString()'
)

src = src.replaceAll(
  'r.total.toLocaleString()',
  'getForecastRowTotal(r).toLocaleString()'
)
logUpdate('safe forecast display values')

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
console.log('Total update groups:', changes)
