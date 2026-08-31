const fs = require('fs')
const file = 'src/App.jsx'
let s = fs.readFileSync(file, 'utf8')
const die = m => { console.error('[invoice-brand-logo] ' + m); process.exit(1) }
const req = (a,b,label) => { if (s.includes(b)) return; if (!s.includes(a)) die('Missing '+label); s=s.replace(a,b) }
const block = (a,b,label) => { const i=s.indexOf(a), j=s.indexOf(b,i+a.length); if(i<0||j<0) die('Missing block '+label); return [i,j,s.slice(i,j)] }
const setBlock = (a,b,label,fn) => { const [i,j,t]=block(a,b,label); const n=fn(t); if(n===t) die('No change '+label); s=s.slice(0,i)+n+s.slice(j) }

for (const n of ['<w:pgSz w:w="5760" w:h="8640"/>','const MARGIN = 170','function buildDeliveryInvoiceDocxTable(invoice) {','function buildDeliveryInvoicesDocxDocument(invoices) {','function buildDeliveryInvoicesDocxBlob(invoices) {','function downloadDeliveryInvoiceDocxFile(filename, invoices) {']) if(!s.includes(n)) die('Current Word structure missing: '+n)

// Native OOXML image support using the app's existing /logo.png.
const anchor='function buildInvoiceDocxTopSpacer'
const p=s.indexOf(anchor); if(p<0) die('Missing DOCX spacer anchor')
const helpers=`function buildLogoDrawingRun(relId, sizeTwips) {
   const emu = Math.round(sizeTwips * 635)
   return \`<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="\${emu}" cy="\${emu}"/><wp:docPr id="1" name="Roma's Donuts Logo"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="Roma's Donuts Logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="\${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="\${emu}" cy="\${emu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>\`
 }
 function wordImageCell(relId, sizeTwips, opts={}) {
   const width=safeNum(opts.width,1000), span=opts.span?\`<w:gridSpan w:val="\${opts.span}"/>\`:''
   return \`<w:tc><w:tcPr><w:tcW w:w="\${width}" w:type="dxa"/>\${span}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>\${buildLogoDrawingRun(relId,sizeTwips)}</w:p></w:tc>\`
 }
 async function fetchLogoImageBytes() {
   try { const r=await fetch('/logo.png',{cache:'no-store'}); if(!r.ok) throw new Error(\`HTTP \${r.status}\`); return new Uint8Array(await r.arrayBuffer()) }
   catch(e) { console.warn('Roma invoice logo unavailable; continuing without logo.',e); return null }
 }
 `
s=s.slice(0,p)+helpers+s.slice(p)

req('function buildDeliveryInvoiceDocxTable(invoice) {','function buildDeliveryInvoiceDocxTable(invoice, hasLogo) {','table signature')
setBlock('function buildDeliveryInvoiceDocxTable(invoice, hasLogo) {','function buildDeliveryInvoicesDocxDocument(invoices) {','table',t=>{
  let x=t
  if(!x.includes("wordImageCell('rIdLogo'")) x=x.replace('const rows = []',"const rows = []\n   if (hasLogo) rows.push(wordRow([wordImageCell('rIdLogo', 420, { width:full, span:5 })], 500))")
  const re=/data\.productRows\.forEach\(row => \{[\s\S]*?\n\s*\}\)/
  const m=x.match(re); if(!m) die('Missing product row loop')
  let loop=m[0]
  if(!loop.includes('], 280))')) { if(!/\],\s*(320|290)\)\)/.test(loop)) die('Unexpected product row height'); loop=loop.replace(/\],\s*(320|290)\)\)/,' ], 280))') }
  x=x.replace(m[0],loop)
  for(const [label,i] of [['Product',0],['Delivered',1],['Price',2],['Amount',3],['Unsold',4]]){
    const a=`wordCell('${label}', { width:widths[${i}], align:'center', bold:true, size:20 })`, b=`wordCell('${label}', { width:widths[${i}], align:'center', bold:true, size:20, shade:BRAND_RED, color:'FFFFFF' })`
    if(x.includes(a)) x=x.replace(a,b); else if(!x.includes(b)) die('Missing '+label+' header')
  }
  return x
})

req('function buildDeliveryInvoicesDocxDocument(invoices) {','function buildDeliveryInvoicesDocxDocument(invoices, hasLogo) {','document signature')
req('buildDeliveryInvoiceDocxTable(invoice)','buildDeliveryInvoiceDocxTable(invoice, hasLogo)','document table call')

