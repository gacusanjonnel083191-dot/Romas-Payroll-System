const fs = require('fs');

const path = 'src/App.jsx';
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const backup = `src/App.jsx.backup-before-print-employment-contract-doc-${stamp}`;

let src = fs.readFileSync(path, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
fs.copyFileSync(path, backup);

let lines = src.split(/\r?\n/);

function findLine(regex, start = 0, end = lines.length) {
  for (let i = start; i < end; i++) {
    if (regex.test(lines[i])) return i;
  }
  return -1;
}

const fnStart = findLine(/function\s+printEmploymentContract\s*\(\s*emp\s*,\s*contractKind\s*=\s*null\s*\)\s*\{/);
const fnEnd = findLine(/\/\/\s*Inventory Functions/, fnStart);

if (fnStart < 0 || fnEnd < 0 || fnEnd <= fnStart) {
  throw new Error('Could not find printEmploymentContract boundaries.');
}

// Remove the in-document browser print button from the Word file HTML.
for (let i = fnStart; i < fnEnd; i++) {
  if (lines[i].includes('<div class="no-print"><button onclick="window.print()">PRINT CONTRACT</button></div>')) {
    lines[i] = lines[i].replace('<div class="no-print"><button onclick="window.print()">PRINT CONTRACT</button></div>', '');
  }
}

// Replace only the browser print block at the end of printEmploymentContract.
const printStart = findLine(/const\s+pw\s*=\s*window\.open/, fnStart, fnEnd);
const printEnd = findLine(/setTimeout\(\(\)\s*=>\s*\{\s*pw\.focus\(\);\s*pw\.print\(\)\s*\}/, printStart, fnEnd);

if (printStart < 0 || printEnd < 0 || printEnd < printStart) {
  throw new Error('Could not find browser print block inside printEmploymentContract.');
}

const downloadBlock = [
" const cleanFileName = value => String(value || '')",
"  .trim()",
"  .replace(/[^a-z0-9]+/gi, '-')",
"  .replace(/^-+|-+$/g, '')",
"  .slice(0, 70)",
"",
" const fileName = [",
"  'Roma-Employment-Contract',",
"  cleanFileName(emp.full_name || 'Employee'),",
"  cleanFileName(type || 'contract'),",
"  cleanFileName(startDate || today)",
" ].filter(Boolean).join('_') + '.doc'",
"",
" try {",
"  const blob = new Blob(['\\ufeff', html], { type:'application/msword;charset=utf-8' })",
"  const url = URL.createObjectURL(blob)",
"  const link = document.createElement('a')",
"  link.href = url",
"  link.download = fileName",
"  document.body.appendChild(link)",
"  link.click()",
"  link.remove()",
"  setTimeout(() => URL.revokeObjectURL(url), 1000)",
"  showToast('Employment contract Word file downloaded.')",
" } catch (err) {",
"  console.warn('printEmploymentContract Word download failed:', err)",
"  showToast('Failed to download employment contract Word file: ' + (err?.message || err), 'red')",
" }"
];

lines.splice(printStart, printEnd - printStart + 1, ...downloadBlock);

fs.writeFileSync(path, lines.join(eol), 'utf8');

console.log('DONE: PRINT CONTRACT now downloads Word-compatible .doc file.');
console.log('Backup created:', backup);
