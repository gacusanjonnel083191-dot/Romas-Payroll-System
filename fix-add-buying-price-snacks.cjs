const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-add-buying-price-snacks-${stamp}`

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

// 1) Add separate buying price state for new item form.
if (!src.includes('const [newItemBuyingPrice, setNewItemBuyingPrice]')) {
  replaceOnce(
`const [newItemCostPerUnit, setNewItemCostPerUnit] = useState('')`,
`const [newItemCostPerUnit, setNewItemCostPerUnit] = useState('')
 const [newItemBuyingPrice, setNewItemBuyingPrice] = useState('')`,
'new item buying price state'
  )
}

// 2) Replace wrong new item computed price logic.
replaceRegex(
/ const itemCostPerUnit = safeNum\(newItemCostPerUnit, 0\)\s+const itemSellingPrice = isSnackDrinkCategoryName\(newItemCategory\)\s+\? snackDrinkAutoSellingPrice\(itemCostPerUnit\)\s+: safeNum\(newItemSellingPrice, 0\)/,
` const isNewSnackDrink = isSnackDrinkCategoryName(newItemCategory)
 const enteredBuyingPrice = safeNum(newItemBuyingPrice, 0)

 // For Snacks/Drinks: existing/old price is SELLING PRICE.
 // Buying price is a separate field. Only compute selling price when buying price is entered.
 const itemBuyingPrice = isNewSnackDrink ? enteredBuyingPrice : 0
 const itemCostPerUnit = isNewSnackDrink
  ? (enteredBuyingPrice > 0 ? enteredBuyingPrice : safeNum(newItemCostPerUnit, 0))
  : safeNum(newItemCostPerUnit, 0)
 const itemSellingPrice = isNewSnackDrink
  ? (enteredBuyingPrice > 0 ? snackDrinkAutoSellingPrice(enteredBuyingPrice) : safeNum(newItemSellingPrice, 0))
  : safeNum(newItemSellingPrice, 0)`,
'correct new item buying/selling logic'
)

// 3) Save new item with buying_price separately.
replaceOnce(
`cost_per_unit: Number(newItemCostPerUnit||0),
 selling_price: Number(newItemSellingPrice||0),`,
`cost_per_unit: itemCostPerUnit,
 buying_price: itemBuyingPrice,
 markup_percent: isNewSnackDrink ? 30 : 0,
 selling_price: itemSellingPrice,`,
'new item save buying price and selling price'
)

// 4) Reset buying price after adding.
if (!src.includes(`setNewItemBuyingPrice('')`)) {
  replaceOnce(
`setNewItemCostPerUnit('')`,
`setNewItemCostPerUnit('')
 setNewItemBuyingPrice('')`,
'reset new item buying price'
  )
}

// 5) Replace wrong edit computed logic.
replaceRegex(
/ const updatedCategory = f\.category \?\? item\.category\s+const updatedCostPerUnit = safeNum\(f\.cost_per_unit \?\? item\.cost_per_unit, 0\)\s+const updatedSellingPrice = isSnackDrinkCategoryName\(updatedCategory\)\s+\? snackDrinkAutoSellingPrice\(updatedCostPerUnit\)\s+: safeNum\(f\.selling_price \?\? item\.selling_price \?\? 0, 0\)/,
` const updatedCategory = f.category ?? item.category
 const isEditingSnackDrink = isSnackDrinkCategoryName(updatedCategory)

 // For Snacks/Drinks: keep old/existing price as SELLING PRICE.
 // Only when buying_price is entered do we recompute selling price.
 const previousSellingPrice = safeNum(item.selling_price || item.cost_per_unit || 0, 0)
 const updatedBuyingPrice = safeNum(f.buying_price ?? item.buying_price ?? 0, 0)
 const updatedCostPerUnit = isEditingSnackDrink
  ? (updatedBuyingPrice > 0 ? updatedBuyingPrice : safeNum(item.cost_per_unit, 0))
  : safeNum(f.cost_per_unit ?? item.cost_per_unit, 0)
 const updatedSellingPrice = isEditingSnackDrink
  ? (updatedBuyingPrice > 0 ? snackDrinkAutoSellingPrice(updatedBuyingPrice) : previousSellingPrice)
  : safeNum(f.selling_price ?? item.selling_price ?? 0, 0)`,
'correct edit buying/selling logic'
)

// 6) Update existing item with buying_price separately.
replaceOnce(
`cost_per_unit: Number(f.cost_per_unit??item.cost_per_unit),
 selling_price: Number(f.selling_price??item.selling_price??0),`,
`cost_per_unit: updatedCostPerUnit,
 buying_price: isEditingSnackDrink ? updatedBuyingPrice : safeNum(f.buying_price ?? item.buying_price ?? 0, 0),
 markup_percent: isEditingSnackDrink ? 30 : safeNum(item.markup_percent, 0),
 selling_price: updatedSellingPrice,`,
'edit item save buying price and selling price'
)

// 7) Stop category change from using old Cost as buying price in add form.
src = src.replace(
`if (isSnackDrinkCategoryName(category)) {
  setNewItemSellingPrice(snackDrinkAutoSellingPrice(newItemCostPerUnit))
 }`,
`if (isSnackDrinkCategoryName(category) && safeNum(newItemBuyingPrice, 0) > 0) {
  setNewItemSellingPrice(snackDrinkAutoSellingPrice(newItemBuyingPrice))
 }`
)

// 8) Stop Cost / Unit field from auto-changing snack selling price.
replaceRegex(
/<input type="number" placeholder="0\.00" value=\{newItemCostPerUnit\} onChange=\{e=>\{\s+const cost = e\.target\.value\s+setNewItemCostPerUnit\(cost\)\s+if \(isSnackDrinkCategoryName\(newItemCategory\)\) \{\s+setNewItemSellingPrice\(snackDrinkAutoSellingPrice\(cost\)\)\s+\}\s+\}\} style=\{\{\.\.\.inputStyle, marginBottom:0 \}\} min="0" step="0\.01" \/>/,
`<input type="number" placeholder="0.00" value={newItemCostPerUnit} onChange={e=>setNewItemCostPerUnit(e.target.value)} style={{...inputStyle, marginBottom:0 }} min="0" step="0.01" />`,
'remove wrong cost-to-selling auto compute in add form'
)

// 9) Add Buying Price field before Selling Price field in add form.
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
'add buying price field in add form'
  )
}

// 10) Change readonly selling price tooltip.
src = src.replaceAll(
  'Auto-computed: cost + 30% markup',
  'Auto-computed from Buying Price + 30% markup'
)

// 11) Edit category change: use buying_price, not cost_per_unit, for snacks.
replaceRegex(
/<select value=\{editItemFields\.category\?\?displayCategoryName\(item\.category\)\} onChange=\{e=>\{\s+const category = e\.target\.value\s+setEditItemFields\(p=>\{\s+const cost = safeNum\(p\.cost_per_unit \?\? item\.cost_per_unit, 0\)\s+return \{\s+\.\.\.p,\s+category,\s+\.\.\.\(isSnackDrinkCategoryName\(category\) \? \{ selling_price: snackDrinkAutoSellingPrice\(cost\) \} : \{\}\)\s+\}\s+\}\)\s+\}\} style=\{\{\.\.\.inputStyle, marginBottom:0, fontSize:'12px', padding:'8px 10px' \}\}>/,
`<select value={editItemFields.category??displayCategoryName(item.category)} onChange={e=>{
 const category = e.target.value
 setEditItemFields(p=>{
  const buy = safeNum(p.buying_price ?? item.buying_price, 0)
  return {
   ...p,
   category,
   ...(isSnackDrinkCategoryName(category) && buy > 0 ? { selling_price: snackDrinkAutoSellingPrice(buy), cost_per_unit:buy } : {})
  }
 })
}} style={{...inputStyle, marginBottom:0, fontSize:'12px', padding:'8px 10px' }}>`,
'edit category uses buying price'
)

// 12) Edit Cost column: for Snacks/Drinks this becomes Buying Price input.
replaceRegex(
/<input type="number" value=\{editItemFields\.cost_per_unit\?\?item\.cost_per_unit\} onChange=\{e=>\{\s+const cost = e\.target\.value\s+setEditItemFields\(p=>\{\s+const category = p\.category \?\? item\.category\s+return \{\s+\.\.\.p,\s+cost_per_unit:cost,\s+\.\.\.\(isSnackDrinkCategoryName\(category\) \? \{ selling_price: snackDrinkAutoSellingPrice\(cost\) \} : \{\}\)\s+\}\s+\}\)\s+\}\} style=\{\{\.\.\.inputStyle, marginBottom:0, textAlign:'right', fontSize:'12px', padding:'8px 6px' \}\} min="0" step="0\.01" \/>/,
`<input type="number" value={isSnackDrinkCategoryName(editItemFields.category ?? item.category) ? (editItemFields.buying_price ?? item.buying_price ?? '') : (editItemFields.cost_per_unit??item.cost_per_unit)} onChange={e=>{
 const value = e.target.value
 setEditItemFields(p=>{
  const category = p.category ?? item.category
  if (isSnackDrinkCategoryName(category)) {
   const buy = safeNum(value, 0)
   return {
    ...p,
    buying_price:value,
    cost_per_unit: buy > 0 ? buy : p.cost_per_unit,
    selling_price: buy > 0 ? snackDrinkAutoSellingPrice(buy) : (p.selling_price ?? item.selling_price ?? item.cost_per_unit ?? 0)
   }
  }
  return {...p,cost_per_unit:value}
 })
}} style={{...inputStyle, marginBottom:0, textAlign:'right', fontSize:'12px', padding:'8px 6px' }} min="0" step="0.01" />`,
'edit cost column becomes buying price for snacks'
)

// 13) Non-edit display: show Sell first, Buy separate. Never compute old records × 1.30.
replaceOnce(
`<>
  <div>{php(item.cost_per_unit || 0)}</div>
  {isSnackDrinkInventoryItem(item) && safeNum(item.selling_price, 0) > 0 && (
   <div style={{ fontSize:'10px', color:'#2d8a4e', fontWeight:'800', marginTop:'2px' }}>Sell: {php(item.selling_price)}</div>
  )}
 </>`,
`isSnackDrinkInventoryItem(item) ? (
  <>
   <div style={{ color:'#2d8a4e', fontWeight:'900' }}>Sell: {php(item.selling_price || item.cost_per_unit || 0)}</div>
   <div style={{ fontSize:'10px', color:safeNum(item.buying_price,0)>0?'#555':'#ca1b1b', fontWeight:'700', marginTop:'2px' }}>
    Buy: {safeNum(item.buying_price,0)>0 ? php(item.buying_price) : 'Not set'}
   </div>
  </>
 ) : php(item.cost_per_unit || 0)`,
'display snacks selling price and buying price separately'
)

// 14) Edit preview uses buying_price, not old cost_per_unit.
src = src.replaceAll(
  `Auto Selling Price from Buying Price: {php(snackDrinkAutoSellingPrice(editItemFields.cost_per_unit ?? item.cost_per_unit))}`,
  `Auto Selling Price from Buying Price: {php(snackDrinkAutoSellingPrice(editItemFields.buying_price ?? item.buying_price ?? 0))}`
)

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
console.log('Total changes:', changes)
