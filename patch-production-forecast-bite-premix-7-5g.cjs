const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

const TARGET_GRAMS = '7.5'
const requiredVariants = [
  'Choco Balls',
  'Matcha Pops',
  'Taro Pops',
  'Strawberry Pops',
  'Bavarian Pops',
  'Bavarian Bites'
]

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

let changed = 0

// Update the shared constant when it exists.
const sharedRatePattern = /const\s+BITE_SIZE_DRY_PREMIX_GRAMS\s*=\s*\d+(?:\.\d+)?/g
src = src.replace(sharedRatePattern, () => {
  changed++
  return `const BITE_SIZE_DRY_PREMIX_GRAMS = ${TARGET_GRAMS}`
})

// Also set every intended variant explicitly to 7.5g. This makes the patch safe
// whether the current source uses the shared constant or direct numeric values.
for (const variant of requiredVariants) {
  const escaped = escapeRegExp(variant)
  const mappingPattern = new RegExp(`(['\"]${escaped}['\"]\\s*:\\s*)(?:BITE_SIZE_DRY_PREMIX_GRAMS|\\d+(?:\\.\\d+)?)`, 'g')
  let matches = 0
  src = src.replace(mappingPattern, (_match, prefix) => {
    matches++
    changed++
    return `${prefix}${TARGET_GRAMS}`
  })

  if (matches === 0) {
    throw new Error(`Production Forecast 7.5g patch aborted: dry-premix mapping not found for ${variant}.`)
  }
}

// Verify the six production-forecast mappings now resolve to exactly 7.5g.
for (const variant of requiredVariants) {
  const escaped = escapeRegExp(variant)
  const verifyPattern = new RegExp(`['\"]${escaped}['\"]\\s*:\\s*7\\.5(?:\\D|$)`)
  if (!verifyPattern.test(src)) {
    throw new Error(`Production Forecast 7.5g patch verification failed for ${variant}.`)
  }
}

if (changed === 0) {
  throw new Error('Production Forecast 7.5g patch made no changes.')
}

fs.writeFileSync(path, src, 'utf8')
console.log('Production Forecast dry premix updated to 7.5 g/piece for Choco Balls, Matcha Pops, Taro Pops, Strawberry Pops, Bavarian Pops, and Bavarian Bites.')
