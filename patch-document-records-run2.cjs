const fs = require('fs');

const path = 'src/App.jsx';
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const backup = `src/App.jsx.backup-before-document-records-${stamp}`;

let src = fs.readFileSync(path, 'utf8');
fs.copyFileSync(path, backup);

let changes = 0;

function replaceOnce(from, to, label) {
  if (!src.includes(from)) {
    console.log('SKIPPED / NOT FOUND:', label);
    return false;
  }
  if (src.includes(to)) {
    console.log('SKIPPED / ALREADY EXISTS:', label);
    return false;
  }
  src = src.replace(from, to);
  changes++;
  console.log('UPDATED:', label);
  return true;
}

// 1) Add document records state after documentFormDraft state block.
const stateMarker = "const [documentFormDraft, setDocumentFormDraft] = useState({";
const stateIdx = src.indexOf(stateMarker);
if (stateIdx < 0) throw new Error('documentFormDraft state not found.');

if (!src.includes("const [companyDocumentRecords, setCompanyDocumentRecords]")) {
  const afterDraftIdx = src.indexOf("\n })", stateIdx);
  if (afterDraftIdx < 0) throw new Error('Could not find end of documentFormDraft state.');

  const insertAt = afterDraftIdx + "\n })".length;
  const stateInsert = `
 const [companyDocumentRecords, setCompanyDocumentRecords] = useState([])
 const [companyDocumentRecordsLoading, setCompanyDocumentRecordsLoading] = useState(false)
`;
  src = src.slice(0, insertAt) + stateInsert + src.slice(insertAt);
  changes++;
  console.log('ADDED: company document records state');
} else {
  console.log('SKIPPED: document records state already exists');
}

// 2) Add loader/saver functions before getSelectedDocumentBatch1AForm.
const functionMarker = " const getSelectedDocumentBatch1AForm = () => {";
const functionIdx = src.indexOf(functionMarker);
if (functionIdx < 0) throw new Error('getSelectedDocumentBatch1AForm not found.');

if (!src.includes("async function loadCompanyDocumentRecords")) {
  const functions = `
 async function loadCompanyDocumentRecords() {
  setCompanyDocumentRecordsLoading(true)
  try {
   const { data, error } = await supabase
    .from('company_document_records')
    .select('*')
    .order('created_at', { ascending:false })
    .limit(200)

   if (error) throw error
   setCompanyDocumentRecords(data || [])
  } catch (err) {
   console.warn('loadCompanyDocumentRecords:', err)
   showToast('Failed to load document records: ' + (err?.message || err), 'red')
   setCompanyDocumentRecords([])
  } finally {
   setCompanyDocumentRecordsLoading(false)
  }
 }

 function getCompanyDocumentRecordStatusColor(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'draft') return 'yellow'
  if (s === 'served' || s === 'issued') return 'blue'
  if (s === 'closed' || s === 'completed') return 'green'
  if (s === 'voided') return 'red'
  return 'gray'
 }

 function getCompanyDocumentRecordStatusLabel(status) {
  const s = String(status || 'draft').toLowerCase()
  if (s === 'draft') return 'Draft'
  if (s === 'served') return 'Served'
  if (s === 'issued') return 'Issued'
  if (s === 'closed') return 'Closed'
  if (s === 'completed') return 'Completed'
  if (s === 'voided') return 'Voided'
  return s.replace(/_/g, ' ').replace(/\\b\\w/g, ch => ch.toUpperCase())
 }

 async function saveCurrentDocumentRecord(status = 'draft', options = {}) {
  const form = getSelectedDocumentBatch1AForm()
  const emp = getDocumentFormEmployee()
  const docNo = getDocumentReferenceNumber(form)

  if (!documentFormDraft.employeeId && !window.confirm('No employee selected. Save blank document record?')) return null

  const payload = {
   document_no: docNo,
   form_key: form.key,
   document_type: form.title,
   employee_id: emp?.id || documentFormDraft.employeeId || null,
   employee_name: emp?.full_name || null,
   employee_code: emp?.employee_code || null,
   position: emp?.position || null,
   department: emp?.department || null,
   document_date: documentFormDraft.documentDate || today,
   incident_date: documentFormDraft.incidentDate || null,
   effective_date: documentFormDraft.effectiveDate || null,
   subject: documentFormDraft.subject || null,
   details: documentFormDraft.details || null,
   amount: documentFormDraft.amount ? safeNum(documentFormDraft.amount, 0) : null,
   deduction_per_cutoff: documentFormDraft.deductionPerCutoff ? safeNum(documentFormDraft.deductionPerCutoff, 0) : null,
   items: documentFormDraft.items || null,
   remarks: documentFormDraft.remarks || null,
   prepared_by: documentFormDraft.preparedBy || currentAdminLabel || 'Admin',
   approved_by: documentFormDraft.approvedBy || null,
   status,
   created_by: currentAdminLabel || adminRole || 'Admin'
  }

  try {
   const { data, error } = await supabase
    .from('company_document_records')
    .insert(payload)
    .select()
    .single()

   if (error) throw error

   showToast((options.printAfter ? 'Document saved. Preparing print...' : 'Document saved to Document Records.'))
   await loadCompanyDocumentRecords()

   if (options.printAfter) {
    setTimeout(() => printBatch1ADocumentForm(), 150)
   }

   return data
  } catch (err) {
   console.warn('saveCurrentDocumentRecord:', err)
   showToast('Failed to save document: ' + (err?.message || err), 'red')
   return null
  }
 }

 async function updateCompanyDocumentRecordStatus(record, status) {
  if (!record?.id) return
  const extra = {}
  if (status === 'served') extra.served_date = today
  if (status === 'closed') extra.closed_date = today

  try {
   const { error } = await supabase
    .from('company_document_records')
    .update({ status, ...extra })
    .eq('id', record.id)

   if (error) throw error
   showToast('Document marked as ' + getCompanyDocumentRecordStatusLabel(status) + '.')
   await loadCompanyDocumentRecords()
  } catch (err) {
   showToast('Failed to update document status: ' + (err?.message || err), 'red')
  }
 }

 async function voidCompanyDocumentRecord(record) {
  if (!record?.id) return
  const reason = window.prompt('Reason for voiding this document?')
  if (reason === null) return

  try {
   const { error } = await supabase
    .from('company_document_records')
    .update({ status:'voided', void_reason:reason || 'Voided by admin' })
    .eq('id', record.id)

   if (error) throw error
   showToast('Document voided.')
   await loadCompanyDocumentRecords()
  } catch (err) {
   showToast('Failed to void document: ' + (err?.message || err), 'red')
  }
 }

`;
  src = src.slice(0, functionIdx) + functions + src.slice(functionIdx);
  changes++;
  console.log('ADDED: document records functions');
} else {
  console.log('SKIPPED: document records functions already exist');
}

