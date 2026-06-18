const fs = require('fs');

const path = 'src/App.jsx';
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const backup = `src/App.jsx.backup-before-matcha-pops-${stamp}`;

fs.copyFileSync(path, backup);

let content = fs.readFileSync(path, 'utf8');

if (content.includes("name:'Matcha Pops'") || content.includes('name:"Matcha Pops"')) {
  console.log('Matcha Pops already exists. No duplicate added.');
  process.exit(0);
}

const anchor = "{ name:'Taro Pops', category:'Bites', selling_price:7, pieces_per_batch:30 },";
const insert = `${anchor}
  { name:'Matcha Pops', category:'Bites', selling_price:7, pieces_per_batch:30 },`;

if (!content.includes(anchor)) {
  throw new Error('Could not find Taro Pops anchor. No changes saved.');
}

content = content.replace(anchor, insert);

fs.writeFileSync(path, content, 'utf8');

console.log('DONE: Matcha Pops added to DONUT_VARIANTS_DEFAULT.');
console.log('Backup created:', backup);
