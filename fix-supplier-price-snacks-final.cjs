const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-supplier-price-final-${stamp}`

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

// 1. Add final helper names. Existing old helpers may remain, but these are the safe final helpers.
if (!src.includes('const getSnackDrinkFinalSellingPrice =')) {
  const anchor = `const isSnackDrinkCategoryName = (category) => {
  const label = getInventoryCategoryLabel({ category })
  return label === 'Snacks, Drinks and Others'
 }`

  const insert = `${anchor}

 const getSnackDrinkFinalSellingPrice = (item = {}) => {
  const sell = safeNum(item.selling_price, 0)
  const oldPrice = safeNum(item.cost_per_unit, 0)
  const supplier = safeNum(item.buying_price, 0)

  // Repair display for records affected by the previous wrong 30% markup.
  if (supplier <= 0 && oldPrice > 0 && sell > 0 && Math.abs(sell - snackDrinkAutoSellingPrice(oldPrice)) <= 0.05) {
   return oldPrice
  }

  return sell || oldPrice
 }

 const getSnackDrinkFinalSupplierPrice = (item = {}) => {
  const supplier = safeNum(item.buying_price, 0)
  if (supplier > 0) return supplier
  return snackDrinkAutoBuyingPrice(getSnackDrinkFinalSellingPrice(item))
 }`

  replaceOnce(anchor, insert, 'final supplier/selling price helpers')
} else {
  console.log('SKIPPED: final helpers already exist')
}

// 2. Ensure new item supplier price state exists.
if (!src.includes('const [newItemBuyingPrice, setNewItemBuyingPrice]')) {
  replaceOnce(
`const [newItemCostPerUnit, setNewItemCostPerUnit] = useState('')`,
`const [newItemCostPerUnit, setNewItemCostPerUnit] = useState('')
 const [newItemBuyingPrice, setNewItemBuyingPrice] = useState('')`,
'new item supplier price state'
  )
}

// 3. Correct add item validation and computed pricing.
if (!src.includes("Please enter supplier/buying price for snacks and drinks.")) {
  replaceOnce(
`const itemSellingPrice = isNewSnackDrink
  ? (enteredBuyingPrice > 0 ? snackDrinkAutoSellingPrice(enteredBuyingPrice) : safeNum(newItemSellingPrice, 0))
  : safeNum(newItemSellingPrice, 0)
 setAddItemLoading(true)`,
`const itemSellingPrice = isNewSnackDrink
  ? snackDrinkAutoSellingPrice(itemBuyingPrice)
  : safeNum(newItemSellingPrice, 0)

 if (isNewSnackDrink && itemBuyingPrice <= 0) {
  showToast('Please enter supplier/buying price for snacks and drinks.', 'red')
  return
 }

 setAddItemLoading(true)`,
'new snack/drink requires supplier price'
  )
}

// 4. Save new Snacks/Drinks correctly.
replaceOnce(
`cost_per_unit: Number(newItemCostPerUnit||0),
 selling_price: Number(newItemSellingPrice||0),`,
`cost_per_unit: itemCostPerUnit,
 buying_price: itemBuyingPrice,
 markup_percent: isNewSnackDrink ? 30 : 0,
 selling_price: itemSellingPrice,`,
'new item saves supplier price and auto selling price'
)

// 5. Reset supplier price after adding.
if (!src.includes(`setNewItemBuyingPrice('')`)) {
  replaceOnce(
`setNewItemCostPerUnit('')`,
`setNewItemCostPerUnit('')
 setNewItemBuyingPrice('')`,
'reset supplier price field'
  )
}

// 6. Correct update pricing variables.
replaceRegex(
/ const updatedCategory = f\.category \?\? item\.category[\s\S]*?const updatedSellingPrice = isSnackDrinkCategoryName\(updatedCategory\)[\s\S]*?: safeNum\(f\.selling_price \?\? item\.selling_price \?\? 0, 0\)/,
` const updatedCategory = f.category ?? item.category
 const isEditingSnackDrink = isSnackDrinkCategoryName(updatedCategory)

 // For Snacks/Drinks, the editable price is SUPPLIER PRICE only.
 const updatedBuyingPrice = isEditingSnackDrink
  ? safeNum(f.buying_price ?? item.buying_price ?? getSnackDrinkFinalSupplierPrice(item), 0)
  : safeNum(f.buying_price ?? item.buying_price ?? 0, 0)

 const updatedCostPerUnit = isEditingSnackDrink
  ? updatedBuyingPrice
  : safeNum(f.cost_per_unit ?? item.cost_per_unit, 0)

 const updatedSellingPrice = isEditingSnackDrink
  ? snackDrinkAutoSellingPrice(updatedBuyingPrice)
  : safeNum(f.selling_price ?? item.selling_price ?? 0, 0)`,
'update item uses supplier price only for snacks/drinks'
)

// 7. Save edited Snacks/Drinks correctly.
replaceOnce(
`cost_per_unit: Number(f.cost_per_unit??item.cost_per_unit),
 selling_price: Number(f.selling_price??item.selling_price??0),`,
`cost_per_unit: updatedCostPerUnit,
 buying_price: updatedBuyingPrice,
 markup_percent: isEditingSnackDrink ? 30 : safeNum(item.markup_percent, 0),
 selling_price: updatedSellingPrice,`,
'edited item saves supplier price and auto selling price'
)

// 8. Add form: supplier price input for Snacks/Drinks, if missing.
if (!src.includes('Supplier Price / Buying Price')) {
  replaceOnce(
`{(newItemCategory==='Finished Products' || isSnackDrinkCategoryName(newItemCategory)) && (`,
`{isSnackDrinkCategoryName(newItemCategory) && (
 <div>
  <label style={lblS}>Supplier Price / Buying Price</label>
  <input
   type="number"
   placeholder="0.00"
   value={newItemBuyingPrice}
   onChange={e=>{
    const supplierPrice = e.target.value
    setNewItemBuyingPrice(supplierPrice)
    setNewItemSellingPrice(safeNum(supplierPrice, 0) > 0 ? snackDrinkAutoSellingPrice(supplierPrice) : '')
   }}
   style={{...inputStyle, marginBottom:0 }}
   min="0"
   step="0.01"
  />
  <p style={{ margin:'4px 0 0', color:'#2d8a4e', fontSize:'10px', fontWeight:'800' }}>
   Auto Selling Price: {safeNum(newItemBuyingPrice,0)>0 ? php(snackDrinkAutoSellingPrice(newItemBuyingPrice)) : 'Enter supplier price'}
  </p>
 </div>
)}
{(newItemCategory==='Finished Products' || isSnackDrinkCategoryName(newItemCategory)) && (`,
'add supplier price field in add form'
  )
}

// 9. Edit row category change should use supplier price.
replaceRegex(
/<select value=\{editItemFields\.category\?\?displayCategoryName\(item\.category\)\} onChange=\{e=>\{[\s\S]*?\}\} style=\{\{\.\.\.inputStyle, marginBottom:0, fontSize:'12px', padding:'8px 10px' \}\}>/,
`<select value={editItemFields.category??displayCategoryName(item.category)} onChange={e=>{
 const category = e.target.value
 setEditItemFields(p=>{
  const supplierPrice = safeNum(p.buying_price ?? item.buying_price ?? getSnackDrinkFinalSupplierPrice(item), 0)
  return {
   ...p,
   category,
   ...(isSnackDrinkCategoryName(category)
    ? { buying_price:supplierPrice, cost_per_unit:supplierPrice, selling_price: snackDrinkAutoSellingPrice(supplierPrice) }
    : {})
  }
 })
}} style={{...inputStyle, marginBottom:0, fontSize:'12px', padding:'8px 10px' }}>`,
'edit category uses supplier price'
)

// 10. Replace the editable Cost input with Supplier Price input for Snacks/Drinks.
const oldSimpleCostInput = `<input type="number" value={editItemFields.cost_per_unit??item.cost_per_unit} onChange={e=>setEditItemFields(p=>({...p,cost_per_unit:e.target.value}))} style={{...inputStyle, marginBottom:0, textAlign:'right', fontSize:'12px', padding:'8px 6px' }} min="0" step="0.01" />`

const newSupplierInput = `{isSnackDrinkCategoryName(editItemFields.category ?? item.category) ? (
 <div>
  <input
   type="number"
   value={editItemFields.buying_price ?? item.buying_price ?? getSnackDrinkFinalSupplierPrice(item)}
   onChange={e=>{
    const supplierPrice = e.target.value
    setEditItemFields(p=>({
     ...p,
     buying_price:supplierPrice,
     cost_per_unit:safeNum(supplierPrice, 0),
     selling_price:snackDrinkAutoSellingPrice(supplierPrice)
    }))
   }}
   style={{...inputStyle, marginBottom:0, textAlign:'right', fontSize:'12px', padding:'8px 6px', border:'2px solid #2d8a4e' }}
   min="0"
   step="0.01"
   title="Supplier price / buying price"
  />
  <div style={{ fontSize:'9.5px', color:'#555', fontWeight:'800', marginTop:'3px' }}>Supplier Price</div>
  <div style={{ fontSize:'9.5px', color:'#2d8a4e', fontWeight:'900', marginTop:'2px' }}>
   Auto Sell: {php(snackDrinkAutoSellingPrice(editItemFields.buying_price ?? item.buying_price ?? getSnackDrinkFinalSupplierPrice(item)))}
  </div>
 </div>
) : (
 <input type="number" value={editItemFields.cost_per_unit??item.cost_per_unit} onChange={e=>setEditItemFields(p=>({...p,cost_per_unit:e.target.value}))} style={{...inputStyle, marginBottom:0, textAlign:'right', fontSize:'12px', padding:'8px 6px' }} min="0" step="0.01" />
)}`

if (src.includes(oldSimpleCostInput)) {
  src = src.replace(oldSimpleCostInput, newSupplierInput)
  changes++
  console.log('UPDATED: simple cost input replaced with supplier price input')
} else if (!src.includes('Supplier Price</div>') || !src.includes('Auto Sell:')) {
  replaceRegex(
/<input type="number" value=\{[\s\S]*?cost_per_unit[\s\S]*?\} onChange=\{e=>\{[\s\S]*?cost_per_unit[\s\S]*?\}\} style=\{\{\.\.\.inputStyle, marginBottom:0, textAlign:'right', fontSize:'12px', padding:'8px 6px' \}\} min="0" step="0\.01" \/>/,
newSupplierInput,
'complex cost input replaced with supplier price input'
  )
} else {
  console.log('SKIPPED: supplier input already present')
}

// 11. Correct display labels.
src = src.replaceAll(
  `Sell: {php(item.selling_price || item.cost_per_unit || 0)}`,
  `Sell: {php(getSnackDrinkFinalSellingPrice(item))}`
)

src = src.replaceAll(
  `Sell: {php(getSnackDrinkDisplaySellingPrice(item))}`,
  `Sell: {php(getSnackDrinkFinalSellingPrice(item))}`
)

src = src.replaceAll(
  `Buy: {safeNum(item.buying_price,0)>0 ? php(item.buying_price) : 'Not set'}`,
  `Supplier: {php(getSnackDrinkFinalSupplierPrice(item))}`
)

src = src.replaceAll(
  `Buy: {php(getSnackDrinkDisplayBuyingPrice(item))}`,
  `Supplier: {php(getSnackDrinkFinalSupplierPrice(item))}`
)

src = src.replaceAll(
  `Auto Selling Price from Buying Price:`,
  `Auto Selling Price from Supplier Price:`
)

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
console.log('Total changes:', changes)
