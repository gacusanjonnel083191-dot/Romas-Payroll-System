import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const functionNames = [
  'normalizeDonutVariantName', 'sortDeliveryInvoiceItems',
  'getInvoiceProductOrderForItems', 'buildInvoiceProductTemplateFromGuide', 'getDeliveryInvoicePrintData',
  'buildDeliveryInvoicePrintPage', 'getInvoiceViewItemRows',
  'buildInvoiceSettlementRows', 'updateSettlementRow', 'getSettlementSummary',
  'wordXmlText', 'wordRun', 'wordParagraph', 'wordCell', 'wordRow', 'buildDeliveryInvoiceDocxTable',
]
const nextMarkers = {
  normalizeDonutVariantName: '  const DONUT_VARIANT_ORDER_INDEX',
  sortDeliveryInvoiceItems: '  // MASTER DONUT VARIETY ORDER',
  getInvoiceProductOrderForItems: '  function buildInvoiceProductTemplateFromGuide',
  buildInvoiceProductTemplateFromGuide: ' function getDeliveryInvoicePrintData',
  getDeliveryInvoicePrintData: ' function wordXmlText',
  buildDeliveryInvoicePrintPage: ' function escapeWordDocText',
  getInvoiceViewItemRows: ' function getDaysUntilLocal',
  buildInvoiceSettlementRows: ' async function openInvoiceSettlement',
  updateSettlementRow: ' function updateSettlementCrates',
  getSettlementSummary: ' async function saveInvoiceSettlement',
  wordXmlText: ' function wordRun',
  wordRun: ' function wordParagraph',
  wordParagraph: ' function wordCell',
  wordCell: ' function wordRow',
  wordRow: ' function buildLogoDrawingRun',
  buildDeliveryInvoiceDocxTable: ' function buildDeliveryInvoicesDocxDocument',
}
const extractFunction = name => {
  const start = source.indexOf(`function ${name}(`)
  const end = source.indexOf(nextMarkers[name], start)
  assert.ok(start >= 0 && end > start, `${name} exists`)
  return source.slice(start, end)
}
const constant = source.match(/const DELIVERY_INVOICE_PRODUCT_ORDER = \[[\s\S]*?\n\s*\];/)[0]
const context = vm.createContext({
  safeNum: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  moneyRound: value => Math.round((Number(value) + Number.EPSILON) * 100) / 100,
  getInvoiceItemDeliveredQty: item => Number(item.quantity || 0),
  getInvoiceItemPrice: item => Number(item.reseller_price || 0),
  getInvoiceItemUnsoldQuantity: (_invoice, item) => Number(item.unsold_quantity || 0),
  getInvoiceProductionDispatchNote: () => '',
  resellers: [], resellerAccounts: [], settlementRows: {}, paymentAmount: {},
})
context.setSettlementRows = updater => { context.settlementRows = updater(context.settlementRows) }
vm.runInContext(constant + '\n' + functionNames.map(extractFunction).join('\n'), context)
const plain = value => JSON.parse(JSON.stringify(value))
const historicalExpected = ['Choco Balls', 'Matcha Pops', 'Almond Glitz', 'Fanfans', 'Oreo Dream',
  'Lotus Cloud', 'Rings', 'Shells', 'Bav. Midnight', 'Circlets', 'Bavarian Bites',
  'Bavarian Pops', 'Strawberry Pops', 'Taro Pops', 'Cinnamon Rolls', 'Biscoreo', 'Choco Lollisticks', 'Giant Donut']
const expected = [...historicalExpected]
expected.splice(expected.indexOf('Shells') + 1, 0, 'Matcha Supreme')
const activeExpected = expected.filter(name => !['Cinnamon Rolls','Biscoreo'].includes(name))
const names = [...historicalExpected].reverse().map(name => name === 'Circlets' ? 'Glazed Circlets' : name === 'Bav. Midnight' ? 'Bavarian Midnight' : name)
const invoice = { id: 'test-invoice', total_amount: 5406.4, paid_amount: 100,
  delivery_invoice_items: names.map((variant_name, i) => ({ id: `item-${i}`, variant_name,
    quantity: i + 2, reseller_price: 4.8, total_price: (i + 2) * 4.8, unsold_quantity: i % 2 })) }

test('three Giant Donuts appear in HTML and Word with the saved 525.60 total', () => {
  const saved = { id:'giant-invoice', customer_type:'non_reseller', delivery_date:'2026-10-02',
    total_amount:525.6, delivery_invoice_items:[{ id:'giant-line', variant_name:'Giant Donut',
      quantity:3, reseller_price:175.2, total_price:525.6 }] }
  const original = JSON.stringify(saved)
  const data = context.getDeliveryInvoicePrintData(saved)
  const giant = data.productRows.find(row => row.product === 'Giant Donut')
  assert.deepEqual(plain(giant), { product:'Giant Donut', delivered:'3', price:'₱175.20',
    amount:'₱525.60', unsold:'', _ordered:true })
  assert.equal(data.total, '₱525.60')
  const html = context.buildDeliveryInvoicePrintPage(saved)
  const htmlRow = html.match(/<tr class="product-row">\s*<td class="product-name">Giant Donut<\/td>[\s\S]*?<\/tr>/)[0]
  assert.match(htmlRow, />3<\/td>/)
  assert.match(htmlRow, /₱175\.20/)
  assert.match(htmlRow, /₱525\.60/)
  const xml = context.buildDeliveryInvoiceDocxTable(saved, false)
  const xmlRow = [...xml.matchAll(/<w:tr>[\s\S]*?<\/w:tr>/g)].find(match => match[0].includes('Giant Donut'))[0]
  assert.match(xmlRow, />3<\/w:t>/)
  assert.match(xmlRow, /₱175\.20/)
  assert.match(xmlRow, /₱525\.60/)
  assert.equal(JSON.stringify(saved), original)
})

