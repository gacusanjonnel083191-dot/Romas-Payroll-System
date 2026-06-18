const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-no-reload-inventory-save-${stamp}`

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

const oldBlock = `setEditingItemId(null)
  setEditItemFields({})
  await loadInventoryItems()

  if (typeof window !== 'undefined') {
   setTimeout(() => window.scrollTo({ top: inventoryScrollY, left:0, behavior:'auto' }), 0)
   setTimeout(() => window.scrollTo({ top: inventoryScrollY, left:0, behavior:'auto' }), 120)
  }
 }`

const newBlock = `const updatedItem = { ...item, ...payload, id:item.id }

  setInventoryItems(prev => (prev || []).map(row =>
   String(row.id) === String(item.id)
    ? { ...row, ...updatedItem }
    : row
  ))

  setEditingItemId(null)
  setEditItemFields({})

  if (typeof window !== 'undefined') {
   requestAnimationFrame(() => {
    window.scrollTo({ top: inventoryScrollY, left:0, behavior:'auto' })
   })
  }
 }`

if (!replaceOnce(oldBlock, newBlock, 'remove full reload after inventory save')) {
  const oldFallback = `setEditingItemId(null); setEditItemFields({}); loadInventoryItems()`
  const newFallback = `setInventoryItems(prev => (prev || []).map(row => String(row.id) === String(item.id) ? { ...row, ...payload, id:item.id } : row)); setEditingItemId(null); setEditItemFields({})`
  replaceOnce(oldFallback, newFallback, 'remove old inline full reload after inventory save')
}

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
console.log('Total changes:', changes)
