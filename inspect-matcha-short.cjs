const fs = require('fs');

const path = 'src/App.jsx';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

const productNames = ['ABG', 'Almond Glitz', 'Bavarian Bites'];
const windows = [];

for (const name of productNames) {
  const index = lines.findIndex(line => line.includes(name));
  if (index >= 0) {
    const start = Math.max(0, index - 12);
    const end = Math.min(lines.length - 1, index + 18);
    windows.push(`\n================ ${name} around line ${index + 1} ================`);
    for (let i = start; i <= end; i++) {
      const clean = lines[i].trim().replace(/\s+/g, ' ');
      windows.push(`${i + 1}: ${clean.length > 180 ? clean.slice(0, 180) + ' ...' : clean}`);
    }
  } else {
    windows.push(`\n================ ${name} ================\nNOT FOUND`);
  }
}

fs.writeFileSync('MATCHA_POPS_SHORT_AUDIT.txt', windows.join('\n'), 'utf8');
console.log('DONE: Created MATCHA_POPS_SHORT_AUDIT.txt');
