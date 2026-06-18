const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-dry-premix-name-lookup-fix-${stamp}`

let src = fs.readFileSync(path, 'utf8')
fs.copyFileSync(path, backup)

let changes = 0

function replaceOnce(from, to, label) {
  if (!src.includes(from)) {
    console.log('NOT FOUND:', label)
    return false
  }
  src = src.replace(from, to)
  changes++
  console.log('UPDATED:', label)
  return true
}

const oldFunction = ` const getDryPremixGramsPerPiece = (variantName) => {
  const name = String(variantName || '').trim()
  const normalizedName = typeof normalizeDonutVariantName === 'function'
   ? normalizeDonutVariantName(name)
   : name
  const direct = DRY_PREMIX_GRAMS[name]
  const normalized = DRY_PREMIX_GRAMS[normalizedName]
  const n = safeNum(direct ?? normalized ?? 0, 0)
  return Number.isFinite(n) ? n : 0
 }`

const newFunction = ` const getDryPremixLookupKey = (value) => {
  return String(value || '')
   .trim()
   .toLowerCase()
   .replace(/[^a-z0-9]/g, '')
 }

 const getDryPremixGramsPerPiece = (variantName) => {
  const name = String(variantName || '').trim()
  const normalizedName = typeof normalizeDonutVariantName === 'function'
   ? normalizeDonutVariantName(name)
   : name

  const dryPremixByKey = Object.entries(DRY_PREMIX_GRAMS || {}).reduce((map, [key, value]) => {
   map[getDryPremixLookupKey(key)] = safeNum(value, 0)
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
  ].map(getDryPremixLookupKey)

  for (const key of possibleKeys) {
   const n = safeNum(dryPremixByKey[key], NaN)
   if (Number.isFinite(n) && n > 0) return n
  }

  return 0
 }`

if (!replaceOnce(oldFunction, newFunction, 'robust dry premix variant name lookup')) {
  console.log('')
  console.log('The exact old function was not found. Searching for helper location...')
  const start = src.indexOf('const getDryPremixGramsPerPiece =')
  if (start < 0) throw new Error('getDryPremixGramsPerPiece function not found.')

  const end = src.indexOf('\n\n', start)
  if (end < 0) throw new Error('Could not find end of getDryPremixGramsPerPiece function.')

  src = src.slice(0, start) + newFunction.trimStart() + src.slice(end)
  changes++
  console.log('UPDATED: replaced getDryPremixGramsPerPiece by position')
}

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
console.log('Total changes:', changes)
