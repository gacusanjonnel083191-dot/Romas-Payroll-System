import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

test('Certificate of Employment is an active, generic fillable document form', () => {
  assert.match(app, /"key": "HR-COE"/)
  assert.match(app, /"title": "Certificate of Employment \(COE\)"/)
  assert.match(app, /"employeeMode": "optional"/)
  assert.match(app, /"key": "employeeName"/)
  assert.match(app, /"key": "employmentStartDate"/)
  assert.match(app, /"key": "positionTitle"/)
  assert.match(app, /"key": "compensationStatement"/)
})

test('COE selection fills known employee facts but still supports a manual certificate', () => {
  assert.match(app, /field === 'employeeId' && isCertificateOfEmploymentFormKey\(prev\.formKey\)/)
  assert.match(app, /employeeName:employee\.full_name \|\| ''/)
  assert.match(app, /employmentStartDate:employee\.hire_date \|\| ''/)
  assert.match(app, /positionTitle:employee\.position \|\| ''/)
  assert.match(app, /coeEmployeeName \|\| emp\?\.full_name \|\| form\.title/)
})

test('COE has a dedicated branded A4 preview and Word download path', () => {
  assert.match(app, /const buildCertificateOfEmploymentHtml =/)
  assert.match(app, /@page WordSection1\{size:8\.27in 11\.69in/)
  assert.match(app, /Roma\\'s Donuts/)
  assert.match(app, /const downloadCertificateOfEmploymentWord =/)
  assert.match(app, /DOWNLOAD WORD \(A4\)/)
  assert.match(app, /Certificate of Employment Word file downloaded/)
})

test('saved COE records can still be previewed, printed, and re-downloaded', () => {
  assert.match(app, /openCertificateOfEmploymentPreview\(\{ form, values, record, autoPrint:true \}\)/)
  assert.match(app, /downloadCertificateOfEmploymentWord\(\{ form:findBatch1DocumentForm\(record\.form_key\), values:getSavedDocumentValues\(record\), record \}\)/)
})
