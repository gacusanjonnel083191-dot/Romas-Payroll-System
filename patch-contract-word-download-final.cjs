const fs = require('fs');

const path = 'src/App.jsx';
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const backup = `src/App.jsx.backup-before-contract-word-download-final-${stamp}`;

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

const start = findLine(/function\s+printContractSummary\s*\(\s*c\s*\)\s*\{/);
const end = findLine(/function\s+getRegularizationDueDate\s*\(\s*emp\s*\)\s*\{/, start);

if (start < 0 || end < 0 || end <= start) {
  throw new Error('Could not find printContractSummary function boundaries.');
}

const newFunction = [
"  function printContractSummary(c) {",
"    const cleanText = value => String(value ?? '').trim();",
"",
"    const escapeHtml = value => cleanText(value)",
"      .replace(/&/g, '&amp;')",
"      .replace(/</g, '&lt;')",
"      .replace(/>/g, '&gt;')",
"      .replace(/\\\"/g, '&quot;')",
"      .replace(/'/g, '&#039;');",
"",
"    const titleCase = value => cleanText(value)",
"      .replace(/[-_]+/g, ' ')",
"      .replace(/\\s+/g, ' ')",
"      .toLowerCase()",
"      .replace(/\\b\\w/g, ch => ch.toUpperCase());",
"",
"    const safeFilePart = value => cleanText(value)",
"      .replace(/[^a-z0-9]+/gi, '-')",
"      .replace(/^-+|-+$/g, '')",
"      .slice(0, 60);",
"",
"    const employeeName = cleanText(c?.employee_name || 'Employee');",
"    const employeeCode = cleanText(c?.employee_code || '');",
"    const contractType = titleCase(c?.contract_type || 'contract');",
"    const statusLabel = titleCase(c?.status || 'active');",
"    const startDate = cleanText(c?.start_date || '');",
"    const endDate = cleanText(c?.end_date || 'Open-ended / No fixed end date');",
"    const loggedDate = c?.created_at",
"      ? new Date(c.created_at).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' })",
"      : '';",
"    const generatedDate = new Date().toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' });",
"    const storageType = cleanText(c?.storage_type || 'digital').toLowerCase();",
"    const storageTitle = storageType === 'physical' ? 'Physical Copy on File' : 'Digital Copy in System';",
"    const storageDetails = storageType === 'physical'",
"      ? cleanText(c?.physical_location || 'Physical contract location not specified.')",
"      : cleanText(c?.file_name || c?.file_url || 'Digital contract file is recorded in the system.');",
"    const preparedBy = cleanText(typeof currentAdminLabel !== 'undefined' ? currentAdminLabel : 'Admin');",
"",
"    const fileName = [",
"      'Roma-Contract',",
"      safeFilePart(employeeName),",
"      safeFilePart(contractType),",
"      safeFilePart(startDate || generatedDate)",
"    ].filter(Boolean).join('_') + '.doc';",
"",
"    const html = [",
"      '<!DOCTYPE html>',",
"      '<html xmlns:o=\"urn:schemas-microsoft-com:office:office\" xmlns:w=\"urn:schemas-microsoft-com:office:word\" xmlns=\"http://www.w3.org/TR/REC-html40\">',",
"      '<head>',",
"      '<meta charset=\"utf-8\">',",
"      '<title>Roma\\'s Donuts Contract Summary</title>',",
"      '<style>',",
"      '@page WordSection1{size:8.5in 11in;margin:0.65in 0.65in 0.65in 0.65in;}',",
"      'div.WordSection1{page:WordSection1;}',",
"      'body{font-family:Arial,sans-serif;color:#111;font-size:11pt;line-height:1.35;}',",
"      '.header{border-bottom:3px solid #ca1b1b;padding-bottom:10px;margin-bottom:16px;}',",
"      'h1{font-size:18pt;color:#ca1b1b;margin:0;}',",
"      '.subtitle{font-size:10pt;color:#555;margin-top:3px;}',",
"      '.badge{display:inline-block;border:1px solid #ca1b1b;color:#ca1b1b;padding:4px 10px;font-weight:bold;font-size:9pt;text-transform:uppercase;margin-top:8px;}',",
"      '.section-title{background:#fdd412;color:#111;font-weight:bold;padding:6px 8px;margin:16px 0 0;border:1px solid #111;}',",
"      'table{width:100%;border-collapse:collapse;}',",
"      'td{border:1px solid #111;padding:7px 8px;vertical-align:top;}',",
"      'td:first-child{width:32%;font-weight:bold;background:#f7f7f7;}',",
"      '.storage-box{border:1px solid #111;padding:10px;margin-top:0;}',",
"      '.note{font-size:9pt;color:#555;margin-top:8px;}',",
"      '.signature-table{margin-top:42px;}',",
"      '.signature-table td{border:none;text-align:center;padding-top:34px;font-size:9pt;}',",
"      '.sig-line{border-top:1px solid #111;padding-top:5px;}',",
"      '.watermark{font-size:8pt;color:#777;margin-top:22px;text-align:center;}',",
"      '</style>',",
"      '</head>',",
"      '<body>',",
"      '<div class=\"WordSection1\">',",
"      '<div class=\"header\">',",
"      '<h1>Roma\\'s Donuts - Employee Contract Record</h1>',",
"      '<div class=\"subtitle\">Payroll &amp; Attendance System Employee Contract Summary</div>',",
"      '<div class=\"badge\">' + escapeHtml(statusLabel) + '</div>',",
"      '</div>',",
"      '<div class=\"section-title\">EMPLOYEE DETAILS</div>',",
"      '<table>',",
"      '<tr><td>Employee Name</td><td>' + escapeHtml(employeeName) + '</td></tr>',",
"      '<tr><td>Employee Code</td><td>' + escapeHtml(employeeCode) + '</td></tr>',",
"      '</table>',",
"      '<div class=\"section-title\">CONTRACT DETAILS</div>',",
"      '<table>',",
"      '<tr><td>Contract Type</td><td><strong>' + escapeHtml(contractType) + '</strong></td></tr>',",
"      '<tr><td>Start Date</td><td>' + escapeHtml(startDate) + '</td></tr>',",
"      '<tr><td>End Date</td><td>' + escapeHtml(endDate) + '</td></tr>',",
"      '<tr><td>Status</td><td><strong>' + escapeHtml(statusLabel) + '</strong></td></tr>',",
"      '<tr><td>Date Logged</td><td>' + escapeHtml(loggedDate) + '</td></tr>',",
"      '<tr><td>Prepared By</td><td>' + escapeHtml(preparedBy) + '</td></tr>',",
"      '</table>',",
"      '<div class=\"section-title\">DOCUMENT STORAGE</div>',",
"      '<div class=\"storage-box\">',",
"      '<strong>' + escapeHtml(storageTitle) + '</strong><br>',",
"      escapeHtml(storageDetails),",
"      '</div>',",
"      '<p class=\"note\">This Word file is generated from the official contract record stored in the Roma\\'s Donuts Payroll &amp; Attendance System.</p>',",
"      '<table class=\"signature-table\">',",
"      '<tr>',",
"      '<td><div class=\"sig-line\">Employee Signature over Printed Name</div></td>',",
"      '<td><div class=\"sig-line\">HR / Authorized Signatory</div></td>',",
"      '<td><div class=\"sig-line\">Date</div></td>',",
"      '</tr>',",
"      '</table>',",
"      '<div class=\"watermark\">Generated on ' + escapeHtml(generatedDate) + '.</div>',",
"      '</div>',",
"      '</body>',",
"      '</html>'",
"    ].join('');",
"",
"    try {",
"      const blob = new Blob(['\\ufeff', html], { type:'application/msword;charset=utf-8' });",
"      const url = URL.createObjectURL(blob);",
"      const link = document.createElement('a');",
"      link.href = url;",
"      link.download = fileName;",
"      document.body.appendChild(link);",
"      link.click();",
"      link.remove();",
"      setTimeout(() => URL.revokeObjectURL(url), 1000);",
"      showToast('Contract Word file downloaded.');",
"    } catch (err) {",
"      console.warn('printContractSummary Word download failed:', err);",
"      showToast('Failed to download contract Word file: ' + (err?.message || err), 'red');",
"    }",
"  }",
""
];

lines.splice(start, end - start, ...newFunction);
fs.writeFileSync(path, lines.join(eol), 'utf8');

console.log('DONE: printContractSummary now downloads Word-compatible .doc file.');
console.log('Backup created:', backup);
