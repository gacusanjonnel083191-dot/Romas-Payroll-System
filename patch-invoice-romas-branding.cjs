const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

const PATCH_MARKER = 'ROMAS_INVOICE_BRAND_V2_CURRENT_PALETTE'

function findMatchingBrace(source, openIndex) {
  let depth = 0
  let state = 'code'
  let quote = ''
  let escaped = false

  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i]
    const next = source[i + 1]

    if (state === 'line') {
      if (ch === '\n') state = 'code'
      continue
    }
    if (state === 'block') {
      if (ch === '*' && next === '/') { state = 'code'; i++ }
      continue
    }
    if (state === 'string') {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === quote) state = 'code'
      continue
    }
    if (state === 'template') {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '`') state = 'code'
      continue
    }

    if (ch === '/' && next === '/') { state = 'line'; i++; continue }
    if (ch === '/' && next === '*') { state = 'block'; i++; continue }
    if (ch === '"' || ch === "'") { state = 'string'; quote = ch; continue }
    if (ch === '`') { state = 'template'; continue }

    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

const fnMarker = 'function buildDeliveryInvoicePrintCSS()'
const fnStart = src.indexOf(fnMarker)
if (fnStart < 0) throw new Error('Roma invoice branding patch aborted: buildDeliveryInvoicePrintCSS() was not found.')

const openBrace = src.indexOf('{', fnStart)
const closeBrace = findMatchingBrace(src, openBrace)
if (openBrace < 0 || closeBrace < 0) throw new Error('Roma invoice branding patch aborted: could not determine invoice CSS function boundaries.')

let fnText = src.slice(fnStart, closeBrace + 1)
if (fnText.includes(PATCH_MARKER)) {
  console.log('Roma invoice branding already uses the current palette; no duplicate override added.')
  process.exit(0)
}

const styleClose = fnText.lastIndexOf('</style>')
if (styleClose < 0) throw new Error('Roma invoice branding patch aborted: invoice print stylesheet closing tag was not found.')

const override = `

        /* ${PATCH_MARKER}
           Current Roma's Donuts palette: Red #CA1B1B | Gold #FDD412 | Navy #1A1A2E.
           Kept as an invoice-only override so legacy blue/green/yellow fills cannot return
           when the Word export is rendered to an image. */
        .invoice-page{
          background:#ffffff!important;
          color:#1A1A2E!important;
        }

        .invoice-table{
          color:#1A1A2E!important;
          border-color:#1A1A2E!important;
        }

        .invoice-table td,
        .invoice-table th{
          border-color:#1A1A2E!important;
        }

        .title-row td{
          background:#CA1B1B!important;
          color:#ffffff!important;
          border-color:#1A1A2E!important;
        }

        .field-label{
          background:#FDD412!important;
          color:#1A1A2E!important;
        }

        .date-fill,
        .customer-fill,
        .address-fill,
        .field-value{
          background:#ffffff!important;
          color:#1A1A2E!important;
        }

        .notes-row,
        .notes-row td,
        .notes-fill,
        .notes-cell,
        tr[class*="note"] td,
        td[class*="note"]{
          background:#FDD412!important;
          color:#1A1A2E!important;
        }

        .header-row th{
          background:#1A1A2E!important;
          color:#ffffff!important;
          border-color:#1A1A2E!important;
        }

        .product-row td,
        .blank-row td{
          background:#ffffff!important;
          color:#1A1A2E!important;
        }

        .footer-row td{
          background:#ffffff!important;
          color:#1A1A2E!important;
        }

        .total-label{
          background:#FDD412!important;
          color:#1A1A2E!important;
        }

        .total-amount{
          background:#CA1B1B!important;
          color:#ffffff!important;
        }

        .prepared-fill{
          background:#FDD412!important;
          color:#1A1A2E!important;
        }
`

fnText = fnText.slice(0, styleClose) + override + fnText.slice(styleClose)
src = src.slice(0, fnStart) + fnText + src.slice(closeBrace + 1)

fs.writeFileSync(path, src, 'utf8')
console.log("Roma's Donuts invoice branding restored: #CA1B1B red, #FDD412 gold, #1A1A2E navy; legacy blue/green/yellow invoice fills overridden.")
