import test from 'node:test';
import assert from 'node:assert/strict';
import {customerPaymentReceiptHtml} from '../customer-receipt.mjs';

const paidOrder={
  orderCode:'RD-2026-ABCDEF123456',name:'Test & Customer',branch:'Arellano St.',pickupAddress:'In front of Novo',
  date:'2026-10-26',time:'10:00',paymentStatus:'paid',paidAt:'2026-10-25T02:00:00Z',
  subtotal:150,deliveryFee:0,total:150,
  items:[{name:'Assorted Rings <6>',quantity:1,unitLabel:'box',unitPrice:150,lineTotal:150}],
};

test('paid online order creates a separate printable customer receipt',()=>{
  const html=customerPaymentReceiptHtml(paidOrder);
  assert.match(html,/Customer payment receipt/);
  assert.match(html,/RD-2026-ABCDEF123456/);
  assert.match(html,/₱150\.00/);
  assert.match(html,/Test &amp; Customer/);
  assert.match(html,/Assorted Rings &lt;6&gt;/);
  assert.doesNotMatch(html,/reseller invoice number/i);
});

test('unpaid or inconsistent orders cannot produce a paid receipt',()=>{
  assert.throws(()=>customerPaymentReceiptHtml({...paidOrder,paymentStatus:'unpaid'}),/paid customer order/);
  assert.throws(()=>customerPaymentReceiptHtml({...paidOrder,total:151}),/do not match/);
  assert.throws(()=>customerPaymentReceiptHtml({...paidOrder,items:[{...paidOrder.items[0],lineTotal:149}]}),/do not match/);
});
