const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-correct-buying-from-selling-${stamp}`

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

function replaceRegex(pattern, to, label) {
  if (!pattern.test(src)) {
    console.log('NOT FOUND:', label)
    return false
  }
  src = src.replace(pattern, to)
  changes++
  console.log('UPDATED:', label)
  return true
}

// 1) Add reverse helper: buying price = selling price / 1.30.
if (!src.includes('const snackDrinkAutoBuyingPrice =')) {
  replaceOnce(
`const snackDrinkAutoSellingPrice = (cost) => moneyRound(safeNum(cost, 0) * 1.30)`,
`const snackDrinkAutoSellingPrice = (cost) => moneyRound(safeNum(cost, 0) * 1.30)
 const snackDrinkAutoBuyingPrice = (sellingPrice) => moneyRound(safeNum(sellingPrice, 0) / 1.30)

 const getSnackDrinkDisplaySellingPrice = (item = {}) => {
  const sell = safeNum(item.selling_price, 0)
  const oldPrice = safeNum(item.cost_per_unit, 0)
  const buy = safeNum(item.buying_price, 0)

  // Safety for rows affected by the wrong previous markup display/save:
  // if selling_price equals oldPrice × 1.30 and buying price is empty,
  // treat oldPrice as the original selling price.
  if (buy <= 0 && oldPrice > 0 && sell > 0 && Math.abs(sell - snackDrinkAutoSellingPrice(oldPrice)) <= 0.05) {
   return oldPrice
  }

  return sell || oldPrice
 }

 const getSnackDrinkDisplayBuyingPrice = (item = {}) => {
  const buy = safeNum(item.buying_price, 0)
  if (buy > 0) return buy
  return snackDrinkAutoBuyingPrice(getSnackDrinkDisplaySellingPrice(item))
 }`,
'add buying price reverse helper'
  )
}

// 2) Add new item buying price state.
if (!src.includes('const [newItemBuyingPrice, setNewItemBuyingPrice]')) {
  replaceOnce(
`const [newItemCostPerUnit, setNewItemCostPerUnit] = useState('')`,
`const [newItemCostPerUnit, setNewItemCostPerUnit] = useState('')
 const [newItemBuyingPrice, setNewItemBuyingPrice] = useState('')`,
'add new item buying price state'
  )
}

// 3) Correct new item pricing logic.
replaceRegex(
/ const itemCostPerUnit = safeNum\(newItemCostPerUnit, 0\)\s+const itemSellingPrice = isSnackDrinkCategoryName\(newItemCategory\)\s+\? snackDrinkAutoSellingPrice\(itemCostPerUnit\)\s+: safeNum\(newItemSellingPrice, 0\)/,
` const isNewSnackDrink = isSnackDrinkCategoryName(newItemCategory)
 const itemBuyingPrice = isNewSnackDrink ? safeNum(newItemBuyingPrice, 0) : 0
 const itemCostPerUnit = isNewSnackDrink
  ? itemBuyingPrice
  : safeNum(newItemCostPerUnit, 0)
 const itemSellingPrice = isNewSnackDrink
  ? snackDrinkAutoSellingPrice(itemBuyingPrice)
  : safeNum(newItemSellingPrice, 0)`,
'correct new item price logic'
)

// 4) Save buying_price separately for new snack/drink items.
replaceOnce(
`cost_per_unit: Number(newItemCostPerUnit||0),
 selling_price: Number(newItemSellingPrice||0),`,
`cost_per_unit: itemCostPerUnit,
 buying_price: itemBuyingPrice,
 markup_percent: isNewSnackDrink ? 30 : 0,
 selling_price: itemSellingPrice,`,
'new item save buying and selling price'
)

// 5) Reset buying price after adding item.
if (!src.includes(`setNewItemBuyingPrice('')`)) {
  replaceOnce(
`setNewItemCostPerUnit('')`,
`setNewItemCostPerUnit('')
 setNewItemBuyingPrice('')`,
'reset buying price after add'
  )
}

// 6) Correct edit pricing logic.
replaceRegex(
/ const updatedCategory = f\.category \?\? item\.category\s+const updatedCostPerUnit = safeNum\(f\.cost_per_unit \?\? item\.cost_per_unit, 0\)\s+const updatedSellingPrice = isSnackDrinkCategoryName\(updatedCategory\)\s+\? snackDrinkAutoSellingPrice\(updatedCostPerUnit\)\s+: safeNum\(f\.selling_price \?\? item\.selling_price \?\? 0, 0\)/,
` const updatedCategory = f.category ?? item.category
 const isEditingSnackDrink = isSnackDrinkCategoryName(updatedCategory)
 const updatedBuyingPrice = isEditingSnackDrink
  ? safeNum(f.buying_price ?? item.buying_price ?? getSnackDrinkDisplayBuyingPrice(item), 0)
  : safeNum(f.buying_price ?? item.buying_price ?? 0, 0)
 const updatedCostPerUnit = isEditingSnackDrink
  ? updatedBuyingPrice
  : safeNum(f.cost_per_unit ?? item.cost_per_unit, 0)
 const updatedSellingPrice = isEditingSnackDrink
  ? snackDrinkAutoSellingPrice(updatedBuyingPrice)
  : safeNum(f.selling_price ?? item.selling_price ?? 0, 0)`,
'correct edit price logic'
)

// 7) Save buying_price separately when editing.
replaceOnce(
`cost_per_unit: Number(f.cost_per_unit??item.cost_per_unit),
 selling_price: Number(f.selling_price??item.selling_price??0),`,
`cost_per_unit: updatedCostPerUnit,
 buying_price: updatedBuyingPrice,
 markup_percent: isEditingSnackDrink ? 30 : safeNum(item.markup_percent, 0),
 selling_price: updatedSellingPrice,`,
'edit save buying and selling price'
)

// 8) Category change in add form should use Buying Price, not Cost.
src = src.replace(
`if (isSnackDrinkCategoryName(category)) {
  setNewItemSellingPrice(snackDrinkAutoSellingPrice(newItemCostPerUnit))
 }`,
`if (isSnackDrinkCategoryName(category) && safeNum(newItemBuyingPrice, 0) > 0) {
  setNewItemSellingPrice(snackDrinkAutoSellingPrice(newItemBuyingPrice))
 }`
)

// 9) Cost/Unit field in add form should no longer auto-compute snack selling price.
replaceRegex(
/<input type="number" placeholder="0\.00" value=\{newItemCostPerUnit\} onChange=\{e=>\{\s+const cost = e\.target\.value\s+setNewItemCostPerUnit\(cost\)\s+if \(isSnackDrinkCategoryName\(newItemCategory\)\) \{\s+setNewItemSellingPrice\(snackDrinkAutoSellingPrice\(cost\)\)\s+\}\s+\}\} style=\{\{\.\.\.inputStyle, marginBottom:0 \}\} min="0" step="0\.01" \/>/,
`<input type="number" placeholder="0.00" value={newItemCostPerUnit} onChange={e=>setNewItemCostPerUnit(e.target.value)} style={{...inputStyle, marginBottom:0 }} min="0" step="0.01" />`,
'remove wrong add cost auto-compute'
)

// 10) Add Buying Price input in add form, if missing.
if (!src.includes('Buying Price / Purchase Price')) {
  replaceOnce(
`{(newItemCategory==='Finished Products' || isSnackDrinkCategoryName(newItemCategory)) && (`,
`{isSnackDrinkCategoryName(newItemCategory) && (
 <div>
  <label style={lblS}>Buying Price / Purchase Price</label>
  <input
   type="number"
   placeholder="0.00"
   value={newItemBuyingPrice}
   onChange={e=>{
    const buy = e.target.value
    setNewItemBuyingPrice(buy)
    setNewItemSellingPrice(safeNum(buy, 0) > 0 ? snackDrinkAutoSellingPrice(buy) : '')
   }}
   style={{...inputStyle, marginBottom:0 }}
   min="0"
   step="0.01"
  />
  <p style={{ margin:'4px 0 0', color:'#2d8a4e', fontSize:'10px', fontWeight:'800' }}>
   Auto selling price: {safeNum(newItemBuyingPrice,0)>0 ? php(snackDrinkAutoSellingPrice(newItemBuyingPrice)) : 'Enter buying price'}
  </p>
 </div>
)}
{(newItemCategory==='Finished Products' || isSnackDrinkCategoryName(newItemCategory)) && (`,
'add buying price field'
  )
}

// 11) Selling price field wording.
src = src.replaceAll(
  'Auto-computed: cost + 30% markup',
  'Auto-computed from Buying Price + 30% markup'
)
src = src.replaceAll(
  'Auto-computed only after you enter the real buying price',
  'Auto-computed from Buying Price + 30% markup'
)

// 12) Edit category change: use buying price.
replaceRegex(
/<select value=\{editItemFields\.category\?\?displayCategoryName\(item\.category\)\} onChange=\{e=>\{\s+const category = e\.target\.value\s+setEditItemFields\(p=>\{\s+const cost = safeNum\(p\.cost_per_unit \?\? item\.cost_per_unit, 0\)\s+return \{\s+\.\.\.p,\s+category,\s+\.\.\.\(isSnackDrinkCategoryName\(category\) \? \{ selling_price: snackDrinkAutoSellingPrice\(cost\) \} : \{\}\)\s+\}\s+\}\)\s+\}\} style=\{\{\.\.\.inputStyle, marginBottom:0, fontSize:'12px', padding:'8px 10px' \}\}>/,
`<select value={editItemFields.category??displayCategoryName(item.category)} onChange={e=>{
 const category = e.target.value
 setEditItemFields(p=>{
  const buy = safeNum(p.buying_price ?? item.buying_price ?? getSnackDrinkDisplayBuyingPrice(item), 0)
  return {
   ...p,
   category,
   ...(isSnackDrinkCategoryName(category) ? { buying_price:buy, cost_per_unit:buy, selling_price: snackDrinkAutoSellingPrice(buy) } : {})
  }
 })
}} style={{...inputStyle, marginBottom:0, fontSize:'12px', padding:'8px 10px' }}>`,
'edit category uses buying price'
)

// 13) Edit Cost column becomes Buying Price for snacks/drinks.
replaceRegex(
/<input type="number" value=\{editItemFields\.cost_per_unit\?\?item\.cost_per_unit\} onChange=\{e=>\{\s+const cost = e\.target\.value\s+setEditItemFields\(p=>\{\s+const category = p\.category \?\? item\.category\s+return \{\s+\.\.\.p,\s+cost_per_unit:cost,\s+\.\.\.\(isSnackDrinkCategoryName\(category\) \? \{ selling_price: snackDrinkAutoSellingPrice\(cost\) \} : \{\}\)\s+\}\s+\}\)\s+\}\} style=\{\{\.\.\.inputStyle, marginBottom:0, textAlign:'right', fontSize:'12px', padding:'8px 6px' \}\} min="0" step="0\.01" \/>/,
`<input type="number" value={isSnackDrinkCategoryName(editItemFields.category ?? item.category) ? (editItemFields.buying_price ?? item.buying_price ?? getSnackDrinkDisplayBuyingPrice(item)) : (editItemFields.cost_per_unit??item.cost_per_unit)} onChange={e=>{
 const value = e.target.value
 setEditItemFields(p=>{
  const category = p.category ?? item.category
  if (isSnackDrinkCategoryName(category)) {
   const buy = safeNum(value, 0)
   return {
    ...p,
    buying_price:value,
    cost_per_unit:buy,
    selling_price: snackDrinkAutoSellingPrice(buy)
   }
  }
  return {...p,cost_per_unit:value}
 })
}} style={{...inputStyle, marginBottom:0, textAlign:'right', fontSize:'12px', padding:'8px 6px' }} min="0" step="0.01" />`,
'edit cost input becomes buying price'
)

// 14) Correct snack/drink display: Sell = existing selling price; Buy = computed selling / 1.30.
src = src.replaceAll(
  `Sell: {php(item.selling_price || item.cost_per_unit || 0)}`,
  `Sell: {php(getSnackDrinkDisplaySellingPrice(item))}`
)

src = src.replaceAll(
  `Buy: {safeNum(item.buying_price,0)>0 ? php(item.buying_price) : 'Not set'}`,
  `Buy: {php(getSnackDrinkDisplayBuyingPrice(item))}`
)

// 15) Edit preview should use buying price fallback.
src = src.replaceAll(
  `Auto Selling Price from Buying Price: {php(snackDrinkAutoSellingPrice(editItemFields.cost_per_unit ?? item.cost_per_unit))}`,
  `Auto Selling Price from Buying Price: {php(snackDrinkAutoSellingPrice(editItemFields.buying_price ?? item.buying_price ?? getSnackDrinkDisplayBuyingPrice(item)))}`
)
src = src.replaceAll(
  `Auto Selling Price from Buying Price: {php(snackDrinkAutoSellingPrice(editItemFields.buying_price ?? item.buying_price ?? 0))}`,
  `Auto Selling Price from Buying Price: {php(snackDrinkAutoSellingPrice(editItemFields.buying_price ?? item.buying_price ?? getSnackDrinkDisplayBuyingPrice(item)))}`
)

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
console.log('Total changes:', changes)
