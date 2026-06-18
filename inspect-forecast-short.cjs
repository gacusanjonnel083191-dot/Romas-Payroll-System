const fs = require('fs');

const path = 'src/App.jsx';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

const terms = [
  'Production Forecast',
  'deliveryDateToForecast',
  'forecastMap',
  'totalPieces',
  'Dry Premix',
  'dryPremix',
  'invoices',
  'invoiceItems',
  'donutVariants',
  'variant_name',
  'total_pieces'
];

const hits = [];

for (let i = 0; i < lines.length; i++) {
  if (terms.some(t => lines[i].includes(t))) hits.push(i);
}

const ranges = [];
for (const h of hits) {
  const start = Math.max(0, h - 5);
  const end = Math.min(lines.length - 1, h + 8);

  const last = ranges[ranges.length - 1];
  if (last && start <= last.end + 3) {
    last.end = Math.max(last.end, end);
  } else {
    ranges.push({ start, end });
  }
}

const out = ['SHORT PRODUCTION FORECAST AUDIT'];

for (const r of ranges.slice(0, 12)) {
  out.push(`\n===== lines ${r.start + 1} to ${r.end + 1} =====`);
  for (let i = r.start; i <= r.end; i++) {
    let clean = lines[i].trim().replace(/\s+/g, ' ');
    if (clean.length > 140) clean = clean.slice(0, 140) + ' ...';
    out.push(`${i + 1}: ${clean}`);
  }
}

fs.writeFileSync('FORECAST_SHORT_AUDIT.txt', out.join('\n'), 'utf8');
console.log('DONE: Created FORECAST_SHORT_AUDIT.txt');
console.log('Open FORECAST_SHORT_AUDIT.txt and send screenshot.');
