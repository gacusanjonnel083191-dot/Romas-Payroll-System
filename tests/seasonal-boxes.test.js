import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { SEASONAL_BOXES, seasonalBoxFor, assertWholeSeasonalBoxes, physicalDonutQuantity, expandSeasonalProductionItems, seasonalPackingSummary } from '../src/seasonalBoxPolicy.js'
import { filterProductionForecastInvoices } from '../src/productionForecastPolicy.js'
const six = SEASONAL_BOXES[0], twelve = SEASONAL_BOXES[1]
const variants=[{id:'shell-id',name:'Shells'},{id:'ring-id',name:'Rings'}]
const ordered=[{variant_name:six.name,quantity:2,retail_price:160},{variant_name:twelve.name,quantity:1,retail_price:315}]
const source=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8')
test('two box sizes preserve retail and discount calculations',()=>{
 assert.deepEqual(SEASONAL_BOXES.map(x=>[x.pieces,x.shells,x.rings,x.price]),[[6,3,3,160],[12,5,7,315]])
 assert.equal(ordered.reduce((sum,r)=>sum+r.quantity*r.retail_price,0),635)
 assert.equal(ordered.reduce((sum,r)=>sum+r.quantity*r.retail_price*0.8,0),508)
 for(const discount of [0,5,10,20]) assert.equal(Math.round(635*(1-discount/100)*100)/100, [635,603.25,571.5,508][[0,5,10,20].indexOf(discount)])
})
test('boxes expand into 11 Shells and 13 Rings; original invoice and money remain untouched',()=>{
 const before=JSON.stringify(ordered)
 const expanded=expandSeasonalProductionItems(ordered,variants)
 assert.equal(expanded.filter(x=>x.variant_id==='shell-id').reduce((s,x)=>s+x.quantity,0),11)
 assert.equal(expanded.filter(x=>x.variant_id==='ring-id').reduce((s,x)=>s+x.quantity,0),13)
 assert.equal(expanded.reduce((s,x)=>s+x.quantity,0),24)
 assert.equal(expanded.reduce((s,x)=>s+x.quantity*27,0),648)
 assert.equal(JSON.stringify(ordered),before)
 assert(expanded.every(x=>!('total_price' in x)))
 assert.equal(expandSeasonalProductionItems(expanded,variants).reduce((s,x)=>s+x.quantity,0),24)
})
test('ordinary pieces plus boxes reconcile once, including packing totals',()=>{
 const items=[...ordered,{variant_name:'Rings',quantity:10}]
 assert.equal(expandSeasonalProductionItems(items,variants).reduce((s,x)=>s+x.quantity,0),34)
 assert.equal(items.reduce((s,x)=>s+physicalDonutQuantity(x),0),34)
 const packing=seasonalPackingSummary(items)
 assert.equal(packing.reduce((s,x)=>s+x.boxes,0),3)
 assert.equal(packing.reduce((s,x)=>s+x.totalPieces,0),24)
 assert.deepEqual(seasonalPackingSummary([]),[])
})
test('fractional, negative and nonnumeric box quantities are blocked; returns also use boxes',()=>{
 for(const quantity of [0.5,-1,NaN,'invalid',Infinity]) assert.throws(()=>assertWholeSeasonalBoxes([{variant_name:six.name,quantity}]))
 for(const quantity of [0,1,'2','']) assert.doesNotThrow(()=>assertWholeSeasonalBoxes([{variant_name:six.name,quantity}]))
 assert.throws(()=>assertWholeSeasonalBoxes([{variant_name:twelve.name,returned_qty:0.5}],'returned_qty'))
 assert.equal(seasonalBoxFor({product_name:six.name}).pieces,6)
 assert.equal(seasonalBoxFor('Shells'),null)
})
test('selected date, voids and deletion exclusions apply before box expansion',()=>{
 const invoices=[{id:'active',delivery_date:'2026-11-01',delivery_invoice_items:ordered},{id:'void',delivery_date:'2026-11-01',status:'voided',delivery_invoice_items:ordered},{id:'excluded',delivery_date:'2026-11-01',delivery_invoice_items:ordered},{id:'wrong-date',delivery_date:'2026-11-02',delivery_invoice_items:ordered}]
 const rows=filterProductionForecastInvoices(invoices,'2026-11-01',['excluded'])
 assert.equal(rows.length,1)
 assert.equal(rows.flatMap(x=>expandSeasonalProductionItems(x.delivery_invoice_items,variants)).reduce((s,x)=>s+x.quantity,0),24)
})
test('all invoice print formats include ordered boxes without blank seasonal rows',()=>{
 const a=source.indexOf('  const DELIVERY_INVOICE_PRODUCT_ORDER ='),b=source.indexOf('  function sortDeliveryInvoiceItems',a)
 const c=source.indexOf('  function getInvoiceProductOrderForItems('),d=source.indexOf(' function getDeliveryInvoicePrintData(',c)
 const ctx=vm.createContext({SEASONAL_BOXES,seasonalBoxFor})
 vm.runInContext(source.slice(a,b)+"\nfunction normalizeDonutVariantName(x){return String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'')}\n"+source.slice(c,d)+';this.rows=getInvoiceProductOrderForItems',ctx)
 assert(!ctx.rows([]).some(row=>seasonalBoxFor(row.label)))
 for(const box of SEASONAL_BOXES) assert(ctx.rows([{variant_name:box.name,quantity:1}]).some(row=>row.aliases.includes(box.name)))
})
test('main forecast expands selected invoices and internal transfers; production screen totals reconcile',()=>{
 const a=source.indexOf(' function getProductionForecastInvoices('),b=source.indexOf(' function openInvoiceDeletionCenter',a)
 const invoice={id:'sample',delivery_date:'2026-11-01',delivery_invoice_items:[...ordered,{variant_name:'Rings',variant_id:'ring-id',quantity:10}]}
 const ctx=vm.createContext({SEASONAL_BOXES,seasonalBoxFor,expandSeasonalProductionItems,seasonalPackingSummary,filterProductionForecastInvoices,sagsTransfersAsForecastDeliveries:()=>[],sagsTransfers:[],resellers:[],donutVariants:[...variants,...SEASONAL_BOXES.map(box=>({id:box.code,name:box.name}))],productionForecastExcludedInvoiceIds:[],deliveryInvoices:[invoice],forecastDate:'2026-11-01',safeNum:(n,d=0)=>Number.isFinite(Number(n))?Number(n):d,isInvoiceExcludedFromProductionForecast:()=>false,compareDonutVariantRowsByGuide:()=>0})
 vm.runInContext(source.slice(a,b),ctx)
 const x=source.indexOf(' const BITE_SIZE_DRY_PREMIX_GRAMS ='),y=source.indexOf(' const printForecast =',x)
 vm.runInContext(source.slice(x,y)+';this.result={rows:forecastRows,totalPieces,totalDryPremixG,seasonalPacking,smallDonutPieces}',ctx)
 assert.equal(ctx.result.totalPieces,34)
 assert.equal(ctx.result.totalDryPremixG,918)
 assert.equal(ctx.result.rows.find(row=>row.variant_name==='Shells').total,11)
 assert.equal(ctx.result.rows.find(row=>row.variant_name==='Rings').total,23)
 assert.equal(ctx.result.seasonalPacking.reduce((s,row)=>s+row.totalPieces,0),24)
 assert(!ctx.result.rows.some(row=>seasonalBoxFor(row)))
})