// 3) Load records when opening documents tab.
replaceOnce(
" if(key==='sales') { setSalesView('dashboard'); loadResellers(); loadResellerAccounts({ silent:true }); loadDeliveryInvoices(); loadDailySales(); loadDailyExpenses(); loadCompanyPayables(); loadInventoryItems(); loadWeeklyInventoryReports(); loadSalesSummaryHistory(); loadDailySalesOnlinePayments(); loadOutletSalesReports(); }",
" if(key==='sales') { setSalesView('dashboard'); loadResellers(); loadResellerAccounts({ silent:true }); loadDeliveryInvoices(); loadDailySales(); loadDailyExpenses(); loadCompanyPayables(); loadInventoryItems(); loadWeeklyInventoryReports(); loadSalesSummaryHistory(); loadDailySalesOnlinePayments(); loadOutletSalesReports(); }\n if(key==='documents') { loadCompanyDocumentRecords(); }",
"load document records on documents tab"
);

// 4) Add Save buttons beside PRINT / SAVE AS PDF.
replaceOnce(
"<button style={{...btnGreen, width:'auto', padding:'10px 16px', marginTop:0 }} onClick={printBatch1ADocumentForm}>PRINT / SAVE AS PDF</button>",
"<button style={{...btnBlack, background:'#4a90d9', width:'auto', padding:'10px 16px', marginTop:0 }} onClick={()=>saveCurrentDocumentRecord('draft')}>SAVE AS DRAFT</button>\n  <button style={{...btnGreen, width:'auto', padding:'10px 16px', marginTop:0 }} onClick={()=>saveCurrentDocumentRecord('draft', { printAfter:true })}>SAVE & PRINT</button>\n  <button style={{...btnGray, width:'auto', padding:'10px 16px', marginTop:0 }} onClick={printBatch1ADocumentForm}>PRINT ONLY</button>",
"add save document buttons"
);

