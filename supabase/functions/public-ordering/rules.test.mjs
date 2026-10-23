import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from './catalog.json' with {type:'json'};
import {DELIVERY_COVERAGE, PICKUP_HOURS, validatePickupSchedule, pricedItems, validPhone, validRequestId, validAccessToken} from './rules.mjs';
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

test('server enforces each pickup point’s Manila days, hours and one-hour lead', () => {
  const now = new Date('2026-10-15T08:00:00+08:00');
  const novo='Dagupan City - Arellano St. (Novo)';
  const pamma='Dagupan City - Perez Blvd. (PAMMA)';
  const school='Dagupan City - Malued (St. Albert School)';
  const gas='Dagupan City - Malued (Centrum Gas)';
  assert.equal(Object.keys(PICKUP_HOURS).length,4);
  assert.equal(validatePickupSchedule(novo,'2026-10-15','09:00',now),'2026-10-15T01:00:00.000Z');
  assert.equal(validatePickupSchedule(novo,'2026-10-15','08:30',now),null);
  assert(validatePickupSchedule(novo,'2026-10-17','18:00',now)); // Saturday close
  assert.equal(validatePickupSchedule(novo,'2026-10-18','10:00',now),null); // Sunday
  assert.equal(validatePickupSchedule(pamma,'2026-10-17','10:00',now),null); // Saturday
  assert(validatePickupSchedule(pamma,'2026-10-16','17:00',now));
  assert.equal(validatePickupSchedule(pamma,'2026-10-16','17:30',now),null);
  assert(validatePickupSchedule(school,'2026-10-17','18:00',now));
  assert.equal(validatePickupSchedule(school,'2026-10-18','10:00',now),null);
  assert(validatePickupSchedule(gas,'2026-10-18','20:00',now)); // Sunday close
  assert.equal(validatePickupSchedule(gas,'2026-10-18','20:30',now),null);
  assert.equal(validatePickupSchedule(gas,'2026-02-30','10:00',now),null);
  assert.equal(validatePickupSchedule(gas,'2026-10-15','07:30',now),null);
  assert.equal(validatePickupSchedule('Dagupan City','2026-10-16','10:00',now),null);
});

test('request credentials and delivery coverage are constrained', () => {
  assert(validPhone('09123456789'));
  assert(!validPhone('123'));
  assert(validRequestId('6f21cd16-4b55-41cc-95e8-4fd76094b4bc'));
  assert(validAccessToken('a'.repeat(64)));
  assert(!DELIVERY_COVERAGE.includes('Mapandan'));
  assert(!DELIVERY_COVERAGE.includes('San Jacinto'));
});
