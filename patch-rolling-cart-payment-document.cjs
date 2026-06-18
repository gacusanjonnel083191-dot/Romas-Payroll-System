const fs = require('fs')

const path = 'src/App.jsx'
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `src/App.jsx.backup-before-rolling-cart-payment-document-${stamp}`

let src = fs.readFileSync(path, 'utf8')
fs.copyFileSync(path, backup)

let changes = 0

function replaceOnce(from, to, label) {
  if (!src.includes(from)) {
    console.log('NOT FOUND:', label)
    return false
  }
  src = src.replace(from, to)
  changes++
  console.log('UPDATED:', label)
  return true
}

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

function replaceConstArrowFunction(functionName, newFunctionText) {
  const needle = `const ${functionName} =`
  const start = src.indexOf(needle)
  if (start < 0) throw new Error(`${functionName} not found`)

  const openBrace = src.indexOf('{', start)
  if (openBrace < 0) throw new Error(`${functionName} opening brace not found`)

  const closeBrace = findMatchingBrace(src, openBrace)
  if (closeBrace < 0) throw new Error(`${functionName} closing brace not found`)

  src = src.slice(0, start) + newFunctionText.trim() + src.slice(closeBrace + 1)
  changes++
  console.log('UPDATED:', functionName)
}

function insertAfterAsyncFunction(functionName, insertText) {
  const needle = `async function ${functionName}`
  const start = src.indexOf(needle)
  if (start < 0) throw new Error(`${functionName} not found`)

  const openBrace = src.indexOf('{', start)
  if (openBrace < 0) throw new Error(`${functionName} opening brace not found`)

  const closeBrace = findMatchingBrace(src, openBrace)
  if (closeBrace < 0) throw new Error(`${functionName} closing brace not found`)

  src = src.slice(0, closeBrace + 1) + '\n\n' + insertText.trim() + '\n' + src.slice(closeBrace + 1)
  changes++
  console.log('ADDED:', insertText.match(/function\s+(\w+)/)?.[1] || insertText.match(/async function\s+(\w+)/)?.[1] || 'function')
}

// 1. Add Rolling Cart Payment Agreement to form list.
if (!src.includes("RES-ROLLING-CART-PAYMENT")) {
  const marker = "const DOCUMENT_BATCH1A_FORMS = ["
  const index = src.indexOf(marker)
  if (index < 0) throw new Error('DOCUMENT_BATCH1A_FORMS not found')

  const insertAt = index + marker.length
  const newForm = `
 { key:'RES-ROLLING-CART-PAYMENT', title:'Rolling Cart Payment Agreement', category:'Reseller / Rolling Cart', refPrefix:'RD-CARTPAY', purpose:'Fixed standard agreement for reseller rolling cart price and payment terms.' },`

  src = src.slice(0, insertAt) + newForm + src.slice(insertAt)
  changes++
  console.log('ADDED: Rolling Cart Payment Agreement form')
} else {
  console.log('SKIPPED: Rolling Cart Payment Agreement already exists')
}

// 2. Make form change initialize rolling cart default fields.
replaceConstArrowFunction('updateDocumentFormDraft', `
 const updateDocumentFormDraft = (field, value) => {
  setDocumentFormDraft(prev => {
   const next = { ...prev, [field]:value }

   if (field === 'formKey' && value === 'RES-ROLLING-CART-PAYMENT') {
    next.employeeId = ''
    next.subject = next.subject || ''
    next.items = 'Rolling Cart'
    next.details = next.details || 'One-time payment'
    next.deductionPerCutoff = ''
    next.remarks = next.remarks || 'Fixed standard rolling cart payment agreement.'
   }

   return next
  })
 }
`)

// 3. Save validation: rolling cart does not need employee; it requires reseller name, price, payment terms.
replaceOnce(
`if (!documentFormDraft.employeeId && !window.confirm('No employee selected. Save blank document record?')) return null`,
`if (form.key === 'RES-ROLLING-CART-PAYMENT') {
   if (!String(documentFormDraft.subject || '').trim()) { showToast('Please enter reseller name.', 'red'); return null }
   if (safeNum(documentFormDraft.amount, 0) <= 0) { showToast('Please enter rolling cart price.', 'red'); return null }
   if (!String(documentFormDraft.details || '').trim()) { showToast('Please select payment terms.', 'red'); return null }
  } else if (!documentFormDraft.employeeId && !window.confirm('No employee selected. Save blank document record?')) return null`,
'rolling cart save validation'
)

