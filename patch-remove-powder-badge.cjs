const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

// The POWDER badge is only a visual indicator that a product recipe links the
// shared Powder Base Recipe. Removing the badge must not remove or alter the
// actual Powder Base recipe link or any costing calculation.
const badge = ` {hasPowderLink&&<Badge label="POWDER" color="blue"/>}`

if (src.includes(badge)) {
  src = src.split(badge).join('')
  fs.writeFileSync(path, src, 'utf8')
  console.log('Removed visual POWDER badges from costing product cards; Powder Base costing links remain unchanged.')
} else {
  console.log('No visual POWDER badges found; no costing logic was changed.')
}
