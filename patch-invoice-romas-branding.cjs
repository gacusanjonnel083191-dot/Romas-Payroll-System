const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

// Keep this production build hook narrowly scoped to invoice export only.
const fnMarker = 'function buildDeliveryInvoicePrintCSS()'
const nextSectionMarker = 'const DELIVERY_INVOICE_SOURCE_WIDTH_MM'
const fnStart = src.indexOf(fnMarker)
if (fnStart < 0) throw new Error('Roma invoice export patch aborted: buildDeliveryInvoicePrintCSS() was not found.')

const sectionEnd = src.indexOf(nextSectionMarker, fnStart)
if (sectionEnd < 0) throw new Error('Roma invoice export patch aborted: invoice export section boundary was not found.')

let section = src.slice(fnStart, sectionEnd)

// Keep the exported Word-image invoice on the approved Roma's Donuts palette.
// These replacements are deliberately limited to the invoice print stylesheet.
section = section
  .replace(/#cfe2f3/gi, '#ffffff')
  .replace(/#b6d7a8/gi, '#FDD412')
  .replace(/#d9d9d9/gi, '#CA1B1B')
  .replace(/#000000/gi, '#1A1A2E')
  .replace(/#000(?![0-9a-f])/gi, '#1A1A2E')

function addDeclarations(selector, declarations, required = true) {
  const selectorIndex = section.indexOf(selector)
  if (selectorIndex < 0) {
    if (required) throw new Error(`Roma invoice export patch aborted: CSS selector not found: ${selector}`)
    return
  }

  const open = section.indexOf('{', selectorIndex)
  const close = section.indexOf('}', open + 1)
  if (open < 0 || close < 0) {
    throw new Error(`Roma invoice export patch aborted: CSS rule boundary not found: ${selector}`)
  }

  const rule = section.slice(open + 1, close)
  if (rule.includes(declarations)) return
  section = section.slice(0, close) + declarations + section.slice(close)
}

// Approved Roma's Donuts palette:
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

// The fixed invoice print template intentionally had a blank line immediately after
// Choco Balls. Matcha Pops is now a real invoice product, so that reserved line must map
// to Matcha Pops instead of rendering blank in the Word/image export.
const chocoThenBlank = "{ label:'Choco Balls', aliases:['Choco Balls'] },\n      { label:'', aliases:[] },"
const chocoThenMatcha = "{ label:'Choco Balls', aliases:['Choco Balls'] },\n      { label:'Matcha Pops', aliases:['Matcha Pops'] },"

if (src.includes(chocoThenBlank)) {
  src = src.replace(chocoThenBlank, chocoThenMatcha)
} else if (!src.includes("{ label:'Matcha Pops', aliases:['Matcha Pops'] },")) {
  throw new Error('Roma invoice export patch aborted: Matcha Pops print-row anchor was not found.')
}

fs.writeFileSync(path, src, 'utf8')
console.log("Roma's Donuts invoice export patch applied: approved branding restored and Matcha Pops print row enabled.")
