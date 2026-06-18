const fs = require('fs');

const path = 'src/App.jsx';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

const keywords = [
  'Production Forecast',
  'production forecast',
  'forecast',
  'Forecast',
  'prodForecast',
  'forecastItems',
  'productionPlan',
  'planned',
  'donutVariants'
];

const hitIndexes = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (keywords.some(k => line.includes(k))) {
    hitIndexes.push(i);
  }
}

const used = new Set();
const output = ['PRODUCTION FORECAST AUDIT'];

for (const idx of hitIndexes.slice(0, 30)) {
  const start = Math.max(0, idx - 12);
  const end = Math.min(lines.length - 1, idx + 18);
  const key = `${start}-${end}`;
  if (used.has(key)) continue;
  used.add(key);

  output.push(`\n================ around line ${idx + 1} ================`);
  for (let i = start; i <= end; i++) {
    const clean = lines[i].trim().replace(/\s+/g, ' ');
    output.push(`${i + 1}: ${clean.length > 180 ? clean.slice(0, 180) + ' ...' : clean}`);
  }
}

fs.writeFileSync('PRODUCTION_FORECAST_AUDIT.txt', output.join('\n'), 'utf8');
console.log('DONE: Created PRODUCTION_FORECAST_AUDIT.txt');
console.log('Matches found:', hitIndexes.length);
