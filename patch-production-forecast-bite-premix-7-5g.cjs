const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

// Legacy filename retained for repository compatibility. The owner-approved
// permanent production-forecast rate is now 7g per bite-size piece.
const TARGET_GRAMS = '7'
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
let sharedRateFound = false

// Update the shared constant when it exists.
const sharedRatePattern = /const\s+BITE_SIZE_DRY_PREMIX_GRAMS\s*=\s*\d+(?:\.\d+)?/g
src = src.replace(sharedRatePattern, () => {
  sharedRateFound = true
  changed++
  return `const BITE_SIZE_DRY_PREMIX_GRAMS = ${TARGET_GRAMS}`
})

if (!sharedRateFound) {
  throw new Error('Production Forecast 7g patch aborted: shared bite-size dry-premix constant was not found.')
}

// Also set every intended variant explicitly to 7g. This makes the patch safe
// whether the current source uses the shared constant or direct numeric values.
for (const variant of requiredVariants) {
  const escaped = escapeRegExp(variant)
  const mappingPattern = new RegExp(`(['\"]${escaped}['\"]\\s*:\\s*)(?:BITE_SIZE_DRY_PREMIX_GRAMS|\\d+(?:\\.\\d+)?)`, 'g')
  let matches = 0
  src = src.replace(mappingPattern, (_match, prefix) => {
    matches++
    changed++
    return `${prefix}BITE_SIZE_DRY_PREMIX_GRAMS`
  })

  if (matches === 0) {
    throw new Error(`Production Forecast 7g patch aborted: dry-premix mapping not found for ${variant}.`)
  }
}

// Verify the six production-forecast mappings now resolve to exactly 7g.
for (const variant of requiredVariants) {
  const escaped = escapeRegExp(variant)
  const verifyPattern = new RegExp(`['\"]${escaped}['\"]\\s*:\\s*BITE_SIZE_DRY_PREMIX_GRAMS`)
  if (!verifyPattern.test(src)) {
    throw new Error(`Production Forecast 7g patch verification failed for ${variant}.`)
  }
}

if (changed === 0) {
  throw new Error('Production Forecast 7g patch made no changes.')
}

fs.writeFileSync(path, src, 'utf8')
console.log('Production Forecast dry premix updated to 7 g/piece for Choco Balls, Matcha Pops, Taro Pops, Strawberry Pops, Bavarian Pops, and Bavarian Bites.')
