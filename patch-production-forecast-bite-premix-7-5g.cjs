const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

const targetRate = '7.5'
const sharedRatePattern = /const\s+BITE_SIZE_DRY_PREMIX_GRAMS\s*=\s*\d+(?:\.\d+)?/

if (!sharedRatePattern.test(src)) {
  throw new Error('Production Forecast 7.5g patch aborted: shared bite-size dry premix rate was not found.')
}

src = src.replace(sharedRatePattern, `const BITE_SIZE_DRY_PREMIX_GRAMS = ${targetRate}`)

// Safety check: all intended bite-size products must still reference the shared rate.
const requiredVariants = [
  'Choco Balls',
  'Matcha Pops',
  'Taro Pops',
  'Strawberry Pops',
  'Bavarian Pops',
  'Bavarian Bites'
]

for (const variant of requiredVariants) {
  const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const referencePattern = new RegExp(`['\"]${escaped}['\"]\\s*:\\s*BITE_SIZE_DRY_PREMIX_GRAMS`)
  if (!referencePattern.test(src)) {
    throw new Error(`Production Forecast 7.5g patch aborted: ${variant} is not linked to the shared bite-size rate.`)
  }
}

fs.writeFileSync(path, src, 'utf8')
console.log('Production Forecast bite-size dry premix rate set to 7.5 g/piece for Choco Balls, all Pops including Matcha Pops, and Bavarian Bites.')
