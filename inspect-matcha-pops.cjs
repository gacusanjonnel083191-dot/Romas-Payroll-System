const fs = require('fs');

const path = 'src/App.jsx';
const text = fs.readFileSync(path, 'utf8');
const lines = text.split(/\r?\n/);

const keywords = [
  'ABG',
  'Almond Glitz',
  'Bavarian Bites',
  'product_name',
  'productName',
  'product_code',
  'sku',
  'unit_price',
  'selling_price',
  'price',
  'invoice',
  'forecast',
  'reseller',
  'POS',
  'Stock In',
  'Outlet Inventory Balance'
];

const hits = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const matched = keywords.filter(k => line.toLowerCase().includes(k.toLowerCase()));

  if (matched.length) {
    const clean = line.trim().replace(/\s+/g, ' ');
    hits.push({
      line: i + 1,
      matched: matched.join(', '),
      text: clean.length > 260 ? clean.slice(0, 260) + ' ...' : clean
    });
  }
}

const output = [
  'MATCHA POPS PRODUCT INSERT AUDIT',
  'New variety target:',
  '- Name: Matcha Pops',
  '- Price: 7',
  '- Suggested SKU: MATCHA-POPS',
  '- Scope: POS, invoices, forecast, reseller portal, stock/inventory areas',
  '',
  'IMPORTANT MATCHES:',
  ...hits.slice(0, 220).map(h => `Line ${h.line} [${h.matched}]\n${h.text}\n`)
].join('\n');

fs.writeFileSync('MATCHA_POPS_AUDIT.txt', output, 'utf8');

console.log('DONE: Created MATCHA_POPS_AUDIT.txt');
console.log('Matches found:', hits.length);
console.log('Open MATCHA_POPS_AUDIT.txt and send screenshot of the top part.');
