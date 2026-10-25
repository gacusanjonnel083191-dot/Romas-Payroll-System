import {PH_TZ, COVERAGE, BRANCH_NAMES, PICKUP_LOCATIONS, phDate, availableSlots, feeForDistance, haversineKm, cartSubtotal} from './logic.mjs?v=pickup-locations-20261015';
import {PRODUCTS, findProduct, catalogCards} from './catalog.mjs?v=small-box-prices-20261015';
import {LIVE_ORDERING, liveCall, newOrderCredential, normalizeLiveOrder} from './live-client.mjs';
import {customerPaymentReceiptHtml} from './customer-receipt.mjs';

const KEY = 'romas-public-ordering-preview-v1';
const DELIVERY_RATE_VERSION = 2;
const APPROVED_DELIVERY_RATE = Object.freeze({minimumFee:80, perKm:10, includedKm:3});
// Approximate municipality centers for interaction design only. These are NOT Roma's branch pins.
const DEMO_CENTERS = {
  'Dagupan City':[16.043,120.334], 'Santa Barbara':[16.001,120.401], 'Binmaley':[16.032,120.270],
  'Mangaldan':[16.072,120.403],
  'Calasiao':[16.012,120.361], 'San Carlos':[15.927,120.349],
};
const tomorrow = () => {
  const today = phDate();
  return phDate(new Date(`${today}T12:00:00+08:00`).getTime() + 86400000);
};
const INITIAL = {
  settings:{...APPROVED_DELIVERY_RATE, deliveryRateVersion:DELIVERY_RATE_VERSION, branches:Object.fromEntries(BRANCH_NAMES.map(name => [name,{lat:DEMO_CENTERS[name][0],lng:DEMO_CENTERS[name][1],enabled:true}]))},
  orders:[{id:'DEMO-1001',sample:true,name:'Sample Customer',phone:'09•• ••• ••••',items:[{id:'double-choco',name:'Double Choco',quantity:6,unitPrice:25,unitLabel:'piece'},{id:'circlet-snow',name:'Snow Sprinkle Delight Circlet',quantity:4,unitPrice:13,unitLabel:'piece'}],type:'pickup',packaging:'box',date:tomorrow(),time:'10:00',branch:'Dagupan City',town:'Dagupan City',subtotal:202,deliveryFee:0,total:202,status:'accepted',address:'',landmark:'',pin:null,distanceKm:null,quoteBasis:'',createdAt:new Date().toISOString(),messages:[{from:'staff',text:'Your sample order is confirmed for tomorrow at 10:00 AM.',at:new Date().toISOString()}]}]
};
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data && Array.isArray(data.orders) && data.settings) {
      if (data.settings.deliveryRateVersion !== DELIVERY_RATE_VERSION) {
        Object.assign(data.settings, APPROVED_DELIVERY_RATE, {deliveryRateVersion:DELIVERY_RATE_VERSION});
      }
      return data;
    }
  } catch { /* Invalid preview data resets to the sample state. */ }
  return structuredClone(INITIAL);
}
let db = LIVE_ORDERING ? {settings:structuredClone(INITIAL.settings),orders:[]} : load();
let livePickupLocations = [];
let liveOrderingEnabled = false;
let liveConfigError = '';
let liveSubmitting = false;
let liveReceipts = [];
if(LIVE_ORDERING){
  try{const stored=JSON.parse(localStorage.getItem('romas-customer-order-receipts-v1')||'[]');liveReceipts=Array.isArray(stored)?stored:[];}
  catch{liveReceipts=[];}
}
let page = 'shop';
let staffView = 'orders';
let catalogMode = 'piece';
let searchTerm = '';
const boxPreviews = {};
let selectedId = db.orders[0]?.id || null;
let cart = {};
let draft = {type:'pickup',packaging:'box',date:phDate(),time:'',town:'Dagupan City',branch:'Dagupan City',name:'',phone:'',address:'',landmark:'',notes:'',pin:null,quote:null};
let map;
let marker;
let error = '';
let toastTimer;
const app = document.getElementById('app');
const money = n => `₱${Number(n || 0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const formatDate = value => value ? new Intl.DateTimeFormat('en-PH',{timeZone:PH_TZ,year:'numeric',month:'short',day:'numeric'}).format(new Date(`${value}T12:00:00+08:00`)) : '';
const formatTime = value => value ? new Intl.DateTimeFormat('en-PH',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:PH_TZ}).format(new Date(`2026-01-01T${value}:00+08:00`)) : '';
function save(){ if(!LIVE_ORDERING)localStorage.setItem(KEY,JSON.stringify(db)); }
function notify(message){ document.querySelector('.toast')?.remove(); const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.remove(),3500); }
function nav(to){ page=to; error=''; window.scrollTo({top:0,behavior:'smooth'}); render(); if(LIVE_ORDERING&&to==='orders')void refreshLiveOrders(); }
function cartCount(){ return Object.values(cart).reduce((a,b)=>a+b,0); }
function subtotal(){ return cartSubtotal(PRODUCTS,cart); }
function currentBranch(){ return db.settings.branches[draft.branch]; }
function suggestedBranch(pin){
  return BRANCH_NAMES.filter(name=>db.settings.branches[name]?.enabled).map(name=>({name,km:haversineKm(pin,db.settings.branches[name])})).sort((a,b)=>a.km-b.km)[0]?.name || '';
}
function quoteTotal(){ return subtotal()+(draft.type==='delivery' ? draft.quote?.fee || 0 : 0); }
function itemRows(items){ return items.map(item=>`<div class="summary-line"><span>${esc(item.name)} × ${item.quantity} ${esc(item.unitLabel||'')}</span><strong>${money(item.quantity*item.unitPrice)}</strong></div>`).join(''); }

function renderHeader(){return `<header class="topbar"><div class="top-inner"><div class="brand"><img src="./assets/logo.png" alt="Roma's Donuts logo"><span>Roma's Donuts</span></div><nav class="nav" aria-label="Preview navigation"><button data-nav="shop" class="${page==='shop'||page==='checkout'?'active':''}">Order online</button><button data-nav="orders" class="${page==='orders'?'active':''}">My orders</button><button data-nav="staff" class="staff ${page==='staff'?'active':''}">Staff dashboard</button></nav></div></header><div class="demo-ribbon">${LIVE_ORDERING?'PICKUP ORDERING · Orders are saved by Roma’s Donuts':'INTERACTIVE PREVIEW · Menu prices from your uploaded sheets · Orders stay in this browser'}</div>`;}
function productArt(p){
  return `<div class="product-art clean-product-art"><img class="clean-product-photo" src="${esc(p.cleanImage)}" alt="${esc(p.name)}" loading="lazy" width="512" height="512"></div>`;
}
function quantityEditor(p){return `<div class="qty-editor"><button data-action="dec" data-id="${p.id}" aria-label="Remove one ${esc(p.name)}">−</button><input data-qty="${p.id}" aria-label="Quantity of ${esc(p.name)}" type="number" min="0" max="999" step="1" value="${cart[p.id]||0}"><button data-action="add" data-id="${p.id}" aria-label="Add one ${esc(p.name)}">+</button></div><div class="line-total">Total: <strong data-line-total="${p.id}">${money((cart[p.id]||0)*p.price)}</strong></div>`;}
function productCard(p){
  if(p.variants){
    const selected=p.variants.find(variant=>variant.id===boxPreviews[p.id])||p.variants[0];
    const hasSizePhotos=new Set(p.variants.map(variant=>variant.cleanImage)).size>1;
    return `<article class="product-card box-group-card">${productArt({...p,cleanImage:selected.cleanImage,name:selected.name})}<div class="product-content"><h3>${esc(p.name)}</h3><div class="box-options">${p.variants.map(variant=>`<section class="box-option" aria-label="${esc(variant.name)}"><div class="box-option-heading">${hasSizePhotos?`<button type="button" class="box-size-preview" data-box-photo="${variant.id}" data-box-group="${p.id}" aria-pressed="${selected.id===variant.id}" aria-label="View ${esc(variant.name)} box photo">${esc(variant.optionLabel)}</button>`:`<span>${esc(variant.optionLabel)}</span>`}<strong>${money(variant.price)}</strong></div>${quantityEditor(variant)}</section>`).join('')}</div></div></article>`;
  }
  return `<article class="product-card">${productArt(p)}<div class="product-content"><h3>${esc(p.name)}</h3><div class="product-bottom"><span class="price">${money(p.price)}<small> / ${esc(p.unitLabel)}</small></span></div>${quantityEditor(p)}</div></article>`;
}
function hasLoosePieces(){return PRODUCTS.some(p=>p.type==='piece'&&cart[p.id]>0);}
function packagingPicker(){return hasLoosePieces()?`<div class="packaging-picker"><strong>Packaging for loose pieces</strong><div class="choice-row"><button type="button" class="choice ${draft.packaging==='box'?'active':''}" data-packaging="box">📦 Box</button><button type="button" class="choice ${draft.packaging==='paper_bag'?'active':''}" data-packaging="paper_bag">🛍 Paper bag</button></div><p class="hint">Prepacked box sets include their box. No separate packaging price was listed in the uploaded menu.</p></div>`:'<p class="hint">Box sets already include their box.</p>';}
function cartPanel(){const rows=PRODUCTS.filter(p=>cart[p.id]>0).map(p=>`<div class="cart-row"><span class="name">${esc(p.name)}<br><small>${money(p.price)} / ${esc(p.unitLabel)}</small></span><span class="qty-controls"><button data-action="dec" data-id="${p.id}" aria-label="Remove one ${esc(p.name)}">−</button><strong data-cart-qty="${p.id}">${cart[p.id]}</strong><button data-action="add" data-id="${p.id}" aria-label="Add one ${esc(p.name)}">+</button></span></div>`).join('');return `<aside class="cart-panel"><h3>Your order <span class="pill" data-cart-count>${cartCount()} ${cartCount()===1?'item':'items'}</span></h3>${rows||'<div class="empty">Start with something sweet. Your picks will appear here.</div>'}<div class="money-row total"><span>Subtotal</span><span data-subtotal>${money(subtotal())}</span></div>${cartCount()?packagingPicker():''}<p class="hint">${LIVE_ORDERING?'Pickup orders only. Pay when you receive your order.':'Delivery fee is calculated at checkout. Pay when you receive your order.'}</p><button class="btn btn-primary wide" data-nav="checkout" ${!cartCount()?'disabled':''}>Continue to checkout →</button></aside>`;}
function renderShop(){const visible=catalogCards(catalogMode,searchTerm);return `<main class="shell"><section class="hero"><div class="hero-content"><span class="eyebrow">Fresh moments start here</span><h1>Donuts for<br>every day.</h1><p>Choose your favorites, pick a future date or order for later today, and let Roma's Donuts take care of the rest.</p><div class="hero-cta"><button class="btn btn-yellow" data-action="scroll-menu">Explore the menu ↓</button><button class="btn btn-outline" data-nav="orders">Track an order</button></div></div><div class="hero-art"><img src="./assets/logo.png" alt="Roma's Donuts"></div></section><div class="benefits"><div class="benefit"><span class="icon">📅</span>Order today or schedule ahead</div><div class="benefit"><span class="icon">📍</span>Pickup or delivery in selected areas</div><div class="benefit"><span class="icon">💬</span>Chat with our team about your order</div></div><div class="section-head" id="menu"><div><span class="pill">ROMA'S DONUTS MENU</span><h2>Pick your favorites</h2><p>Per-piece and per-box prices from your uploaded sheets.</p></div></div><div class="catalog-tabs"><button class="${catalogMode==='piece'?'active':''}" data-catalog="piece">Per piece</button><button class="${catalogMode==='box'?'active':''}" data-catalog="box">Per box</button><input id="menu-search" type="search" placeholder="Search the menu…" value="${esc(searchTerm)}" aria-label="Search menu"></div><div class="catalog-layout"><div class="product-grid">${visible.length?visible.map(productCard).join(''):'<div class="empty">No matching menu items.</div>'}</div>${cartPanel()}</div></main>`;}
function field(label,name,placeholder='',required=false,type='text',extra=''){return `<div class="field"><label for="${name}">${label}${required?' *':''}</label><input id="${name}" name="${name}" data-field="${name}" type="${type}" placeholder="${placeholder}" value="${esc(draft[name]||'')}" ${required?'required':''} ${extra}></div>`;}
function deliverySection(){
  if(draft.type!=='delivery') return '';
  const q=draft.quote;
  return `<div class="panel"><h3>Delivery location</h3><div class="field"><label for="town">City / municipality *</label><select id="town" name="town" data-field="town">${COVERAGE.map(name=>`<option ${draft.town===name?'selected':''}>${name}</option>`).join('')}</select></div><p class="hint">Drag the pin or tap the map to mark the exact drop-off point. Coverage boundaries are not verified in this preview.</p><div class="map" id="location-map"><div class="map-fallback">Map loading…<br>Coordinates can also be entered below.</div></div><div class="field-grid">${field('Latitude','lat','16.000000',true,'number','step="any" min="-90" max="90"')}${field('Longitude','lng','120.000000',true,'number','step="any" min="-180" max="180"')}</div><button type="button" class="btn btn-ghost" data-action="locate">◎ Use my current location</button><div style="height:14px"></div>${field('Full delivery address','address','Street, barangay, house/building',true)}${field('Landmark','landmark','What should the rider look for?',true)}<div class="quote-box"><strong>Suggested branch:</strong> ${esc(draft.branch||'Choose a location')}<br>${q?`<strong>Approx. straight-line distance:</strong> ${q.km.toFixed(1)} km · <strong>Estimated delivery fee:</strong> ${money(q.fee)}<br><small>${esc(q.basis)}. ${money(db.settings.minimumFee)} covers the first ${db.settings.includedKm} km; each additional started km adds ${money(db.settings.perKm)}. Staff must confirm the actual road distance and final fee.</small>`:'Set your pin to see an estimated delivery fee.'}</div></div>`;
}
function renderCheckout(){
  if(!cartCount()) return `<main class="shell"><div class="page-head"><h1>Your box is empty</h1><p>Add donuts before checking out.</p></div><button class="btn btn-primary" data-nav="shop">Browse the menu</button></main>`;
  const selectedHours=LIVE_ORDERING?livePickupLocations.find(location=>location.name===draft.branch)?.hours:null;
  const slots=LIVE_ORDERING?availableSlots(draft.date,new Date(),60,selectedHours||null):availableSlots(draft.date);
  if(!slots.includes(draft.time)) draft.time=slots[0]||'';
  const fulfillment = `<div class="panel"><h3>1. Pickup or delivery</h3><div class="choice-row"><button type="button" class="choice ${draft.type==='pickup'?'active':''}" data-type="pickup">🏬 &nbsp; Pickup<br><small>Collect at a pickup location</small></button><button type="button" class="choice ${draft.type==='delivery'?'active':''}" data-type="delivery" ${LIVE_ORDERING?'disabled':''}>🛵 &nbsp; Delivery<br><small>${LIVE_ORDERING?'Unavailable until routes are verified':'We bring it to you'}</small></button></div>${draft.type==='pickup'?`<div class="field" style="margin-top:17px"><label for="branch">Pickup location</label><select id="branch" data-field="branch" name="branch">${(LIVE_ORDERING?livePickupLocations.map(location=>location.name):PICKUP_LOCATIONS).map(name=>`<option ${draft.branch===name?'selected':''}>${esc(name)}</option>`).join('')}</select><small class="hint">${LIVE_ORDERING?esc(livePickupLocations.find(location=>location.name===draft.branch)?.address||'No verified pickup locations are available yet.'):'Exact branch addresses will appear after Roma’s Donuts configures them.'}</small></div>`:''}</div>`;
  const schedule = `<div class="panel"><h3>2. Date and time</h3><div class="field-grid"><div class="field"><label for="date">Order date *</label><input id="date" data-field="date" name="date" type="date" min="${phDate()}" value="${esc(draft.date)}" required></div><div class="field"><label for="time">${draft.type==='delivery'?'Delivery':'Pickup'} time *</label><select id="time" data-field="time" name="time" required>${slots.length?slots.map(time=>`<option value="${time}" ${draft.time===time?'selected':''}>${formatTime(time)}</option>`).join(''):'<option value="">No available times — choose another date</option>'}</select></div></div><p class="hint">${LIVE_ORDERING?`Pickup hours: ${esc(selectedHours?.label||'unavailable')}.`:'Available from 8:00 AM–5:00 PM, Philippine time.'} Same-day orders need at least one hour of notice.</p></div>`;
  const packaging = `<div class="panel"><h3>3. Packaging</h3>${packagingPicker()}</div>`;
  const details = `<div class="panel"><h3>4. Your details</h3><div class="field-grid">${field('Full name','name','Your name',true)}${field('Mobile number','phone','09XXXXXXXXX',true,'tel')}</div><div class="field"><label for="notes">Notes for the team</label><textarea id="notes" name="notes" data-field="notes" placeholder="Any helpful details?">${esc(draft.notes)}</textarea></div><p class="hint">Payment is due when you receive your order. The team will confirm availability and your requested time.</p></div>`;
  const summary = PRODUCTS.filter(p=>cart[p.id]>0).map(p=>`<div class="summary-line"><span>${esc(p.name)} × ${cart[p.id]} ${esc(p.unitLabel)}</span><strong>${money(p.price*cart[p.id])}</strong></div>`).join('');
  return `<main class="shell"><button class="back" data-nav="shop">← Back to menu</button><div class="page-head"><h1>Make it your moment</h1><p>Choose how and when to enjoy your donuts.</p></div><div class="checkout-layout"><div><form id="order-form">${fulfillment}${schedule}${deliverySection()}${packaging}${details}${liveConfigError?`<div class="error" role="alert">${esc(liveConfigError)}</div>`:''}${error?`<div class="error" role="alert">${esc(error)}</div>`:''}<button class="btn btn-primary wide" type="submit" ${LIVE_ORDERING&&(liveSubmitting||!liveOrderingEnabled||!livePickupLocations.length)?'disabled':''}>${liveSubmitting?'Sending…':'Send order request →'}</button></form></div><aside class="cart-panel"><h3>Order summary</h3>${summary}<div class="money-row"><span>Subtotal</span><strong>${money(subtotal())}</strong></div><div class="money-row"><span>Packaging</span><strong>${hasLoosePieces()?draft.packaging==='box'?'Box':'Paper bag':'Box sets'}</strong></div><div class="money-row"><span>${draft.type==='delivery'?'Estimated delivery fee':'Delivery fee'}</span><strong>${draft.type==='pickup'?money(0):draft.quote?money(draft.quote.fee):'Set pin'}</strong></div><div class="money-row total"><span>${draft.type==='delivery'?'Estimated total':LIVE_ORDERING?'Order total':'Preview total'}</span><span>${draft.type==='delivery'&&!draft.quote?'—':money(quoteTotal())}</span></div><p class="hint">${LIVE_ORDERING?'Pickup availability and prices are checked again when you submit. Staff will confirm your order.':`The current preview rate is ${money(db.settings.minimumFee)} for the first ${db.settings.includedKm} km plus ${money(db.settings.perKm)} per additional started km. The displayed fee uses approximate branch pins and straight-line distance; staff must confirm the road route and final charge. This preview does not create a live order.`}</p></aside></div></main>`;
}
function orderTile(order){return `<button class="order-tile ${selectedId===order.id?'active':''}" data-select="${esc(order.id)}"><strong>${esc(order.orderCode||order.id)} ${order.sample?'<span class="pill">SAMPLE</span>':''}</strong><small>${formatDate(order.date)} · ${formatTime(order.time)} · ${esc(order.type)}</small><br><span class="status ${order.status}">${esc(order.status.replaceAll('_',' '))}</span></button>`;}
function chatBox(order,from){return `<div class="chat"><div class="chat-messages">${order.messages.length?order.messages.map(m=>`<div class="bubble ${m.from===from?'me':''}"><strong>${m.from==='staff'?'Roma’s team':'Customer'}</strong><div>${esc(m.text)}</div><small>${new Intl.DateTimeFormat('en-PH',{timeZone:PH_TZ,hour:'numeric',minute:'2-digit',month:'short',day:'numeric'}).format(new Date(m.at))}</small></div>`).join(''):'<div class="hint">Start a conversation about this order.</div>'}</div><form class="chat-form" data-chat="${esc(order.id)}" data-from="${from}"><input name="message" maxlength="500" placeholder="Write a message about this order…" required aria-label="Chat message"><button class="btn btn-primary" type="submit">Send</button></form></div>`;}
function orderDetail(order,from){const loosePieces=order.items.some(item=>item.unitLabel==='piece');return `<div class="panel"><div class="detail-top"><div><h2>Order ${esc(order.orderCode||order.id)}</h2><p class="hint">${esc(order.name)} · ${esc(order.phone)}</p></div><span class="status ${order.status}">${esc(order.status.replaceAll('_',' '))}</span></div><div class="summary-line"><span>When</span><strong>${formatDate(order.date)}, ${formatTime(order.time)}</strong></div><div class="summary-line"><span>Fulfillment</span><strong>${esc(order.type)} · ${esc(order.branch)}</strong></div><div class="summary-line"><span>Packaging</span><strong>${loosePieces?order.packaging==='paper_bag'?'Paper bag for loose pieces':'Box for loose pieces':'Prepacked box sets'}</strong></div>${order.type==='delivery'?`<div class="summary-line"><span>Location</span><strong>${esc(order.address)}, ${esc(order.town)}</strong></div><div class="summary-line"><span>Landmark</span><strong>${esc(order.landmark)}</strong></div>${order.pin?`<p><a target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/?mlat=${order.pin.lat}&mlon=${order.pin.lng}#map=16/${order.pin.lat}/${order.pin.lng}">Open delivery pin ↗</a></p>`:''}`:''}<h3 style="margin-top:24px">Items</h3>${itemRows(order.items)}<div class="money-row"><span>${order.type==='delivery'?'Estimated delivery fee':'Delivery fee'}</span><strong>${money(order.deliveryFee)}</strong></div><div class="money-row total"><span>${order.type==='delivery'?'Estimated total':'Total on receipt'}</span><strong>${money(order.total)}</strong></div>${order.type==='delivery'?'<p class="hint">The delivery fee and total are estimates until staff confirms the road route and final charge.</p>':''}<h3 style="margin-top:24px">Order chat</h3>${chatBox(order,from)}${from==='customer'?`<p class="footnote">${LIVE_ORDERING?'Keep your order access link private. Anyone with it can view this order.':'Preview only: all orders and messages are stored in this browser. Customer identity verification is required before public launch.'}</p>`:''}</div>`;}
function customerOrderDetail(order){
  const payment=LIVE_ORDERING ? order.paymentStatus==='paid'
    ? order.receipt?.saleId && order.paidAt
      ? `<div class="receipt-action"><strong>Payment received</strong><p class="hint">Recorded ${esc(new Intl.DateTimeFormat('en-PH',{timeZone:PH_TZ,dateStyle:'medium',timeStyle:'short'}).format(new Date(order.paidAt)))} via ${esc(order.receipt.paymentMethod)}.</p><button class="btn btn-primary" data-print-receipt="${esc(order.id)}">Print customer payment receipt</button></div>`
      : '<div class="receipt-action"><strong>Receipt unavailable</strong><p class="hint">The payment record needs staff review before a receipt can be printed.</p></div>'
    : '<div class="receipt-action"><strong>Payment pending</strong><p class="hint">Your order reference confirms the request. A payment receipt becomes available after Roma’s team records full payment.</p></div>' : '';
  return orderDetail(order,'customer').replace('Total on receipt','Order total')
    .replace('<h3 style="margin-top:24px">Order chat</h3>', `${payment}<h3 style="margin-top:24px">Order chat</h3>`);
}
function renderOrders(){const orders=[...db.orders].reverse();const selected=db.orders.find(o=>o.id===selectedId)||orders[0];return `<main class="shell"><div class="page-head"><h1>My orders</h1><p>Follow your request and talk with Roma's team.</p></div><div class="order-grid"><div class="order-list">${orders.length?orders.map(orderTile).join(''):'<div class="empty">No orders yet. Your first sweet moment is waiting.</div>'}<button class="btn btn-primary" data-nav="shop">+ Start a new order</button></div>${selected?customerOrderDetail(selected):''}</div></main>`;}
function renderStaff(){const counts={pending:db.orders.filter(o=>o.status==='pending_confirmation').length,scheduled:db.orders.filter(o=>['accepted','preparing'].includes(o.status)).length,activeChat:db.orders.filter(o=>o.messages.at(-1)?.from==='customer').length,today:db.orders.filter(o=>o.date===phDate()).length};const selected=db.orders.find(o=>o.id===selectedId)||db.orders.at(-1);return `<main class="shell"><div class="page-head"><span class="pill">STAFF PREVIEW</span><h1>Order command center</h1><p>Review requests, manage preparation and reply to customers. This dashboard is a browser-only demo.</p></div><div class="metric-grid"><div class="metric"><strong>${counts.pending}</strong><span>Need confirmation</span></div><div class="metric"><strong>${counts.scheduled}</strong><span>Accepted / preparing</span></div><div class="metric"><strong>${counts.today}</strong><span>Scheduled today</span></div><div class="metric"><strong>${counts.activeChat}</strong><span>Customer replies to review</span></div></div><div class="staff-layout"><div class="staff-sidebar"><button data-staff="orders" class="${staffView==='orders'?'active':''}">▤ &nbsp; Order queue</button><button data-staff="selected" class="${staffView==='selected'?'active':''}">◉ &nbsp; Selected order</button><button data-staff="settings" class="${staffView==='settings'?'active':''}">⚙ &nbsp; Delivery settings</button><div class="quote-box">Live integration will place accepted customer orders into production planning and completed paid orders into sales once. It is not connected in this preview.</div></div><div>${staffView==='orders'?`<div class="panel"><h3>Customer requests</h3><div class="table-wrap"><table class="orders-table"><thead><tr><th>Order</th><th>Customer</th><th>Date & time</th><th>Branch</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>${[...db.orders].reverse().map(o=>`<tr><td><strong>${esc(o.id)}</strong>${o.sample?'<br><small>Sample</small>':''}</td><td>${esc(o.name)}</td><td>${formatDate(o.date)}<br>${formatTime(o.time)}</td><td>${esc(o.branch)}</td><td>${money(o.total)}</td><td><span class="status ${o.status}">${esc(o.status.replaceAll('_',' '))}</span></td><td><button data-open-staff="${esc(o.id)}">Open →</button></td></tr>`).join('')}</tbody></table></div></div>`:staffView==='settings'?settingsPanel():selected?`<div class="panel"><div class="field"><label for="status-update">Update status</label><select id="status-update" data-status="${esc(selected.id)}">${['pending_confirmation','accepted','preparing','ready','out_for_delivery','completed','declined','cancelled'].map(s=>`<option value="${s}" ${selected.status===s?'selected':''}>${s.replaceAll('_',' ')}</option>`).join('')}</select></div><p class="hint">Status changes in this preview are stored only in your browser.</p></div>${orderDetail(selected,'staff')}`:'<div class="empty">Choose an order.</div>'}</div></div></main>`;}
function settingsPanel(){const s=db.settings;return `<div class="panel"><h3>Delivery fee preview</h3><p class="hint">The default approved rate is ₱80 for the first 3 km plus ₱10 per additional started km. The values below can be adjusted for this local preview. Exact branch pins and road routing are still needed before live use.</p><form id="settings-form"><div class="field-grid"><div class="field"><label>Minimum fee (₱)</label><input type="number" name="minimumFee" min="0" step="0.01" value="${s.minimumFee}" required></div><div class="field"><label>Additional per started km (₱)</label><input type="number" name="perKm" min="0" step="0.01" value="${s.perKm}" required></div><div class="field"><label>Included kilometers</label><input type="number" name="includedKm" min="0" step="0.1" value="${s.includedKm}" required></div></div><h3>Branch pins</h3><p class="hint">Current positions are approximate municipality centers, not real shop coordinates.</p>${BRANCH_NAMES.map(name=>`<div class="settings-branch"><strong>${name}</strong><input type="number" step="any" name="lat:${name}" aria-label="${name} latitude" value="${s.branches[name].lat}"><input type="number" step="any" name="lng:${name}" aria-label="${name} longitude" value="${s.branches[name].lng}"></div>`).join('')}<button class="btn btn-primary" type="submit">Save preview settings</button></form></div>`;}
function render(){ if(map){map.remove();map=null;marker=null;}app.innerHTML=renderHeader()+(page==='shop'?renderShop():page==='checkout'?renderCheckout():page==='orders'?renderOrders():renderStaff())+`<footer class="footer"><strong>Roma's Donuts</strong> · ${LIVE_ORDERING?'Pickup orders are submitted for staff confirmation':'Customer ordering concept · Local interactive preview, not a live ordering service'}</footer>`;if(page==='checkout'&&draft.type==='delivery') setTimeout(initMap,0);}

