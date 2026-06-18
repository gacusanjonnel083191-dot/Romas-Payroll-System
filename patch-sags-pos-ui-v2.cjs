const fs = require('fs');

const path = 'src/App.jsx';
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const backup = `src/App.jsx.backup-sags-pos-ui-v2-${stamp}`;

fs.copyFileSync(path, backup);

let content = fs.readFileSync(path, 'utf8');

// Fix php formatter line
let lines = content.split(/\r?\n/);
let phpCount = 0;

lines = lines.map((line) => {
  const indent = (line.match(/^\s*/) || [''])[0];

  if (/function\s+php\s*\(\s*a\s*\)/.test(line) && line.includes('PHP')) {
    phpCount++;
    return `${indent}function php(a) { return \`\\u20B1\${safeNum(a).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\` }`;
  }

  return line;
});

content = lines.join('\n');

// Fix Status column only inside Outlet Inventory Balance section
const start = content.indexOf('Outlet Inventory Balance');
if (start < 0) throw new Error('Outlet Inventory Balance section not found.');

let end = content.indexOf('Inventory Movements', start);
if (end < 0) end = Math.min(content.length, start + 8000);

const before = content.slice(0, start);
let section = content.slice(start, end);
const after = content.slice(end);

let sectionLines = section.split(/\r?\n/);
let headerCount = 0;
let cellCount = 0;

sectionLines = sectionLines.map((line) => {
  const indent = (line.match(/^\s*/) || [''])[0];

  if (line.includes('>Status</th>')) {
    headerCount++;
    return `${indent}<th style={{ textAlign:'center', padding:'8px', width:'90px' }}>Status</th>`;
  }

  if (line.includes('{row.status}</td>') && line.includes("row.status === 'OK'")) {
    cellCount++;
    return `${indent}<td style={{ padding:'8px', borderBottom:'1px solid #efefef', textAlign:'center', width:'90px', color:row.status === 'OK' ? '#2d8a4e' : '#ca1b1b', fontWeight:'bold' }}>{row.status}</td>`;
  }

  return line;
});

if (phpCount < 1) throw new Error('php formatter was not found.');
if (headerCount < 1) throw new Error('Status header was not found inside Outlet Inventory Balance.');
if (cellCount < 1) throw new Error('Status value cell was not found inside Outlet Inventory Balance.');

section = sectionLines.join('\n');
content = before + section + after;

fs.writeFileSync(path, content, 'utf8');

console.log('DONE: Peso sign fixed and Outlet Inventory Balance Status column aligned.');
console.log('Backup created:', backup);
console.log('php formatter fixed:', phpCount);
console.log('Status header fixed:', headerCount);
console.log('Status value cell fixed:', cellCount);
