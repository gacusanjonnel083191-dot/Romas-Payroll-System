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
].join('\n')

function fixture(role = 'owner') {
 const downloads = [], messages = [], timers = [], blobs = []
 let link
 const context = vm.createContext({
  Blob, console, adminRole:role,
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
 test(`${role} can download the Word file with both printable 6.5 x 9.5cm images`, async () => {
  const f = fixture(role)
  assert.equal(await f.context.downloadEmployeeIdWord(), true)
  assert.deepEqual(f.downloads, ['Romas-Donuts-ID-Sample-Employee-front-and-back.doc'])
  assert.equal(f.blobs[0].type, 'application/msword;charset=utf-8')
  const html = await f.blobs[0].text()
  assert.match(html,/width:6\.5cm;height:9\.5cm/)
  assert.match(html,/data:image\/png;base64,ZnJvbnQ=/)
  assert.match(html,/data:image\/png;base64,YmFjaw==/)
  assert.equal(f.timers[0].delay, 2000)
  assert.ok(!f.messages.some(row => row.color === 'red'))
 })
 test(`${role} can download front and back PNGs without a POS component dependency`, async () => {
  const f = fixture(role)
  assert.equal(await f.context.downloadEmployeeIdPng('front'), true)
  assert.equal(await f.context.downloadEmployeeIdPng('back'), true)
  assert.deepEqual(f.downloads, ['Romas-Donuts-ID-Sample-Employee-front.png','Romas-Donuts-ID-Sample-Employee-back.png'])
  assert.ok(f.blobs.every(blob => blob.type === 'image/png'))
 })
}

test('missing photo or failed render does not download an incomplete ID', async () => {
 const f = fixture()
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
