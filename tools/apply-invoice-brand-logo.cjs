const fs = require('fs')

const file = 'src/App.jsx'
let source = fs.readFileSync(file, 'utf8')

function fail(message) {
  console.error(`[invoice-brand-logo] ${message}`)
  process.exit(1)
}

function replaceRequired(oldText, newText, label) {
  if (source.includes(newText)) return
  if (!source.includes(oldText)) fail(`Expected ${label} was not found.`)
  source = source.replace(oldText, newText)
}

const requiredInfrastructure = [
  'async function fetchLogoImageBytes()',
  'function downloadDeliveryInvoiceDocxFile(filename, invoices, logoBytes)',
  'function buildDeliveryInvoiceDocxTable(invoice, hasLogo)',
  '<w:pgSz w:w="5760" w:h="8640"/>',
  'const MARGIN = 170'
]
for (const needle of requiredInfrastructure) {
  if (!source.includes(needle)) fail(`Required existing invoice infrastructure is missing: ${needle}`)
}

// Keep the real Roma's Donuts logo inside the native Word document while
// preserving one invoice per true 4 x 6 inch page.
replaceRequired(
  "rows.push(wordRow([wordImageCell('rIdLogo', 620, { width:full, span:5 })], 700))",
  "rows.push(wordRow([wordImageCell('rIdLogo', 450, { width:full, span:5 })], 520))",
  'native DOCX logo row'
)

// Reduce only product row height to make room for the logo without clipping
// the bottom of a maximum 17-row invoice.
const productLoopStart = source.indexOf('data.productRows.forEach(row => {', source.indexOf('function buildDeliveryInvoiceDocxTable(invoice, hasLogo)'))
const productLoopEnd = source.indexOf('})', productLoopStart)
if (productLoopStart < 0 || productLoopEnd < 0) fail('Could not locate DOCX product row loop.')
const productLoop = source.slice(productLoopStart, productLoopEnd + 2)
if (!productLoop.includes('], 290))')) {
  if (!productLoop.includes('], 320))')) fail('Expected DOCX product row height was not found.')
  const patchedLoop = productLoop.replace('], 320))', '], 290))')
  source = source.slice(0, productLoopStart) + patchedLoop + source.slice(productLoopEnd + 2)
}

// Match the main app's red/yellow visual language in the editable Word table.
const headers = [
  ['Product', 0],
  ['Delivered', 1],
  ['Price', 2],
  ['Amount', 3],
  ['Unsold', 4]
]
for (const [label, index] of headers) {
  const plain = `wordCell('${label}', { width:widths[${index}], align:'center', bold:true, size:20 })`
  const branded = `wordCell('${label}', { width:widths[${index}], align:'center', bold:true, size:20, shade:BRAND_RED, color:'FFFFFF' })`
  if (source.includes(plain)) source = source.replace(plain, branded)
  else if (!source.includes(branded)) fail(`Could not brand ${label} header.`)
}

// Restore logo fetching to the two print actions. A prior fresh-database refactor
// dropped the third logoBytes argument even though the native DOCX logo support remained.
replaceRequired(
  'downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoices_4x6_${date}`, dayInvoices)',
  'const logoBytes = await fetchLogoImageBytes()\n     downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoices_4x6_${date}`, dayInvoices, logoBytes)',
  'PRINT ALL branded Word call'
)
replaceRequired(
  'downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoice_4x6_${invoiceNumber}`, [freshInvoice])',
  'const logoBytes = await fetchLogoImageBytes()\n   downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoice_4x6_${invoiceNumber}`, [freshInvoice], logoBytes)',
  'PRINT branded Word call'
)

function verify(text) {
  const required = [
    "wordImageCell('rIdLogo', 450, { width:full, span:5 })], 520)",
    "shade:BRAND_RED, color:'FFFFFF'",
    '<w:pgSz w:w="5760" w:h="8640"/>',
    'const MARGIN = 170',
    'const logoBytes = await fetchLogoImageBytes()',
    'downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoices_4x6_${date}`, dayInvoices, logoBytes)',
    'downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoice_4x6_${invoiceNumber}`, [freshInvoice], logoBytes)',
    '> PRINT ALL ({invoiceDayFilter})</button>',
    '> PRINT</button>'
  ]
  for (const needle of required) {
    if (!text.includes(needle)) fail(`Verification failed: missing ${needle}`)
  }
  const forbidden = [
    'await downloadDeliveryInvoiceWordImageFile(`Romas_Donuts_Invoices_4x6_${date}`, dayInvoices)',
    'await downloadDeliveryInvoiceWordImageFile(`Romas_Donuts_Invoice_4x6_${invoiceNumber}`, [freshInvoice])',
    '> PRINT ALL PDF ({invoiceDayFilter})</button>',
    '> DOWNLOAD IMAGES</button>',
    '> DOWNLOAD PDF</button>'
  ]
  for (const needle of forbidden) {
    if (text.includes(needle)) fail(`Old invoice behavior remains: ${needle}`)
  }
}

verify(source)
fs.writeFileSync(file, source)
console.log('[invoice-brand-logo] Native 4x6 Word branding/logo patch applied and verified.')
