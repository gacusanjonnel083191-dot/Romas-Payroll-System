const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-inventory-category-price-print-${stamp}`

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

function insertAfterAsyncFunction(functionName, insertText) {
  const needle = `async function ${functionName}`
  const start = src.indexOf(needle)
  if (start < 0) throw new Error(`${functionName} not found`)

  const openBrace = src.indexOf('{', start)
  if (openBrace < 0) throw new Error(`${functionName} opening brace not found`)

  const closeBrace = findMatchingBrace(src, openBrace)
  if (closeBrace < 0) throw new Error(`${functionName} closing brace not found`)

  src = src.slice(0, closeBrace + 1) + '\n\n' + insertText.trim() + '\n' + src.slice(closeBrace + 1)
  changes++
  console.log('ADDED:', insertText.match(/function\s+(\w+)/)?.[1] || 'function')
}

if (!src.includes('function printInventoryCategoryPriceList')) {
  insertAfterAsyncFunction('deleteInventoryItem', `
 function printInventoryCategoryPriceList() {
  const selectedCategory = inventoryCategoryFilter || 'all'

  if (selectedCategory === 'all') {
   showToast('Please select one category before printing.', 'red')
   return
  }

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({
   '&':'&amp;',
   '<':'&lt;',
   '>':'&gt;',
   '"':'&quot;',
   "'":'&#39;'
  }[ch]))

  const displayCategoryName = (category) => normalizeInventoryCategory(category)

  const rows = (inventoryItems || [])
   .filter(item => String(item.is_active ?? true) !== 'false')
   .filter(item => {
    const displayCat = displayCategoryName(item.category)
    return displayCat === selectedCategory || item.category === selectedCategory
   })
   .sort((a,b) => String(a.name || '').localeCompare(String(b.name || '')))
   .map(item => {
    const sellingPrice = isSnackDrinkInventoryItem(item)
     ? getSnackDrinkDisplaySellingPrice(item)
     : safeNum(item.selling_price ?? item.price ?? 0, 0)

    return {
     name: item.name || '',
     sellingPrice
    }
   })

  if (rows.length === 0) {
   showToast('No items found for this category.', 'red')
   return
  }

  const rowHtml = rows.map(row =>
   '<tr>' +
    '<td>' + esc(row.name) + '</td>' +
    '<td style="text-align:right;">' + esc(php(row.sellingPrice)) + '</td>' +
   '</tr>'
  ).join('')

  const pw = window.open('', '_blank')
  if (!pw) {
   showToast('Popup blocked. Please allow popups to print.', 'red')
   return
  }

  const html = [
   '<!DOCTYPE html><html><head><title>Inventory Price List</title>',
   '<style>',
   '@page { size:A4; margin:14mm; }',
   'body { font-family:Arial, sans-serif; color:#111; margin:0; }',
   'table { width:100%; border-collapse:collapse; }',
   'th, td { border:1px solid #222; padding:8px 10px; font-size:13px; }',
   'th { background:#f2f2f2; text-align:left; font-weight:bold; }',
   'th:last-child { text-align:right; }',
   '.no-print { text-align:center; margin-top:14px; }',
   'button { background:#ca1b1b; color:white; border:none; border-radius:8px; padding:10px 18px; font-weight:bold; cursor:pointer; }',
   '@media print { .no-print { display:none; } }',
   '</style></head><body>',
   '<table>',
   '<thead><tr><th>Product Name</th><th>Selling Price</th></tr></thead>',
   '<tbody>' + rowHtml + '</tbody>',
   '</table>',
   '<div class="no-print"><button onclick="window.print()">PRINT</button></div>',
   '</body></html>'
  ].join('')

  pw.document.write(html)
  pw.document.close()
  pw.focus()
  setTimeout(() => pw.print(), 300)
 }
  `)
} else {
  console.log('SKIPPED: printInventoryCategoryPriceList already exists')
}

const oldFilterSelect = `<select value={inventoryCategoryFilter} onChange={e=>setInventoryCategoryFilter(e.target.value)} style={{...inputStyle, marginBottom:0, width:'auto' }}>
 <option value="all">All Categories</option>
 {INVENTORY_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
 </select>`

const newFilterSelect = `<select value={inventoryCategoryFilter} onChange={e=>setInventoryCategoryFilter(e.target.value)} style={{...inputStyle, marginBottom:0, width:'auto' }}>
 <option value="all">All Categories</option>
 {INVENTORY_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
 </select>
 <button
  style={{...btnBlack, background:'#1a1a2e', width:'auto', padding:'10px 14px', marginTop:0, fontSize:'12px', opacity:inventoryCategoryFilter==='all'?0.55:1 }}
  onClick={printInventoryCategoryPriceList}
  title={inventoryCategoryFilter==='all'?'Select one category first':'Print product name and selling price only'}
 >
  PRINT CATEGORY PRICE LIST
 </button>`

if (!src.includes('PRINT CATEGORY PRICE LIST')) {
  if (!src.includes(oldFilterSelect)) {
    throw new Error('Inventory category filter select block not found')
  }
  src = src.replace(oldFilterSelect, newFilterSelect)
  changes++
  console.log('ADDED: PRINT CATEGORY PRICE LIST button')
} else {
  console.log('SKIPPED: PRINT CATEGORY PRICE LIST button already exists')
}

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
console.log('Total changes:', changes)
