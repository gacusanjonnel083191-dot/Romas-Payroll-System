const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-fix-snack-markup-ref-${stamp}`

let src = fs.readFileSync(path, 'utf8')
fs.copyFileSync(path, backup)

if (!src.includes('const snackDrinkAutoSellingPrice =')) {
  const anchor = `const [editItemFields, setEditItemFields] = useState({})`

  if (!src.includes(anchor)) {
    throw new Error('Could not find editItemFields state anchor.')
  }

  const insert = `${anchor}

 const snackDrinkAutoSellingPrice = (cost) => moneyRound(safeNum(cost, 0) * 1.30)

 const isSnackDrinkCategoryName = (category) => {
  const label = getInventoryCategoryLabel({ category })
  return label === 'Snacks, Drinks and Others'
 }`

  src = src.replace(anchor, insert)
  console.log('ADDED: safe snack/drink markup helpers inside App scope')
} else {
  console.log('SKIPPED: snackDrinkAutoSellingPrice already exists')
}

src = src.replaceAll('computeSnackDrinkSellingPrice(', 'snackDrinkAutoSellingPrice(')
src = src.replaceAll('isSnacksDrinksInventoryCategory(', 'isSnackDrinkCategoryName(')

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
