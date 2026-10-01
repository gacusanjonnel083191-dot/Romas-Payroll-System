const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/App.jsx'), 'utf8')
const extract = (start, end) => {
 const i = source.indexOf(start), j = source.indexOf(end, i)
 assert.ok(i >= 0 && j > i)
 return source.slice(i, j)
}
const functions = [
 extract(' function sanitizeWordFileName(', '  // Invoice screens'),
 extract(' function downloadGeneratedInvoiceFile(', ' function invoiceCanvasToBlob('),
 extract(' function getEmployeeIdDownloadName(', ' async function loadCompanyDocumentRecords(')
].join('\n').replace('import.meta.env.BASE_URL', JSON.stringify('/'))

async function fixture(role = 'owner') {
 const { buildEmployeeIdWordBlob } = await import('../src/employeeIdWord.js')
 const downloads = [], messages = [], timers = [], blobs = []
 let link
 const context = vm.createContext({
  Blob, console, Uint8Array, buildEmployeeIdWordBlob, adminRole:role,
  fetch:async url => {
   assert.equal(url, '/employee-id-a4-template.docx')
   return {ok:true,arrayBuffer:async () => fs.readFileSync(require('node:path').join(__dirname, '../public/employee-id-a4-template.docx'))}
  },
  employeeIdDraft:{ fullName:'Sample Employee', employeeCode:'EMP-TEST' },
  employeeIdPhotoDataUrl:'data:image/png;base64,cGhvdG8=',
  employeeIdFrontCanvasRef:{ current:{ toDataURL:() => 'data:image/png;base64,ZnJvbnQ=', toBlob:cb => cb(new Blob(['front'], {type:'image/png'})) } },
  employeeIdBackCanvasRef:{ current:{ toDataURL:() => 'data:image/png;base64,YmFjaw==', toBlob:cb => cb(new Blob(['back'], {type:'image/png'})) } },
  renderEmployeeIdCanvases:async options => { assert.equal(options.highResolution,true); return true },
  showToast:(message,color) => messages.push({message,color}),
  URL:{ createObjectURL:blob => {blobs.push(blob);return 'blob:test'}, revokeObjectURL:() => {} },
  document:{ createElement:() => { link={click:() => downloads.push(link.download)};return link }, body:{appendChild:() => {},removeChild:() => {}} },
  setTimeout:(fn, delay) => timers.push({fn,delay})
 })
 vm.runInContext(functions, context)
 return {context,downloads,messages,timers,blobs}
}

for (const role of ['owner','supervisor']) {
 test(`${role} can download the Word file with the reference A4 layout and both embedded images`, async () => {
  const f = await fixture(role)
  assert.equal(await f.context.downloadEmployeeIdWord(), true)
  assert.deepEqual(f.downloads, ['Romas-Donuts-ID-Sample-Employee-front-and-back.docx'])
  assert.equal(f.blobs[0].type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  const {unzipSync,strFromU8} = require('fflate')
  const files = unzipSync(new Uint8Array(await f.blobs[0].arrayBuffer()))
  const template = unzipSync(fs.readFileSync(require('node:path').join(__dirname, '../public/employee-id-a4-template.docx')))
  assert.equal(strFromU8(files['word/document.xml']),strFromU8(template['word/document.xml']))
  assert.equal(strFromU8(files['word/media/image2.png']),'front')
  assert.equal(strFromU8(files['word/media/image1.png']),'back')
  assert.equal(f.timers[0].delay, 2000)
  assert.ok(!f.messages.some(row => row.color === 'red'))
 })
 test(`${role} can download front and back PNGs without a POS component dependency`, async () => {
  const f = await fixture(role)
  assert.equal(await f.context.downloadEmployeeIdPng('front'), true)
  assert.equal(await f.context.downloadEmployeeIdPng('back'), true)
  assert.deepEqual(f.downloads, ['Romas-Donuts-ID-Sample-Employee-front.png','Romas-Donuts-ID-Sample-Employee-back.png'])
  assert.ok(f.blobs.every(blob => blob.type === 'image/png'))
 })
}

test('missing photo or failed render does not download an incomplete ID', async () => {
 const f = await fixture()
 f.context.employeeIdPhotoDataUrl = ''
 assert.equal(await f.context.downloadEmployeeIdWord(), false)
 assert.equal(await f.context.downloadEmployeeIdPng('front'), false)
 assert.equal(f.downloads.length, 0)
 f.context.employeeIdPhotoDataUrl = 'data:image/png;base64,cGhvdG8='
 f.context.renderEmployeeIdCanvases = async () => false
 assert.equal(await f.context.downloadEmployeeIdWord(), false)
 assert.equal(f.downloads.length, 0)
})

test('supervisor can open Documents Center and load employees for ID selection', () => {
 const section = source.match(/\{ key:'documents', icon:[\s\S]*?roles:(\[[^\]]+\])/)
 assert.ok(vm.runInNewContext(section[1]).includes('supervisor'))
 const events = []
 const context = vm.createContext({
  adminRole:'supervisor',canAccess:() => false,
  setActiveTab:key => events.push(key),setSidebarOpen:() => {},
  loadEmployees:() => events.push('employees'),loadResellers:() => {},
  loadCompanyDocumentRecords:() => {},showToast:() => events.push('blocked')
 })
 vm.runInContext(extract(' const handleTabClick =', 'function renderInvoiceDeletionApprovalCenter()') + '\nthis.openTab=handleTabClick', context)
 context.openTab('documents')
 assert.deepEqual(events,['documents','employees'])
})


test('template loading failure is reported without downloading a broken document', async () => {
 const f = await fixture('supervisor')
 f.context.fetch = async () => ({ok:false})
 assert.equal(await f.context.downloadEmployeeIdWord(),false)
 assert.equal(f.downloads.length,0)
 assert.ok(f.messages.some(row => row.color === 'red'))
})
