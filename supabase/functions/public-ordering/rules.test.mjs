import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from './catalog.json' with {type:'json'};
import {DELIVERY_COVERAGE, validateSchedule, pricedItems, validPhone, validRequestId, validAccessToken} from './rules.mjs';
import {PRODUCTS} from '../../../customer-ordering-preview/catalog.mjs';

test('server catalog matches every preview SKU and price', () => {
  assert.deepEqual(catalog, PRODUCTS.map(({id,name,price,unitLabel,piecesPerUnit,type}) =>
    ({id,name,price,unitLabel,piecesPerUnit,type})));
});

test('the server recalculates quantities and rejects altered prices', () => {
  const result = pricedItems([{id:'double-choco',quantity:2,price:1},{id:'shells-6',quantity:1,price:1}],catalog);
  assert.equal(result.subtotal,206);
  assert.equal(result.lines[0].price,25);
  assert.equal(pricedItems([{id:'unknown',quantity:1}],catalog),null);
  assert.equal(pricedItems([{id:'double-choco',quantity:1},{id:'double-choco',quantity:1}],catalog),null);
  assert.equal(pricedItems([{id:'double-choco',quantity:0}],catalog),null);
  assert.equal(pricedItems([{id:'double-choco',quantity:1000}],catalog),null);
});

test('schedule validates Manila time and one-hour lead', () => {
  const now = new Date('2026-10-15T08:00:00+08:00');
  assert.equal(validateSchedule('2026-10-15','09:00',now),'2026-10-15T01:00:00.000Z');
  assert.equal(validateSchedule('2026-10-15','08:30',now),null);
  assert.equal(validateSchedule('2026-02-30','10:00',now),null);
  assert.equal(validateSchedule('2026-10-15','17:30',now),null);
  assert.equal(validateSchedule('2026-10-15','07:30',now),null);
});

test('request credentials and delivery coverage are constrained', () => {
  assert(validPhone('09123456789'));
  assert(!validPhone('123'));
  assert(validRequestId('6f21cd16-4b55-41cc-95e8-4fd76094b4bc'));
  assert(validAccessToken('a'.repeat(64)));
  assert(!DELIVERY_COVERAGE.includes('Mapandan'));
  assert(!DELIVERY_COVERAGE.includes('San Jacinto'));
});
