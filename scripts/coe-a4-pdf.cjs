'use strict'

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source
  const first = source.indexOf(before)
  if (first < 0) throw new Error(`COE A4 PDF patch aborted: ${label} anchor was not found.`)
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`COE A4 PDF patch aborted: multiple ${label} anchors were found.`)
  return source.slice(0, first) + after + source.slice(first + before.length)
}

function verifyCoeA4PdfFix(source) {
  const required = [
    ['const downloadCertificateOfEmploymentPdf = async', 'direct PDF exporter'],
    ["format:'a4'", 'A4 PDF format'],
    ['DOWNLOAD PDF (A4)', 'builder PDF button'],
    ['Certificate of Employment PDF downloaded.', 'PDF success feedback'],
    ["month:'long', day:'numeric', year:'numeric'", 'full formal dates'],
    ['Issued on <strong>', 'professional issuance wording'],
    ["signatoryName ? esc(signatoryName) : '&nbsp;'", 'clean empty signatory line'],
    ["timeZone:'Asia/Manila'", 'Asia/Manila document timestamp']
  ]
  for (const [needle, label] of required) {
    if (!source.includes(needle)) throw new Error(`COE A4 PDF verification failed: ${label}.`)
  }
}

function applyCoeA4PdfFix(source) {
  let app = String(source || '')
  if (!app.includes('const buildCertificateOfEmploymentHtml =')) {
    throw new Error('COE A4 PDF patch aborted: Certificate of Employment builder was not found.')
  }
  if (app.includes('const downloadCertificateOfEmploymentPdf = async') && app.includes('DOWNLOAD PDF (A4)')) {
    verifyCoeA4PdfFix(app)
    return app
  }

app = replaceRequired(
  app,
  "  const signatoryName = String(record?.approved_by || values?.approvedBy || '____________________________').trim()",
  "  const signatoryName = String(record?.approved_by || values?.approvedBy || '').trim()",
  'blank authorized-signatory fallback'
)

app = replaceRequired(
  app,
  `  const esc = escapeAgreementHtml\n  const formattedStartDate = employmentStartDate ? formatDateForDisplay(employmentStartDate) : '____________________________'\n  const formattedEndDate = employmentEndDate ? formatDateForDisplay(employmentEndDate) : ''\n  const employmentStatement = isFormerEmployee\n   ? 'This is to certify that <strong>' + esc(employeeName) + '</strong> was employed by <strong>Roma\\'s Donuts</strong> as <strong>' + esc(positionTitle) + '</strong>' + (employeeCode ? ' (Employee Code: ' + esc(employeeCode) + ')' : '') + ' from <strong>' + esc(formattedStartDate) + '</strong>' + (formattedEndDate ? ' until <strong>' + esc(formattedEndDate) + '</strong>' : '') + '.'\n   : 'This is to certify that <strong>' + esc(employeeName) + '</strong> is currently employed by <strong>Roma\\'s Donuts</strong> as <strong>' + esc(positionTitle) + '</strong>' + (employeeCode ? ' (Employee Code: ' + esc(employeeCode) + ')' : '') + ', under a <strong>' + esc(employmentStatus) + '</strong> employment status, effective <strong>' + esc(formattedStartDate) + '</strong>.'`,
  `  const esc = escapeAgreementHtml\n  const formatCertificateDate = value => {\n   if (!value) return ''\n   const raw = String(value).trim()\n   const dateOnlyMatch = raw.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/)\n   const parsed = dateOnlyMatch\n    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))\n    : new Date(raw)\n   if (Number.isNaN(parsed.getTime())) return raw\n   return parsed.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })\n  }\n  const formattedStartDate = employmentStartDate ? formatCertificateDate(employmentStartDate) : '____________________________'\n  const formattedEndDate = employmentEndDate ? formatCertificateDate(employmentEndDate) : ''\n  const formattedIssueDate = formatCertificateDate(issueDate)\n  const employmentStatement = isFormerEmployee\n   ? 'This is to certify that <strong>' + esc(employeeName) + '</strong> was employed by <strong>Roma\\'s Donuts</strong> as <strong>' + esc(positionTitle) + '</strong>' + (employeeCode ? ' (Employee Code: ' + esc(employeeCode) + ')' : '') + ' from <strong>' + esc(formattedStartDate) + '</strong>' + (formattedEndDate ? ' to <strong>' + esc(formattedEndDate) + '</strong>' : '') + '.'\n   : 'This is to certify that <strong>' + esc(employeeName) + '</strong> is currently employed by <strong>Roma\\'s Donuts</strong> as <strong>' + esc(positionTitle) + '</strong>' + (employeeCode ? ' (Employee Code: ' + esc(employeeCode) + ')' : '') + '. The employee\\'s employment status is <strong>' + esc(employmentStatus) + '</strong>, effective <strong>' + esc(formattedStartDate) + '</strong>.'`,
  'professional COE wording and full-month dates'
)

const oldCss = `.brand{width:100%;border-collapse:collapse;border-bottom:3px solid #CA1B1B;margin:0 0 7px;}.brand td{vertical-align:top;padding:0 0 10px;}.brand-left{width:60%;}.brand-right{text-align:right;width:40%;}.company{font-size:22pt;line-height:1;color:#CA1B1B;font-weight:900;letter-spacing:.2px;}.company-sub{font-size:8.5pt;color:#555;margin-top:4px;}.tagline{font-size:8pt;color:#9b7900;margin-top:2px;font-style:italic;}.document-title{font-size:11.5pt;color:#1A1A2E;font-weight:900;text-transform:uppercase;letter-spacing:.7px;}.document-no{font-size:8.5pt;color:#666;margin-top:5px;}.gold-rule{height:5px;background:#FDD412;margin:0 0 19px;}.addressee{font-size:11pt;font-weight:900;margin:0 0 22px;text-transform:uppercase;}.letter-title{text-align:center;color:#1A1A2E;font-size:16pt;font-weight:900;letter-spacing:.7px;text-transform:uppercase;margin:0 0 22px;}.letter-body p{margin:0 0 15px;text-align:justify;}.optional-block{border:1px solid #F0D675;background:#FFFBE9;padding:9px 11px;margin:16px 0;}.optional-label{font-size:8.5pt;font-weight:900;color:#8a6700;letter-spacing:.5px;}.optional-block p{margin:5px 0 0;}.issue-line{margin-top:22px;}.signature-table{width:100%;border-collapse:collapse;margin-top:53px;}.signature-table td{width:50%;vertical-align:bottom;padding:0 18px 0 0;}.signature-table td+td{padding:0 0 0 18px;}.signature-space{height:45px;}.signature-line{border-top:1px solid #111;padding-top:5px;text-align:center;font-size:9.5pt;font-weight:700;}.signature-title{text-align:center;font-size:8.5pt;color:#555;margin-top:2px;}.document-control{margin-top:34px;border-top:1px solid #ddd;padding-top:7px;text-align:center;color:#777;font-size:8pt;line-height:1.35;}.no-print{text-align:center;margin:0 0 10px;}.no-print button{background:#CA1B1B;color:#fff;border:none;border-radius:8px;padding:9px 20px;font-size:10pt;font-weight:700;cursor:pointer;}`
const newCss = `.brand{width:100%;border-collapse:collapse;border-bottom:3px solid #CA1B1B;margin:0 0 7px;}.brand td{vertical-align:top;padding:0 0 10px;}.brand-left{width:60%;}.brand-right{text-align:right;width:40%;}.company{font-size:22pt;line-height:1;color:#CA1B1B;font-weight:900;letter-spacing:.2px;}.company-sub{font-size:8.5pt;color:#555;margin-top:4px;}.tagline{font-size:8pt;color:#9b7900;margin-top:2px;font-style:italic;}.document-title{font-size:11.5pt;color:#1A1A2E;font-weight:900;text-transform:uppercase;letter-spacing:.7px;}.document-no{font-size:8.5pt;color:#666;margin-top:5px;}.gold-rule{height:5px;background:#FDD412;margin:0 0 19px;}.addressee{font-size:11pt;font-weight:900;margin:0 0 22px;text-transform:uppercase;}.letter-title{text-align:center;color:#1A1A2E;font-size:16pt;font-weight:900;letter-spacing:.7px;text-transform:uppercase;margin:0 0 22px;}.letter-body{font-size:11pt;line-height:1.62;}.letter-body p{margin:0 0 14px;text-align:left;orphans:3;widows:3;}.optional-block{border:1px solid #F0D675;background:#FFFBE9;padding:9px 11px;margin:16px 0;}.optional-label{font-size:8.5pt;font-weight:900;color:#8a6700;letter-spacing:.5px;}.optional-block p{margin:5px 0 0;}.issue-line{margin-top:22px;}.signature-table{width:100%;border-collapse:collapse;margin-top:53px;}.signature-table td{width:50%;vertical-align:bottom;padding:0 18px 0 0;}.signature-table td+td{padding:0 0 0 18px;}.signature-space{height:45px;}.signature-line{border-top:1px solid #111;padding-top:5px;text-align:center;font-size:9.5pt;font-weight:700;min-height:20px;}.signature-title{text-align:center;font-size:8.5pt;color:#555;margin-top:2px;}.document-control{margin-top:34px;border-top:1px solid #ddd;padding-top:7px;text-align:center;color:#666;font-size:8.5pt;line-height:1.4;}.no-print{text-align:center;margin:0 0 10px;}.no-print button{background:#CA1B1B;color:#fff;border:none;border-radius:8px;padding:9px 20px;font-size:10pt;font-weight:700;cursor:pointer;}`
app = replaceRequired(app, oldCss, newCss, 'COE document typography and footer legibility')

app = replaceRequired(
  app,
  `   wordMode ? '' : '<div class="no-print"><button onclick="window.print()">Print / Save as PDF</button></div>',`,
  `   wordMode ? '' : '<div class="no-print"><button onclick="window.print()">Print</button></div>',`,
  'preview print-button label'
)

app = replaceRequired(
  app,
  `   '<p class="issue-line">Issued this <strong>' + esc(formatDateForDisplay(issueDate)) + '</strong> at Dagupan City, Pangasinan, Philippines.</p>',`,
  `   '<p class="issue-line">Issued on <strong>' + esc(formattedIssueDate) + '</strong>, in Dagupan City, Pangasinan, Philippines.</p>',`,
  'COE issuance wording'
)

app = replaceRequired(
  app,
  `   '<table class="signature-table"><tr><td><div class="signature-space"></div><div class="signature-line">' + esc(preparedBy) + '</div><div class="signature-title">Prepared By</div></td><td><div class="signature-space"></div><div class="signature-line">' + esc(signatoryName) + '</div><div class="signature-title">' + esc(signatoryTitle) + '</div></td></tr></table>',`,
  `   '<table class="signature-table"><tr><td><div class="signature-space"></div><div class="signature-line">' + esc(preparedBy) + '</div><div class="signature-title">Prepared By</div></td><td><div class="signature-space"></div><div class="signature-line">' + (signatoryName ? esc(signatoryName) : '&nbsp;') + '</div><div class="signature-title">' + esc(signatoryTitle) + '</div></td></tr></table>',`,
  'clean empty authorized-signatory line'
)

app = replaceRequired(
  app,
  `   '<div class="document-control">Roma\\'s Donuts • Certificate of Employment • ' + esc(documentNo) + '<br/>Generated from the Roma\\'s Donuts Company Documents &amp; Forms Center on ' + esc(new Date().toLocaleString('en-PH')) + '.</div>',`,
  `   '<div class="document-control">Roma\\'s Donuts • Certificate of Employment • ' + esc(documentNo) + '<br/>Generated from the Roma\\'s Donuts Company Documents &amp; Forms Center on ' + esc(new Date().toLocaleString('en-PH', { timeZone:'Asia/Manila' })) + ' (Asia/Manila).</div>',`,
  'Asia/Manila document-control timestamp'
)

const pdfFunction = ` const downloadCertificateOfEmploymentPdf = async ({ form = getSelectedDocumentBatch1AForm(), values = documentFormDraft, record = null } = {}) => {\n  if (!form || !isCertificateOfEmploymentFormKey(form.key)) { showToast('Select a Certificate of Employment first.', 'red'); return }\n  if (!record && !validateCurrentDocumentForm(form)) return\n  const documentNo = record?.document_no || values?.documentNo || getDocumentReferenceNumber(form)\n  const employeeName = String(values?.customFields?.employeeName || record?.employee_name || getDocumentFormEmployee()?.full_name || 'Employee').trim()\n  if (!record && !documentFormDraft.documentNo) setDocumentFormDraft(prev => ({ ...prev, documentNo }))\n\n  let renderFrame = null\n  try {\n   const html = buildCertificateOfEmploymentHtml({ form, values:{ ...values, documentNo }, record, wordMode:false })\n   renderFrame = document.createElement('iframe')\n   renderFrame.setAttribute('aria-hidden', 'true')\n   renderFrame.tabIndex = -1\n   renderFrame.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;pointer-events:none;background:#fff;'\n   document.body.appendChild(renderFrame)\n\n   const frameDocument = renderFrame.contentDocument\n   if (!frameDocument) throw new Error('Unable to create the PDF rendering document.')\n   frameDocument.open()\n   frameDocument.write(html)\n   frameDocument.close()\n   await new Promise(resolve => setTimeout(resolve, 80))\n   if (frameDocument.fonts?.ready) await frameDocument.fonts.ready\n\n   const page = frameDocument.querySelector('.page')\n   if (!page) throw new Error('The A4 Certificate of Employment page could not be rendered.')\n   frameDocument.body.style.padding = '0'\n   frameDocument.body.style.background = '#ffffff'\n   page.style.margin = '0'\n   page.style.boxShadow = 'none'\n\n   const canvas = await html2canvas(page, { scale:2, useCORS:true, backgroundColor:'#ffffff', logging:false })\n   const imageHeightMm = (canvas.height * 210) / canvas.width\n   if (imageHeightMm > 297.5) throw new Error('The COE content exceeds one A4 page. Shorten the optional certification text and try again.')\n   const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4', compress:true })\n   pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, 210, Math.min(imageHeightMm, 297), undefined, 'FAST')\n   const fileName = ['Roma-COE', cleanCertificateFileName(employeeName), cleanCertificateFileName(documentNo)].join('_') + '.pdf'\n   pdf.save(fileName)\n   showToast('Certificate of Employment PDF downloaded.')\n  } catch(error) {\n   showToast('Failed to download Certificate of Employment PDF: ' + (error?.message || error), 'red')\n  } finally {\n   if (renderFrame) renderFrame.remove()\n  }\n }\n\n`
app = replaceRequired(
  app,
  ` const downloadCertificateOfEmploymentWord = ({ form = getSelectedDocumentBatch1AForm(), values = documentFormDraft, record = null } = {}) => {`,
  pdfFunction + ` const downloadCertificateOfEmploymentWord = ({ form = getSelectedDocumentBatch1AForm(), values = documentFormDraft, record = null } = {}) => {`,
  'direct A4 PDF download function'
)

app = replaceRequired(
  app,
  `  {isCertificateOfEmploymentForm && <button style={{...btnBlack, width:'auto', padding:'10px 16px', marginTop:0 }} onClick={()=>downloadCertificateOfEmploymentWord()}>DOWNLOAD WORD (A4)</button>}`,
  `  {isCertificateOfEmploymentForm && <button style={{...btnBlack, background:'#CA1B1B', width:'auto', padding:'10px 16px', marginTop:0 }} onClick={()=>downloadCertificateOfEmploymentPdf()}>DOWNLOAD PDF (A4)</button>}\n  {isCertificateOfEmploymentForm && <button style={{...btnBlack, width:'auto', padding:'10px 16px', marginTop:0 }} onClick={()=>downloadCertificateOfEmploymentWord()}>DOWNLOAD WORD (A4)</button>}`,
  'COE builder PDF button'
)

app = replaceRequired(
  app,
  `          {isCertificateOfEmploymentFormKey(record.form_key) && <button style={{...btnBlack, width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>downloadCertificateOfEmploymentWord({ form:findBatch1DocumentForm(record.form_key), values:getSavedDocumentValues(record), record })}>WORD</button>}`,
  `          {isCertificateOfEmploymentFormKey(record.form_key) && <button style={{...btnBlack, background:'#CA1B1B', width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>downloadCertificateOfEmploymentPdf({ form:findBatch1DocumentForm(record.form_key), values:getSavedDocumentValues(record), record })}>PDF</button>}\n          {isCertificateOfEmploymentFormKey(record.form_key) && <button style={{...btnBlack, width:'auto', padding:'6px 9px', marginTop:0, fontSize:'11px' }} onClick={()=>downloadCertificateOfEmploymentWord({ form:findBatch1DocumentForm(record.form_key), values:getSavedDocumentValues(record), record })}>WORD</button>}`,
  'saved COE PDF button'
)
  verifyCoeA4PdfFix(app)
  return app
}

module.exports = { applyCoeA4PdfFix, verifyCoeA4PdfFix }
