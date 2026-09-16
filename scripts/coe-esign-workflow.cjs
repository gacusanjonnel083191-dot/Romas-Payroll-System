'use strict'

const fs = require('node:fs')
const path = require('node:path')

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source
  const first = source.indexOf(before)
  if (first < 0) throw new Error(`COE e-sign patch aborted: ${label} anchor was not found.`)
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`COE e-sign patch aborted: multiple ${label} anchors were found.`)
  return source.slice(0, first) + after + source.slice(first + before.length)
}

function insertBeforeRequired(source, anchor, insertion, label) {
  if (source.includes(insertion.trim())) return source
  const first = source.indexOf(anchor)
  if (first < 0) throw new Error(`COE e-sign patch aborted: ${label} anchor was not found.`)
  if (source.indexOf(anchor, first + anchor.length) >= 0) throw new Error(`COE e-sign patch aborted: multiple ${label} anchors were found.`)
  return source.slice(0, first) + insertion + '\n' + source.slice(first)
}

function runtimeSource() {
  return fs.readFileSync(path.join(__dirname, 'coe-esign-runtime.txt'), 'utf8').trimEnd()
}

function verifyCoeEsignWorkflow(source) {
  const required = [
    ['COE_SIGNATURE_BUCKET', 'signature storage configuration'],
    ['request_coe_signature', 'send-for-signature RPC'],
    ['approve_coe_signature_request', 'sign approval RPC'],
    ['return_coe_signature_request', 'return-for-correction RPC'],
    ['openCoeSignatureInbox', 'signature inbox UI'],
    ['openCoeSignatureProfile', 'signature profile UI'],
    ['openCoeSignatorySettings', 'owner signatory settings UI'],
    ['openCurrentCoeEsignWorkflow', 'direct COE e-sign workflow button'],
    ['ADD E-SIGNATURE & APPROVE', 'approval action'],
    ['DRAFT — NOT YET SIGNED', 'draft watermark'],
    ['signature_image_data_url', 'signature image rendering'],
    ['coeComputeDocumentHash', 'content integrity hash'],
    ['invalidate_coe_signature_if_changed', 'signature invalidation guard'],
    ['SEND FOR SIGNATURE', 'saved COE workflow action'],
    ['SIGNATURE INBOX', 'inbox action'],
    ['MY E-SIGNATURE', 'profile action'],
    ['requireSigned:true', 'final-output signature guard'],
    ["<div class=\"company\">Roma\\'s Donuts</div><div class=\"tagline\">Every bite is a little piece of heaven.</div><div class=\"company-sub\">Malued District, Dagupan City, Pangasinan</div>", 'tagline directly below company name']
  ]
  for (const [needle, label] of required) {
    if (!source.includes(needle)) throw new Error(`COE e-sign verification failed: ${label}.`)
  }
}

