'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { applyCoeEsignWorkflow, verifyCoeEsignWorkflow } = require('../scripts/coe-esign-workflow.cjs')

function fixture() {
  return `
 function Fixture(){
  const setCompanyDocumentRecords = () => {}
  const isCertificateOfEmploymentForm = true
  const isOwnerRole = true
  const selectedBatch1DocumentForm = {key:'HR-COE'}
  const documentFormDraft = {}
  const btnBlack = {}, btnGreen = {}, btnGray = {}
  const buildCertificateOfEmploymentHtml_PLACEHOLDER = true
  const buildCertificateOfEmploymentHtml = ({ form, values = documentFormDraft, record = null, wordMode = false }) => {
  const cf = values?.customFields || {}
  const signatoryName = String(record?.approved_by || values?.approvedBy || '').trim()
  const signatoryTitle = String(cf.signatoryTitle || 'Authorized Signatory').trim()
  const preparedBy = 'Admin'
  const documentNo = 'RD-COE-1'
  const esc = v => String(v)
  const pageClass = wordMode ? 'WordSection1' : 'page'
  return [
   '<style>',
   '.signature-space{height:45px;}.signature-line{border-top:1px solid #111;padding-top:5px;text-align:center;font-size:9.5pt;font-weight:700;min-height:20px;}.signature-title{text-align:center;font-size:8.5pt;color:#555;margin-top:2px;}.document-control{margin-top:34px;border-top:1px solid #ddd;padding-top:7px;text-align:center;color:#666;font-size:8.5pt;line-height:1.4;}.no-print{text-align:center;margin:0 0 10px;}',
   '</style></head><body>',
   '<div class="' + pageClass + '">',
   '<table class="brand"><tr><td><div class="company">Roma\\'s Donuts</div><div class="company-sub">Malued District, Dagupan City, Pangasinan</div><div class="tagline">Every bite is a little piece of heaven.</div></td></tr></table>',
   '<table class="signature-table"><tr><td><div class="signature-space"></div><div class="signature-line">' + esc(preparedBy) + '</div><div class="signature-title">Prepared By</div></td><td><div class="signature-space"></div><div class="signature-line">' + (signatoryName ? esc(signatoryName) : '&nbsp;') + '</div><div class="signature-title">' + esc(signatoryTitle) + '</div></td></tr></table>',
   '</div></body></html>'
  ].join('')
 }
 const openCertificateOfEmploymentPreview = ({ form = getSelectedDocumentBatch1AForm(), values = documentFormDraft, record = null, autoPrint = false } = {}) => {
  if (!form || !isCertificateOfEmploymentFormKey(form.key)) { showToast('Select a Certificate of Employment first.', 'red'); return }
  const html = buildCertificateOfEmploymentHtml({ form, values, record, wordMode:false })
  const pw = window.open('', '_blank', 'width=980,height=780')
  if (autoPrint) setTimeout(() => pw.print(), 350)
 }
 const downloadCertificateOfEmploymentPdf = async ({ form = getSelectedDocumentBatch1AForm(), values = documentFormDraft, record = null } = {}) => {
  let renderFrame = null
  try {
   const documentNo = 'RD-COE-1'
   const html = buildCertificateOfEmploymentHtml({ form, values:{ ...values, documentNo }, record, wordMode:false })
   const pdf = {save(){}}
   const fileName = 'x.pdf'
   pdf.save(fileName)
   showToast('Certificate of Employment PDF downloaded.')
  } catch(error) {}
 }
 const downloadCertificateOfEmploymentWord = ({ form = getSelectedDocumentBatch1AForm(), values = documentFormDraft, record = null } = {}) => {
  const documentNo = 'RD-COE-1'
  const employeeName = 'Employee'
  const html = buildCertificateOfEmploymentHtml({ form, values:{ ...values, documentNo }, record, wordMode:true })
  const fileName = ['Roma-COE', cleanCertificateFileName(employeeName), cleanCertificateFileName(documentNo)].join('_') + '.doc'
  try {
   showToast('Certificate of Employment Word file downloaded.')
  } catch(error) {}
 }
 return <div>
  <button style={{...btnBlack, background:'#4a90d9', width:'auto', padding:'10px 16px', marginTop:0 }} onClick={()=>saveCurrentDocumentRecord('draft')}>{editingCompanyDocumentRecordId?'UPDATE DRAFT':'SAVE AS DRAFT'}</button>
  <button style={{...btnGreen, width:'auto', padding:'10px 16px', marginTop:0 }} onClick={()=>saveCurrentDocumentRecord('draft', { printAfter:true })}>SAVE & PRINT</button>
  <button style={{...btnGray, width:'auto', padding:'10px 16px', marginTop:0 }} onClick={()=>printBatch1ADocumentForm()}>{isResellerAgreementFormKey(selectedBatch1DocumentForm.key)?'PREVIEW / PRINT':'PRINT ONLY'}</button>
  {isCertificateOfEmploymentForm && <button style={{...btnBlack, background:'#CA1B1B', width:'auto', padding:'10px 16px', marginTop:0 }} onClick={()=>downloadCertificateOfEmploymentPdf()}>DOWNLOAD PDF (A4)</button>}
  {isCertificateOfEmploymentForm && <button style={{...btnBlack, width:'auto', padding:'10px 16px', marginTop:0 }} onClick={()=>downloadCertificateOfEmploymentWord()}>DOWNLOAD WORD (A4)</button>}
  {isCertificateOfEmploymentFormKey(record.form_key) && <button style={{...btnBlack, background:'#CA1B1B', width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>downloadCertificateOfEmploymentPdf({ form:findBatch1DocumentForm(record.form_key), values:getSavedDocumentValues(record), record })}>PDF</button>}
  {isCertificateOfEmploymentFormKey(record.form_key) && <button style={{...btnBlack, width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>downloadCertificateOfEmploymentWord({ form:findBatch1DocumentForm(record.form_key), values:getSavedDocumentValues(record), record })}>WORD</button>}
 </div>
 }
 const PDF_MARKER = "format:'a4' DOWNLOAD PDF (A4)"
 `
}

