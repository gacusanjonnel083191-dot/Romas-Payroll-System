'use strict'

const fs = require('node:fs')

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source
  const first = source.indexOf(before)
  if (first < 0) throw new Error(`COE address/compensation patch aborted: ${label} anchor was not found.`)
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`COE address/compensation patch aborted: multiple ${label} anchors were found.`)
  return source.slice(0, first) + after + source.slice(first + before.length)
}

function verifyCoeAddressCompensation(source) {
  const required = [
    ['"key": "employeeAddress"', 'employee address field'],
    ['"label": "Compensation"', 'compensation field label'],
    ["employeeAddress:employee.address || employee.home_address || employee.residential_address || employee.current_address || ''", 'employee address auto-fill'],
    ["const employeeAddress = String(cf.employeeAddress || '').trim()", 'employee address render value'],
    ["The employee\\'s address on record is <strong>", 'employee address document text'],
    ['>COMPENSATION</div>', 'compensation document label'],
    ["'employeeAddress','addressee'", 'employee address signature-integrity field']
  ]
  for (const [needle, label] of required) {
    if (!source.includes(needle)) throw new Error(`COE address/compensation verification failed: ${label}.`)
  }
}

function applyCoeAddressCompensation(source) {
  let app = String(source || '')
  if (!app.includes('"key": "HR-COE"') || !app.includes('const buildCertificateOfEmploymentHtml =')) {
    throw new Error('COE address/compensation patch aborted: Certificate of Employment builder was not found.')
  }

  app = replaceRequired(
    app,
    `   {
    "key": "compensationStatement",
    "label": "Compensation Statement (Optional)",
    "type": "textarea",
    "placeholder": "Leave blank unless the employee specifically requests it and the authorized signatory approves its inclusion.",
    "span": "full"
   },`,
    `   {
    "key": "employeeAddress",
    "label": "Employee Address",
    "type": "textarea",
    "placeholder": "Enter the employee's current/residential address",
    "span": "full"
   },
   {
    "key": "compensationStatement",
    "label": "Compensation",
    "type": "text",
    "placeholder": "Example: ₱610/day or ₱18,000/month",
    "span": "full"
   },`,
    'COE employee address and compensation fields'
  )

  app = replaceRequired(
    app,
    `       positionTitle:employee.position || '',
       assignedDepartment:employee.department || ''`,
    `       positionTitle:employee.position || '',
       assignedDepartment:employee.department || '',
       employeeAddress:employee.address || employee.home_address || employee.residential_address || employee.current_address || ''`,
    'employee address auto-fill'
  )

  app = replaceRequired(
    app,
    `  const assignedDepartment = String(cf.assignedDepartment || record?.department || selectedEmployee?.department || '').trim()
  const addressee = String(cf.addressee || 'TO WHOM IT MAY CONCERN').trim().toUpperCase()`,
    `  const assignedDepartment = String(cf.assignedDepartment || record?.department || selectedEmployee?.department || '').trim()
  const employeeAddress = String(cf.employeeAddress || '').trim()
  const addressee = String(cf.addressee || 'TO WHOM IT MAY CONCERN').trim().toUpperCase()`,
    'employee address render value'
  )

  app = replaceRequired(
    app,
    `  const departmentStatement = assignedDepartment
   ? 'The employee is assigned to <strong>' + esc(assignedDepartment) + '</strong>.'
   : ''
  const purposeStatement = certificatePurpose && certificatePurpose !== 'General / Personal Record'`,
    `  const departmentStatement = assignedDepartment
   ? 'The employee is assigned to <strong>' + esc(assignedDepartment) + '</strong>.'
   : ''
  const addressStatement = employeeAddress
   ? 'The employee\'s address on record is <strong>' + esc(employeeAddress) + '</strong>.'
   : ''
  const purposeStatement = certificatePurpose && certificatePurpose !== 'General / Personal Record'`,
    'employee address document sentence'
  )

  app = replaceRequired(
    app,
    `   departmentStatement ? '<p>' + departmentStatement + '</p>' : '',
   compensationHtml,`,
    `   departmentStatement ? '<p>' + departmentStatement + '</p>' : '',
   addressStatement ? '<p>' + addressStatement + '</p>' : '',
   compensationHtml,`,
    'employee address document placement'
  )

  app = replaceRequired(
    app,
    `<div class=\"optional-label\">COMPENSATION STATEMENT</div>`,
    `<div class=\"optional-label\">COMPENSATION</div>`,
    'compensation document label'
  )

  app = replaceRequired(
    app,
    `const COE_HASH_FIELDS = ['employeeName','employeeCode','employmentStatus','employmentStartDate','employmentEndDate','positionTitle','assignedDepartment','addressee','certificatePurpose','compensationStatement','additionalCertification','signatoryTitle']`,
    `const COE_HASH_FIELDS = ['employeeName','employeeCode','employmentStatus','employmentStartDate','employmentEndDate','positionTitle','assignedDepartment','employeeAddress','addressee','certificatePurpose','compensationStatement','additionalCertification','signatoryTitle']`,
    'COE signed-content hash fields'
  )

  verifyCoeAddressCompensation(app)
  return app
}

if (require.main === module) {
  const appPath = 'src/App.jsx'
  const source = fs.readFileSync(appPath, 'utf8')
  const patched = applyCoeAddressCompensation(source)
  if (patched !== source) {
    fs.writeFileSync(appPath, patched, 'utf8')
    console.log('COE address/compensation patch applied: employee address and compensation fields enabled and protected by signature integrity.')
  } else {
    console.log('COE address/compensation patch already present; verification passed.')
  }
}

module.exports = { applyCoeAddressCompensation, verifyCoeAddressCompensation }
