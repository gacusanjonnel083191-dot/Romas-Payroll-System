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
});