setBlock('function buildDeliveryInvoicesDocxBlob(invoices) {','function downloadDeliveryInvoiceDocxFile(filename, invoices) {','blob',t=>{
  let x=t.replace('function buildDeliveryInvoicesDocxBlob(invoices) {','function buildDeliveryInvoicesDocxBlob(invoices, logoBytes) {')
  if(!x.includes('const hasLogo = logoBytes instanceof Uint8Array')) x=x.replace('const documentXml = buildDeliveryInvoicesDocxDocument(invoices)','const hasLogo = logoBytes instanceof Uint8Array && logoBytes.length > 0\n   const documentXml = buildDeliveryInvoicesDocxDocument(invoices, hasLogo)')
  if(!x.includes('buildDeliveryInvoicesDocxDocument(invoices, hasLogo)')) die('Blob document call not patched')
  if(!x.includes('Default Extension="png"')) x=x.replace('<Default Extension="xml" ContentType="application/xml"/>','<Default Extension="xml" ContentType="application/xml"/>${hasLogo ? \'<Default Extension="png" ContentType="image/png"/>\' : \'\'}')
  if(!x.includes('Id="rIdLogo"')){
    const a=x.indexOf('const docRels ='), b=x.indexOf('const styles =',a); if(a<0||b<0) die('Missing doc relationships')
    let r=x.slice(a,b); if(!r.includes('</Relationships>`')) die('Unexpected doc relationships')
    r=r.replace('</Relationships>`','${hasLogo ? \'<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>\' : \'\'}</Relationships>`')
    x=x.slice(0,a)+r+x.slice(b)
  }
  if(!x.includes("name:'word/media/logo.png'")){
    const mime="'application/vnd.openxmlformats-officedocument.wordprocessingml.document'", a=x.indexOf('return createStoredZipBlob(['), b=x.indexOf(`], ${mime})`,a)
    if(a<0||b<0) die('Missing DOCX zip list')
    x=x.slice(0,b)+",\n     ...(hasLogo ? [{ name:'word/media/logo.png', data:logoBytes }] : [])"+x.slice(b)
  }
  return x
})
req('function downloadDeliveryInvoiceDocxFile(filename, invoices) {','function downloadDeliveryInvoiceDocxFile(filename, invoices, logoBytes) {','download signature')
req('const blob = buildDeliveryInvoicesDocxBlob(invoices)','const blob = buildDeliveryInvoicesDocxBlob(invoices, logoBytes)','download blob call')
req('downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoices_4x6_${date}`, dayInvoices)','const logoBytes = await fetchLogoImageBytes()\n     downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoices_4x6_${date}`, dayInvoices, logoBytes)','print all logo')
req('downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoice_4x6_${invoiceNumber}`, [freshInvoice])','const logoBytes = await fetchLogoImageBytes()\n   downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoice_4x6_${invoiceNumber}`, [freshInvoice], logoBytes)','print logo')

for(const n of ['async function fetchLogoImageBytes()','function buildDeliveryInvoiceDocxTable(invoice, hasLogo)',"wordImageCell('rIdLogo', 420, { width:full, span:5 })], 500)",'function buildDeliveryInvoicesDocxDocument(invoices, hasLogo)','function buildDeliveryInvoicesDocxBlob(invoices, logoBytes)','function downloadDeliveryInvoiceDocxFile(filename, invoices, logoBytes)',"name:'word/media/logo.png'",'Id="rIdLogo"','Default Extension="png" ContentType="image/png"','<w:pgSz w:w="5760" w:h="8640"/>','const MARGIN = 170','downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoices_4x6_${date}`, dayInvoices, logoBytes)','downloadDeliveryInvoiceDocxFile(`Romas_Donuts_Invoice_4x6_${invoiceNumber}`, [freshInvoice], logoBytes)','> PRINT ALL ({invoiceDayFilter})</button>','> PRINT</button>']) if(!s.includes(n)) die('Final missing: '+n)
for(const n of ['await downloadDeliveryInvoiceWordImageFile(`Romas_Donuts_Invoices_4x6_${date}`, dayInvoices)','await downloadDeliveryInvoiceWordImageFile(`Romas_Donuts_Invoice_4x6_${invoiceNumber}`, [freshInvoice])','> PRINT ALL PDF ({invoiceDayFilter})</button>','> DOWNLOAD IMAGES</button>','> DOWNLOAD PDF</button>']) if(s.includes(n)) die('Old behavior remains: '+n)

fs.writeFileSync(file,s)
console.log('[invoice-brand-logo] Roma logo + branded native 4x6 Word invoice patch applied.')
