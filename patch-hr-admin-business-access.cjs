const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

// Preserve the approved HR Admin business-operation access used by Myra.
// This patch is intentionally narrow: it only extends the existing HR canAccess() rule
// to the main Inventory and Sales & Expenses tabs. It does not grant owner/manager-only pages.
const hrRulePattern = /if \(role === 'hr'\) return \[([^\]]*)\]\.includes\(tab\)/
const match = src.match(hrRulePattern)

if (!match) {
  throw new Error("HR access patch aborted: existing role === 'hr' canAccess rule was not found.")
}

const existingItems = match[1]
  .split(',')
  .map(item => item.trim())
  .filter(Boolean)

const requiredItems = ["'inventory'", "'sales'"]
const nextItems = [...existingItems]
for (const item of requiredItems) {
  if (!nextItems.includes(item)) nextItems.push(item)
}

const replacement = `if (role === 'hr') return [${nextItems.join(',')}].includes(tab)`
src = src.replace(hrRulePattern, replacement)

const verification = src.match(hrRulePattern)
if (!verification || !verification[1].includes("'inventory'") || !verification[1].includes("'sales'")) {
  throw new Error('HR access patch verification failed: Inventory and Sales & Expenses were not both enabled.')
}

fs.writeFileSync(path, src, 'utf8')
console.log('HR Admin access patch applied: Inventory and Sales & Expenses enabled without widening owner/manager permissions.')
