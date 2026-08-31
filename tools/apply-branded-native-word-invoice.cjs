const fs = require('fs')

const file = 'src/App.jsx'
let source = fs.readFileSync(file, 'utf8')

function fail(message) {
  console.error(`[invoice-word-native] ${message}`)
  process.exit(1)
}

function block(startToken, endToken, label) {
  const start = source.indexOf(startToken)
  const end = source.indexOf(endToken, start + startToken.length)
  if (start < 0 || end < 0 || end <= start) fail(`Could not locate ${label}.`)
  return { start, end, text: source.slice(start, end) }
}

function replaceBlock(startToken, endToken, updater, label) {
  const found = block(startToken, endToken, label)
  const next = updater(found.text)
  if (next === found.text) fail(`No changes were made inside ${label}.`)
  source = source.slice(0, found.start) + next + source.slice(found.end)
}

function replaceRequired(oldText, newText, label) {
  if (!source.includes(oldText)) {
    if (source.includes(newText)) return
    fail(`Expected ${label} was not found.`)
  }
  source = source.replace(oldText, newText)
}

// Restore the native, editable Word table that already belongs to the app.
// Keep the exact 4 x 6 inch page, but make the table fit within 3 mm print-safe margins.
replaceBlock(
  'function buildDeliveryInvoiceDocxTable(invoice) {',
  'function buildDeliveryInvoicesDocxDocument(invoices) {',
  text => {
    let out = text
    out = out.replace(/const widths = \[[^\]]+\]/, 'const widths = [1675, 1155, 863, 863, 864]')

    // The current 105 x 165 mm layout used taller rows. Compress only the invoice
    // table rows enough to fit a true 4 x 6 inch page without clipping.
    const heightMap = new Map([
      ['360', '320'],
      ['320', '280'],
      ['290', '250'],
      ['340', '320'],
      ['40', '20']
    ])
    out = out.replace(/\],\s*(360|320|290|340|40)\)\)/g, (match, height) => `], ${heightMap.get(height)}))`)

    // Reinforce the established Roma's Donuts red/yellow invoice branding in Word.
    const headers = [
      ["wordCell('Product', { width:widths[0], align:'center', bold:true, size:13 })", "wordCell('Product', { width:widths[0], align:'center', bold:true, size:13, shade:BRAND_RED, color:'FFFFFF' })"],
      ["wordCell('Delivered', { width:widths[1], align:'center', bold:true, size:13 })", "wordCell('Delivered', { width:widths[1], align:'center', bold:true, size:13, shade:BRAND_RED, color:'FFFFFF' })"],
      ["wordCell('Price', { width:widths[2], align:'center', bold:true, size:13 })", "wordCell('Price', { width:widths[2], align:'center', bold:true, size:13, shade:BRAND_RED, color:'FFFFFF' })"],
      ["wordCell('Amount', { width:widths[3], align:'center', bold:true, size:13 })", "wordCell('Amount', { width:widths[3], align:'center', bold:true, size:13, shade:BRAND_RED, color:'FFFFFF' })"],
      ["wordCell('Unsold', { width:widths[4], align:'center', bold:true, size:13 })", "wordCell('Unsold', { width:widths[4], align:'center', bold:true, size:13, shade:BRAND_RED, color:'FFFFFF' })"]
    ]
    for (const [plain, branded] of headers) {
      if (out.includes(plain)) out = out.replace(plain, branded)
    }
    return out
  },
  'delivery invoice DOCX table'
)

replaceBlock(
  'function buildDeliveryInvoicesDocxDocument(invoices) {',
  'function buildDeliveryInvoicesDocxBlob(invoices) {',
  text => {
    let out = text
    out = out.replace('const MARGIN = 147', 'const MARGIN = 170')
    out = out.replace('<w:pgSz w:w="5953" w:h="9354"/>', '<w:pgSz w:w="5760" w:h="8640"/>')
    return out
  },
  'delivery invoice DOCX document'
)

// Print actions must download the native Word document, not a page screenshot embedded in Word.
replaceRequired(
  'await downloadDeliveryInvoiceWordImageFile(`Romas_Donuts_Invoices_4x6_${date}`, dayInvoices)',
  'downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoices_4x6_${date}`, dayInvoices)',
  'bulk Word image exporter call'
)
replaceRequired(
  'await downloadDeliveryInvoiceWordImageFile(`Romas_Donuts_Invoice_4x6_${invoiceNumber}`, [freshInvoice])',
  'downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoice_4x6_${invoiceNumber}`, [freshInvoice])',
  'single Word image exporter call'
)

source = source
  .replace('Preparing ${dayInvoices.length} 4x6 Word invoice page(s)...', 'Preparing ${dayInvoices.length} branded 4x6 Word invoice page(s)...')
  .replace('Downloaded ${dayInvoices.length} verified invoice(s) as one 4x6 Word file.', 'Downloaded ${dayInvoices.length} verified invoice(s) as one branded 4x6 Word file.')
  .replace('Preparing 4x6 Word invoice...', 'Preparing branded 4x6 Word invoice...')
  .replace('Downloaded verified invoice as a 4x6 Word file.', 'Downloaded verified invoice as a branded 4x6 Word file.')

// Restore simple PRINT / PRINT ALL labels and remove the temporary PDF/image export choices.
source = source.replace(/<>\s*(<button[^>]*onClick=\{\(\)=>printAllDailyInvoices\(invoiceDayFilter\)\}[^>]*>)\s*PRINT ALL PDF \(\{invoiceDayFilter\}\)<\/button>\s*<button[^>]*onClick=\{\(\)=>downloadAllDailyInvoiceImages\(invoiceDayFilter\)\}[^>]*>\s*DOWNLOAD IMAGES\s*<\/button>\s*<\/>/g,
  '$1 PRINT ALL ({invoiceDayFilter})</button>')

source = source.replace(/(<button[^>]*onClick=\{\(\)=>printDeliveryInvoice\(inv\)\}[^>]*>)\s*PDF\s*<\/button>\s*<button[^>]*onClick=\{\(\)=>downloadDeliveryInvoiceImage\(inv\)\}[^>]*>\s*IMAGE\s*<\/button>/g,
  '$1 PRINT</button>')

source = source.replace(/(<button[^>]*onClick=\{\(\)=>\{\s*printDeliveryInvoice\(viewingInvoice\);\s*\}\}[^>]*>)\s*DOWNLOAD PDF\s*<\/button>\s*<button[^>]*onClick=\{\(\)=>\{\s*downloadDeliveryInvoiceImage\(viewingInvoice\);\s*\}\}[^>]*>\s*DOWNLOAD IMAGE\s*<\/button>/g,
  '$1 PRINT</button>')

function verify(text) {
  const required = [
    'const widths = [1675, 1155, 863, 863, 864]',
    "shade:BRAND_RED, color:'FFFFFF'",
    '<w:pgSz w:w="5760" w:h="8640"/>',
    'const MARGIN = 170',
    'downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoices_4x6_${date}`, dayInvoices)',
    'downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoice_4x6_${invoiceNumber}`, [freshInvoice])',
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
    if (text.includes(needle)) fail(`Verification failed: old invoice action remains: ${needle}`)
  }
}

verify(source)
fs.writeFileSync(file, source)
console.log('[invoice-word-native] Branded native 4x6 Word invoice patch applied and verified.')
