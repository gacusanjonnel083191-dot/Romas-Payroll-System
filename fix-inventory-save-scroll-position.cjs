const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-preserve-inventory-scroll-${stamp}`

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

// Add scroll capture at the start of saveInventoryItemEdit.
replaceOnce(
`async function saveInventoryItemEdit(item) {
  const f = editItemFields`,
`async function saveInventoryItemEdit(item) {
  const inventoryScrollY = typeof window !== 'undefined' ? window.scrollY : 0
  const f = editItemFields`,
'capture inventory scroll position'
)

// Restore scroll after inventory refresh.
replaceOnce(
`setEditingItemId(null)
  setEditItemFields({})
  loadInventoryItems()
 }`,
`setEditingItemId(null)
  setEditItemFields({})
  await loadInventoryItems()

  if (typeof window !== 'undefined') {
   setTimeout(() => window.scrollTo({ top: inventoryScrollY, left:0, behavior:'auto' }), 0)
   setTimeout(() => window.scrollTo({ top: inventoryScrollY, left:0, behavior:'auto' }), 120)
  }
 }`,
'restore inventory scroll position after save'
)

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
console.log('Total changes:', changes)