// 4. Save payload override for rolling cart records.
replaceOnce(
`created_by: currentAdminLabel || adminRole || 'Admin'
  }

  try {`,
`created_by: currentAdminLabel || adminRole || 'Admin'
  }

  if (form.key === 'RES-ROLLING-CART-PAYMENT') {
   payload.employee_id = null
   payload.employee_name = null
   payload.employee_code = null
   payload.position = null
   payload.department = null
   payload.subject = String(documentFormDraft.subject || '').trim()
   payload.amount = safeNum(documentFormDraft.amount, 0)
   payload.deduction_per_cutoff = null
   payload.details = documentFormDraft.details || 'One-time payment'
   payload.items = 'Rolling Cart'
   payload.remarks = documentFormDraft.remarks || 'Fixed standard rolling cart payment agreement.'
  }

  try {`,
'rolling cart save payload'
)

// 5. Add delete function for saved document records.
if (!src.includes('async function deleteCompanyDocumentRecord')) {
  insertAfterAsyncFunction('voidCompanyDocumentRecord', `
 async function deleteCompanyDocumentRecord(record) {
  if (!record?.id) return
  if (!window.confirm('Delete this saved document record permanently? This cannot be undone.')) return

  try {
   const { error } = await supabase
    .from('company_document_records')
    .delete()
    .eq('id', record.id)

   if (error) throw error
   showToast('Document record deleted.')
   await loadCompanyDocumentRecords()
  } catch (err) {
   showToast('Failed to delete document: ' + (err?.message || err), 'red')
  }
 }
  `)
} else {
  console.log('SKIPPED: deleteCompanyDocumentRecord already exists')
}

// 6. Rolling cart printable rows: fixed standard document.
const printableNeedle = `const buildPrintableDocumentRows = (form, emp) => {`
const printableIndex = src.indexOf(printableNeedle)
if (printableIndex < 0) throw new Error('buildPrintableDocumentRows not found')

if (!src.includes("Rolling Cart Price', documentFormDraft.amount")) {
  const insertAt = printableIndex + printableNeedle.length
  const rollingRows = `
  if (form.key === 'RES-ROLLING-CART-PAYMENT') {
   const resellerName = String(documentFormDraft.subject || '').trim() || '____________________________'
   const cartPrice = safeNum(documentFormDraft.amount, 0)
   const paymentTerms = documentFormDraft.details || 'One-time payment'

   return [
    ['Document No.', getDocumentReferenceNumber(form)],
    ['Document Type', form.title],
    ['Date Prepared', formatDateForDisplay(documentFormDraft.documentDate || today)],
    ['Reseller Name', resellerName],
    ['Rolling Cart Price', cartPrice > 0 ? php(cartPrice) : '________________'],
    ['Payment Terms', paymentTerms],
    ['Agreement Purpose', 'This document records the approved payment agreement for one Roma\\'s Donuts rolling cart under the reseller / cart program.'],
    ['Standard Terms', 'The Reseller agrees to acquire one Roma\\'s Donuts rolling cart for authorized business use. The rolling cart price and payment terms stated in this document shall be followed until fully paid.'],
    ['Fabrication / Release Terms', 'Cart fabrication, assignment, or release shall be subject to management approval and the agreed payment arrangement. Any unpaid balance remains payable by the Reseller until fully settled.'],
    ['Use of Cart', 'The rolling cart shall be used only for authorized Roma\\'s Donuts selling activities. The Reseller must maintain the cart properly, keep it clean, and follow company selling, hygiene, display, and product-handling standards.'],
    ['Default or Non-Payment', 'If the Reseller fails to follow the agreed payment terms, Roma\\'s Donuts may pause supply, hold further delivery, require payment settlement, or take other appropriate company action based on company policy and reseller agreement.'],
    ['Acknowledgment', 'By signing this document, the Reseller confirms that the price, payment terms, and obligations have been clearly explained and accepted.'],
    ['Remarks', documentFormDraft.remarks || 'Fixed standard rolling cart payment agreement.'],
    ['Prepared By', documentFormDraft.preparedBy || currentAdminLabel || 'Admin'],
    ['Approved By', documentFormDraft.approvedBy || '____________________________']
   ]
  }

`
  src = src.slice(0, insertAt) + rollingRows + src.slice(insertAt)
  changes++
  console.log('ADDED: rolling cart printable fixed rows')
} else {
  console.log('SKIPPED: rolling cart printable rows already exist')
}

