import test from 'node:test';
import assert from 'node:assert/strict';
import {availableSlots, feeForDistance, cartSubtotal, COVERAGE, BRANCH_NAMES, PICKUP_LOCATIONS} from '../logic.mjs';
import {PRODUCTS, findProduct, catalogCards} from '../catalog.mjs';
import {PICKUP_HOURS} from '../../supabase/functions/public-ordering/rules.mjs';

test('same-day slots respect one-hour lead time and 5 PM close', () => {
  const now = new Date('2026-10-13T15:10:00+08:00');
  assert.deepEqual(availableSlots('2026-10-13', now), ['16:30', '17:00']);
  assert.deepEqual(availableSlots('2026-10-14', now)[0], '08:00');
  assert.deepEqual(availableSlots('2026-10-12', now), []);
});

test('checkout slots match the four confirmed pickup schedules', () => {
  const now=new Date('2026-10-15T08:00:00+08:00');
  const slots=(name,date)=>availableSlots(date,now,60,PICKUP_HOURS[name]);
  const novo='Dagupan City - Arellano St. (Novo)';
  const pamma='Dagupan City - Perez Blvd. (PAMMA)';
  const school='Dagupan City - Malued (St. Albert School)';
  const gas='Dagupan City - Malued (Centrum Gas)';
  assert.equal(slots(novo,'2026-10-17')[0],'09:00');
  assert.equal(slots(novo,'2026-10-17').at(-1),'18:00');
  assert.deepEqual(slots(novo,'2026-10-18'),[]);
  assert.equal(slots(pamma,'2026-10-16')[0],'08:00');
  assert.equal(slots(pamma,'2026-10-16').at(-1),'17:00');
  assert.deepEqual(slots(pamma,'2026-10-17'),[]);
  assert.equal(slots(school,'2026-10-17').at(-1),'18:00');
  assert.deepEqual(slots(school,'2026-10-18'),[]);
  assert.equal(slots(gas,'2026-10-18').at(-1),'20:00');
  assert.deepEqual(availableSlots('2026-10-18',now,60,null),[]);
});

test('approved delivery rate charges each additional started kilometer', () => {
  assert.equal(feeForDistance(0, 80, 10, 3), 80);
  assert.equal(feeForDistance(3, 80, 10, 3), 80);
  assert.equal(feeForDistance(3.01, 80, 10, 3), 90);
  assert.equal(feeForDistance(5, 80, 10, 3), 100);
  assert.equal(feeForDistance(5.25, 80, 10, 3), 110);
  assert.equal(feeForDistance(8, 80, 10, 3), 130);
  assert.equal(feeForDistance(-1, 80, 10, 3), null);
});

test('pickup locations are alphabetical and stay separate from delivery coverage', () => {
  assert.deepEqual(PICKUP_LOCATIONS, [
    'Asingan', 'Binmaley', 'Calasiao', 'Dagupan City', 'Laoac', 'Mangaldan',
    'Mapandan', 'San Carlos', 'San Fabian', 'San Jacinto', 'San Manuel',
    'Santa Barbara', 'Santo Tomas', 'Sta Maria', 'Tayug', 'Urdaneta (Nancalobasaan)',
  ]);
  for (const name of ['Asingan', 'Laoac', 'Mapandan', 'San Fabian', 'San Jacinto',
    'San Manuel', 'Santo Tomas', 'Sta Maria', 'Tayug', 'Urdaneta (Nancalobasaan)']) {
    assert.equal(PICKUP_LOCATIONS.includes(name),true);
    assert.equal(COVERAGE.includes(name),false);
    assert.equal(BRANCH_NAMES.includes(name),false);
  }
  assert.deepEqual(COVERAGE,['Binmaley','Calasiao','Dagupan City','Mangaldan','Santa Barbara']);
});

test('cart subtotal uses quantities once', () => {
  assert.equal(cartSubtotal([{id:'a',price:25},{id:'b',price:13}], {a:2,b:3}), 89);
});

