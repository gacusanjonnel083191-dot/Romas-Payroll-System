const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-compact-category-price-print-${stamp}`

let src = fs.readFileSync(path, 'utf8')
fs.copyFileSync(path, backup)

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

const start = src.indexOf('function printInventoryCategoryPriceList')
if (start < 0) throw new Error('printInventoryCategoryPriceList not found')

const openBrace = src.indexOf('{', start)
if (openBrace < 0) throw new Error('opening brace not found')

const closeBrace = findMatchingBrace(src, openBrace)
if (closeBrace < 0) throw new Error('closing brace not found')

const newFunction = `
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

  const rows = (inventoryItems || [])
   .filter(item => String(item.is_active ?? true).toLowerCase() !== 'false')
   .filter(item => {
    const displayCat = normalizeInventoryCategory(item.category)
    return displayCat === selectedCategory || String(item.category || '') === selectedCategory
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
   '<div class="price-row">' +
    '<div class="name">' + esc(row.name) + '</div>' +
    '<div class="price">' + esc(php(row.sellingPrice)) + '</div>' +
   '</div>'
  ).join('')

  const pw = window.open('', '_blank')
  if (!pw) {
   showToast('Popup blocked. Please allow popups to print.', 'red')
   return
  }

  const html = [
   '<!DOCTYPE html><html><head><title>Inventory Price List</title>',
   '<style>',
   '@page { size: Legal portrait; margin: 7mm; }',
   'html, body { margin:0; padding:0; font-family:Arial, sans-serif; color:#111; }',
   'body { font-size:10.5px; }',
   '.header-row { display:grid; grid-template-columns:minmax(0, 1fr) 48px; gap:4px; font-weight:900; border-bottom:1px solid #111; padding:0 0 3px 0; margin-bottom:3px; }',
   '.list { column-count:2; column-gap:8mm; column-fill:auto; }',
   '.price-row { break-inside:avoid; page-break-inside:avoid; display:grid; grid-template-columns:minmax(0, 1fr) 48px; gap:4px; align-items:center; border-bottom:0.5px solid #888; padding:2px 0; line-height:1.15; }',
   '.name { font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
   '.price { text-align:right; font-weight:800; white-space:nowrap; }',
   '.no-print { text-align:center; margin-top:12px; }',
   'button { background:#ca1b1b; color:white; border:none; border-radius:8px; padding:10px 18px; font-weight:bold; cursor:pointer; }',
   '@media print { .no-print { display:none; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }',
   '</style></head><body>',
   '<div class="header-row"><div>Product Name</div><div style="text-align:right;">Price</div></div>',
   '<div class="list">' + rowHtml + '</div>',
   '<div class="no-print"><button onclick="window.print()">PRINT</button></div>',
   '</body></html>'
  ].join('')

  pw.document.write(html)
  pw.document.close()
  pw.focus()
  setTimeout(() => pw.print(), 300)
 }
`

src = src.slice(0, start) + newFunction.trim() + src.slice(closeBrace + 1)
fs.writeFileSync(path, src, 'utf8')

console.log('UPDATED: compact two-column inventory category price print')
console.log('Backup:', backup)
