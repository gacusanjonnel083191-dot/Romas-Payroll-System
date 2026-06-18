const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-final-black-screen-fix-${stamp}`

let src = fs.readFileSync(path, 'utf8')
fs.copyFileSync(path, backup)

let changed = false

// Fix missing owner dashboard helper
if (!src.includes('function getOwnerPaymentDeadlineAlerts')) {
  const marker = 'function App()'
  const at = src.indexOf(marker)
  if (at < 0) throw new Error('function App() not found')

  src = src.slice(0, at) + `
function getOwnerPaymentDeadlineAlerts() {
 return []
}

` + src.slice(at)

  changed = true
  console.log('ADDED: getOwnerPaymentDeadlineAlerts fallback')
} else {
  console.log('OK: getOwnerPaymentDeadlineAlerts already exists')
}

// Remove risky service worker auto-registration so old broken cache stops loading
src = src.replace(
  /if\s*\(\s*['"]serviceWorker['"]\s+in\s+navigator\s*\)[\s\S]{0,1200?SW registered[\s\S]{0,1200?}\s*}\s*/g,
  ''
)

fs.writeFileSync(path, src, 'utf8')

console.log('Backup:', backup)
console.log('DONE: emergency app open fix applied')