test('uploaded menu prices calculate mixed piece and box quantities', () => {
  assert.equal(findProduct('double-choco').price, 25);
  assert.equal(findProduct('circlet-snow').price, 13);
  assert.equal(findProduct('giant-donut').price, 219);
  assert.equal(findProduct('assorted-rings-6').price, 150);
  assert.equal(findProduct('assorted-circlets-20').price, 260);
  assert.equal(findProduct('bavarian-midnight-12').price, 336);
  assert.equal(findProduct('bavarian-pops-30').price, 180);
  assert.equal(findProduct('bavarian-pops-60').price, 360);
  assert.equal(cartSubtotal(PRODUCTS, {'double-choco':3,'assorted-rings-6':2}), 375);
  assert.equal(new Set(PRODUCTS.map(product => product.id)).size, PRODUCTS.length);
});

test('box cards group all sizes without losing or duplicating orderable products', () => {
  const cards = catalogCards('box');
  assert.equal(cards.length, 11);
  assert.deepEqual(cards.flatMap(card => card.variants.map(p => p.id)), PRODUCTS.filter(p => p.type === 'box').map(p => p.id));
  assert.deepEqual(cards.find(p => p.name === 'Assorted Rings').variants.map(p => [p.optionLabel,p.price]), [['6 pcs',150],['12 pcs',300]]);
  assert.deepEqual(cards.find(p => p.name === 'Assorted Circlets').variants.map(p => [p.optionLabel,p.price]), [['12 pcs',156],['20 pcs',260]]);
  assert.equal(cartSubtotal(PRODUCTS, {'assorted-rings-6':2,'assorted-rings-12':1,'assorted-circlets-20':1}), 860);
  assert.deepEqual(catalogCards('box','Bavarian Bites')[0].variants.map(p=>[p.id,p.optionLabel,p.price,p.piecesPerUnit]),[
    ['bavarian-bites-15','15 pcs',90,15],['bavarian-bites-30','30 pcs',180,30],
  ]);
  assert.equal(cartSubtotal(PRODUCTS,{'bavarian-bites-15':2,'bavarian-bites-30':1}),360);
  for (const name of ['Bavarian Bites','Bavarian Pops','Taro Pops','Strawberry Pops','Matcha Pops','Choco Balls']) {
    for (const variant of catalogCards('box',name).find(card=>card.name===name).variants) {
      assert.equal(variant.price,variant.piecesPerUnit*6,`${name} ${variant.optionLabel}`);
    }
  }
  assert.equal(findProduct('bavarian-bites-21'),undefined);
  assert.equal(findProduct('bavarian-bites-42'),undefined);
  assert.equal(catalogCards('box','nothing matches').length,0);
  assert.equal(findProduct('giant-donut').name,'Giant Donut (approx. 7x11 inches)');
  assert.notEqual(findProduct('bavarian-bites-15').cleanImage,findProduct('bavarian-bites').cleanImage);
});

test('only Shells receive new six- and twelve-piece box options', () => {
  assert.deepEqual(catalogCards('box').find(card=>card.name==='Shells').variants.map(p=>[p.id,p.price,p.piecesPerUnit]),[
    ['shells-6',156,6],['shells-12',312,12],
  ]);
  assert.equal(cartSubtotal(PRODUCTS,{'shells-6':2,'shells-12':1}),624);
  assert.equal(findProduct('shells-6').cleanImage,'./assets/flavor-boxes/shells-6-packed.png');
  for (const flavor of PRODUCTS.filter(p=>p.type==='piece')) {
    if (flavor.id==='bavarian-midnight'||flavor.id==='fanfans') continue;
    assert.equal(findProduct(`${flavor.id}-6`),undefined);
    assert.equal(findProduct(`${flavor.id}-12`),undefined);
  }
  assert.equal(findProduct('bavarian-midnight-6').price,168);
  assert.equal(findProduct('fanfans-12').price,396);
  assert.equal(findProduct('giant-bavarian-a'),undefined);
});
