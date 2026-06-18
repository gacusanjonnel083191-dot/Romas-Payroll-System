const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-correct-snack-price-logic-${stamp}`

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

// Remove wrong computed selling price display for old records.
// Old records have cost_per_unit filled with selling price, so DO NOT show cost_per_unit × 1.30.
replaceOnce(
`{isSnackDrinkInventoryItem(item) && (
   <div style={{ fontSize:'10px', color:'#2d8a4e', fontWeight:'800', marginTop:'2px' }}>Sell: {php(item.selling_price || snackDrinkAutoSellingPrice(item.cost_per_unit))}</div>
  )}`,
`{isSnackDrinkInventoryItem(item) && safeNum(item.selling_price, 0) > 0 && (
   <div style={{ fontSize:'10px', color:'#2d8a4e', fontWeight:'800', marginTop:'2px' }}>Sell: {php(item.selling_price)}</div>
  )}`,
'stop auto-markup display on existing snack records'
)

// Make the edit preview clearer: buying price is the input, auto sell is the computed output.
replaceOnce(
`Auto Sell: {php(snackDrinkAutoSellingPrice(editItemFields.cost_per_unit ?? item.cost_per_unit))}`,
`Auto Selling Price from Buying Price: {php(snackDrinkAutoSellingPrice(editItemFields.cost_per_unit ?? item.cost_per_unit))}`,
'clarify auto selling price preview'
)

// Rename title text if present from generic auto-compute wording.
src = src.replaceAll(
  'Auto-computed: buying price + 30% markup',
  'Auto-computed only after you enter the real buying price'
)

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
console.log('Total changes:', changes)
