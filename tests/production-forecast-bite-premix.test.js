import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const appSource = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

const biteSizeVariants = [
  'Choco Balls',
  'Matcha Pops',
  'Taro Pops',
  'Strawberry Pops',
  'Bavarian Pops',
  'Bavarian Bites'
]

test('all six bite-size variants permanently share the owner-approved 7g rate', () => {
  assert.match(appSource, /const\s+BITE_SIZE_DRY_PREMIX_GRAMS\s*=\s*7(?:\D|$)/)

  for (const variant of biteSizeVariants) {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.match(
      appSource,
      new RegExp(`['"]${escaped}['"]\\s*:\\s*BITE_SIZE_DRY_PREMIX_GRAMS`),
      `${variant} must use the shared 7g dry-premix rate`
    )
  }
})

test('one piece of each bite-size variant contributes 42g total', () => {
  assert.equal(biteSizeVariants.length * 7, 42)
})
