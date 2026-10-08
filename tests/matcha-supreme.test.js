import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url),'utf8')
test('Matcha Supreme is in default catalog, while retired names are absent',()=>{
 const block=source.slice(source.indexOf('const DONUT_VARIANTS_DEFAULT = ['),source.indexOf('const [VARIANT_CATEGORIES]'))
 assert.match(block,/name:'Matcha Supreme', category:'Premium', selling_price:30/)
 assert.doesNotMatch(block,/name:'Cinnamon Rolls'/)
 assert.doesNotMatch(block,/name:'Biscoreo'/)
})
test('Matcha Supreme uses exactly 27g dry premix per piece like Rings and Shells',()=>{
 const start=source.indexOf(' const BITE_SIZE_DRY_PREMIX_GRAMS =')
 const end=source.indexOf(' const forecastExcludedInvoices =',start)
 assert.ok(start>=0&&end>start)
 const ctx=vm.createContext({safeNum:(x,f=0)=>Number.isFinite(Number(x))?Number(x):f})
 vm.runInContext(source.slice(start,end)+'\nthis.rate=getDryPremixGramsPerPiece',ctx)
 for(const name of ['Matcha Supreme',' matcha supreme ','MATCHA SUPREME','Rings','Shells'])
   assert.equal(ctx.rate(name),27)
 assert.equal(ctx.rate('Matcha Supreme')*100/1000,2.7)
})
test('new invoice avoids retired rows, historical invoice reprint keeps them',()=>{
 const start=source.indexOf('  const DELIVERY_INVOICE_PRODUCT_ORDER =')
 const end=source.indexOf('  function sortDeliveryInvoiceItems',start)
 const helperStart=source.indexOf('  function getInvoiceProductOrderForItems(')
 const helperEnd=source.indexOf(' function getDeliveryInvoicePrintData(',helperStart)
 assert.ok(start>=0&&end>start&&helperStart>=0&&helperEnd>helperStart)
 const ctx=vm.createContext({})
 vm.runInContext(source.slice(start,end)+`
 function normalizeDonutVariantName(x) {return String(x||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'')}
 `+source.slice(helperStart,helperEnd)+
 '\nthis.products=getInvoiceProductOrderForItems; this.template=buildInvoiceProductTemplateFromGuide',ctx)
 const names=items=>Array.from(ctx.products(items),x=>x.label)
 assert.ok(names([]).includes('Matcha Supreme'))
 assert.ok(!names([]).includes('Cinnamon Rolls'))
 assert.ok(!names([]).includes('Biscoreo'))
 const history=names([{variant_name:'Cinnamon Rolls'},{variant_name:'Biscoreo'}])
 assert.ok(history.includes('Cinnamon Rolls')&&history.includes('Biscoreo'))
})
test('POS and invoice fallback load only active products',()=>{
 assert.match(source,/return product\.is_active === false \|\| \['deleted'/)
 assert.equal((source.match(/from\('donut_variants'\)\.select\('\*'\)\.eq\('is_active', true\)\.order\('category'\)/g)||[]).length,2)
})
