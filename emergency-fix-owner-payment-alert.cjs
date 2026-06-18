const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-emergency-owner-alert-fix-${stamp}`

let src = fs.readFileSync(path, 'utf8')
fs.copyFileSync(path, backup)

if (!src.includes('function getOwnerPaymentDeadlineAlerts')) {
  const marker = 'function App()'
  const at = src.indexOf(marker)
  if (at < 0) throw new Error('function App() not found')

  const helper = `
function getOwnerPaymentDeadlineAlerts() {
 return []
}

`

  src = src.slice(0, at) + helper + src.slice(at)
  fs.writeFileSync(path, src, 'utf8')
  console.log('ADDED missing getOwnerPaymentDeadlineAlerts fallback')
} else {
  console.log('getOwnerPaymentDeadlineAlerts already exists')
}

console.log('Backup:', backup)
