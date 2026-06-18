const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-black-screen-dry-premix-scope-fix-${stamp}`

let src = fs.readFileSync(path, 'utf8')
fs.copyFileSync(path, backup)

function findMatchingBrace(text, openIndex) {
  let depth = 0
  let quote = null
  let escaped = false

  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]

    if (quote) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === quote) quote = null
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

const name = 'getDryPremixGramsPerPiece'
const needle = `const ${name} =`
const start = src.indexOf(needle)

if (start < 0) {
  throw new Error(`${name} function not found.`)
}

const bodyStart = src.indexOf('{', start)
if (bodyStart < 0) {
  throw new Error(`${name} body start not found.`)
}

const bodyEnd = findMatchingBrace(src, bodyStart)
if (bodyEnd < 0) {
  throw new Error(`${name} body end not found.`)
}

let end = bodyEnd + 1
while (src[end] === ';' || src[end] === '\r' || src[end] === '\n') end++

const replacement = `
const getDryPremixGramsPerPiece = (variantName) => {
 const lookupKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')

 const dryPremixByKey = Object.entries(DRY_PREMIX_GRAMS || {}).reduce((map, [key, value]) => {
  map[lookupKey(key)] = safeNum(value, 0)
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
 ].map(lookupKey)

 for (const key of possibleKeys) {
  const value = dryPremixByKey[key]
  if (Number.isFinite(value)) return value
 }

 return 0
}
`

src = src.slice(0, start) + replacement.trimEnd() + '\n\n' + src.slice(end)

fs.writeFileSync(path, src, 'utf8')

console.log('DONE: Fixed dry premix helper scope crash.')
console.log('Backup:', backup)
