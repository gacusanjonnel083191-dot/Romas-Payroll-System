import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const safeNum = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const moneyRound = value => Math.round(Number(value) * 100) / 100
const variant = { id:'giant-test', name:'Giant Donut', category:'Giant', selling_price:219 }

test('existing order builder applies each available discount to Giant Donut', async () => {
  const start = source.indexOf(' async function getAllOrderVariantRows(')
  const end = source.indexOf(' async function loadResellerOrderItems(', start)
  const context = vm.createContext({ donutVariants:[variant], safeNum, moneyRound })
  vm.runInContext(source.slice(start, end), context)
  for (const [discount, expected] of [[0,219],[5,208.05],[10,197.10],[20,175.20]]) {
    const rows = await context.getAllOrderVariantRows([{variant_id:variant.id,default_quantity:10}], discount)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].retail_price, 219)
    assert.equal(rows[0].reseller_price, expected)
    assert.equal(rows[0].quantity, '10')
    assert.equal(rows[0].variant_id, variant.id)
  }
})

test('live product loader and invoice builder include Giant category with the normal pricing path', async () => {
  const start = source.indexOf(' async function loadAllInvoiceVariants(')
  const end = source.indexOf(' // Reseller Credit Warning', start)
  let items
  const context = vm.createContext({
    donutVariants:[variant], invoiceDiscountPct:20, safeNum, moneyRound,
    setInvoiceItems:rows => { items = rows }, showToast:() => {}
  })
  vm.runInContext(source.slice(start, end), context)
  for (const [discount, expected] of [[0,219],[5,208.05],[10,197.10],[20,175.20]]) {
    await context.loadAllInvoiceVariants(10, discount)
    assert.equal(items[0].reseller_price, expected)
    assert.equal(items[0].variant_name, 'Giant Donut')
    assert.equal(items[0].quantity, 10)
  }
  const categories = source.match(/const \[VARIANT_CATEGORIES\] = useState\((\[[^\n]+\])\)/)[1]
  assert.ok(vm.runInNewContext(categories).includes('Giant'))
})

test('forecast uses 170g per Giant Donut and preserves existing rates', () => {
  const start = source.indexOf(' const BITE_SIZE_DRY_PREMIX_GRAMS =')
  const end = source.indexOf(' const forecastExcludedInvoices =', start)
  const context = vm.createContext({ safeNum })
  vm.runInContext(source.slice(start, end) + '\nthis.rate = getDryPremixGramsPerPiece; this.qty = getForecastRowTotal', context)
  for (const name of ['Giant Donut', ' giant donut ', 'GIANT DONUT']) assert.equal(context.rate(name), 170)
  assert.equal(context.rate('Giant Donut') * context.qty({quantity:10}) / 1000, 1.7)
  assert.equal(context.rate('Giant Donut') * context.qty({quantity:0}), 0)
  assert.equal(context.rate('Matcha Pops'), 7)
  assert.equal(context.rate('Rings'), 27)
  assert.equal(context.rate('Lotus Cloud'), 31.5)
})
