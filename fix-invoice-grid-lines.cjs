const fs = require("fs");
const path = "src/App.jsx";

let text = fs.readFileSync(path, "utf8");
fs.writeFileSync(process.env.USERPROFILE + "\\Desktop\\App_backup_before_invoice_grid_fix.jsx", text, "utf8");

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
  const start = source.indexOf("function " + functionName);
  if (start === -1) throw new Error("Cannot find " + functionName);

  const openIndex = source.indexOf("{", start);
  const closeIndex = findMatchingBrace(source, openIndex);
  if (closeIndex === -1) throw new Error("Cannot find closing brace for " + functionName);

  return source.slice(0, start) + replacement + "\n" + source.slice(closeIndex + 1);
}

const newCssFunction = `
function buildDeliveryInvoicePrintCSS() {
  return [
    '<style>',
    '@page { size: 4in 6in; margin: 0; }',

    '* {',
    '  box-sizing: border-box !important;',
    '  -webkit-print-color-adjust: exact !important;',
    '  print-color-adjust: exact !important;',
    '}',

    'html, body {',
    '  width: 4in !important;',
    '  height: 6in !important;',
    '  margin: 0 !important;',
    '  padding: 0 !important;',
    '  background: white !important;',
    '  font-family: Arial, sans-serif !important;',
    '  color: #000 !important;',
    '}',

    '.no-print { display: none !important; }',

    '.invoice-page {',
    '  width: 4in !important;',
    '  height: 6in !important;',
    '  margin: 0 auto !important;',
    '  padding: 0.04in !important;',
    '  background: white !important;',
    '  overflow: hidden !important;',
    '}',

    '.invoice-table {',
    '  width: 100% !important;',
    '  height: 100% !important;',
    '  border-collapse: collapse !important;',
    '  table-layout: fixed !important;',
    '  border: 2px solid #000 !important;',
    '  font-size: 8.4px !important;',
    '  line-height: 1 !important;',
    '}',

    '.invoice-table tr {',
    '  border: 1px solid #000 !important;',
    '}',

    '.invoice-table td, .invoice-table th {',
    '  border: 1px solid #000 !important;',
    '  border-color: #000 !important;',
    '  padding: 1px 2px !important;',
    '  vertical-align: middle !important;',
    '  overflow: hidden !important;',
    '  white-space: nowrap !important;',
    '}',

    '.title-row td {',
    '  height: 0.22in !important;',
    '  text-align: center !important;',
    '  font-weight: 900 !important;',
    '  font-size: 10px !important;',
    '}',

    '.field-row td { height: 0.22in !important; font-size: 8.4px !important; }',
    '.field-label { text-align: center !important; font-weight: 900 !important; }',
    '.field-value { font-weight: 700 !important; }',

    '.date-fill, .customer-fill { background: #cfe2f3 !important; }',
    '.address-fill, .prepared-fill { background: #b6d7a8 !important; }',

    '.blank-row td { height: 0.15in !important; }',

    '.header-row th {',
    '  height: 0.23in !important;',
    '  text-align: center !important;',
    '  font-weight: 900 !important;',
    '  font-size: 9px !important;',
    '}',

    '.product-row td { height: 0.215in !important; font-size: 8.2px !important; }',
    '.product-name { text-align: center !important; font-weight: 900 !important; }',
    '.number-cell { text-align: center !important; font-weight: 800 !important; }',
    '.money-cell { text-align: right !important; font-weight: 800 !important; }',

    '.footer-row td { height: 0.23in !important; font-size: 8.3px !important; }',
    '.footer-label { text-align: center !important; font-weight: 900 !important; font-style: italic !important; }',
    '.total-label { text-align: center !important; font-weight: 900 !important; font-size: 11px !important; }',
    '.total-amount { text-align: right !important; font-weight: 900 !important; background: #d9d9d9 !important; font-size: 11px !important; }',

    '@media screen {',
    '  html, body { width: auto !important; height: auto !important; min-height: 100vh !important; background: #ddd !important; display: flex !important; justify-content: center !important; align-items: flex-start !important; padding: 10px !important; }',
    '  .invoice-page { box-shadow: 0 2px 12px rgba(0,0,0,0.3) !important; }',
    '}',

    '@media print {',
    '  html, body { width: 4in !important; height: 6in !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }',
    '  .invoice-page { width: 4in !important; height: 6in !important; margin: 0 !important; padding: 0.04in !important; box-shadow: none !important; page-break-after: always !important; }',
    '  .invoice-page:last-of-type { page-break-after: auto !important; }',
    '}',
    '</style>'
  ].join('\\n')
}
`;

text = replaceFunction(text, "buildDeliveryInvoicePrintCSS", newCssFunction);

fs.writeFileSync(path, text, "utf8");

console.log("Invoice grid border fix applied.");
console.log("4x6 page size:", text.includes("@page { size: 4in 6in; margin: 0; }"));
console.log("2px outer border:", text.includes("border: 2px solid #000"));
