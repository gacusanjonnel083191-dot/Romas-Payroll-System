const fs = require("fs");
const path = "src/App.jsx";

let text = fs.readFileSync(path, "utf8");
fs.writeFileSync(process.env.USERPROFILE + "\\Desktop\\App_backup_before_4x6_invoice_fix.jsx", text, "utf8");

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

const newCss = String.raw`function buildDeliveryInvoicePrintCSS() {
    return \`<style>
        @page invoicePage{
          size:4in 6in;
          margin:0;
        }

        *{
          box-sizing:border-box;
          -webkit-print-color-adjust:exact!important;
          print-color-adjust:exact!important;
        }

        html,body{
          width:4in!important;
          min-width:4in!important;
          max-width:4in!important;
          height:auto!important;
          min-height:0!important;
          margin:0!important;
          padding:0!important;
          background:white!important;
          font-family:Arial,sans-serif!important;
          color:#000!important;
          overflow:visible!important;
        }

        body{
          display:block;
        }

        .no-print{
          width:4in;
          margin:0 auto 6px;
          padding:6px;
          background:#fff8dc;
          border:1px solid #fdd412;
          font-size:10px;
          text-align:center;
        }

        .invoice-page{
          page:invoicePage;
          width:4in!important;
          height:6in!important;
          min-width:4in!important;
          max-width:4in!important;
          min-height:6in!important;
          max-height:6in!important;
          margin:0 auto!important;
          padding:0.035in!important;
          background:white!important;
          overflow:hidden!important;
          box-shadow:none!important;
          border:none!important;
          break-inside:avoid!important;
          page-break-inside:avoid!important;
        }

        .invoice-table{
          width:100%;
          height:100%;
          border-collapse:collapse;
          table-layout:fixed;
          border:1px solid #000;
          font-size:8.5px;
          line-height:1.05;
        }

        .invoice-table td,
        .invoice-table th{
          border:1px solid #000;
          padding:1px 2px;
          vertical-align:middle;
          overflow:hidden;
          white-space:nowrap;
        }

        .title-row td{
          height:0.20in;
          text-align:center;
          font-weight:900;
          font-size:10.5px;
          letter-spacing:-0.1px;
        }

        .field-row td{
          height:0.21in;
          font-size:8.5px;
        }

        .field-label{
          text-align:center;
          font-weight:900;
          width:31%;
        }

        .field-value{
          font-weight:700;
        }

        .date-fill,
        .customer-fill{
          background:#cfe2f3!important;
        }

        .address-fill,
        .prepared-fill{
          background:#b6d7a8!important;
        }

        .blank-row td{
          height:0.17in;
        }

        .header-row th{
          height:0.22in;
          text-align:center;
          font-weight:900;
          font-size:9.5px;
        }

        .product-row td{
          height:0.205in;
          font-size:8.6px;
        }

        .product-name{
          text-align:center;
          font-weight:900;
        }

        .number-cell{
          text-align:center;
          font-weight:800;
        }

        .money-cell{
          text-align:right;
          font-weight:800;
        }

        .footer-row td{
          height:0.22in;
          font-size:8.6px;
        }

        .footer-label{
          text-align:center;
          font-weight:900;
          font-style:italic;
        }

        .total-label{
          text-align:center;
          font-weight:900;
          font-size:12px!important;
        }

        .total-amount{
          text-align:right;
          font-weight:900;
          background:#d9d9d9!important;
          font-size:12px!important;
        }

        @media print{
          .no-print{display:none!important;}
          html,body{
            width:4in!important;
            height:auto!important;
            margin:0!important;
            padding:0!important;
          }
          .invoice-page{
            margin:0!important;
            break-after:page!important;
            page-break-after:always!important;
          }
          .single-invoice-print .invoice-page:last-of-type,
          .print-all-invoices .invoice-page:last-of-type{
            break-after:avoid!important;
            page-break-after:avoid!important;
          }
          .force-break{
            break-after:page!important;
            page-break-after:always!important;
          }
        }
      </style>\`
  }`;

