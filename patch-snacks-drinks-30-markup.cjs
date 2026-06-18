const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-snacks-drinks-30-markup-${stamp}`

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

// 1) Add helper functions after snack/drink category detector.
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
  replaceOnce(anchor, insert, 'snacks/drinks 30% markup helpers')
} else {
  console.log('SKIPPED: snacks/drinks helpers already exist')
}

// 2) Save new inventory item with auto selling price only for Snacks, Drinks and Others.
replaceOnce(
`if (!newItemCategory) { showToast(' Please select a category.','red'); return }`,
`if (!newItemCategory) { showToast(' Please select a category.','red'); return }

 const itemCostPerUnit = safeNum(newItemCostPerUnit, 0)
 const itemSellingPrice = isSnacksDrinksInventoryCategory(newItemCategory)
  ? computeSnackDrinkSellingPrice(itemCostPerUnit)
  : safeNum(newItemSellingPrice, 0)`,
'new item computed selling price'
)

replaceOnce(
`cost_per_unit: Number(newItemCostPerUnit||0),
 selling_price: Number(newItemSellingPrice||0),`,
`cost_per_unit: itemCostPerUnit,
 selling_price: itemSellingPrice,`,
'new item save cost/selling price'
)

// 3) Update existing item with auto selling price only for Snacks, Drinks and Others.
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

replaceOnce(
`cost_per_unit: Number(f.cost_per_unit??item.cost_per_unit),
 selling_price: Number(f.selling_price??item.selling_price??0),`,
`cost_per_unit: updatedCostPerUnit,
 selling_price: updatedSellingPrice,`,
'edit item save cost/selling price'
)

// 4) Add form auto-compute when category changes.
replaceOnce(
`<select value={newItemCategory} onChange={e=>setNewItemCategory(e.target.value)} style={inputStyle}>`,
`<select value={newItemCategory} onChange={e=>{
 const category = e.target.value
 setNewItemCategory(category)
 if (isSnacksDrinksInventoryCategory(category)) {
  setNewItemSellingPrice(computeSnackDrinkSellingPrice(newItemCostPerUnit))
 }
}} style={inputStyle}>`,
'new item category auto computes selling price'
)

// 5) Add form auto-compute when cost changes.
replaceOnce(
`<input type="number" placeholder="0.00" value={newItemCostPerUnit} onChange={e=>setNewItemCostPerUnit(e.target.value)} style={{...inputStyle, marginBottom:0 }} min="0" step="0.01" />`,
`<input type="number" placeholder="0.00" value={newItemCostPerUnit} onChange={e=>{
 const cost = e.target.value
 setNewItemCostPerUnit(cost)
 if (isSnacksDrinksInventoryCategory(newItemCategory)) {
  setNewItemSellingPrice(computeSnackDrinkSellingPrice(cost))
 }
}} style={{...inputStyle, marginBottom:0 }} min="0" step="0.01" />`,
'new item cost auto computes selling price'
)

// 6) Show selling price field for Snacks/Drinks also.
replaceOnce(
`{newItemCategory==='Finished Products' && (`,
`{(newItemCategory==='Finished Products' || isSnacksDrinksInventoryCategory(newItemCategory)) && (`,
'show selling price for snacks/drinks'
)

// 7) Make new snack/drink selling price readonly auto field.
replaceOnce(
`<input type="number" placeholder="0.00" value={newItemSellingPrice} onChange={e=>setNewItemSellingPrice(e.target.value)} style={{...inputStyle, marginBottom:0 }} min="0" step="0.01" />`,
`<input type="number" placeholder="0.00" value={newItemSellingPrice} onChange={e=>setNewItemSellingPrice(e.target.value)} readOnly={isSnacksDrinksInventoryCategory(newItemCategory)} title={isSnacksDrinksInventoryCategory(newItemCategory)?'Auto-computed: cost + 30% markup':'Manual selling price'} style={{...inputStyle, marginBottom:0, background:isSnacksDrinksInventoryCategory(newItemCategory)?'#f7f9fc':'white' }} min="0" step="0.01" />`,
'new snack/drink selling price readonly'
)

// 8) Auto-compute when editing category.
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
'edit category auto computes selling price'
)

// 9) Auto-compute when editing cost.
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
'edit cost auto computes selling price'
)

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
console.log('Total changes:', changes)