// 7. Print validation: rolling cart does not require employee.
replaceOnce(
`if (!documentFormDraft.employeeId && !window.confirm('No employee selected. Print blank form?')) return`,
`if (form.key === 'RES-ROLLING-CART-PAYMENT') {
   if (!String(documentFormDraft.subject || '').trim()) { showToast('Please enter reseller name.', 'red'); return }
   if (safeNum(documentFormDraft.amount, 0) <= 0) { showToast('Please enter rolling cart price.', 'red'); return }
   if (!String(documentFormDraft.details || '').trim()) { showToast('Please select payment terms.', 'red'); return }
  } else if (!documentFormDraft.employeeId && !window.confirm('No employee selected. Print blank form?')) return`,
'rolling cart print validation'
)

// 8. UI: employee field becomes reseller name for rolling cart.
replaceOnce(
`<div>
 <label style={lblS}>Employee</label>
 <EmployeeSelect value={documentFormDraft.employeeId} onChange={value=>updateDocumentFormDraft('employeeId', value)} employees={employees} />
 </div>`,
`{documentFormDraft.formKey === 'RES-ROLLING-CART-PAYMENT' ? (
 <div>
  <label style={lblS}>Reseller Name</label>
  <input value={documentFormDraft.subject} onChange={e=>updateDocumentFormDraft('subject', e.target.value)} placeholder="Enter reseller name" style={{...inputStyle, marginBottom:0 }} />
 </div>
 ) : (
 <div>
  <label style={lblS}>Employee</label>
  <EmployeeSelect value={documentFormDraft.employeeId} onChange={value=>updateDocumentFormDraft('employeeId', value)} employees={employees} />
 </div>
 )}`,
'employee field conditional reseller name'
)

// 9. UI: Amount label becomes Rolling Cart Price.
replaceOnce(
`<label style={lblS}>Amount</label>
 <input value={documentFormDraft.amount} onChange={e=>updateDocumentFormDraft('amount', e.target.value)} placeholder="Example: 2000" style={{...inputStyle, marginBottom:0 }} />`,
`<label style={lblS}>{documentFormDraft.formKey === 'RES-ROLLING-CART-PAYMENT' ? 'Rolling Cart Price' : 'Amount'}</label>
 <input value={documentFormDraft.amount} onChange={e=>updateDocumentFormDraft('amount', e.target.value)} placeholder={documentFormDraft.formKey === 'RES-ROLLING-CART-PAYMENT' ? 'Example: 20000' : 'Example: 2000'} style={{...inputStyle, marginBottom:0 }} />`,
'amount label conditional rolling cart price'
)

// 10. UI: Deduction field becomes payment terms dropdown.
replaceOnce(
`<div>
 <label style={lblS}>Deduction Per Cutoff</label>
 <input value={documentFormDraft.deductionPerCutoff} onChange={e=>updateDocumentFormDraft('deductionPerCutoff', e.target.value)} placeholder="Example: 500" style={{...inputStyle, marginBottom:0 }} />
 </div>`,
`<div>
 <label style={lblS}>{documentFormDraft.formKey === 'RES-ROLLING-CART-PAYMENT' ? 'Payment Terms' : 'Deduction Per Cutoff'}</label>
 {documentFormDraft.formKey === 'RES-ROLLING-CART-PAYMENT' ? (
  <select value={documentFormDraft.details} onChange={e=>updateDocumentFormDraft('details', e.target.value)} style={{...inputStyle, marginBottom:0 }}>
   <option value="One-time payment">One-time payment</option>
   <option value="50% before fabrication / 50% after fabrication">50% before fabrication / 50% after fabrication</option>
   <option value="Weekly">Weekly</option>
   <option value="Semi-monthly">Semi-monthly</option>
   <option value="Monthly">Monthly</option>
  </select>
 ) : (
  <input value={documentFormDraft.deductionPerCutoff} onChange={e=>updateDocumentFormDraft('deductionPerCutoff', e.target.value)} placeholder="Example: 500" style={{...inputStyle, marginBottom:0 }} />
 )}
 </div>`,
'payment terms dropdown'
)

