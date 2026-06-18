const fs = require('fs');

const path = 'src/App.jsx';
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const backup = `src/App.jsx.backup-before-contract-doc-paragraph-format-${stamp}`;

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

const start = findLine(/function\s+printEmploymentContract\s*\(\s*emp\s*,\s*contractKind\s*=\s*null\s*\)\s*\{/);
const end = findLine(/\/\/\s*Inventory Functions/, start);

if (start < 0 || end < 0 || end <= start) {
  throw new Error('Could not find printEmploymentContract function boundaries.');
}

const newFunction = [
" function printEmploymentContract(emp, contractKind = null) {",
" if (!emp) { showToast('Employee not found.', 'red'); return }",
" const esc = value => String(value ?? '').replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#039;'}[ch]))",
" const cleanFileName = value => String(value || '').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 70)",
" const type = contractKind || getRecommendedContractTypeForEmployee(emp)",
" const dueDate = getRegularizationDueDate(emp)",
" const isRegular = type === 'regular'",
" const title = isRegular ? 'REGULAR EMPLOYMENT CONTRACT' : 'PROBATIONARY EMPLOYMENT CONTRACT'",
" const startDate = isRegular ? (String(emp.employment_type || '').toLowerCase() === 'regular' ? (emp.hire_date || today) : (dueDate || today)) : (emp.hire_date || today)",
" const endDate = isRegular ? 'Open-ended, subject to company policies and applicable labor laws' : (dueDate || 'Six months from hire date')",
" const rateText = emp.daily_rate ? php(emp.daily_rate) + ' per day' : 'As stated in the employee compensation record'",
" const position = emp.position || 'Crew / Staff'",
" const department = emp.department || 'Operations'",
" const workLocation = emp.work_location || 'Roma\\'s Donuts assigned work location / branch / production area'",
" const generatedDate = new Date().toLocaleDateString('en-PH', {year:'numeric', month:'long', day:'numeric'})",
" const fileName = ['Roma-Employment-Contract', cleanFileName(emp.full_name || 'Employee'), cleanFileName(type || 'contract'), cleanFileName(startDate || today)].filter(Boolean).join('_') + '.doc'",
"",
" const probationaryClauses = isRegular ? '' : [",
"  '<h3>3. PROBATIONARY PERIOD AND REGULARIZATION STANDARDS</h3>',",
"  '<p>The Employee is engaged on a probationary basis starting from the commencement date stated above. The Employee shall be evaluated based on attendance, punctuality, work quality, productivity, teamwork, honesty, discipline, food safety compliance, customer service, obedience to lawful company instructions, care of company property, and compliance with Roma\\'s Donuts SOPs and handbook.</p>',",
"  '<p>The probationary review date is <strong>' + esc(dueDate || 'to be computed from hire date') + '</strong>. Regularization is subject to management review and written approval. If the Employee continues working after the probationary period without lawful termination or extension allowed by law, the Employee may be treated according to applicable labor standards.</p>'",
" ].join('')",
"",
" const regularClauses = isRegular ? [",
"  '<h3>3. REGULAR EMPLOYMENT STATUS</h3>',",
"  '<p>The Employee is engaged as a regular employee effective on the start date stated above, subject to continued compliance with company standards, attendance rules, payroll policies, food safety requirements, lawful instructions, and the Roma\\'s Donuts employee handbook and SOPs.</p>'",
" ].join('') : ''",
"",
" const html = [",
" '<!DOCTYPE html>',",
" '<html xmlns:o=\"urn:schemas-microsoft-com:office:office\" xmlns:w=\"urn:schemas-microsoft-com:office:word\" xmlns=\"http://www.w3.org/TR/REC-html40\">',",
" '<head>',",
" '<meta charset=\"utf-8\">',",
" '<title>' + esc(title) + ' - ' + esc(emp.full_name || '') + '</title>',",
" '<style>',",
" '@page WordSection1{size:8.5in 11in;margin:0.75in 0.85in 0.75in 0.85in;}',",
" 'div.WordSection1{page:WordSection1;}',",
" 'body{font-family:Arial,sans-serif;color:#111;font-size:11pt;line-height:1.45;margin:0;background:white;}',",
" '.brand{text-align:center;border-bottom:2px solid #ca1b1b;padding-bottom:10px;margin-bottom:20px;}',",
" '.brand h1{margin:0;color:#ca1b1b;font-size:18pt;}',",
" '.brand p{margin:2px 0;color:#555;font-size:9pt;}',",
" 'h2{text-align:center;margin:10px 0 18px;font-size:14pt;text-decoration:underline;letter-spacing:.4px;}',",
" 'h3{font-size:11pt;color:#ca1b1b;margin:18px 0 6px;text-transform:uppercase;border-bottom:1px solid #ca1b1b;padding-bottom:3px;}',",
" 'p{margin:7px 0;text-align:justify;}',",
" '.info{margin:10px 0 16px;padding:10px 12px;border-left:4px solid #ca1b1b;background:#fff8dc;}',",
" '.info p{margin:4px 0;text-align:left;}',",
" '.note{border:1px solid #f5c518;background:#fff8dc;padding:9px 11px;margin:14px 0;font-size:10pt;}',",
" '.signature-area{margin-top:42px;}',",
" '.sig-row{display:block;margin-top:28px;}',",
" '.sig-line{border-top:1px solid #111;width:44%;display:inline-block;text-align:center;padding-top:5px;font-size:9pt;margin-right:8%;vertical-align:top;}',",
" '.sig-line:nth-child(2){margin-right:0;}',",
" '.footer{text-align:center;color:#777;font-size:8pt;margin-top:24px;border-top:1px solid #ddd;padding-top:8px;}',",
" '</style>',",
" '</head>',",
" '<body><div class=\"WordSection1\">',",
" '<div class=\"brand\"><h1>Roma\\'s Donuts</h1><p>Employment Contract Record</p><p>Generated by Roma\\'s Donuts Business System</p></div>',",
" '<h2>' + esc(title) + '</h2>',",
" '<p>This Employment Contract is entered into by and between <strong>Roma\\'s Donuts</strong> (the <strong>Company</strong>) and <strong>' + esc(emp.full_name || '') + '</strong> (the <strong>Employee</strong>).</p>',",
" '<div class=\"info\">',",
" '<p><strong>Employee Name:</strong> ' + esc(emp.full_name || '') + '</p>',",
" '<p><strong>Employee Code:</strong> ' + esc(emp.employee_code || '') + '</p>',",
" '<p><strong>Position:</strong> ' + esc(position) + '</p>',",
" '<p><strong>Department:</strong> ' + esc(department) + '</p>',",
" '<p><strong>Work Location:</strong> ' + esc(workLocation) + '</p>',",
" '<p><strong>Hire Date:</strong> ' + esc(emp.hire_date || '') + '</p>',",
" '<p><strong>Contract Start Date:</strong> ' + esc(startDate) + '</p>',",
" '<p><strong>Contract End / Review Date:</strong> ' + esc(endDate) + '</p>',",
" '<p><strong>Compensation:</strong> ' + esc(rateText) + '</p>',",
" '</div>',",
" '<h3>1. Duties and Responsibilities</h3>',",
" '<p>The Employee shall perform all duties related to the position and any reasonable work assignment given by the Company, including tasks connected to production, packing, dispatch, delivery, selling, customer service, cleaning, inventory, food safety, documentation, and other operational needs depending on the assigned role.</p>',",
" '<h3>2. Work Schedule, Attendance, and Payroll</h3>',",
" '<p>The Employee shall follow the work schedule, attendance rules, time-in/time-out procedures, overtime approval process, leave procedures, and payroll policies implemented by the Company. Overtime, undertime, absences, tardiness, holiday pay, cash advances, deductions, and adjustments shall be processed based on company records and applicable labor rules.</p>',",
" probationaryClauses,",
" regularClauses,",
" '<h3>4. Company Rules, Food Safety, and Confidentiality</h3>',",
" '<p>The Employee agrees to follow all company SOPs, food safety rules, hygiene standards, cash handling procedures, production standards, inventory controls, delivery policies, reseller policies, and lawful instructions from authorized managers or supervisors.</p>',",
" '<p>The Employee shall keep confidential all company recipes, formulas, costing, supplier information, customer/reseller records, employee records, prices, business systems, reports, and other internal information. Unauthorized disclosure or misuse may lead to disciplinary action and other lawful remedies.</p>',",
" '<h3>5. Company Property and Accountability</h3>',",
" '<p>The Employee shall properly use and safeguard all company property, including equipment, tools, uniforms, delivery items, crates, crate covers, documents, cash, ingredients, finished goods, vehicles, devices, and system access credentials. Loss, damage, negligence, or unauthorized use shall be handled according to company policy, investigation, and applicable law.</p>',",
" '<h3>6. Discipline, Separation, and Acknowledgment</h3>',",
" '<p>Violation of company policy, misconduct, negligence, dishonesty, abandonment, repeated attendance issues, unsafe practices, insubordination, theft, fraud, or failure to meet reasonable work standards may result in disciplinary action, up to termination, subject to due process and applicable labor laws.</p>',",
" '<div class=\"note\"><strong>Legal/HR Review Note:</strong> This is a system-generated company template. For official signing and enforcement, management should ensure the contract matches current Philippine labor requirements and company policy.</div>',",
" '<p>By signing below, the Employee confirms that the terms have been explained, read, understood, and accepted.</p>',",
" '<div class=\"signature-area\">',",
" '<div class=\"sig-row\"><div class=\"sig-line\">Employee Signature over Printed Name / Date</div><div class=\"sig-line\">Authorized Company Representative / Date</div></div>',",
" '<div class=\"sig-row\"><div class=\"sig-line\">Witness / HR Representative / Date</div><div class=\"sig-line\">Government ID Presented / ID Number</div></div>',",
" '</div>',",
" '<div class=\"footer\">Roma\\'s Donuts | ' + esc(title) + ' | Generated ' + esc(generatedDate) + '</div>',",
" '</div></body></html>'",
" ].join('')",
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
" }",
" }",
""
];

lines.splice(start, end - start, ...newFunction);
fs.writeFileSync(path, lines.join(eol), 'utf8');

console.log('DONE: Employment contract Word file now uses paragraph-style contract format.');
console.log('Backup created:', backup);
