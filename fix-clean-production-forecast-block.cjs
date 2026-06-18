const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-clean-production-forecast-block-${stamp}`

let src = fs.readFileSync(path, 'utf8')
fs.copyFileSync(path, backup)

const startMarker = " // Dry premix weight per piece (grams) after 10% reduction"
const endMarker = " const printForecast = () => {"

const start = src.indexOf(startMarker)
if (start < 0) throw new Error('Production Forecast dry premix start marker not found.')

const end = src.indexOf(endMarker, start)
if (end < 0) throw new Error('printForecast marker not found after dry premix block.')

const cleanBlock = ` // Dry premix weight per piece (grams) after 10% reduction
 const DRY_PREMIX_GRAMS = {
  'Choco Balls': 9.45,
  'Matcha Pops': 0,
  'Taro Pops': 9.45,
  'Strawberry Pops': 9.45,
  'Bavarian Pops': 9.45,
  'Bavarian Bites': 9.45,
  'Choco Lollisticks': 0,
  'Glazed Circlets': 11.7,
  'Cinnamon Rolls': 27,
  'Rings': 27,
  'Shells': 27,
  'Bavarian Midnight': 27,
  'Biscoreo': 27,
  'Fanfans': 31.5,
  'Oreo Dream': 31.5,
  'Almond Glitz': 31.5,
  'Lotus Cloud': 31.5
 }

 const forecastNameKey = (value) => {
  return String(value || '')
   .trim()
   .toLowerCase()
   .replace(/[^a-z0-9]/g, '')
 }

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

  const premixByKey = Object.entries(DRY_PREMIX_GRAMS || {}).reduce((map, [key, value]) => {
   map[forecastNameKey(key)] = safeNum(value, 0)
   return map
  }, {})

  const possibleKeys = [
   name,
   normalizedName,
   name.replace(/pops$/i, ' Pops'),
   name.replace(/balls$/i, ' Balls'),
   name.replace(/bites$/i, ' Bites'),
   name.replace(/circlets$/i, ' Circlets'),
   name.replace(/rolls$/i, ' Rolls'),
   name.replace(/midnight$/i, ' Midnight'),
   name.replace(/dream$/i, ' Dream'),
   name.replace(/glitz$/i, ' Glitz'),
   name.replace(/cloud$/i, ' Cloud')
  ].map(forecastNameKey)

  for (const key of possibleKeys) {
   if (Object.prototype.hasOwnProperty.call(premixByKey, key)) {
    return safeNum(premixByKey[key], 0)
   }
  }

  return 0
 }

 const forecastInvoices = deliveryInvoices.filter(i => i.delivery_date === forecastDate)
 const forecastMap = {}

 forecastInvoices.forEach(inv => {
  ;(inv.delivery_invoice_items || []).forEach(item => {
   const variantName = item.variant_name || item.product_name || item.name || ''
   const key = forecastNameKey(variantName)
   if (!key) return

   if (!forecastMap[key]) {
    forecastMap[key] = {
     variant_name: variantName,
     variant_id: item.variant_id,
     total: 0
    }
   }

   forecastMap[key].total = safeNum(forecastMap[key].total, 0) + safeNum(item.quantity, 0)
  })
 })

 let forecastRows = Object.values(forecastMap)

 const existingForecastKeys = new Set((forecastRows || []).map(row =>
  forecastNameKey(row.variant_name || row.variant || row.product_name || row.name || row.product || '')
 ))

 ;(donutVariants || []).forEach(variant => {
  const variantName = variant?.name || variant?.variant_name || variant?.product_name || ''
  const variantKey = forecastNameKey(variantName)

  if (!variantName || existingForecastKeys.has(variantKey)) return

  forecastRows.push({
   id: variant?.id || variant?.variant_id || \`zero-\${variantKey}\`,
   variant_id: variant?.id || variant?.variant_id || \`zero-\${variantKey}\`,
   variant_name: variantName,
   variant: variantName,
   product_name: variantName,
   name: variantName,
   product: variantName,
   total: 0,
   totalPieces: 0,
   total_pieces: 0,
   pieces: 0,
   quantity: 0,
   qty: 0,
   forecast_qty: 0
  })

  existingForecastKeys.add(variantKey)
 })

 forecastRows = (forecastRows || [])
  .map(row => {
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

 const totalPieces = safeNum((forecastRows || []).reduce((s,r)=>s+getForecastRowTotal(r),0),0)
 const totalDryPremixG = safeNum((forecastRows || []).reduce((s,r)=>s+(getDryPremixGramsPerPiece(r.variant_name)*getForecastRowTotal(r)),0),0)
 const totalDryPremixKg = (safeNum(totalDryPremixG,0)/1000).toFixed(2)

`

src = src.slice(0, start) + cleanBlock + src.slice(end)

// Clean any leftover broken helper references.
src = src.replaceAll('getDryPremixLookupKey', 'forecastNameKey')

// Make printed forecast rows use the clean functions.
src = src.replaceAll(
  'const grams = safeNum(getDryPremixGramsPerPiece(r.variant_name),0)*safeNum(r.total,0)',
  'const grams = getDryPremixGramsPerPiece(r.variant_name)*getForecastRowTotal(r)'
)

src = src.replaceAll(
  'const grams = safeNum(DRY_PREMIX_GRAMS[r.variant_name],0)*safeNum(r.total,0)',
  'const grams = getDryPremixGramsPerPiece(r.variant_name)*getForecastRowTotal(r)'
)

src = src.replaceAll(
  'const grams = (DRY_PREMIX_GRAMS[r.variant_name]||0)*r.total',
  'const grams = getDryPremixGramsPerPiece(r.variant_name)*getForecastRowTotal(r)'
)

src = src.replaceAll(
  "safeNum(r.total,0).toLocaleString('en-PH')",
  "getForecastRowTotal(r).toLocaleString('en-PH')"
)

src = src.replaceAll(
  'r.total.toLocaleString()',
  'getForecastRowTotal(r).toLocaleString()'
)

fs.writeFileSync(path, src, 'utf8')

console.log('DONE: Clean Production Forecast block replaced.')
console.log('Backup:', backup)
