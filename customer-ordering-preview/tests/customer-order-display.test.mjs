import test from 'node:test';
import assert from 'node:assert/strict';
import {customerOrderAmounts, customerStatusLabel} from '../customer-order-display.mjs';

const money = value => `₱${Number(value).toFixed(2)}`;
const delivery = {type:'delivery', status:'pending_confirmation', paymentStatus:'unpaid',
  deliveryQuotedAt:null, deliveryFee:0, total:100};

test('a new delivery request explains the quote without suggesting it is confirmed', () => {
  assert.equal(customerStatusLabel(delivery.status), 'Request received');
  const display = customerOrderAmounts(delivery, money);
  assert.equal(display.fee, 'To be confirmed by Roma’s team');
  assert.equal(display.total, 'Awaiting delivery quote');
});

test('cancelled and declined unpaid requests show no pending quote or payment', () => {
  for (const status of ['cancelled', 'declined']) {
    const display = customerOrderAmounts({...delivery, status}, money);
    assert.equal(display.fee, 'Not charged');
    assert.equal(display.totalLabel, 'Amount due');
    assert.equal(display.total, '₱0.00');
    assert.match(display.note, /No payment is due/);
  }
  assert.equal(customerStatusLabel('cancelled'), 'Order cancelled');
  assert.equal(customerStatusLabel('declined'), 'Request declined');
});

test('paid or refunded closed orders retain their financial history', () => {
  for (const paymentStatus of ['paid', 'refunded']) {
    const display = customerOrderAmounts({...delivery, status:'cancelled',
      paymentStatus, deliveryQuotedAt:'2026-11-01T02:00:00Z', deliveryFee:80, total:180}, money);
    assert.equal(display.fee, '₱80.00');
    assert.equal(display.totalLabel, 'Original order total');
    assert.equal(display.total, '₱180.00');
  }
});
