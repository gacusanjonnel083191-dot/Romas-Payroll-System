const fs = require('fs');

const path = 'src/App.jsx';
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const backup = `src/App.jsx.backup-before-uniform-order-final-${stamp}`;

let src = fs.readFileSync(path, 'utf8');
fs.copyFileSync(path, backup);

function findMatchingBracket(text, openIndex) {
  let depth = 0;
  let quote = null;
  let escape = false;

  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];

    if (quote) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === quote) quote = null;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

const helper = `

  // MASTER DONUT VARIETY ORDER - use this everywhere for uniform display.
  const DONUT_VARIANT_DISPLAY_ORDER = [
    { label:'Choco Balls', aliases:['Choco Balls'] },
    { label:'Matcha Pops', aliases:['Matcha Pops'] },
    { label:'Taro Pops', aliases:['Taro Pops'] },
    { label:'Strawberry Pops', aliases:['Strawberry Pops'] },
    { label:'Bavarian Pops', aliases:['Bavarian Pops'] },
    { label:'Bavarian Bites', aliases:['Bavarian Bites'] },
    { label:'Choco Lollisticks', aliases:['Choco Lollisticks', 'Choco Lollistick', 'Choco Lollistiks'] },
    { label:'Circlets', aliases:['Circlets', 'Glazed Circlets', 'Glaze Circlet'] },
    { label:'Cinnamon Rolls', aliases:['Cinnamon Rolls'] },
    { label:'Rings', aliases:['Rings'] },
    { label:'Shells', aliases:['Shells'] },
    { label:'Bav. Midnight', aliases:['Bavarian Midnight', 'Bav. Midnight', 'Bav Midnight'] },
    { label:'Biscoreo', aliases:['Biscoreo'] },
    { label:'Oreo Dream', aliases:['Oreo Dream'] },
    { label:'Fanfans', aliases:['Fanfans', 'Fan Fans'] },
    { label:'Almond Glitz', aliases:['Almond Glitz'] },
    { label:'Lotus Cloud', aliases:['Lotus Cloud'] }
  ];

  function normalizeDonutVariantName(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  const DONUT_VARIANT_ORDER_INDEX = DONUT_VARIANT_DISPLAY_ORDER.reduce((map, row, index) => {
    [row.label, ...(row.aliases || [])].forEach(name => {
      const key = normalizeDonutVariantName(name);
      if (key) map[key] = index;
    });
    return map;
  }, {});

  function getDonutVariantOrderIndex(value) {
    const key = normalizeDonutVariantName(value);
    return Object.prototype.hasOwnProperty.call(DONUT_VARIANT_ORDER_INDEX, key)
      ? DONUT_VARIANT_ORDER_INDEX[key]
      : 9999;
  }

  function compareDonutVariantNamesByGuide(a, b) {
    const ai = getDonutVariantOrderIndex(a);
    const bi = getDonutVariantOrderIndex(b);
    if (ai !== bi) return ai - bi;
    return String(a || '').localeCompare(String(b || ''));
  }

  function compareDonutVariantRowsByGuide(a, b) {
    const an = a?.variant_name || a?.variant || a?.product_name || a?.name || a?.product || '';
    const bn = b?.variant_name || b?.variant || b?.product_name || b?.name || b?.product || '';
    return compareDonutVariantNamesByGuide(an, bn);
  }

  function sortDonutVariantsByGuide(list) {
    return [...(Array.isArray(list) ? list : [])].sort((a, b) =>
      compareDonutVariantNamesByGuide(
        a?.name || a?.variant_name || a?.product_name || '',
        b?.name || b?.variant_name || b?.product_name || ''
      )
    );
  }

  function buildInvoiceProductTemplateFromGuide() {
    return DONUT_VARIANT_DISPLAY_ORDER.map(row => ({
      label: row.label,
      aliases: row.aliases || [row.label]
    }));
  }
`;

let changes = 0;

if (!src.includes('DONUT_VARIANT_DISPLAY_ORDER')) {
  const marker = 'const DONUT_VARIANTS_DEFAULT = [';
  const markerIndex = src.indexOf(marker);
  if (markerIndex < 0) throw new Error('DONUT_VARIANTS_DEFAULT not found');

  const openIndex = src.indexOf('[', markerIndex);
  const closeIndex = findMatchingBracket(src, openIndex);
  if (closeIndex < 0) throw new Error('Could not find end of DONUT_VARIANTS_DEFAULT');

  let insertAt = closeIndex + 1;
  if (src[insertAt] === ';') insertAt++;

  src = src.slice(0, insertAt) + helper + src.slice(insertAt);
  changes++;
  console.log('ADDED: master donut order helper');
} else {
  console.log('SKIPPED: master helper already exists');
}

// Replace printed invoice hardcoded productTemplate block.
const printFn = src.indexOf('function getDeliveryInvoicePrintData(invoice)');
if (printFn < 0) throw new Error('getDeliveryInvoicePrintData not found');

const templateStart = src.indexOf('    const productTemplate = [', printFn);
const getQtyStart = src.indexOf('    const getQty = item =>', printFn);

if (templateStart >= 0 && getQtyStart > templateStart) {
  src = src.slice(0, templateStart) + '    const productTemplate = buildInvoiceProductTemplateFromGuide()\n\n' + src.slice(getQtyStart);
  changes++;
  console.log('UPDATED: printed invoice productTemplate uses master order');
} else if (src.includes('const productTemplate = buildInvoiceProductTemplateFromGuide()')) {
  console.log('SKIPPED: printed invoice already uses master order');
} else {
  throw new Error('Printed invoice productTemplate block not found');
}

const replacements = [
  ['setDonutVariants(data || [])', 'setDonutVariants(sortDonutVariantsByGuide(data || []))'],
  ['setDonutVariants(data)', 'setDonutVariants(sortDonutVariantsByGuide(data))'],
  ['setDonutVariants(variants)', 'setDonutVariants(sortDonutVariantsByGuide(variants))'],
  ['let forecastRows = Object.values(forecastMap).sort((a,b)=>a.variant_name.localeCompare(b.variant_name))', 'let forecastRows = Object.values(forecastMap).sort(compareDonutVariantRowsByGuide)'],
  ['return Object.values(rowsByKey).sort((a,b)=>String(a.variant_name).localeCompare(String(b.variant_name)))', 'return Object.values(rowsByKey).sort(compareDonutVariantRowsByGuide)']
];

for (const [from, to] of replacements) {
  if (src.includes(from) && !src.includes(to)) {
    src = src.split(from).join(to);
    changes++;
    console.log('UPDATED:', from);
  }
}

src = src.replace(
  /forecastRows\s*=\s*\(forecastRows\s*\|\|\s*\[\]\)\.sort\(\(a,\s*b\)\s*=>\s*String\(a\.variant_name\s*\|\|\s*a\.variant\s*\|\|\s*a\.product_name\s*\|\|\s*a\.name\s*\|\|\s*''\)\.localeCompare\(\s*String\(b\.variant_name\s*\|\|\s*b\.variant\s*\|\|\s*b\.product_name\s*\|\|\s*b\.name\s*\|\|\s*''\)\s*\)\s*\)/g,
  'forecastRows = (forecastRows || []).sort(compareDonutVariantRowsByGuide)'
);

fs.writeFileSync(path, src, 'utf8');

console.log('');
console.log('DONE. Backup:', backup);
console.log('Total changes:', changes);
