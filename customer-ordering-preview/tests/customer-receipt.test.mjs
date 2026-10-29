import test from 'node:test';
import assert from 'node:assert/strict';
import {customerPaymentReceiptHtml, customerRefundReceiptHtml} from '../customer-receipt.mjs';

const paidOrder={
  orderCode:'RD-2026-ABCDEF123456',name:'Test & Customer',branch:'Arellano St.',pickupAddress:'In front of Novo',
  date:'2026-10-26',time:'10:00',paymentStatus:'paid',paidAt:'2026-10-25T02:00:00Z',
  receipt:{saleId:'11111111-2222-4333-8444-555555555555',paymentMethod:'GCash',referenceNumber:'TEST-REF-001',amount:150},
  subtotal:150,deliveryFee:0,total:150,
  items:[{name:'Assorted Rings <6>',quantity:1,unitLabel:'box',unitPrice:150,lineTotal:150}],
};

test('paid online order creates a separate printable customer receipt',()=>{
  const html=customerPaymentReceiptHtml(paidOrder);
  assert.match(html,/Customer payment receipt/);
  assert.match(html,/RD-2026-ABCDEF123456/);
  assert.match(html,/11111111-2222-4333-8444-555555555555/);
  assert.match(html,/GCash/);
  assert.match(html,/TEST-REF-001/);
  assert.match(html,/₱150\.00/);
  assert.match(html,/Test &amp; Customer/);
  assert.match(html,/Assorted Rings &lt;6&gt;/);
  assert.doesNotMatch(html,/reseller invoice number/i);
});

test('unpaid or inconsistent orders cannot produce a paid receipt',()=>{
  assert.throws(()=>customerPaymentReceiptHtml({...paidOrder,paymentStatus:'unpaid'}),/paid customer order/);
  assert.throws(()=>customerPaymentReceiptHtml({...paidOrder,receipt:null}),/linked online sale/);
  assert.throws(()=>customerPaymentReceiptHtml({...paidOrder,receipt:{...paidOrder.receipt,amount:149}}),/invalid payment details/);
  assert.throws(()=>customerPaymentReceiptHtml({...paidOrder,total:151}),/invalid payment details/);
  assert.throws(()=>customerPaymentReceiptHtml({...paidOrder,items:[{...paidOrder.items[0],lineTotal:149}]}),/do not match/);
});

test('paid delivery receipt shows destination and the final quoted fee',()=>{
  const delivery={...paidOrder,type:'delivery',branch:null,pickupAddress:null,
    address:'123 Test Street',town:'Dagupan City',landmark:'Near test market',
    deliveryFee:90,total:240,receipt:{...paidOrder.receipt,amount:240}};
  const html=customerPaymentReceiptHtml(delivery);
  assert.match(html,/Scheduled delivery/);
  assert.match(html,/123 Test Street, Dagupan City/);
  assert.match(html,/Near test market/);
  assert.match(html,/₱90\.00/);
  assert.match(html,/₱240\.00/);
  assert.doesNotMatch(html,/Scheduled pickup/);
});

test('full refund has a separate printable confirmation without a paid badge',()=>{
  const refunded={...paidOrder,paymentStatus:'refunded',refundedAt:'2026-10-26T03:00:00Z',
    receipt:{...paidOrder.receipt,refund:{
      id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',paymentMethod:'GCash',
      referenceNumber:'REFUND-001',amount:-150,
    }}};
  const html=customerRefundReceiptHtml(refunded);
  assert.match(html,/Customer refund confirmation/);
  assert.match(html,/REFUNDED/);
  assert.match(html,/11111111-2222-4333-8444-555555555555/);
  assert.match(html,/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/);
  assert.match(html,/REFUND-001/);
  assert.match(html,/₱150\.00/);
  assert.doesNotMatch(html,/>PAID</);
  assert.throws(()=>customerRefundReceiptHtml({...refunded,receipt:{...refunded.receipt,refund:{...refunded.receipt.refund,amount:-149}}}),/invalid refund/);
  assert.throws(()=>customerRefundReceiptHtml({...refunded,receipt:{...refunded.receipt,refund:null}}),/linked reversal/);
});
