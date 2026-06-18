const fs = require("fs");
const path = "src/App.jsx";

let text = fs.readFileSync(path, "utf8");
fs.writeFileSync(process.env.USERPROFILE + "\\Desktop\\App_backup_before_invoice_center_fix.jsx", text, "utf8");

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let state = "code";
  let quote = "";
  let escaped = false;

  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (state === "line") {
      if (ch === "\n") state = "code";
      continue;
    }

    if (state === "block") {
      if (ch === "*" && next === "/") {
        state = "code";
        i++;
      }
      continue;
    }

    if (state === "string") {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) state = "code";
      continue;
    }

    if (state === "template") {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "`") state = "code";
      continue;
    }

    if (ch === "/" && next === "/") {
      state = "line";
      i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      state = "block";
      i++;
      continue;
    }

    if (ch === "'" || ch === '"') {
      state = "string";
      quote = ch;
      continue;
    }

    if (ch === "`") {
      state = "template";
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function replaceFunction(source, functionName, replacement) {
  const marker = "function " + functionName;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error("Cannot find " + functionName);

  const openIndex = source.indexOf("{", start);
  if (openIndex === -1) throw new Error("Cannot find opening brace for " + functionName);

  const closeIndex = findMatchingBrace(source, openIndex);
  if (closeIndex === -1) throw new Error("Cannot find closing brace for " + functionName);

  return source.slice(0, start) + replacement + "\n" + source.slice(closeIndex + 1);
}

const newCssFunction = `
function buildDeliveryInvoicePrintCSS() {
  return [
    '<style>',
    '@page { size: 4in 6in; margin: 0; }',
    '@page invoicePage { size: 4in 6in; margin: 0; }',

    '* {',
    '  box-sizing: border-box;',
    '  -webkit-print-color-adjust: exact !important;',
    '  print-color-adjust: exact !important;',
    '}',

    'html, body {',
    '  margin: 0 !important;',
    '  padding: 0 !important;',
    '  background: white !important;',
    '  font-family: Arial, sans-serif !important;',
    '  color: #000 !important;',
    '}',

    '.no-print {',
    '  display: none !important;',
    '}',

    '.invoice-page {',
    '  page: invoicePage;',
    '  width: 4in !important;',
    '  height: 6in !important;',
    '  min-width: 4in !important;',
    '  max-width: 4in !important;',
    '  min-height: 6in !important;',
    '  max-height: 6in !important;',
    '  margin: 0 auto !important;',
    '  padding: 0.035in !important;',
    '  background: white !important;',
    '  overflow: hidden !important;',
    '}',

    '.invoice-table {',
    '  width: 100% !important;',
    '  height: 100% !important;',
    '  border-collapse: collapse !important;',
    '  table-layout: fixed !important;',
    '  border: 1px solid #000 !important;',
    '  font-size: 8.7px !important;',
    '  line-height: 1 !important;',
    '}',

    '.invoice-table td, .invoice-table th {',
    '  border: 1px solid #000 !important;',
    '  padding: 1px 2px !important;',
    '  vertical-align: middle !important;',
    '  overflow: hidden !important;',
    '  white-space: nowrap !important;',
    '}',

    '.title-row td {',
    '  height: 0.22in !important;',
    '  text-align: center !important;',
    '  font-weight: 900 !important;',
    '  font-size: 10.5px !important;',
    '}',

    '.field-row td {',
    '  height: 0.23in !important;',
    '  font-size: 8.6px !important;',
    '}',

    '.field-label {',
    '  text-align: center !important;',
    '  font-weight: 900 !important;',
    '}',

    '.field-value {',
    '  font-weight: 700 !important;',
    '}',

    '.date-fill, .customer-fill {',
    '  background: #cfe2f3 !important;',
    '}',

    '.address-fill, .prepared-fill {',
    '  background: #b6d7a8 !important;',
    '}',

    '.blank-row td {',
    '  height: 0.16in !important;',
    '}',

    '.header-row th {',
    '  height: 0.24in !important;',
    '  text-align: center !important;',
    '  font-weight: 900 !important;',
    '  font-size: 9.3px !important;',
    '}',

    '.product-row td {',
    '  height: 0.22in !important;',
    '  font-size: 8.5px !important;',
    '}',

    '.product-name {',
    '  text-align: center !important;',
    '  font-weight: 900 !important;',
    '}',

    '.number-cell {',
    '  text-align: center !important;',
    '  font-weight: 800 !important;',
    '}',

    '.money-cell {',
    '  text-align: right !important;',
    '  font-weight: 800 !important;',
    '}',

    '.footer-row td {',
    '  height: 0.24in !important;',
    '  font-size: 8.5px !important;',
    '}',

    '.footer-label {',
    '  text-align: center !important;',
    '  font-weight: 900 !important;',
    '  font-style: italic !important;',
    '}',

    '.total-label {',
    '  text-align: center !important;',
    '  font-weight: 900 !important;',
    '  font-size: 12px !important;',
    '}',

    '.total-amount {',
    '  text-align: right !important;',
    '  font-weight: 900 !important;',
    '  background: #d9d9d9 !important;',
    '  font-size: 12px !important;',
    '}',

    '@media screen {',
    '  body {',
    '    width: auto !important;',
    '    min-height: 100vh !important;',
    '    background: #e5e5e5 !important;',
    '    display: flex !important;',
    '    justify-content: center !important;',
    '    align-items: flex-start !important;',
    '    padding: 12px !important;',
    '    overflow: auto !important;',
    '  }',
    '  .invoice-page {',
    '    margin: 0 auto !important;',
    '    box-shadow: 0 2px 10px rgba(0,0,0,0.25) !important;',
    '  }',
    '}',

    '@media print {',
    '  html, body {',
    '    width: 4in !important;',
    '    height: 6in !important;',
    '    min-width: 4in !important;',
    '    max-width: 4in !important;',
    '    min-height: 6in !important;',
    '    max-height: 6in !important;',
    '    margin: 0 !important;',
    '    padding: 0 !important;',
    '    overflow: hidden !important;',
    '  }',
    '  .invoice-page {',
    '    width: 4in !important;',
    '    height: 6in !important;',
    '    margin: 0 !important;',
    '    padding: 0.035in !important;',
    '    box-shadow: none !important;',
    '    break-after: page !important;',
    '    page-break-after: always !important;',
    '  }',
    '  .invoice-page:last-of-type {',
    '    break-after: auto !important;',
    '    page-break-after: auto !important;',
    '  }',
    '}',
    '</style>'
  ].join('\\\\n')
}
`;

text = replaceFunction(text, "buildDeliveryInvoicePrintCSS", newCssFunction);

text = text.replace(/Use 4 x 8 inches paper size/gi, "Use 4 x 6 inches paper size");
text = text.replace(/Use 4 x 6 inches paper size, scale 100%, and turn off headers\/footers\./gi, "Use 4 x 6 inches paper size, scale 100%, margins none, backgrounds on, headers/footers off.");

fs.writeFileSync(path, text, "utf8");

const finalText = fs.readFileSync(path, "utf8");
console.log("Invoice CSS has 4x6 page:", finalText.includes("@page { size: 4in 6in; margin: 0; }"));
console.log("Invoice CSS has exact 4in body:", finalText.includes("width: 4in !important;"));
console.log("Invoice CSS has exact 6in body:", finalText.includes("height: 6in !important;"));
