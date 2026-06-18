const fs = require('fs');

const path = 'src/App.jsx';
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const backup = `src/App.jsx.backup-before-master-variety-order-${stamp}`;

let src = fs.readFileSync(path, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
fs.copyFileSync(path, backup);

let lines = src.split(/\r?\n/);

function findLine(regex, start = 0) {
  for (let i = start; i < lines.length; i++) {
    if (regex.test(lines[i])) return i;
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
`.trimEnd().split('\n');

let changes = 0;

// Add helper before getDeliveryInvoicePrintData, only if missing.
if (!src.includes('DONUT_VARIANT_DISPLAY_ORDER')) {
  const insertAt = findLine(/function\s+getDeliveryInvoicePrintData\s*\(invoice\)/);
  if (insertAt < 0) throw new Error('getDeliveryInvoicePrintData not found');
  lines.splice(insertAt, 0, ...helper, '');
  changes++;
  console.log('ADDED: master variety order helper');
} else {
  console.log('SKIPPED: master helper already exists');
}

src = lines.join(eol);
lines = src.split(/\r?\n/);

// Replace invoice print productTemplate block with master-order template.
const printFn = findLine(/function\s+getDeliveryInvoicePrintData\s*\(invoice\)/);
const templateStart = findLine(/^\s*const\s+productTemplate\s*=\s*\[\s*$/, printFn);
let templateEnd = -1;

if (templateStart >= 0) {
  for (let i = templateStart + 1; i < lines.length; i++) {
    if (/^\s*\]\s*$/.test(lines[i])) {
      templateEnd = i;
      break;
    }
  }
}

if (templateStart >= 0 && templateEnd > templateStart) {
  lines.splice(templateStart, templateEnd - templateStart + 1, '    const productTemplate = buildInvoiceProductTemplateFromGuide()');
  changes++;
  console.log('UPDATED: printed invoice product template uses master order');
} else if (src.includes('const productTemplate = buildInvoiceProductTemplateFromGuide()')) {
  console.log('SKIPPED: print template already uses master order');
} else {
  throw new Error('Could not replace printed invoice productTemplate');
}

src = lines.join(eol);

// Sort main donutVariants state.
const replacements = [
  ['setDonutVariants(data || [])', 'setDonutVariants(sortDonutVariantsByGuide(data || []))'],
  ['setDonutVariants(data)', 'setDonutVariants(sortDonutVariantsByGuide(data))'],
  ['setDonutVariants(variants)', 'setDonutVariants(sortDonutVariantsByGuide(variants))'],
  ['let forecastRows = Object.values(forecastMap).sort((a,b)=>a.variant_name.localeCompare(b.variant_name))', 'let forecastRows = Object.values(forecastMap).sort(compareDonutVariantRowsByGuide)'],
  ['return Object.values(rowsByKey).sort((a,b)=>String(a.variant_name).localeCompare(String(b.variant_name)))', 'return Object.values(rowsByKey).sort(compareDonutVariantRowsByGuide)'],
  ['const variantItems = (variants||[]).map(v=>', 'const variantItems = sortDonutVariantsByGuide(variants||[]).map(v=>'],
  ['const all = variants.map(v =>', 'const all = sortDonutVariantsByGuide(variants).map(v =>']
];

for (const [from, to] of replacements) {
  if (src.includes(from) && !src.includes(to)) {
    src = src.split(from).join(to);
    changes++;
    console.log('UPDATED:', from);
  }
}

// Sort production forecast rows that use the long multiline alphabetical sort.
src = src.replace(
  /forecastRows\s*=\s*\(forecastRows\s*\|\|\s*\[\]\)\.sort\(\(a,\s*b\)\s*=>\s*String\(a\.variant_name\s*\|\|\s*a\.variant\s*\|\|\s*a\.product_name\s*\|\|\s*a\.name\s*\|\|\s*''\)\.localeCompare\(\s*String\(b\.variant_name\s*\|\|\s*b\.variant\s*\|\|\s*b\.product_name\s*\|\|\s*b\.name\s*\|\|\s*''\)\s*\)\s*\)/g,
  'forecastRows = (forecastRows || []).sort(compareDonutVariantRowsByGuide)'
);

fs.writeFileSync(path, src, 'utf8');

console.log('');
console.log('DONE. Backup:', backup);
console.log('Total changes:', changes);