// 11. UI: hide subject/items fields for rolling cart and show fixed document note.
const subjectBlockStartNeedle = `<div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
 <div>
 <label style={lblS}>Subject / Reason / Payroll Period</label>`
const subjectStart = src.indexOf(subjectBlockStartNeedle)
const subjectEndNeedle = `
 <label style={lblS}>Details / Explanation / Terms</label>`
const subjectEnd = subjectStart >= 0 ? src.indexOf(subjectEndNeedle, subjectStart) : -1

if (subjectStart >= 0 && subjectEnd > subjectStart && !src.includes('Rolling Cart Payment Agreement is fixed and standardized')) {
  const oldSubjectBlock = src.slice(subjectStart, subjectEnd)
  const newSubjectBlock = `{documentFormDraft.formKey === 'RES-ROLLING-CART-PAYMENT' ? (
 <div style={{ background:'#f0fff4', border:'1px solid #c8e6c9', borderRadius:'12px', padding:'12px', marginBottom:'10px' }}>
  <p style={{ margin:'0 0 4px', color:'#2d8a4e', fontWeight:'900', fontSize:'12px' }}>Rolling Cart Payment Agreement is fixed and standardized.</p>
  <p style={{ margin:0, color:'#555', fontSize:'11px', lineHeight:1.5 }}>Only Reseller Name, Rolling Cart Price, Payment Terms, Prepared By, and Approved By are editable. The legal/business terms are locked in the printed document.</p>
 </div>
) : (
${oldSubjectBlock}
)}`
  src = src.slice(0, subjectStart) + newSubjectBlock + src.slice(subjectEnd)
  changes++
  console.log('UPDATED: rolling cart subject/items UI')
} else {
  console.log('SKIPPED: rolling cart subject/items UI already changed or not found')
}

// 12. UI: hide free-text details textarea for rolling cart.
replaceOnce(
`<label style={lblS}>Details / Explanation / Terms</label>
 <textarea value={documentFormDraft.details} onChange={e=>updateDocumentFormDraft('details', e.target.value)} placeholder="Write the important details here. This will appear in the printed form." style={{...inputStyle, minHeight:'90px', resize:'vertical' }} />`,
`{documentFormDraft.formKey === 'RES-ROLLING-CART-PAYMENT' ? (
 <div style={{ background:'#fff8dc', border:'1px solid #f5a623', borderRadius:'12px', padding:'12px', marginBottom:'10px' }}>
  <p style={{ margin:'0 0 4px', color:'#8a6d00', fontWeight:'900', fontSize:'12px' }}>Fixed Terms Preview</p>
  <p style={{ margin:0, color:'#555', fontSize:'11px', lineHeight:1.5 }}>The printed agreement will include the standard rolling cart purpose, payment obligation, use of cart, default/non-payment clause, and acknowledgment section.</p>
 </div>
) : (
 <>
  <label style={lblS}>Details / Explanation / Terms</label>
  <textarea value={documentFormDraft.details} onChange={e=>updateDocumentFormDraft('details', e.target.value)} placeholder="Write the important details here. This will appear in the printed form." style={{...inputStyle, minHeight:'90px', resize:'vertical' }} />
 </>
)}`,
'rolling cart hide editable details'
)

// 13. Saved records: ensure DELETE button exists.
if (!src.includes('onClick={()=>deleteCompanyDocumentRecord(record)}')) {
  const recordsStart = src.indexOf('companyDocumentRecords.map(record')
  if (recordsStart < 0) throw new Error('companyDocumentRecords.map(record) not found')

  const voidNeedle = `onClick={()=>voidCompanyDocumentRecord(record)}>VOID</button>}`
  const voidHit = src.indexOf(voidNeedle, recordsStart)
  if (voidHit < 0) throw new Error('Document record VOID button not found')

  const insertAt = voidHit + voidNeedle.length
  const deleteButton = `
 <button style={{...btnRed, background:'#7f1d1d', width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>deleteCompanyDocumentRecord(record)}>DELETE</button>`

  src = src.slice(0, insertAt) + deleteButton + src.slice(insertAt)
  changes++
  console.log('ADDED: DELETE button to document records')
} else {
  console.log('SKIPPED: document record DELETE button already exists')
}

fs.writeFileSync(path, src, 'utf8')

console.log('')
console.log('DONE. Backup:', backup)
console.log('Total changes:', changes)
