const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-robust-dry-premix-lookup-${stamp}`

let src = fs.readFileSync(path, 'utf8')
fs.copyFileSync(path, backup)

function findMatchingBrace(text, openIndex) {
  let depth = 0
  let quote = null
  let escaped = false

  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]
    const prev = text[i - 1]

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === quote) {
        quote = null
      }
      continue
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }

    if (ch === '/' && text[i + 1] === '/') {
      const nextLine = text.indexOf('\n', i + 2)
      if (nextLine < 0) return -1
      i = nextLine
      continue
    }

    if (ch === '/' && text[i + 1] === '*') {
      const endComment = text.indexOf('*/', i + 2)
      if (endComment < 0) return -1
      i = endComment + 1
      continue
    }

    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }

  return -1
}

function replaceArrowFunction(name, replacement) {
  const needle = `const ${name} =`
  const start = src.indexOf(needle)
  if (start < 0) return false

  const arrowBodyStart = src.indexOf('{', start)
  if (arrowBodyStart < 0) throw new Error(`Could not find body start for ${name}`)

  const endBrace = findMatchingBrace(src, arrowBodyStart)
  if (endBrace < 0) throw new Error(`Could not find body end for ${name}`)

  let end = endBrace + 1
  while (src[end] === ';' || src[end] === '\r' || src[end] === '\n') end++

  src = src.slice(0, start) + replacement.trimEnd() + '\n\n' + src.slice(end)
  console.log('REPLACED:', name)
  return true
}

const newLookupFunction = `
const getDryPremixLookupKey = (value) => {
 return String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')
}
`

const newDryPremixFunction = `
const getDryPremixGramsPerPiece = (variantName) => {
 const dryPremixByKey = Object.entries(DRY_PREMIX_GRAMS || {}).reduce((map, [key, value]) => {
  map[getDryPremixLookupKey(key)] = safeNum(value, 0)
  return map
 }, {})

 const name = String(variantName || '').trim()
 const normalizedName = typeof normalizeDonutVariantName === 'function'
  ? normalizeDonutVariantName(name)
  : name

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
  const value = dryPremixByKey[key]
  if (Number.isFinite(value)) return value
 }

 return 0
}
`

// Replace existing functions if found.
replaceArrowFunction('getDryPremixLookupKey', newLookupFunction)
const replacedDryFunction = replaceArrowFunction('getDryPremixGramsPerPiece', newDryPremixFunction)

// If getDryPremixGramsPerPiece did not exist, insert both helpers after DRY_PREMIX_GRAMS.
if (!replacedDryFunction) {
  const dryStart = src.indexOf('const DRY_PREMIX_GRAMS = {')
  if (dryStart < 0) throw new Error('DRY_PREMIX_GRAMS not found.')

  const openBrace = src.indexOf('{', dryStart)
  const closeBrace = findMatchingBrace(src, openBrace)
  if (closeBrace < 0) throw new Error('Could not find end of DRY_PREMIX_GRAMS.')

  src = src.slice(0, closeBrace + 1) + '\n\n' + newLookupFunction + '\n' + newDryPremixFunction + src.slice(closeBrace + 1)
  console.log('INSERTED: dry premix helper functions')
}

// Force dry premix totals and row grams to use robust lookup.
src = src.replace(
 /const totalDryPremixG = .*forecastRows\.reduce.*\n/,
 "const totalDryPremixG = safeNum((forecastRows || []).reduce((s,r)=>s+(getDryPremixGramsPerPiece(r.variant_name)*getForecastRowTotal(r)),0),0)\n"
)

src = src.replaceAll(
 'const grams = safeNum(DRY_PREMIX_GRAMS[r.variant_name],0)*safeNum(r.total,0)',
 'const grams = getDryPremixGramsPerPiece(r.variant_name)*getForecastRowTotal(r)'
)

src = src.replaceAll(
 'const grams = getDryPremixGramsPerPiece(r.variant_name)*safeNum(r.total,0)',
 'const grams = getDryPremixGramsPerPiece(r.variant_name)*getForecastRowTotal(r)'
)

src = src.replaceAll(
 'const grams = safeNum(getDryPremixGramsPerPiece(r.variant_name),0)*safeNum(r.total,0)',
 'const grams = getDryPremixGramsPerPiece(r.variant_name)*getForecastRowTotal(r)'
)

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
