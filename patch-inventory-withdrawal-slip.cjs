const fs = require('fs');

const path = 'src/App.jsx';
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const backup = `src/App.jsx.backup-before-inventory-withdrawal-slip-${stamp}`;

let src = fs.readFileSync(path, 'utf8');
fs.copyFileSync(path, backup);

let changes = 0;

// 1) Add form to DOCUMENT_BATCH1A_FORMS
if (!src.includes("key:'INV-WITHDRAWAL'") && !src.includes('key:"INV-WITHDRAWAL"')) {
  const marker = 'const DOCUMENT_BATCH1A_FORMS = [';
  const idx = src.indexOf(marker);
  if (idx < 0) throw new Error('DOCUMENT_BATCH1A_FORMS not found');

  const insertAt = src.indexOf('[', idx) + 1;
  const formEntry = `
  { key:'INV-WITHDRAWAL', title:'Company Inventory Withdrawal Slip', refPrefix:'INV-WD' },`;

  src = src.slice(0, insertAt) + formEntry + src.slice(insertAt);
  changes++;
  console.log('ADDED: Company Inventory Withdrawal Slip to printable forms');
} else {
  console.log('SKIPPED: INV-WITHDRAWAL already exists in printable forms');
}

// 2) Add rows to buildPrintableDocumentRows
if (!src.includes("form.key === 'INV-WITHDRAWAL'")) {
  const marker = `  if (form.key === 'PAY-RELEASE') {`;
  const idx = src.indexOf(marker);
  if (idx < 0) throw new Error('PAY-RELEASE block not found');

  const block = `
  if (form.key === 'INV-WITHDRAWAL') {
   rows.push(['Withdrawal Purpose', documentFormDraft.subject || 'Production Use / Outlet Transfer / Staff Meal / Sample / Damage Replacement / Marketing / Promo / Company Use / Finished Goods Release / Other'])
   rows.push(['Department / Area', emp?.department || 'Production / Inventory / Outlet / Company Use'])
   rows.push(['Items Withdrawn', documentFormDraft.items || 'Item name, category, quantity, and unit'])
   rows.push(['Quantity / Unit', documentFormDraft.amount || '________________'])
   rows.push(['Released By', documentFormDraft.preparedBy || currentAdminLabel || '____________________________'])
   rows.push(['Approved By', documentFormDraft.approvedBy || '____________________________'])
   rows.push(['Remarks / Reason', documentFormDraft.details || documentFormDraft.remarks || 'This slip records company inventory, finished goods, supplies, tools, equipment, crates, crate covers, or other company property withdrawn from company custody.'])
  }

`;

  src = src.slice(0, idx) + block + src.slice(idx);
  changes++;
  console.log('ADDED: INV-WITHDRAWAL rows to printable document builder');
} else {
  console.log('SKIPPED: INV-WITHDRAWAL rows already exist');
}

// 3) Add to DOCUMENT_CENTER_CATALOG if possible
if (!src.includes("code:'INV-WD'") && !src.includes('code:"INV-WD"')) {
  const marker = 'const DOCUMENT_CENTER_CATALOG = [';
  const idx = src.indexOf(marker);
  if (idx >= 0) {
    const insertAt = src.indexOf('[', idx) + 1;
    const catalogEntry = `
  { code:'INV-WD', name:'Company Inventory Withdrawal Slip', category:'Inventory', batch:'Batch 1', priority:'High', status:'Template Listed', purpose:'Records withdrawal of raw materials, packaging, supplies, finished goods like donuts, tools, equipment, crates, crate covers, and other company property.' },`;

    src = src.slice(0, insertAt) + catalogEntry + src.slice(insertAt);
    changes++;
    console.log('ADDED: INV-WD to document center catalog');
  } else {
    console.log('SKIPPED: DOCUMENT_CENTER_CATALOG not found');
  }
} else {
  console.log('SKIPPED: INV-WD already exists in document catalog');
}

fs.writeFileSync(path, src, 'utf8');

console.log('');
console.log('DONE. Backup:', backup);
console.log('Total changes:', changes);
