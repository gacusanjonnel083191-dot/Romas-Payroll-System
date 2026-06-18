const fs = require('fs');

const path = 'src/App.jsx';
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const backup = `src/App.jsx.backup-before-document-records-section-${stamp}`;

let src = fs.readFileSync(path, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
fs.copyFileSync(path, backup);

let lines = src.split(/\r?\n/);

function findLine(regex, start = 0) {
  for (let i = start; i < lines.length; i++) {
    if (regex.test(lines[i])) return i;
  }
  return -1;
}

if (src.includes('Saved NTE, incident reports, inventory withdrawal slips')) {
  console.log('SKIPPED: Document Records section already exists.');
  process.exit(0);
}

const docsTitleLine = findLine(/Company Documents & Forms Center/);
if (docsTitleLine < 0) throw new Error('Company Documents & Forms Center area not found.');

let insertAt = -1;
for (let i = docsTitleLine; i < lines.length; i++) {
  if (lines[i].includes('{(()=>{')) {
    const nextFew = lines.slice(i, i + 8).join('\n');
    if (nextFew.includes('documentCenterSearch.trim().toLowerCase()')) {
      insertAt = i;
      break;
    }
  }
}

if (insertAt < 0) {
  throw new Error('Could not find document catalog IIFE insertion point.');
}

const section = [
"",
" <div style={{ background:'white', border:'1px solid #e5e5e5', borderRadius:'16px', padding:'16px', marginBottom:'16px' }}>",
"  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', flexWrap:'wrap', marginBottom:'12px' }}>",
"   <div>",
"    <h3 style={{ color:'#1a1a2e', margin:'0 0 4px', fontSize:'15px' }}>Document Records</h3>",
"    <p style={{ color:'#666', fontSize:'12px', margin:0 }}>Saved NTE, incident reports, inventory withdrawal slips, agreements, clearance forms, and other company documents.</p>",
"   </div>",
"   <button style={{...btnGray, width:'auto', padding:'8px 12px', marginTop:0, fontSize:'12px' }} onClick={loadCompanyDocumentRecords}>REFRESH RECORDS</button>",
"  </div>",
"",
"  {companyDocumentRecordsLoading && <p style={{ color:'#888', fontSize:'12px', margin:0 }}>Loading document records...</p>}",
"",
"  {!companyDocumentRecordsLoading && companyDocumentRecords.length === 0 && (",
"   <div style={{ background:'#fafafa', border:'1px dashed #ccc', borderRadius:'12px', padding:'14px', color:'#888', fontSize:'12px' }}>",
"    No saved document records yet. Create a form above, then click SAVE AS DRAFT or SAVE & PRINT.",
"   </div>",
"  )}",
"",
"  {!companyDocumentRecordsLoading && companyDocumentRecords.length > 0 && (",
"   <div style={{ overflowX:'auto', border:'1px solid #eee', borderRadius:'12px' }}>",
"    <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'980px', fontSize:'12px' }}>",
"     <thead>",
"      <tr style={{ background:'#f7f9fc', color:'#555' }}>",
"       <th style={{ padding:'9px', textAlign:'left' }}>Document No.</th>",
"       <th style={{ padding:'9px', textAlign:'left' }}>Type</th>",
"       <th style={{ padding:'9px', textAlign:'left' }}>Employee</th>",
"       <th style={{ padding:'9px', textAlign:'left' }}>Date</th>",
"       <th style={{ padding:'9px', textAlign:'left' }}>Subject / Items</th>",
"       <th style={{ padding:'9px', textAlign:'left' }}>Status</th>",
"       <th style={{ padding:'9px', textAlign:'left' }}>Actions</th>",
"      </tr>",
"     </thead>",
"     <tbody>",
"      {companyDocumentRecords.map(record => (",
"       <tr key={record.id} style={{ borderTop:'1px solid #eee' }}>",
"        <td style={{ padding:'9px', fontWeight:'bold', color:'#333' }}>{record.document_no}</td>",
"        <td style={{ padding:'9px' }}>{record.document_type}</td>",
"        <td style={{ padding:'9px' }}>{record.employee_name || '—'}<br/><span style={{ color:'#888', fontSize:'10px' }}>{record.employee_code || ''}</span></td>",
"        <td style={{ padding:'9px' }}>{formatDateForDisplay(record.document_date)}</td>",
"        <td style={{ padding:'9px' }}>{record.subject || record.items || '—'}</td>",
"        <td style={{ padding:'9px' }}><Badge label={getCompanyDocumentRecordStatusLabel(record.status)} color={getCompanyDocumentRecordStatusColor(record.status)} /></td>",
"        <td style={{ padding:'9px' }}>",
"         <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>",
"          <button style={{...btnGray, width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>alert(",
"           'Document No.: ' + (record.document_no || '') +",
"           '\\nType: ' + (record.document_type || '') +",
"           '\\nEmployee: ' + (record.employee_name || '') +",
"           '\\nSubject: ' + (record.subject || '') +",
"           '\\nItems: ' + (record.items || '') +",
"           '\\nDetails: ' + (record.details || '') +",
"           '\\nRemarks: ' + (record.remarks || '')",
"          )}>VIEW</button>",
"          {String(record.status || '').toLowerCase() === 'draft' && <button style={{...btnBlack, background:'#4a90d9', width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>updateCompanyDocumentRecordStatus(record, 'served')}>MARK SERVED</button>}",
"          {!['closed','voided'].includes(String(record.status || '').toLowerCase()) && <button style={{...btnGreen, width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>updateCompanyDocumentRecordStatus(record, 'closed')}>CLOSE</button>}",
"          {String(record.status || '').toLowerCase() !== 'voided' && <button style={{...btnRed, width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>voidCompanyDocumentRecord(record)}>VOID</button>}",
"         </div>",
"        </td>",
"       </tr>",
"      ))}",
"     </tbody>",
"    </table>",
"   </div>",
"  )}",
" </div>",
""
];

lines.splice(insertAt, 0, ...section);
fs.writeFileSync(path, lines.join(eol), 'utf8');

console.log('DONE: Document Records section inserted.');
console.log('Backup created:', backup);
