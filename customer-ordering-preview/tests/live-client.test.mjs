import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLiveOrder} from '../live-client.mjs';

test('server order maps to the existing customer receipt view',()=>{
  const value=normalizeLiveOrder({
    id:'order-id',order_code:'RD-2026-ABCD1234EF56',customer_name:'Customer',customer_phone:'09123456789',
    scheduled_at:'2026-10-15T02:00:00.000Z',fulfillment_type:'pickup',pickup_location:'Dagupan City',
    delivery_municipality:null,delivery_address:null,delivery_landmark:null,packaging:'box',
    status:'pending_confirmation',payment_status:'unpaid',paid_at:null,subtotal:'25.00',delivery_fee:'0.00',total:'25.00',
    items:[{product_id:'double-choco',product_name:'Double Choco',quantity:1,unit_label:'piece',unit_price:'25.00',line_total:'25.00'}],
    messages:[],
  });
  assert.equal(value.date,'2026-10-15');
  assert.equal(value.time,'10:00');
  assert.equal(value.total,25);
  assert.equal(value.items[0].unitPrice,25);
  assert.equal(value.items[0].lineTotal,25);
  assert.equal(value.paymentStatus,'unpaid');
  assert.equal(value.receipt,null);
});

test('paid order retains its linked online sale details',()=>{
  const value=normalizeLiveOrder({
    id:'paid-id',order_code:'RD-2026-ABCDEF123456',customer_name:'Customer',customer_phone:'09123456789',
    scheduled_at:'2026-10-26T02:00:00.000Z',fulfillment_type:'pickup',pickup_location:'Arellano St.',
    pickup_address_snapshot:'In front of Novo',packaging:'box',status:'accepted',payment_status:'paid',
    paid_at:'2026-10-25T02:00:00Z',subtotal:'150.00',delivery_fee:'0.00',total:'150.00',
    receipt:{sale_id:'11111111-2222-4333-8444-555555555555',payment_method:'Cash',reference_number:null,amount:'150.00'},
    items:[{product_id:'assorted-rings-6',product_name:'Assorted Rings',quantity:1,unit_label:'box',unit_price:'150.00',line_total:'150.00'}],
    messages:[],
  });
  assert.equal(value.receipt.saleId,'11111111-2222-4333-8444-555555555555');
  assert.equal(value.receipt.paymentMethod,'Cash');
  assert.equal(value.receipt.amount,150);
});
