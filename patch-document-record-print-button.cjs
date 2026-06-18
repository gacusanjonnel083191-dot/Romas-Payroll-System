const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-document-record-print-button-${stamp}`

let src = fs.readFileSync(path, 'utf8')
fs.copyFileSync(path, backup)

let changes = 0

function findMatchingBrace(text, openIndex) {
  let depth = 0
  let quote = null
  let escaped = false

  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]

    if (quote) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === quote) quote = null
      continue
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }

    if (ch === '/' && text[i + 1] === '/') {
      const nextLine = text.indexOf('\n', i + 2)
      if (nextLine < 0) return -1
      i = nextLine
      continue
    }

    if (ch === '/' && text[i + 1] === '*') {
      const endComment = text.indexOf('*/', i + 2)
      if (endComment < 0) return -1
      i = endComment + 1
      continue
    }

    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }

  return -1
}

function insertAfterFunction(functionName, insertText) {
  const needle = `function ${functionName}`
  const start = src.indexOf(needle)
  if (start < 0) throw new Error(`${functionName} not found`)

  const openBrace = src.indexOf('{', start)
  if (openBrace < 0) throw new Error(`${functionName} opening brace not found`)

  const closeBrace = findMatchingBrace(src, openBrace)
  if (closeBrace < 0) throw new Error(`${functionName} closing brace not found`)

  src = src.slice(0, closeBrace + 1) + '\n\n' + insertText.trim() + '\n' + src.slice(closeBrace + 1)
  changes++
  console.log('ADDED:', insertText.match(/function\s+(\w+)/)?.[1] || 'function')
}

// 1. Add print function for saved document records.
if (!src.includes('function printCompanyDocumentRecord')) {
  insertAfterFunction('printBatch1ADocumentForm', `
 function printCompanyDocumentRecord(record) {
  if (!record) {
   showToast('No document record selected.', 'red')
   return
  }

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({
   '&':'&amp;',
   '<':'&lt;',
   '>':'&gt;',
   '"':'&quot;',
   "'":'&#39;'
  }[ch]))

  const docNo = record.document_no || record.document_number || 'RD-DOCUMENT'
  const title = record.document_type || record.form_title || record.form_key || 'Company Document'
  const status = getCompanyDocumentRecordStatusLabel(record.status)
  const employee = record.employee_name || record.employee_code || '____________________________'
  const employeeCode = record.employee_code || ''
  const docDate = record.document_date || record.created_at || today
  const incidentDate = record.incident_date || ''
  const effectiveDate = record.effective_date || ''
  const amount = safeNum(record.amount, 0)
  const deduction = safeNum(record.deduction_per_cutoff, 0)

  const rows = [
   ['Document No.', docNo],
   ['Document Type', title],
   ['Status', status],
   ['Employee', employee],
   ['Employee Code', employeeCode],
   ['Document Date', formatDateForDisplay(docDate)],
   ['Incident Date', incidentDate ? formatDateForDisplay(incidentDate) : ''],
   ['Effective Date', effectiveDate ? formatDateForDisplay(effectiveDate) : ''],
   ['Subject / Items', record.subject || record.items || ''],
   ['Details', record.details || ''],
   ['Amount', amount > 0 ? php(amount) : ''],
   ['Deduction Per Cutoff', deduction > 0 ? php(deduction) : ''],
   ['Remarks', record.remarks || ''],
   ['Prepared By', record.prepared_by || currentAdminLabel || 'Admin'],
   ['Approved By', record.approved_by || '']
  ].filter(([label, value]) => String(value || '').trim() !== '')

  const pw = window.open('', '_blank')
  if (!pw) {
   showToast('Popup blocked. Please allow popups to print document.', 'red')
   return
  }

  pw.document.write(\`<!DOCTYPE html>
<html>
<head>
<title>\${esc(docNo)}</title>
<style>
@page { size: A4; margin: 16mm; }
body { font-family: Arial, sans-serif; color:#1a1a2e; margin:0; }
.header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #ca1b1b; padding-bottom:10px; margin-bottom:18px; }
.brand h1 { margin:0; color:#ca1b1b; font-size:20px; }
.brand p { margin:3px 0 0; color:#666; font-size:11px; }
.doc-title { text-align:right; }
.doc-title h2 { margin:0; color:#1a1a2e; font-size:17px; text-transform:uppercase; }
.doc-title p { margin:4px 0 0; color:#555; font-size:11px; }
.badge { display:inline-block; padding:4px 9px; border-radius:999px; background:#f7f9fc; border:1px solid #ddd; font-size:10px; font-weight:bold; margin-top:6px; }
table { width:100%; border-collapse:collapse; margin-top:10px; }
td { border:1px solid #ddd; padding:8px 10px; font-size:12px; vertical-align:top; }
td:first-child { width:28%; background:#f8f7f5; font-weight:bold; color:#333; }
.details { min-height:70px; line-height:1.5; }
.signatures { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:55px; }
.sig { text-align:center; font-size:11px; color:#333; }
.line { border-top:1px solid #333; padding-top:6px; font-weight:bold; }
.footer { margin-top:30px; padding-top:10px; border-top:1px solid #eee; font-size:10px; color:#777; text-align:center; }
.no-print { margin-top:18px; text-align:center; }
button { background:#ca1b1b; color:white; border:none; padding:10px 18px; border-radius:8px; font-weight:bold; cursor:pointer; }
@media print { .no-print { display:none; } }
</style>
</head>
<body>
 <div class="header">
  <div class="brand">
   <h1>Roma's Donuts</h1>
   <p>Management System</p>
   <p>Company Documents & Forms Center</p>
  </div>
  <div class="doc-title">
   <h2>\${esc(title)}</h2>
   <p>\${esc(docNo)}</p>
   <span class="badge">\${esc(status)}</span>
  </div>
 </div>

 <table>
  \${rows.map(([label, value]) => \`
   <tr>
    <td>\${esc(label)}</td>
    <td class="\${label === 'Details' ? 'details' : ''}">\${esc(value).replace(/\\n/g, '<br/>')}</td>
   </tr>
  \`).join('')}
 </table>

 <div class="signatures">
  <div class="sig">
   <div class="line">\${esc(record.prepared_by || currentAdminLabel || 'Prepared By')}</div>
   <div>Prepared By</div>
  </div>
  <div class="sig">
   <div class="line">\${esc(record.approved_by || 'Approved By')}</div>
   <div>Approved By</div>
  </div>
 </div>

 <div class="footer">
  Printed from Roma's Donuts Management System • \${new Date().toLocaleString()}
 </div>

 <div class="no-print">
  <button onclick="window.print()">PRINT DOCUMENT</button>
 </div>
</body>
</html>\`)

  pw.document.close()
  pw.focus()
  setTimeout(() => pw.print(), 300)
 }
  `)
} else {
  console.log('SKIPPED: printCompanyDocumentRecord already exists')
}

// 2. Add PRINT button beside VIEW in saved document records.
if (!src.includes('printCompanyDocumentRecord(record)')) {
  const oldButton = `)}>VIEW</button>`

  const firstViewIndex = src.indexOf(oldButton, src.indexOf('companyDocumentRecords.map(record'))
  if (firstViewIndex < 0) throw new Error('Document record VIEW button not found')

  const insertAt = firstViewIndex + oldButton.length
  const printButton = `
 <button style={{...btnBlack, background:'#1a1a2e', width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>printCompanyDocumentRecord(record)}>PRINT</button>`

  src = src.slice(0, insertAt) + printButton + src.slice(insertAt)
  changes++
  console.log('ADDED: PRINT button in document records')
} else {
  console.log('SKIPPED: PRINT button already exists')
}

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
console.log('Total changes:', changes)
