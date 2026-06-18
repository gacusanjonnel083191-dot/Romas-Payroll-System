const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-exact-supplier-price-edit-${stamp}`

let src = fs.readFileSync(path, 'utf8')
fs.copyFileSync(path, backup)

let changes = 0

function findMatchingBrace(text, openIndex) {
  let depth = 0
  let quote = null
  let escaped = false

  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]

    if (quote) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === quote) quote = null
      continue
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }

    if (ch === '/' && text[i + 1] === '/') {
      const nextLine = text.indexOf('\n', i + 2)
      if (nextLine < 0) return -1
      i = nextLine
      continue
    }

    if (ch === '/' && text[i + 1] === '*') {
      const endComment = text.indexOf('*/', i + 2)
      if (endComment < 0) return -1
      i = endComment + 1
      continue
    }

    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }

  return -1
}

function replaceAsyncFunction(functionName, newFunction) {
  const needle = `async function ${functionName}`
  const start = src.indexOf(needle)
  if (start < 0) throw new Error(`${functionName} not found`)

  const openBrace = src.indexOf('{', start)
  if (openBrace < 0) throw new Error(`${functionName} opening brace not found`)

  const closeBrace = findMatchingBrace(src, openBrace)
  if (closeBrace < 0) throw new Error(`${functionName} closing brace not found`)

  src = src.slice(0, start) + newFunction.trim() + src.slice(closeBrace + 1)
  changes++
  console.log('UPDATED:', functionName)
}

// 1. Correct saveInventoryItemEdit.
// For Snacks/Drinks, the editable price is supplier/buying price only.
replaceAsyncFunction('saveInventoryItemEdit', `
 async function saveInventoryItemEdit(item) {
  const f = editItemFields
  const updatedCategory = f.category ?? item.category
  const isEditingSnackDrink = isSnackDrinkCategoryName(updatedCategory)

  const supplierPrice = isEditingSnackDrink
   ? safeNum(f.buying_price ?? item.buying_price ?? getSnackDrinkDisplayBuyingPrice(item), 0)
   : safeNum(f.buying_price ?? item.buying_price ?? 0, 0)

  if (isEditingSnackDrink && supplierPrice <= 0) {
   showToast('Please enter supplier price / buying price for this snack or drink.', 'red')
   return
  }

  const finalCostPerUnit = isEditingSnackDrink
   ? supplierPrice
   : safeNum(f.cost_per_unit ?? item.cost_per_unit, 0)

  const finalSellingPrice = isEditingSnackDrink
   ? snackDrinkAutoSellingPrice(supplierPrice)
   : safeNum(f.selling_price ?? item.selling_price ?? 0, 0)

  const payload = {
   name: f.name || item.name,
   category: f.category || item.category,
   unit: f.unit || item.unit,
   current_stock: Number(f.current_stock ?? item.current_stock ?? 0),
   min_stock: Number(f.min_stock ?? item.min_stock),
   cost_per_unit: finalCostPerUnit,
   selling_price: finalSellingPrice,
   expiry_date: f.expiry_date !== undefined ? (f.expiry_date || null) : (item.expiry_date || null),
   supplier_id: f.supplier_id !== undefined ? (f.supplier_id || null) : (item.supplier_id || null)
  }

  if (isEditingSnackDrink) {
   payload.buying_price = supplierPrice
   payload.markup_percent = 30
  }

  const { error } = await supabase.from('inventory_items').update(payload).eq('id', item.id)

  if (error) { showToast(' Failed: ' + error.message, 'red'); return }

  showToast(
   isEditingSnackDrink
    ? ' Item updated! Supplier price: ' + php(supplierPrice) + ' | Selling price: ' + php(finalSellingPrice)
    : ' Item updated!'
  )

  setEditingItemId(null)
  setEditItemFields({})
  loadInventoryItems()
 }
`)

// 2. Make add item payload use computed values if Snacks/Drinks is added.
const oldAddPayload = `cost_per_unit: Number(newItemCostPerUnit||0),
 selling_price: Number(newItemSellingPrice||0),`

const newAddPayload = `cost_per_unit: itemCostPerUnit,
 buying_price: itemBuyingPrice,
 markup_percent: isNewSnackDrink ? 30 : 0,
 selling_price: itemSellingPrice,`

if (src.includes(oldAddPayload)) {
  src = src.replace(oldAddPayload, newAddPayload)
  changes++
  console.log('UPDATED: add item price payload')
} else {
  console.log('SKIPPED: add item price payload already changed or not found')
}

// 3. Replace the exact inventory price/cost cell.
// This makes the edit field show Supplier Price only for Snacks/Drinks.
const previewNeedle = 'Auto Selling Price from Buying Price:'
const previewAt = src.indexOf(previewNeedle)
if (previewAt < 0) throw new Error('Could not find current snack price preview cell')

const cellStart = src.lastIndexOf(`<td style={{ ...numStyle, color:'#666' }}>`, previewAt)
if (cellStart < 0) throw new Error('Could not find price cell start')

const nextCellMarker = `
 <td style={{ ...rowBase, textAlign:'center' }}>`
const cellEnd = src.indexOf(nextCellMarker, previewAt)
if (cellEnd < 0) throw new Error('Could not find price cell end marker')

const newPriceCell = `
 <td style={{ ...numStyle, color:'#666' }}>
 {isEditing? (
  isSnackDrinkCategoryName(editItemFields.category ?? item.category) ? (
   <div>
    <input
     type="number"
     value={editItemFields.buying_price ?? item.buying_price ?? getSnackDrinkDisplayBuyingPrice(item)}
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
     title="Supplier Price / Buying Price"
    />
    <div style={{ fontSize:'9.5px', color:'#555', fontWeight:'800', marginTop:'3px' }}>Supplier Price</div>
    <div style={{ fontSize:'9.5px', color:'#2d8a4e', fontWeight:'900', marginTop:'2px', whiteSpace:'nowrap' }}>
     Auto Sell: {php(snackDrinkAutoSellingPrice(editItemFields.buying_price ?? item.buying_price ?? getSnackDrinkDisplayBuyingPrice(item)))}
    </div>
   </div>
  ) : (
   <input type="number" value={editItemFields.cost_per_unit??item.cost_per_unit} onChange={e=>setEditItemFields(p=>({...p,cost_per_unit:e.target.value}))} style={{...inputStyle, marginBottom:0, textAlign:'right', fontSize:'12px', padding:'8px 6px' }} min="0" step="0.01" />
  )
 ) : (
  isSnackDrinkInventoryItem(item) ? (
   <>
    <div style={{ color:'#2d8a4e', fontWeight:'900' }}>Sell: {php(getSnackDrinkDisplaySellingPrice(item))}</div>
    <div style={{ fontSize:'10px', color:'#555', fontWeight:'700', marginTop:'2px' }}>
     Supplier: {php(getSnackDrinkDisplayBuyingPrice(item))}
    </div>
   </>
  ) : php(item.cost_per_unit || 0)
 )}
 </td>
`

src = src.slice(0, cellStart) + newPriceCell + src.slice(cellEnd)
changes++
console.log('UPDATED: exact inventory supplier price cell')

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
console.log('Total changes:', changes)
