export const DELIVERY_COVERAGE = ['Binmaley', 'Calasiao', 'Dagupan City', 'Mangaldan', 'Santa Barbara'];

// Confirmed customer pickup hours, in Asia/Manila. Sunday is 0.
export const PICKUP_HOURS = Object.freeze({
  'Dagupan City - Arellano St. (Novo)': {days:[1,2,3,4,5,6], open:'09:00', close:'18:00', label:'Monday–Saturday, 9:00 AM–6:00 PM'},
  'Dagupan City - Perez Blvd. (PAMMA)': {days:[1,2,3,4,5], open:'08:00', close:'17:00', label:'Monday–Friday, 8:00 AM–5:00 PM'},
  'Dagupan City - Malued (St. Albert School)': {days:[1,2,3,4,5,6], open:'09:00', close:'18:00', label:'Monday–Saturday, 9:00 AM–6:00 PM'},
  'Dagupan City - Malued (Centrum Gas)': {days:[0,1,2,3,4,5,6], open:'08:00', close:'20:00', label:'Daily, 8:00 AM–8:00 PM'},
});

export function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function earliestOrderDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const today = `${values.year}-${values.month}-${values.day}`;
  const daysAhead = now.getTime() >= Date.parse(`${today}T15:00:00+08:00`) ? 2 : 1;
  return new Date(Date.parse(`${today}T12:00:00+08:00`) + daysAhead * 86_400_000).toISOString().slice(0,10);
}

export function isOrderDateAllowed(date, now = new Date()) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= earliestOrderDate(now);
}

export function validateSchedule(date, time, now = new Date()) {
  if (!isOrderDateAllowed(date, now)) return null;
  if (typeof time !== 'string' || !/^(0[8-9]|1[0-9]):(00|30)$|^20:00$/.test(time)) return null;
  const scheduled = new Date(`${date}T${time}:00+08:00`);
  if (Number.isNaN(scheduled.getTime())) return null;
  const dateInManila = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(scheduled);
  if (dateInManila !== date) return null;
  return scheduled.toISOString();
}

export function validatePickupSchedule(locationName, date, time, now = new Date()) {
  const hours = Object.hasOwn(PICKUP_HOURS, locationName) ? PICKUP_HOURS[locationName] : null;
  if (!hours) return null;
  const scheduled = validateSchedule(date, time, now);
  if (!scheduled) return null;
  const weekday = new Date(`${date}T12:00:00+08:00`).getUTCDay();
  return hours.days.includes(weekday) && time >= hours.open && time <= hours.close ? scheduled : null;
}

export function pricedItems(requested, catalog) {
  if (!Array.isArray(requested) || requested.length < 1 || requested.length > 30) return null;
  const byId = new Map(catalog.map(product => [product.id, product]));
  const seen = new Set();
  const lines = [];
  let subtotal = 0;
  for (const request of requested) {
    const id = request?.id;
    const quantity = request?.quantity;
    const product = byId.get(id);
    if (!product || seen.has(id) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) return null;
    if (!Number.isSafeInteger(product.price) || product.price < 0) return null;
    seen.add(id);
    subtotal += product.price * quantity;
    if (!Number.isSafeInteger(subtotal) || subtotal > 1_000_000) return null;
    lines.push({
      id: product.id, name: product.name, quantity, price: product.price,
      unitLabel: product.unitLabel, piecesPerUnit: product.piecesPerUnit,
    });
  }
  return {lines, subtotal};
}

export function validPhone(value) {
  return typeof value === 'string' && /^\+?[0-9\s-]{10,16}$/.test(value.trim());
}

export function validRequestId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function validAccessToken(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}