// 5) Add Document Records section after the form builder card.
const afterFormMarker = "  </div>\n \n {(()=>{\n  const q = documentCenterSearch.trim().toLowerCase()";
const recordsSection = `  </div>

 <div style={{ background:'white', border:'1px solid #e5e5e5', borderRadius:'16px', padding:'16px', marginBottom:'16px' }}>
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', flexWrap:'wrap', marginBottom:'12px' }}>
   <div>
    <h3 style={{ color:'#1a1a2e', margin:'0 0 4px', fontSize:'15px' }}>Document Records</h3>
    <p style={{ color:'#666', fontSize:'12px', margin:0 }}>Saved NTE, incident reports, inventory withdrawal slips, agreements, clearance forms, and other company documents.</p>
   </div>
   <button style={{...btnGray, width:'auto', padding:'8px 12px', marginTop:0, fontSize:'12px' }} onClick={loadCompanyDocumentRecords}>REFRESH RECORDS</button>
  </div>

  {companyDocumentRecordsLoading && <p style={{ color:'#888', fontSize:'12px', margin:0 }}>Loading document records...</p>}

  {!companyDocumentRecordsLoading && companyDocumentRecords.length === 0 && (
   <div style={{ background:'#fafafa', border:'1px dashed #ccc', borderRadius:'12px', padding:'14px', color:'#888', fontSize:'12px' }}>
    No saved document records yet. Create a form above, then click SAVE AS DRAFT or SAVE & PRINT.
   </div>
  )}

  {!companyDocumentRecordsLoading && companyDocumentRecords.length > 0 && (
   <div style={{ overflowX:'auto', border:'1px solid #eee', borderRadius:'12px' }}>
    <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'980px', fontSize:'12px' }}>
     <thead>
      <tr style={{ background:'#f7f9fc', color:'#555' }}>
       <th style={{ padding:'9px', textAlign:'left' }}>Document No.</th>
       <th style={{ padding:'9px', textAlign:'left' }}>Type</th>
       <th style={{ padding:'9px', textAlign:'left' }}>Employee</th>
       <th style={{ padding:'9px', textAlign:'left' }}>Date</th>
       <th style={{ padding:'9px', textAlign:'left' }}>Subject</th>
       <th style={{ padding:'9px', textAlign:'left' }}>Status</th>
       <th style={{ padding:'9px', textAlign:'left' }}>Actions</th>
      </tr>
     </thead>
     <tbody>
      {companyDocumentRecords.map(record => (
       <tr key={record.id} style={{ borderTop:'1px solid #eee' }}>
        <td style={{ padding:'9px', fontWeight:'bold', color:'#333' }}>{record.document_no}</td>
        <td style={{ padding:'9px' }}>{record.document_type}</td>
        <td style={{ padding:'9px' }}>{record.employee_name || '—'}<br/><span style={{ color:'#888', fontSize:'10px' }}>{record.employee_code || ''}</span></td>
        <td style={{ padding:'9px' }}>{formatDateForDisplay(record.document_date)}</td>
        <td style={{ padding:'9px' }}>{record.subject || record.items || '—'}</td>
        <td style={{ padding:'9px' }}><Badge label={getCompanyDocumentRecordStatusLabel(record.status)} color={getCompanyDocumentRecordStatusColor(record.status)} /></td>
        <td style={{ padding:'9px' }}>
         <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
          <button style={{...btnGray, width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>alert(
           'Document No.: ' + (record.document_no || '') +
           '\\nType: ' + (record.document_type || '') +
           '\\nEmployee: ' + (record.employee_name || '') +
           '\\nSubject: ' + (record.subject || '') +
           '\\nItems: ' + (record.items || '') +
           '\\nDetails: ' + (record.details || '') +
           '\\nRemarks: ' + (record.remarks || '')
          )}>VIEW</button>
          {String(record.status || '').toLowerCase() === 'draft' && <button style={{...btnBlack, background:'#4a90d9', width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>updateCompanyDocumentRecordStatus(record, 'served')}>MARK SERVED</button>}
          {!['closed','voided'].includes(String(record.status || '').toLowerCase()) && <button style={{...btnGreen, width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>updateCompanyDocumentRecordStatus(record, 'closed')}>CLOSE</button>}
          {String(record.status || '').toLowerCase() !== 'voided' && <button style={{...btnRed, width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>voidCompanyDocumentRecord(record)}>VOID</button>}
         </div>
        </td>
       </tr>
      ))}
     </tbody>
    </table>
   </div>
  )}
 </div>
 
 {(()=>{
  const q = documentCenterSearch.trim().toLowerCase()`;

if (!src.includes('Saved NTE, incident reports, inventory withdrawal slips')) {
  if (!src.includes(afterFormMarker)) {
    console.log('SKIPPED / NOT FOUND: exact insertion point for Document Records section');
  } else {
    src = src.replace(afterFormMarker, recordsSection);
    changes++;
    console.log('ADDED: Document Records section');
  }
} else {
  console.log('SKIPPED: Document Records section already exists');
}

fs.writeFileSync(path, src, 'utf8');

console.log('');
console.log('DONE. Backup:', backup);
console.log('Total changes:', changes);
