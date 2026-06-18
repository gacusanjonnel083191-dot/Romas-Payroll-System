const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-visible-snack-selling-auto-${stamp}`

let src = fs.readFileSync(path, 'utf8')
fs.copyFileSync(path, backup)

let changes = 0

function replaceOnce(from, to, label) {
  if (src.includes(to)) {
    console.log('SKIPPED already updated:', label)
    return true
  }
  if (!src.includes(from)) {
    console.log('NOT FOUND:', label)
    return false
  }
  src = src.replace(from, to)
  changes++
  console.log('UPDATED:', label)
  return true
}

// 1) Helper: Snacks/Drinks category + 30% markup
if (!src.includes('function isSnacksDrinksInventoryCategory')) {
  const anchor = `function isSnackDrinkInventoryItem(item = {}) {
 return getInventoryCategoryLabel(item) === 'Snacks, Drinks and Others'
}`
  const insert = `${anchor}

function isSnacksDrinksInventoryCategory(category) {
 return getInventoryCategoryLabel({ category }) === 'Snacks, Drinks and Others'
}

function computeSnackDrinkSellingPrice(cost) {
 return moneyRound(safeNum(cost, 0) * 1.30)
}`
  replaceOnce(anchor, insert, 'snacks/drinks markup helpers')
} else {
  console.log('SKIPPED: snacks/drinks markup helpers already exist')
}

// 2) New item save: auto selling price only for Snacks, Drinks and Others
if (!src.includes('const itemSellingPrice = isSnacksDrinksInventoryCategory(newItemCategory)')) {
  replaceOnce(
`if (!newItemCategory) { showToast(' Please select a category.','red'); return }`,
`if (!newItemCategory) { showToast(' Please select a category.','red'); return }

 const itemCostPerUnit = safeNum(newItemCostPerUnit, 0)
 const itemSellingPrice = isSnacksDrinksInventoryCategory(newItemCategory)
  ? computeSnackDrinkSellingPrice(itemCostPerUnit)
  : safeNum(newItemSellingPrice, 0)`,
'new item computed selling price'
  )
}

replaceOnce(
`cost_per_unit: Number(newItemCostPerUnit||0),
 selling_price: Number(newItemSellingPrice||0),`,
`cost_per_unit: itemCostPerUnit,
 selling_price: itemSellingPrice,`,
'new item save computed prices'
)

// 3) Existing item update: auto selling price only for Snacks, Drinks and Others
if (!src.includes('const updatedSellingPrice = isSnacksDrinksInventoryCategory(updatedCategory)')) {
  replaceOnce(
`const f = editItemFields`,
`const f = editItemFields
 const updatedCategory = f.category ?? item.category
 const updatedCostPerUnit = safeNum(f.cost_per_unit ?? item.cost_per_unit, 0)
 const updatedSellingPrice = isSnacksDrinksInventoryCategory(updatedCategory)
  ? computeSnackDrinkSellingPrice(updatedCostPerUnit)
  : safeNum(f.selling_price ?? item.selling_price ?? 0, 0)`,
'edit item computed selling price'
  )
}

replaceOnce(
`cost_per_unit: Number(f.cost_per_unit??item.cost_per_unit),
 selling_price: Number(f.selling_price??item.selling_price??0),`,
`cost_per_unit: updatedCostPerUnit,
 selling_price: updatedSellingPrice,`,
'edit item save computed prices'
)

// 4) New item form: when category changes to Snacks/Drinks, compute selling price
replaceOnce(
`<select value={newItemCategory} onChange={e=>setNewItemCategory(e.target.value)} style={inputStyle}>`,
`<select value={newItemCategory} onChange={e=>{
 const category = e.target.value
 setNewItemCategory(category)
 if (isSnacksDrinksInventoryCategory(category)) {
  setNewItemSellingPrice(computeSnackDrinkSellingPrice(newItemCostPerUnit))
 }
}} style={inputStyle}>`,
'new item category auto selling price'
)

// 5) New item form: when buying price/cost changes, compute selling price
replaceOnce(
`<input type="number" placeholder="0.00" value={newItemCostPerUnit} onChange={e=>setNewItemCostPerUnit(e.target.value)} style={{...inputStyle, marginBottom:0 }} min="0" step="0.01" />`,
`<input type="number" placeholder="0.00" value={newItemCostPerUnit} onChange={e=>{
 const cost = e.target.value
 setNewItemCostPerUnit(cost)
 if (isSnacksDrinksInventoryCategory(newItemCategory)) {
  setNewItemSellingPrice(computeSnackDrinkSellingPrice(cost))
 }
}} style={{...inputStyle, marginBottom:0 }} min="0" step="0.01" />`,
'new item buying price auto selling price'
)

// 6) Show selling price field for Snacks/Drinks in add form
replaceOnce(
`{newItemCategory==='Finished Products' && (`,
`{(newItemCategory==='Finished Products' || isSnacksDrinksInventoryCategory(newItemCategory)) && (`,
'show selling price for snacks/drinks add form'
)

// 7) Make Snacks/Drinks selling price read-only in add form
replaceOnce(
`<input type="number" placeholder="0.00" value={newItemSellingPrice} onChange={e=>setNewItemSellingPrice(e.target.value)} style={{...inputStyle, marginBottom:0 }} min="0" step="0.01" />`,
`<input type="number" placeholder="0.00" value={newItemSellingPrice} onChange={e=>setNewItemSellingPrice(e.target.value)} readOnly={isSnacksDrinksInventoryCategory(newItemCategory)} title={isSnacksDrinksInventoryCategory(newItemCategory)?'Auto-computed: buying price + 30% markup':'Manual selling price'} style={{...inputStyle, marginBottom:0, background:isSnacksDrinksInventoryCategory(newItemCategory)?'#f7f9fc':'white' }} min="0" step="0.01" />`,
'readonly selling price for snacks/drinks add form'
)

// 8) Edit form: when category changes to Snacks/Drinks, compute selling price
replaceOnce(
`<select value={editItemFields.category??displayCategoryName(item.category)} onChange={e=>setEditItemFields(p=>({...p,category:e.target.value}))} style={{...inputStyle, marginBottom:0, fontSize:'12px', padding:'8px 10px' }}>`,
`<select value={editItemFields.category??displayCategoryName(item.category)} onChange={e=>{
 const category = e.target.value
 setEditItemFields(p=>{
  const cost = safeNum(p.cost_per_unit ?? item.cost_per_unit, 0)
  return {
   ...p,
   category,
   ...(isSnacksDrinksInventoryCategory(category) ? { selling_price: computeSnackDrinkSellingPrice(cost) } : {})
  }
 })
}} style={{...inputStyle, marginBottom:0, fontSize:'12px', padding:'8px 10px' }}>`,
'edit category auto selling price'
)

// 9) Edit form: when buying price/cost changes, compute selling price immediately
replaceOnce(
`<input type="number" value={editItemFields.cost_per_unit??item.cost_per_unit} onChange={e=>setEditItemFields(p=>({...p,cost_per_unit:e.target.value}))} style={{...inputStyle, marginBottom:0, textAlign:'right', fontSize:'12px', padding:'8px 6px' }} min="0" step="0.01" />`,
`<input type="number" value={editItemFields.cost_per_unit??item.cost_per_unit} onChange={e=>{
 const cost = e.target.value
 setEditItemFields(p=>{
  const category = p.category ?? item.category
  return {
   ...p,
   cost_per_unit:cost,
   ...(isSnacksDrinksInventoryCategory(category) ? { selling_price: computeSnackDrinkSellingPrice(cost) } : {})
  }
 })
}} style={{...inputStyle, marginBottom:0, textAlign:'right', fontSize:'12px', padding:'8px 6px' }} min="0" step="0.01" />`,
'edit buying price auto selling price'
)

// 10) Visible preview in the Cost column: Buy + Auto Sell
if (!src.includes('Auto Sell:')) {
  replaceOnce(
`): php(item.cost_per_unit || 0)}`,
`): (
 <>
  <div>{php(item.cost_per_unit || 0)}</div>
  {isSnackDrinkInventoryItem(item) && (
   <div style={{ fontSize:'10px', color:'#2d8a4e', fontWeight:'800', marginTop:'2px' }}>Sell: {php(item.selling_price || computeSnackDrinkSellingPrice(item.cost_per_unit))}</div>
  )}
 </>
)}
{editingItemId===item.id && isSnacksDrinksInventoryCategory(editItemFields.category ?? item.category) && (
 <div style={{ fontSize:'10px', color:'#2d8a4e', fontWeight:'900', marginTop:'4px', whiteSpace:'nowrap' }}>
  Auto Sell: {php(computeSnackDrinkSellingPrice(editItemFields.cost_per_unit ?? item.cost_per_unit))}
 </div>
)}`,
'visible auto selling price preview in inventory row'
  )
} else {
  console.log('SKIPPED: Auto Sell preview already exists')
}

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
console.log('Total changes:', changes)