test('COE e-sign patch adds controlled workflow and is idempotent', () => {
  const patched = applyCoeEsignWorkflow(fixture())
  verifyCoeEsignWorkflow(patched)
  assert.equal(applyCoeEsignWorkflow(patched), patched)
})

test('unsigned current COEs are draft-only and final exports require a signed state', () => {
  const patched = applyCoeEsignWorkflow(fixture())
  assert.match(patched, /PREVIEW DRAFT/)
  assert.match(patched, /DRAFT — NOT YET SIGNED/)
  assert.doesNotMatch(patched, /onClick=\{\(\)=>downloadCertificateOfEmploymentPdf\(\)\}>DOWNLOAD PDF \(A4\)/)
  assert.match(patched, /coePrepareRenderContext\(\{ values:\{ \.\.\.values, documentNo \}, record, requireSigned:true \}\)/)
  assert.match(patched, /Final Print\/PDF\/Word unlock only after/)
})

test('saved COEs expose e-sign workflow, signature inbox and owner controls', () => {
  const patched = applyCoeEsignWorkflow(fixture())
  assert.match(patched, /E-SIGN \/ SEND FOR SIGNATURE<\/button>/)
  assert.match(patched, /openCurrentCoeEsignWorkflow/)
  assert.match(patched, />E-SIGN<\/button>/)
  assert.match(patched, />MY E-SIGNATURE<\/button>/)
  assert.match(patched, />SIGNATURE INBOX<\/button>/)
  assert.match(patched, />SIGNATORY SETTINGS<\/button>/)
  assert.match(patched, /ADD E-SIGNATURE & APPROVE/)
  assert.match(patched, /RETURN FOR CORRECTION/)
})

test('signed output embeds immutable signature image and timestamp and protects content integrity', () => {
  const patched = applyCoeEsignWorkflow(fixture())
  assert.match(patched, /signature_image_data_url/)
  assert.match(patched, /Electronically signed/)
  assert.match(patched, /crypto\.subtle\.digest\('SHA-256'/)
  assert.match(patched, /invalidate_coe_signature_if_changed/)
  assert.match(patched, /documents\/\$\{record\.id\}\//)
})

test('COE header places the company tagline immediately under the company name', () => {
  const patched = applyCoeEsignWorkflow(fixture())
  const expected = `<div class="company">Roma\\'s Donuts</div><div class="tagline">Every bite is a little piece of heaven.</div><div class="company-sub">Malued District, Dagupan City, Pangasinan</div>`
  assert.ok(patched.includes(expected))
})

test('signatory review uses an isolated preview frame before approval', () => {
  const patched = applyCoeEsignWorkflow(fixture())
  assert.match(patched, /data-coe-review-frame/)
  assert.match(patched, /\.srcdoc = html/)
})
