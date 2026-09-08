const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

const fnMarker = 'function buildDeliveryInvoicePrintCSS()'
const nextSectionMarker = 'const DELIVERY_INVOICE_SOURCE_WIDTH_MM'
const fnStart = src.indexOf(fnMarker)
if (fnStart < 0) throw new Error('Roma invoice branding patch aborted: buildDeliveryInvoicePrintCSS() was not found.')

const sectionEnd = src.indexOf(nextSectionMarker, fnStart)
if (sectionEnd < 0) throw new Error('Roma invoice branding patch aborted: invoice export section boundary was not found.')

let section = src.slice(fnStart, sectionEnd)

// The invoice stylesheet may be stored as a template literal or an escaped string depending
// on earlier build patches. Only make syntax-safe in-string edits: no new JS quotes, backticks,
// template expressions, or literal line breaks are injected into the stylesheet string.
section = section
  .replace(/#cfe2f3/gi, '#ffffff')
  .replace(/#b6d7a8/gi, '#FDD412')
  .replace(/#d9d9d9/gi, '#CA1B1B')
  .replace(/#000000/gi, '#1A1A2E')
  .replace(/#000(?![0-9a-f])/gi, '#1A1A2E')

function addDeclarations(selector, declarations, required = true) {
  const selectorIndex = section.indexOf(selector)
  if (selectorIndex < 0) {
    if (required) throw new Error(`Roma invoice branding patch aborted: CSS selector not found: ${selector}`)
    return
  }

  const open = section.indexOf('{', selectorIndex)
  const close = section.indexOf('}', open + 1)
  if (open < 0 || close < 0) {
    throw new Error(`Roma invoice branding patch aborted: CSS rule boundary not found: ${selector}`)
  }

  const rule = section.slice(open + 1, close)
  if (rule.includes(declarations)) return
  section = section.slice(0, close) + declarations + section.slice(close)
}

// Current Roma's Donuts palette:
// Red #CA1B1B | Gold #FDD412 | Navy #1A1A2E | White #FFFFFF.
addDeclarations('.title-row td', 'background:#CA1B1B!important;color:#ffffff!important;border-color:#1A1A2E!important;')
addDeclarations('.field-label', 'background:#FDD412!important;color:#1A1A2E!important;')
addDeclarations('.header-row th', 'background:#1A1A2E!important;color:#ffffff!important;border-color:#1A1A2E!important;')
addDeclarations('.total-label', 'background:#FDD412!important;color:#1A1A2E!important;')
addDeclarations('.total-amount', 'background:#CA1B1B!important;color:#ffffff!important;')
addDeclarations('.prepared-fill', 'background:#FDD412!important;color:#1A1A2E!important;', false)
addDeclarations('.notes-row', 'background:#FDD412!important;color:#1A1A2E!important;', false)
addDeclarations('.notes-fill', 'background:#FDD412!important;color:#1A1A2E!important;', false)
addDeclarations('.notes-cell', 'background:#FDD412!important;color:#1A1A2E!important;', false)

src = src.slice(0, fnStart) + section + src.slice(sectionEnd)
fs.writeFileSync(path, src, 'utf8')
console.log("Roma's Donuts invoice branding applied safely: #CA1B1B red, #FDD412 gold, #1A1A2E navy; legacy blue/green/gray invoice fills removed.")
