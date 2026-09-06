const fs = require('fs')
const path = process.env.ROMAS_APP_PATH || 'src/App.jsx'
let src = fs.readFileSync(path, 'utf8')

const marker = 'PRODUCTION_FORECAST_LETTER_PRINT_V1'
if (src.includes(marker)) {
  console.log('Production Forecast Letter print patch already present; no changes needed.')
  process.exit(0)
}

const fnAnchor = 'const printForecast = () => {'
const fnIndex = src.indexOf(fnAnchor)
if (fnIndex < 0) throw new Error('Production Forecast print function was not found. Patch aborted safely.')

const styleOpen = src.indexOf('<style>', fnIndex)
const styleClose = src.indexOf('</style>', styleOpen)
if (styleOpen < 0 || styleClose < 0 || styleClose - fnIndex > 40000) {
  throw new Error('Production Forecast print stylesheet was not found within the expected print function. Patch aborted safely.')
}

const css = `
/* ${marker} */
@page { size: 8.5in 11in; margin: 0.30in; }
html, body {
  width: 100% !important;
  min-height: 10.4in !important;
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box !important;
}
body {
  font-size: 12px !important;
  line-height: 1.22 !important;
}
body > * {
  width: 100% !important;
  max-width: none !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  box-sizing: border-box !important;
}
table {
  width: 100% !important;
  max-width: none !important;
  border-collapse: collapse !important;
}
th, td {
  padding-top: 3px !important;
  padding-bottom: 3px !important;
}
@media print {
  html, body {
    width: 7.9in !important;
    min-height: 10.4in !important;
  }
  body > * {
    width: 100% !important;
    max-width: none !important;
    transform: none !important;
    zoom: 1 !important;
  }
  table { width: 100% !important; }
}
`

src = src.slice(0, styleClose) + css + src.slice(styleClose)

if (!src.includes(marker)) throw new Error('Letter print marker was not inserted. Patch aborted safely.')
fs.writeFileSync(path, src, 'utf8')
console.log('Production Forecast print layout patched for US Letter / short coupon bond (8.5 x 11 in).')
