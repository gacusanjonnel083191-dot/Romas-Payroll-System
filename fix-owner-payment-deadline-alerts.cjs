const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-fix-owner-payment-deadline-alerts-${stamp}`

let src = fs.readFileSync(path, 'utf8')
fs.copyFileSync(path, backup)

if (src.includes('function getOwnerPaymentDeadlineAlerts')) {
  console.log('SKIPPED: getOwnerPaymentDeadlineAlerts already exists')
} else {
  const marker = 'function App()'
  const index = src.indexOf(marker)

  if (index < 0) {
    throw new Error('function App() not found')
  }

  const fallback = `
// Safe fallback: prevents owner dashboard crash if payment deadline alert helper is missing.
function getOwnerPaymentDeadlineAlerts() {
 return []
}

`

  src = src.slice(0, index) + fallback + src.slice(index)
  fs.writeFileSync(path, src, 'utf8')

  console.log('ADDED: getOwnerPaymentDeadlineAlerts safe fallback')
}

console.log('Backup:', backup)
