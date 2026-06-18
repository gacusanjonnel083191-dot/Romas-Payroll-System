const fs = require('fs');

const path = 'src/App.jsx';
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const backup = `src/App.jsx.backup-before-print-contract-doc-${stamp}`;

let src = fs.readFileSync(path, 'utf8');
fs.copyFileSync(path, backup);

const fnStart = src.indexOf('function printEmploymentContract(emp, contractKind = null) {');
const nextMarker = src.indexOf('// Inventory Functions', fnStart);

if (fnStart < 0 || nextMarker < 0) {
  throw new Error('Could not find printEmploymentContract function block.');
}

let before = src.slice(0, fnStart);
let block = src.slice(fnStart, nextMarker);
let after = src.slice(nextMarker);

block = block.replace(
  '</div><div class="no-print"><button onclick="window.print()">PRINT CONTRACT</button></div></body></html>',
  '</div></body></html>'
);

const oldPrintBlock = `const pw = window.open('', '_blank', 'width=900,height=700')
 if (!pw) { showToast('Popup blocked. Please allow popups to print the contract.', 'red'); return }
 pw.document.write(html)
 pw.document.close()
 setTimeout(() => { pw.focus(); pw.print() }, 700)`;

const newDownloadBlock = `const cleanFileName = value => String(value || '')
  .trim()
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 70)

 const fileName = [
  'Roma-Employment-Contract',
  cleanFileName(emp.full_name || 'Employee'),
  cleanFileName(type || 'contract'),
  cleanFileName(startDate || today)
 ].filter(Boolean).join('_') + '.doc'

 try {
  const blob = new Blob(['\\\\ufeff', html], { type:'application/msword;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  showToast('Employment contract Word file downloaded.')
 } catch (err) {
  console.warn('printEmploymentContract Word download failed:', err)
  showToast('Failed to download employment contract Word file: ' + (err?.message || err), 'red')
 }`;

if (!block.includes(oldPrintBlock)) {
  throw new Error('Old print window block not found inside printEmploymentContract.');
}

block = block.replace(oldPrintBlock, newDownloadBlock);

src = before + block + after;
fs.writeFileSync(path, src, 'utf8');

console.log('DONE: PRINT CONTRACT now downloads Word-compatible .doc file.');
console.log('Backup created:', backup);
