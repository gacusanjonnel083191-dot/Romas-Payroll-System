import test from 'node:test'
import assert from 'node:assert/strict'
import {customerRetailInvoiceHtml} from '../customer-invoice.mjs'

const invoice = {
  invoice_number:'RI-2026-ABCDEF123456',status:'active',
  issued_at:'2026-11-02T03:00:00Z',scheduled_at:'2026-11-03T03:00:00Z',
  customer_name:'Sample Customer',customer_phone:'09170000000',
  fulfillment_type:'delivery',dispatch_location:'Arellano St. (Novo)',
  delivery_address:'Sample Street',delivery_municipality:'Dagupan City',
  delivery_landmark:'Near school',distance_km:3.25,packaging:'box',
  order_notes:'Call on arrival',
  items:[{product_name:'Double Choco',quantity:2,unit_label:'piece',unit_price:25,line_total:50}],
  subtotal:50,delivery_fee:90,total:140,
}

test('retail order invoice includes prices and agreed delivery details',()=>{
  const html=customerRetailInvoiceHtml(invoice)
  for(const value of ['Sample Customer','Double Choco','Arellano St. (Novo)',
    'Sample Street','Near school','Call on arrival','₱90.00','₱140.00']) {
    assert.ok(html.includes(value),value)
  }
  assert.match(html,/separate from reseller invoices/)
  assert.match(html,/<header>.*<div class="invoice-meta"><strong>Invoice:<\/strong> RI-2026-ABCDEF123456<br><strong>Issued:/)
  assert.match(html,/<strong>Customer:<\/strong> Sample Customer · <strong>Contact:<\/strong> 09170000000/)
  assert.match(html,/<strong>Landmark:<\/strong> Near school · <strong>Road distance:<\/strong> 3.25 km/)
  assert.match(html,/<h2>Items<\/h2>/)
  assert.doesNotMatch(html,/Items at retail price/)
})

test('retail invoice rejects cancelled or mismatched snapshots and escapes text',()=>{
  assert.throws(()=>customerRetailInvoiceHtml({...invoice,status:'pending_removal'}),/active/)
  assert.throws(()=>customerRetailInvoiceHtml({...invoice,total:141}),/amounts/)
  assert.throws(()=>customerRetailInvoiceHtml({...invoice,items:[{...invoice.items[0],line_total:40}]}),/item amounts/)
  assert.ok(customerRetailInvoiceHtml({...invoice,customer_name:'<script>'}).includes('&lt;script&gt;'))
})

test('pickup invoice shows the pickup address and no delivery charge',()=>{
  const html=customerRetailInvoiceHtml({...invoice,fulfillment_type:'pickup',
    pickup_location:'Arellano St. (Novo)',pickup_address:'In front of Novo',
    delivery_fee:0,total:50})
  assert.match(html,/Pickup address:<\/strong> In front of Novo/)
  assert.match(html,/Delivery fee<\/span><span>₱0.00/)
  assert.doesNotMatch(html,/Delivery address:<\/strong>/)
})