test('HTML print, Word/image data, invoice view, and settlement share the printed sequence', () => {
  assert.deepEqual(plain(context.buildInvoiceProductTemplateFromGuide()).map(row => row.label), activeExpected)
  assert.deepEqual(plain(context.buildInvoiceProductTemplateFromGuide(invoice.delivery_invoice_items)).map(row => row.label), expected)
  const printData = context.getDeliveryInvoicePrintData(invoice)
  assert.deepEqual(plain(printData.productRows).map(row => row.product), expected)
  const html = context.buildDeliveryInvoicePrintPage(invoice)
  assert.deepEqual([...html.matchAll(/class="product-name">([^<]+)</g)].map(match => match[1]), expected)
  const actualNames = historicalExpected.map(name => name === 'Circlets' ? 'Glazed Circlets' : name === 'Bav. Midnight' ? 'Bavarian Midnight' : name)
  assert.deepEqual(plain(context.getInvoiceViewItemRows(invoice)).map(row => row.variant_name), actualNames)
  assert.deepEqual(plain(context.buildInvoiceSettlementRows(invoice)).map(row => row.variant_name), actualNames)
})

test('sorting preserves source records, totals, aliases, duplicate rows, and unlisted products', () => {
  const original = JSON.stringify(invoice)
  const before = invoice.delivery_invoice_items.reduce((sum, row) => sum + row.quantity * row.reseller_price, 0)
  const rows = context.sortDeliveryInvoiceItems(invoice.delivery_invoice_items)
  assert.equal(rows.reduce((sum, row) => sum + row.quantity * row.reseller_price, 0), before)
  assert.equal(JSON.stringify(invoice), original)
  const extras = [{ id: 'a', variant_name: 'Fan Fans' }, { id: 'b', variant_name: 'Fanfans' },
    { id: 'c', variant_name: 'New Product' }, { id: 'd', variant_name: 'Choco Lollistick' }]
  assert.deepEqual(plain(context.sortDeliveryInvoiceItems(extras)).map(row => row.id), ['a', 'b', 'd', 'c'])
  assert.deepEqual(plain(context.sortDeliveryInvoiceItems(null)), [])
})

test('typing actual delivery and returns updates the correct sorted item and reconciles payment', () => {
  context.settlementRows = { [invoice.id]: context.buildInvoiceSettlementRows(invoice) }
  const first = context.settlementRows[invoice.id][0]
  assert.equal(first.variant_name, 'Choco Balls')
  context.updateSettlementRow(invoice.id, 0, 'actual_quantity', '10')
  context.updateSettlementRow(invoice.id, 0, 'returned_quantity', '3')
  const updated = context.settlementRows[invoice.id]
  assert.equal(updated[0].item_id, first.item_id)
  assert.equal(updated[0].actual_quantity, '10')
  assert.equal(updated[0].returned_quantity, '3')
  assert.equal(updated[1].actual_quantity, updated[1].original_quantity)
  const summary = context.getSettlementSummary(invoice)
  const expectedTotal = Math.round(updated.reduce((sum, row) => sum +
    (Number(row.actual_quantity) - Number(row.returned_quantity)) * row.reseller_price, 0) * 100) / 100
  assert.equal(summary.finalTotal, expectedTotal)
  assert.equal(summary.finalBalance, Math.round((expectedTotal - 100) * 100) / 100)
  context.paymentAmount[invoice.id] = summary.dueBeforeCash
  assert.equal(context.getSettlementSummary(invoice).newStatus, 'paid')
  assert.equal(context.getSettlementSummary(invoice).finalBalance, 0)
  context.updateSettlementRow(invoice.id, 0, 'actual_quantity', '2')
  assert.equal(context.settlementRows[invoice.id][0].returned_quantity, 2)
})

test('the screenshot invoice retains its verified 5406.40 total after ordering', () => {
  const lines = [
    ['Bavarian Bites', 80, 4.8], ['Bavarian Pops', 230, 4.8], ['Choco Balls', 110, 4.8],
    ['Choco Lollisticks', 10, 5.6], ['Matcha Pops', 40, 4.8], ['Strawberry Pops', 110, 4.8],
    ['Taro Pops', 110, 4.8], ['Shells', 40, 20.8], ['Glazed Circlets', 10, 10.4],
    ['Almond Glitz', 10, 28], ['Bavarian Midnight', 3, 22.4], ['Cinnamon Rolls', 5, 14.4],
    ['Fanfans', 2, 26.4], ['Lotus Cloud', 10, 28], ['Oreo Dream', 6, 26.4], ['Rings', 12, 20],
  ]
  const saved = { id: 'screenshot-fixture', total_amount: 5406.4,
    delivery_invoice_items: lines.map(([variant_name, quantity, reseller_price], i) => ({
      id: `line-${i}`, variant_name, quantity, reseller_price, total_price: quantity * reseller_price,
    })) }
  const rows = context.buildInvoiceSettlementRows(saved)
  assert.equal(context.getSettlementSummary(saved, rows).finalTotal, 5406.4)
  const viewRows = context.getInvoiceViewItemRows(saved)
  assert.equal(Math.round(viewRows.reduce((sum, row) => sum + row.netAmount, 0) * 100) / 100, 5406.4)
  assert.equal(context.getDeliveryInvoicePrintData(saved).total, '₱5,406.40')
  assert.equal(viewRows[0].variant_name, 'Choco Balls')
  assert.equal(viewRows[1].variant_name, 'Matcha Pops')
  assert.equal(rows.at(-1).variant_name, 'Choco Lollisticks')
})
