const fs = require('fs')

const path = 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

const PATCH_MARKER = 'ROMAS_INVOICE_BRAND_V2_CURRENT_PALETTE'
const fnMarker = 'function buildDeliveryInvoicePrintCSS()'
const nextSectionMarker = 'const DELIVERY_INVOICE_SOURCE_WIDTH_MM'

const fnStart = src.indexOf(fnMarker)
if (fnStart < 0) {
  throw new Error('Roma invoice branding patch aborted: buildDeliveryInvoicePrintCSS() was not found.')
}

const sectionEnd = src.indexOf(nextSectionMarker, fnStart)
if (sectionEnd < 0) {
  throw new Error('Roma invoice branding patch aborted: invoice export section boundary was not found.')
}

const invoiceSection = src.slice(fnStart, sectionEnd)
if (invoiceSection.includes(PATCH_MARKER)) {
  console.log('Roma invoice branding already uses the current palette; no duplicate override added.')
  process.exit(0)
}

const styleClose = src.indexOf('</style>', fnStart)
if (styleClose < 0 || styleClose >= sectionEnd) {
  throw new Error('Roma invoice branding patch aborted: invoice print stylesheet closing tag was not found in the invoice section.')
}

// IMPORTANT: This is deliberately inserted by stable text anchors rather than by parsing
// JavaScript braces. buildDeliveryInvoicePrintCSS() contains a template literal, so brace
// parsing can corrupt the source when future invoice markup changes.
const override = `

        /* ${PATCH_MARKER}
           Current Roma's Donuts palette: Red #CA1B1B | Gold #FDD412 | Navy #1A1A2E.
           Invoice-only override. The Word export is an image of this HTML, so these rules
           must remain in the rendered invoice stylesheet to prevent legacy colors returning. */
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

src = src.slice(0, styleClose) + override + src.slice(styleClose)
fs.writeFileSync(path, src, 'utf8')
console.log("Roma's Donuts invoice branding restored: #CA1B1B red, #FDD412 gold, #1A1A2E navy; legacy blue/green/yellow invoice fills overridden.")