function applyCoeEsignWorkflow(source) {
  let app = String(source || '')
  if (!app.includes('const buildCertificateOfEmploymentHtml =')) {
    throw new Error('COE e-sign patch aborted: Certificate of Employment builder was not found.')
  }
  if (!app.includes('const downloadCertificateOfEmploymentPdf = async') || !app.includes('DOWNLOAD PDF (A4)')) {
    throw new Error('COE e-sign patch aborted: the COE A4/PDF patch must run first.')
  }
  if (app.includes("const COE_SIGNATURE_BUCKET = 'coe-signatures'") && app.includes('ADD E-SIGNATURE & APPROVE')) {
    verifyCoeEsignWorkflow(app)
    return app
  }

  app = insertBeforeRequired(
    app,
    ' const buildCertificateOfEmploymentHtml = ({ form, values = documentFormDraft, record = null, wordMode = false }) => {',
    runtimeSource(),
    'COE builder runtime insertion'
  )

  app = replaceRequired(
    app,
    ' const buildCertificateOfEmploymentHtml = ({ form, values = documentFormDraft, record = null, wordMode = false }) => {',
    ' const buildCertificateOfEmploymentHtml = ({ form, values = documentFormDraft, record = null, wordMode = false, signatureState = null, draftWatermark = false }) => {',
    'COE builder signature-context arguments'
  )

  app = replaceRequired(
    app,
    `<div class="company">Roma\\'s Donuts</div><div class="company-sub">Malued District, Dagupan City, Pangasinan</div><div class="tagline">Every bite is a little piece of heaven.</div>`,
    `<div class="company">Roma\\'s Donuts</div><div class="tagline">Every bite is a little piece of heaven.</div><div class="company-sub">Malued District, Dagupan City, Pangasinan</div>`,
    'company tagline directly below company name'
  )

  app = replaceRequired(
    app,
    "  const signatoryName = String(record?.approved_by || values?.approvedBy || '').trim()\n  const signatoryTitle = String(cf.signatoryTitle || 'Authorized Signatory').trim()",
    "  const signatoryName = String(signatureState?.signed_name || record?.approved_by || values?.approvedBy || '').trim()\n  const signatoryTitle = String(signatureState?.signed_title || cf.signatoryTitle || 'Authorized Signatory').trim()\n  const signatureImageDataUrl = String(signatureState?.signature_image_data_url || '').trim()\n  const signedAtLabel = signatureState?.signed_at ? coeFormatSignedAt(signatureState.signed_at) : ''",
    'signed identity and signature image variables'
  )

  const oldCssTail = ".signature-space{height:45px;}.signature-line{border-top:1px solid #111;padding-top:5px;text-align:center;font-size:9.5pt;font-weight:700;min-height:20px;}.signature-title{text-align:center;font-size:8.5pt;color:#555;margin-top:2px;}.document-control{margin-top:34px;border-top:1px solid #ddd;padding-top:7px;text-align:center;color:#666;font-size:8.5pt;line-height:1.4;}.no-print{text-align:center;margin:0 0 10px;}"
  const newCssTail = ".signature-space{height:55px;display:flex;align-items:flex-end;justify-content:center;}.signature-line{border-top:1px solid #111;padding-top:5px;text-align:center;font-size:9.5pt;font-weight:700;min-height:20px;}.signature-title{text-align:center;font-size:8.5pt;color:#555;margin-top:2px;}.signature-meta{text-align:center;font-size:7.4pt;color:#777;margin-top:2px;line-height:1.3;}.esignature-image{display:block;max-width:180px;max-height:52px;object-fit:contain;margin:0 auto -2px;}.coe-draft-watermark{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%) rotate(-28deg);font-size:34pt;font-weight:900;color:rgba(202,27,27,.13);letter-spacing:2px;white-space:nowrap;pointer-events:none;z-index:0;}.letter-body,.brand,.gold-rule,.addressee,.letter-title,.signature-table,.document-control{position:relative;z-index:1;}.document-control{margin-top:34px;border-top:1px solid #ddd;padding-top:7px;text-align:center;color:#666;font-size:8.5pt;line-height:1.4;}.no-print{text-align:center;margin:0 0 10px;}"
  app = replaceRequired(app, oldCssTail, newCssTail, 'signature/watermark document CSS')

  app = replaceRequired(
    app,
    "   '<div class=\"' + pageClass + '\">',\n   '<table class=\"brand\"><tr>",
    "   '<div class=\"' + pageClass + '\" style=\"position:relative;overflow:hidden\">',\n   draftWatermark ? '<div class=\"coe-draft-watermark\">DRAFT — NOT YET SIGNED</div>' : '',\n   '<table class=\"brand\"><tr>",
    'draft watermark markup'
  )

  const oldSignature = `   '<table class="signature-table"><tr><td><div class="signature-space"></div><div class="signature-line">' + esc(preparedBy) + '</div><div class="signature-title">Prepared By</div></td><td><div class="signature-space"></div><div class="signature-line">' + (signatoryName ? esc(signatoryName) : '&nbsp;') + '</div><div class="signature-title">' + esc(signatoryTitle) + '</div></td></tr></table>',`
  const newSignature = `   '<table class="signature-table"><tr><td><div class="signature-space"></div><div class="signature-line">' + esc(preparedBy) + '</div><div class="signature-title">Prepared By</div></td><td><div class="signature-space">' + (signatureImageDataUrl ? '<img class="esignature-image" alt="Authorized e-signature" src="' + esc(signatureImageDataUrl) + '"/>' : '') + '</div><div class="signature-line">' + (signatoryName ? esc(signatoryName) : '&nbsp;') + '</div><div class="signature-title">' + esc(signatoryTitle) + '</div>' + (signedAtLabel ? '<div class="signature-meta">Electronically signed ' + esc(signedAtLabel) + ' (Asia/Manila)</div>' : '') + '</td></tr></table>',`
  app = replaceRequired(app, oldSignature, newSignature, 'e-signature document block')

  app = replaceRequired(
    app,
    ' const openCertificateOfEmploymentPreview = ({ form = getSelectedDocumentBatch1AForm(), values = documentFormDraft, record = null, autoPrint = false } = {}) => {',
    ' const openCertificateOfEmploymentPreview = async ({ form = getSelectedDocumentBatch1AForm(), values = documentFormDraft, record = null, autoPrint = false } = {}) => {',
    'async COE preview'
  )

  app = replaceRequired(
    app,
    "  const html = buildCertificateOfEmploymentHtml({ form, values, record, wordMode:false })\n  const pw = window.open('', '_blank', 'width=980,height=780')",
    "  let renderContext\n  try { renderContext = await coePrepareRenderContext({ values, record, requireSigned:!!autoPrint }) }\n  catch(error) { showToast(error?.message || String(error), 'red'); return }\n  const html = buildCertificateOfEmploymentHtml({ form, values, record, wordMode:false, signatureState:renderContext.signatureState, draftWatermark:renderContext.draftWatermark })\n  const pw = window.open('', '_blank', 'width=980,height=780')",
    'preview signature-state guard'
  )

  app = replaceRequired(
    app,
    '  if (autoPrint) setTimeout(() => pw.print(), 350)\n }',
    "  if (autoPrint) { await coeLogFinalOutput(record, 'PRINT'); setTimeout(() => pw.print(), 350) }\n }",
    'print audit logging'
  )

  app = replaceRequired(
    app,
    "   const html = buildCertificateOfEmploymentHtml({ form, values:{ ...values, documentNo }, record, wordMode:false })",
    "   const renderContext = await coePrepareRenderContext({ values:{ ...values, documentNo }, record, requireSigned:true })\n   const html = buildCertificateOfEmploymentHtml({ form, values:{ ...values, documentNo }, record, wordMode:false, signatureState:renderContext.signatureState, draftWatermark:false })",
    'PDF signed render guard'
  )

  app = replaceRequired(
    app,
    "   pdf.save(fileName)\n   showToast('Certificate of Employment PDF downloaded.')",
    "   pdf.save(fileName)\n   await coeLogFinalOutput(record, 'PDF')\n   showToast('Certificate of Employment PDF downloaded.')",
    'PDF audit log'
  )

  app = replaceRequired(
    app,
    ' const downloadCertificateOfEmploymentWord = ({ form = getSelectedDocumentBatch1AForm(), values = documentFormDraft, record = null } = {}) => {',
    ' const downloadCertificateOfEmploymentWord = async ({ form = getSelectedDocumentBatch1AForm(), values = documentFormDraft, record = null } = {}) => {',
    'async Word export'
  )

  app = replaceRequired(
    app,
    "  const html = buildCertificateOfEmploymentHtml({ form, values:{ ...values, documentNo }, record, wordMode:true })\n  const fileName = ['Roma-COE', cleanCertificateFileName(employeeName), cleanCertificateFileName(documentNo)].join('_') + '.doc'\n  try {",
    "  const fileName = ['Roma-COE', cleanCertificateFileName(employeeName), cleanCertificateFileName(documentNo)].join('_') + '.doc'\n  try {\n   const renderContext = await coePrepareRenderContext({ values:{ ...values, documentNo }, record, requireSigned:true })\n   const html = buildCertificateOfEmploymentHtml({ form, values:{ ...values, documentNo }, record, wordMode:true, signatureState:renderContext.signatureState, draftWatermark:false })",
    'Word signed render guard'
  )

  app = replaceRequired(
    app,
    "   showToast('Certificate of Employment Word file downloaded.')",
    "   await coeLogFinalOutput(record, 'WORD')\n   showToast('Certificate of Employment Word file downloaded.')",
    'Word audit log'
  )

  app = replaceRequired(
    app,
    "  <button style={{...btnGreen, width:'auto', padding:'10px 16px', marginTop:0 }} onClick={()=>saveCurrentDocumentRecord('draft', { printAfter:true })}>SAVE & PRINT</button>",
    "  {!isCertificateOfEmploymentForm && <button style={{...btnGreen, width:'auto', padding:'10px 16px', marginTop:0 }} onClick={()=>saveCurrentDocumentRecord('draft', { printAfter:true })}>SAVE & PRINT</button>}",
    'disable unsigned COE save-and-print shortcut'
  )

  app = replaceRequired(
    app,
    "  <button style={{...btnGray, width:'auto', padding:'10px 16px', marginTop:0 }} onClick={()=>printBatch1ADocumentForm()}>{isResellerAgreementFormKey(selectedBatch1DocumentForm.key)?'PREVIEW / PRINT':'PRINT ONLY'}</button>",
    "  <button style={{...btnGray, width:'auto', padding:'10px 16px', marginTop:0 }} onClick={()=>printBatch1ADocumentForm()}>{isCertificateOfEmploymentForm?'PREVIEW DRAFT':(isResellerAgreementFormKey(selectedBatch1DocumentForm.key)?'PREVIEW / PRINT':'PRINT ONLY')}</button>",
    'COE draft-preview label'
  )

  const activePdfWord = `  {isCertificateOfEmploymentForm && <button style={{...btnBlack, background:'#CA1B1B', width:'auto', padding:'10px 16px', marginTop:0 }} onClick={()=>downloadCertificateOfEmploymentPdf()}>DOWNLOAD PDF (A4)</button>}
  {isCertificateOfEmploymentForm && <button style={{...btnBlack, width:'auto', padding:'10px 16px', marginTop:0 }} onClick={()=>downloadCertificateOfEmploymentWord()}>DOWNLOAD WORD (A4)</button>}`
  const activeWorkflow = `  {isCertificateOfEmploymentForm && <button style={{...btnBlack, background:'#CA1B1B', width:'auto', padding:'10px 16px', marginTop:0 }} onClick={openCurrentCoeEsignWorkflow}>E-SIGN / SEND FOR SIGNATURE</button>}
  {isCertificateOfEmploymentForm && <button style={{...btnBlack, background:'#1A1A2E', width:'auto', padding:'10px 16px', marginTop:0 }} onClick={openCoeSignatureInbox}>SIGNATURE INBOX</button>}
  {isCertificateOfEmploymentForm && <button style={{...btnBlack, background:'#4a4a4a', width:'auto', padding:'10px 16px', marginTop:0 }} onClick={openCoeSignatureProfile}>MY E-SIGNATURE</button>}
  {isCertificateOfEmploymentForm && isOwnerRole && <button style={{...btnBlack, background:'#9b7900', width:'auto', padding:'10px 16px', marginTop:0 }} onClick={openCoeSignatorySettings}>SIGNATORY SETTINGS</button>}
  {isCertificateOfEmploymentForm && <span style={{fontSize:'11px',color:'#777',alignSelf:'center'}}>Save the COE as draft before sending it for signature. Final Print/PDF/Word unlock only after the assigned authorized signatory approves the current version.</span>}`
  app = replaceRequired(app, activePdfWord, activeWorkflow, 'COE active-form signature controls')

  const savedPdf = `{isCertificateOfEmploymentFormKey(record.form_key) && <button style={{...btnBlack, background:'#CA1B1B', width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>downloadCertificateOfEmploymentPdf({ form:findBatch1DocumentForm(record.form_key), values:getSavedDocumentValues(record), record })}>PDF</button>}`
  const savedWorkflowPdf = `{isCertificateOfEmploymentFormKey(record.form_key) && <button style={{...btnBlack, background:'#9b7900', width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>openCoeSignatureWorkflow(record)}>E-SIGN</button>}
          {isCertificateOfEmploymentFormKey(record.form_key) && <button style={{...btnBlack, background:'#CA1B1B', width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>downloadCertificateOfEmploymentPdf({ form:findBatch1DocumentForm(record.form_key), values:getSavedDocumentValues(record), record })}>PDF</button>}`
  app = replaceRequired(app, savedPdf, savedWorkflowPdf, 'saved COE e-sign action')

  verifyCoeEsignWorkflow(app)
  return app
}

module.exports = { applyCoeEsignWorkflow, verifyCoeEsignWorkflow }