function initMap(){const container=document.getElementById('location-map');if(!container||!window.L)return;const {L}=window;const center=draft.pin||{lat:DEMO_CENTERS[draft.town][0],lng:DEMO_CENTERS[draft.town][1]};container.innerHTML='';map=L.map(container).setView([center.lat,center.lng],draft.pin?14:12);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);if(draft.pin){marker=L.marker([draft.pin.lat,draft.pin.lng],{draggable:true}).addTo(map);marker.on('dragend',()=>setPin(marker.getLatLng()));}map.on('click',event=>setPin(event.latlng));setTimeout(()=>map?.invalidateSize(),150);}
function setPin(point){const lat=Number(point.lat),lng=Number(point.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return;draft.pin={lat,lng};draft.lat=lat.toFixed(6);draft.lng=lng.toFixed(6);draft.branch=suggestedBranch(draft.pin);draft.quote=null;const latInput=document.querySelector('[name="lat"]'),lngInput=document.querySelector('[name="lng"]');if(latInput)latInput.value=draft.lat;if(lngInput)lngInput.value=draft.lng;calculateQuote();}
function calculateQuote(renderAfter = true){const pin=draft.pin,branch=currentBranch();if(!pin||!branch)return;const km=haversineKm(branch,pin);draft.quote={km,fee:feeForDistance(km,db.settings.minimumFee,db.settings.perKm,db.settings.includedKm),basis:'Based on approximate branch-center pins and straight-line distance, not a road route'};if(renderAfter)render();}
async function refreshLiveConfig(){
  try{
    const result=await liveCall('config');
    livePickupLocations=result.pickupLocations;
    liveOrderingEnabled=result.orderingEnabled===true;
    liveConfigError=liveOrderingEnabled?'':'Customer ordering is not open yet.';
    draft.type='pickup';
    draft.branch=livePickupLocations.some(location=>location.name===draft.branch)?draft.branch:livePickupLocations[0]?.name||'';
  }catch(failure){liveConfigError=failure.message;livePickupLocations=[];liveOrderingEnabled=false;draft.branch='';}
  render();
}
async function refreshLiveOrders(){
  const results=await Promise.allSettled(liveReceipts.map(receipt=>liveCall('customer-get',receipt)));
  db.orders=results.filter(result=>result.status==='fulfilled').map(result=>normalizeLiveOrder(result.value.order));
  db.orders.sort((a,b)=>a.date.localeCompare(b.date));
  if(results.some(result=>result.status==='rejected'))error='Some orders could not be loaded. Please refresh to try again.';
  selectedId=db.orders.some(order=>order.id===selectedId)?selectedId:db.orders.at(-1)?.id||null;
  if(page==='orders')render();
}
async function submitLiveOrder(form){
  if(liveSubmitting)return;
  if(!liveOrderingEnabled){error='Customer ordering is not open yet.';render();return;}
  if(!draft.branch||!livePickupLocations.some(location=>location.name===draft.branch)){
    error='No verified pickup location is available yet.';render();return;
  }
  const selectedHours=livePickupLocations.find(location=>location.name===draft.branch)?.hours;
  if(!availableSlots(String(form.get('date')||''),new Date(),60,selectedHours||null).includes(String(form.get('time')||''))){
    error='Choose an available time during this pickup location’s open days and hours.';render();return;
  }
  liveSubmitting=true;error='';render();
  const pendingKey='romas-pending-order-credential-v1';
  let credential;
  try{credential=JSON.parse(sessionStorage.getItem(pendingKey)||'null');}catch{credential=null;}
  if(!credential){credential=newOrderCredential();sessionStorage.setItem(pendingKey,JSON.stringify(credential));}
  try{
    const result=await liveCall('submit',{
      ...credential,fulfillmentType:'pickup',pickupLocation:draft.branch,
      name:String(form.get('name')||''),phone:String(form.get('phone')||''),
      date:String(form.get('date')||''),time:String(form.get('time')||''),
      packaging:draft.packaging,notes:String(form.get('notes')||''),
      items:PRODUCTS.filter(product=>cart[product.id]>0).map(product=>({id:product.id,quantity:cart[product.id]})),
    });
    const receipt={orderCode:result.orderCode,accessToken:credential.accessToken};
    if(!liveReceipts.some(item=>item.orderCode===receipt.orderCode))liveReceipts.push(receipt);
    localStorage.setItem('romas-customer-order-receipts-v1',JSON.stringify(liveReceipts));
    sessionStorage.removeItem(pendingKey);
    cart={};
    nav('orders');
    notify(`Order ${result.orderCode} received for review`);
  }catch(failure){error=failure.message;render();}
  finally{liveSubmitting=false;}
}
async function sendLiveChat(form){
  const order=db.orders.find(item=>item.id===form.dataset.chat);
  const receipt=liveReceipts.find(item=>item.orderCode===order?.orderCode);
  const message=String(new FormData(form).get('message')||'').trim();
  if(!receipt||!message)return;
  try{
    await liveCall('customer-message',{...receipt,message});
    await refreshLiveOrders();
    notify('Message sent to Roma’s team');
  }catch(failure){notify(failure.message);}
}
function createOrder(form){if(LIVE_ORDERING){void submitLiveOrder(form);return;}error='';const name=String(form.get('name')||'').trim(),phone=String(form.get('phone')||'').trim();const date=String(form.get('date')||''),time=String(form.get('time')||'');if(!name||!/^\+?[0-9\s-]{10,16}$/.test(phone)){error='Please enter your name and a valid mobile number.';render();return;}if(!availableSlots(date).includes(time)){error='That time is no longer available. Choose a time at least one hour from now.';render();return;}if(draft.type==='delivery'&&(!draft.pin||!draft.quote||!String(form.get('address')||'').trim()||!String(form.get('landmark')||'').trim())){error='Set the delivery pin, address and landmark to continue.';render();return;}const id=`RD-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;const items=PRODUCTS.filter(p=>cart[p.id]>0).map(p=>({id:p.id,name:p.name,quantity:cart[p.id],unitPrice:p.price,unitLabel:p.unitLabel,piecesPerUnit:p.piecesPerUnit}));const order={id,name,phone,items,type:draft.type,packaging:hasLoosePieces()?draft.packaging:'box',date,time,branch:draft.branch,town:draft.town,subtotal:subtotal(),deliveryFee:draft.type==='delivery'?draft.quote.fee:0,total:quoteTotal(),status:'pending_confirmation',address:String(form.get('address')||'').trim(),landmark:String(form.get('landmark')||'').trim(),notes:String(form.get('notes')||'').trim(),pin:draft.type==='delivery'?draft.pin:null,distanceKm:draft.quote?.km||null,quoteBasis:draft.quote?.basis||'',createdAt:new Date().toISOString(),messages:[]};db.orders.push(order);save();selectedId=id;cart={};draft={type:'pickup',packaging:'box',date:phDate(),time:'',town:'Dagupan City',branch:'Dagupan City',name:'',phone:'',address:'',landmark:'',notes:'',pin:null,quote:null};nav('orders');notify(`Preview order ${id} received`);}

function updateLiveTotals(){document.querySelectorAll('[data-subtotal]').forEach(el=>{el.textContent=money(subtotal());});document.querySelectorAll('[data-cart-count]').forEach(el=>{el.textContent=`${cartCount()} ${cartCount()===1?'item':'items'}`;});document.querySelectorAll('[data-line-total]').forEach(el=>{const p=findProduct(el.dataset.lineTotal);if(p)el.textContent=money((cart[p.id]||0)*p.price);});}

app.addEventListener('click',event=>{const target=event.target.closest('button');if(!target)return;if(target.dataset.boxPhoto){boxPreviews[target.dataset.boxGroup]=target.dataset.boxPhoto;render();return;}if(target.dataset.nav){if(LIVE_ORDERING&&target.dataset.nav==='staff'){window.location.assign('/public-ordering-staff.html');return;}nav(target.dataset.nav);return;}if(target.dataset.action==='scroll-menu'){document.getElementById('menu')?.scrollIntoView({behavior:'smooth'});return;}if(target.dataset.catalog){catalogMode=target.dataset.catalog;searchTerm='';render();document.getElementById('menu')?.scrollIntoView();return;}if(target.dataset.packaging){draft.packaging=target.dataset.packaging;render();return;}if(target.dataset.action==='add'||target.dataset.action==='dec'){const id=target.dataset.id;const product=findProduct(id);if(!product)return;if(product.type==='box')boxPreviews[product.groupId]=id;cart[id]=Math.min(999,Math.max(0,(cart[id]||0)+(target.dataset.action==='add'?1:-1)));render();return;}if(target.dataset.type){draft.type=target.dataset.type;if(draft.type==='delivery'&&!BRANCH_NAMES.includes(draft.branch))draft.branch='Dagupan City';draft.quote=null;render();return;}if(target.dataset.select){selectedId=target.dataset.select;render();return;}if(target.dataset.staff){staffView=target.dataset.staff;render();return;}if(target.dataset.openStaff){selectedId=target.dataset.openStaff;staffView='selected';render();return;}if(target.dataset.action==='locate'){if(!navigator.geolocation){notify('Location is unavailable in this browser');return;}navigator.geolocation.getCurrentPosition(pos=>{setPin({lat:pos.coords.latitude,lng:pos.coords.longitude});notify('Pin placed at your current location');},()=>notify('Location permission was not granted'),{enableHighAccuracy:true,timeout:10000});}});
app.addEventListener('click',event=>{
  const button=event.target.closest('[data-print-receipt]');
  if(!button||!LIVE_ORDERING)return;
  const order=db.orders.find(item=>item.id===button.dataset.printReceipt);
  try{
    const html=customerPaymentReceiptHtml(order);
    const printWindow=window.open('','_blank','width=760,height=900');
    if(!printWindow)throw new Error('Allow pop-ups to open your payment receipt.');
    printWindow.opener=null;
    printWindow.document.open();printWindow.document.write(html);printWindow.document.close();
  }catch(failure){notify(failure.message);}
});
app.addEventListener('input',event=>{const el=event.target;if(el.dataset.qty){const qty=Math.min(999,Math.max(0,Math.floor(Number(el.value)||0)));cart[el.dataset.qty]=qty;updateLiveTotals();return;}if(el.id==='menu-search'){searchTerm=el.value;const start=el.selectionStart;render();const replacement=document.getElementById('menu-search');replacement?.focus();replacement?.setSelectionRange(start,start);return;}if(el.dataset.field&&el.dataset.field!=='lat'&&el.dataset.field!=='lng')draft[el.dataset.field]=el.value;});
app.addEventListener('change',event=>{const el=event.target;if(el.dataset.qty){const qty=Math.min(999,Math.max(0,Math.floor(Number(el.value)||0)));cart[el.dataset.qty]=qty;render();return;}if(el.dataset.status){const order=db.orders.find(o=>o.id===el.dataset.status);if(order){order.status=el.value;save();render();notify('Preview status updated');}return;}if(!el.dataset.field)return;draft[el.dataset.field]=el.value;if(el.dataset.field==='date'||el.dataset.field==='town'||el.dataset.field==='branch'){if(el.dataset.field==='town'){draft.pin=null;draft.quote=null;}if(el.dataset.field==='branch'&&draft.pin){draft.quote=null;calculateQuote();}else render();}if(el.dataset.field==='lat'||el.dataset.field==='lng'){const lat=Number(document.querySelector('[name="lat"]')?.value),lng=Number(document.querySelector('[name="lng"]')?.value);if(Number.isFinite(lat)&&Number.isFinite(lng)&&lat!==0&&lng!==0)setPin({lat,lng});}});
app.addEventListener('submit',event=>{event.preventDefault();const form=event.target;if(form.id==='order-form'){createOrder(new FormData(form));return;}if(form.dataset.chat){if(LIVE_ORDERING){void sendLiveChat(form);return;}const order=db.orders.find(o=>o.id===form.dataset.chat);const message=String(new FormData(form).get('message')||'').trim();if(order&&message){order.messages.push({from:form.dataset.from,text:message,at:new Date().toISOString()});save();render();document.querySelector('.chat-messages')?.scrollTo(0,99999);}return;}if(form.id==='settings-form'){const data=new FormData(form);const next={minimumFee:Number(data.get('minimumFee')),perKm:Number(data.get('perKm')),includedKm:Number(data.get('includedKm'))};if(Object.values(next).some(v=>!Number.isFinite(v)||v<0)){notify('Enter valid nonnegative fee values');return;}Object.assign(db.settings,next);for(const name of BRANCH_NAMES){const lat=Number(data.get(`lat:${name}`)),lng=Number(data.get(`lng:${name}`));if(Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180)db.settings.branches[name]={lat,lng,enabled:true};}if(draft.type==='delivery'&&draft.pin){draft.quote=null;draft.branch=suggestedBranch(draft.pin);if(draft.branch)calculateQuote(false);}save();notify('Preview settings saved');render();}});
window.addEventListener('storage',event=>{if(event.key===KEY){db=load();if(draft.type==='delivery'&&draft.pin){draft.quote=null;draft.branch=suggestedBranch(draft.pin);if(draft.branch)calculateQuote(false);}render();}});
render();
if(LIVE_ORDERING)void refreshLiveConfig();