const newPage = String.raw`function buildDeliveryInvoicePrintPage(invoice, pageClass = '') {
    const items = Array.isArray(invoice.delivery_invoice_items) ? invoice.delivery_invoice_items : [];
    const reseller = resellers.find(r => String(r.id) === String(invoice.reseller_id));
    const resellerAccount = resellerAccounts.find(a => String(a.id) === String(reseller?.reseller_account_id || invoice.reseller_account_id || ''));

    const cleanText = value => String(value || '').trim();
    const normalize = value => cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, '');
    const escapeHtml = value => cleanText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const peso = value => {
      const amount = safeNum(value, 0).toLocaleString('en-PH', { minimumFractionDigits:2, maximumFractionDigits:2 });
      return '\\u20B1' + amount;
    };

    const formatInvoiceDate = value => {
      const raw = cleanText(value);
      if (!raw) return '';
      const datePart = raw.slice(0, 10);
      const parts = datePart.split('-');
      if (parts.length === 3) return parts[1] + ' / ' + parts[2] + ' / ' + parts[0];
      return raw;
    };

    const resellerName = [
      reseller?.contact_person,
      resellerAccount?.owner_name,
      resellerAccount?.account_name,
      invoice.reseller_contact_person,
      invoice.reseller_owner_name,
      invoice.reseller_name,
      reseller?.name
    ].map(cleanText).find(Boolean) || '';

    const resellerAddress = [
      reseller?.address,
      invoice.reseller_address,
      invoice.address,
      reseller?.area
    ].map(cleanText).find(Boolean) || '';

    const preparedBy = cleanText(invoice.prepared_by || invoice.dispatcher || invoice.dispatcher_name || invoice.created_by || '');

    const rows = [
      { label:'Choco Balls', aliases:['Choco Balls'] },
      { label:'', aliases:[] },
      { label:'Almond Glitz', aliases:['Almond Glitz'] },
      { label:'Fanfans', aliases:['Fanfans', 'Fan Fans'] },
      { label:'Oreo Dream', aliases:['Oreo Dream'] },
      { label:'Lotus Cloud', aliases:['Lotus Cloud'] },
      { label:'Rings', aliases:['Rings'] },
      { label:'Shells', aliases:['Shells'] },
      { label:'Bav. Midnight', aliases:['Bavarian Midnight', 'Bav. Midnight', 'Bav Midnight'] },
      { label:'Circlets', aliases:['Circlets', 'Glazed Circlets', 'Glaze Circlet'] },
      { label:'Bavarian Bites', aliases:['Bavarian Bites'] },
      { label:'Bavarian Pops', aliases:['Bavarian Pops'] },
      { label:'Cinnamon Rolls', aliases:['Cinnamon Rolls'] },
      { label:'Biscoreo', aliases:['Biscoreo'] },
      { label:'Choco Lollisticks', aliases:['Choco Lollisticks', 'Choco Lollistick', 'Choco Lollistiks'] }
    ];

    const getQty = item => safeNum(item?.delivered_quantity ?? item?.actual_quantity ?? item?.quantity, 0);
    const getPrice = item => safeNum(item?.reseller_price ?? item?.unit_price ?? item?.price ?? item?.selling_price, 0);
    const getAmount = item => {
      const stored = safeNum(item?.total_price ?? item?.amount ?? item?.line_total, NaN);
      if (Number.isFinite(stored)) return stored;
      return getQty(item) * getPrice(item);
    };

    const findMatchingItems = row => {
      if (!row.label) return [];
      const aliases = row.aliases.map(normalize);
      return items.filter(item => {
        const itemName = normalize(item.variant_name || item.product_name || item.name || '');
        return aliases.some(alias => itemName === alias || itemName.includes(alias) || alias.includes(itemName));
      });
    };

    const productRowsHtml = rows.map(row => {
      if (!row.label) {
        return '<tr class="product-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>';
      }

      const matched = findMatchingItems(row);
      const qty = matched.reduce((sum, item) => sum + getQty(item), 0);
      const first = matched[0] || null;
      const price = first ? getPrice(first) : 0;
      const amount = matched.reduce((sum, item) => sum + getAmount(item), 0);

      return \`<tr class="product-row">
        <td class="product-name">\${escapeHtml(row.label)}</td>
        <td class="number-cell">\${qty ? qty.toLocaleString('en-PH') : ''}</td>
        <td class="money-cell">\${price ? peso(price) : ''}</td>
        <td class="money-cell">\${amount ? peso(amount) : ''}</td>
        <td></td>
      </tr>\`;
    }).join('');

    const computedTotal = rows.reduce((sum, row) => {
      return sum + findMatchingItems(row).reduce((itemSum, item) => itemSum + getAmount(item), 0);
    }, 0);

    const invoiceTotal = safeNum(invoice.total_amount, computedTotal || 0) || computedTotal;

    return \`
      <section class="invoice-page \${pageClass}">
        <table class="invoice-table">
          <colgroup>
            <col style="width:31%;">
            <col style="width:21%;">
            <col style="width:16%;">
            <col style="width:16%;">
            <col style="width:16%;">
          </colgroup>

          <tr class="title-row">
            <td colspan="5">Roma\\u2019s Donuts \\u2013 Delivery Invoice</td>
          </tr>

          <tr class="field-row">
            <td class="field-label">Date:</td>
            <td class="field-value date-fill" colspan="3">\${escapeHtml(formatInvoiceDate(invoice.delivery_date || invoice.invoice_date || ''))}</td>
            <td></td>
          </tr>

          <tr class="field-row">
            <td class="field-label">Customer:</td>
            <td class="field-value customer-fill" colspan="3">\${escapeHtml(resellerName)}</td>
            <td></td>
          </tr>

          <tr class="field-row">
            <td class="field-label">Address:</td>
            <td class="field-value address-fill" colspan="3">\${escapeHtml(resellerAddress)}</td>
            <td></td>
          </tr>

          <tr class="blank-row"><td></td><td></td><td></td><td></td><td></td></tr>

          <tr class="header-row">
            <th>Product</th>
            <th>Delivered</th>
            <th>Price</th>
            <th>Amount</th>
            <th>Unsold</th>
          </tr>

          \${productRowsHtml}

          <tr class="blank-row"><td></td><td></td><td></td><td></td><td></td></tr>

          <tr class="footer-row">
            <td class="footer-label">Crates Used</td>
            <td class="number-cell">\${invoice.crates_used ? escapeHtml(invoice.crates_used) : ''}</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>

          <tr class="footer-row">
            <td class="footer-label">Crates Cover</td>
            <td></td>
            <td class="total-label">TOTAL</td>
            <td class="total-amount">\${peso(invoiceTotal)}</td>
            <td></td>
          </tr>

          <tr class="footer-row">
            <td class="footer-label prepared-fill">Prepared by:</td>
            <td class="prepared-fill" colspan="2">\${escapeHtml(preparedBy)}</td>
            <td></td>
            <td></td>
          </tr>
        </table>
      </section>\`;
  }`;

text = replaceFunction(text, "buildDeliveryInvoicePrintCSS", newCss);
text = replaceFunction(text, "buildDeliveryInvoicePrintPage", newPage);

text = text.replace(/window\.open\('','_blank','width=650,height=900'\)/g, "window.open('','_blank','width=420,height=660')");
text = text.replace(/window\.open\('','_blank','width=900,height=700'\)/g, "window.open('','_blank','width=420,height=660')");
text = text.replace(/Use 145mm [^<]*?printed area\./g, "Use 4 x 6 inches paper size, scale 100%, and turn off headers/footers.");

fs.writeFileSync(path, text, "utf8");

console.log("4x6 invoice layout patch applied.");
console.log("buildDeliveryInvoicePrintCSS:", text.includes("size:4in 6in"));
console.log("Fixed invoice title:", text.includes("Delivery Invoice"));
console.log("Old 145mm print size still exists:", text.includes("145mm"));
