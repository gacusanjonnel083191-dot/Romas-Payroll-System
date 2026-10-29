export const PH_TZ = 'Asia/Manila';
export const COVERAGE = ['Binmaley', 'Calasiao', 'Dagupan City', 'Mangaldan', 'Santa Barbara'];
export const BRANCH_NAMES = ['Dagupan City', 'Santa Barbara', 'Binmaley', 'Mangaldan', 'Calasiao', 'San Carlos'];
export const PICKUP_LOCATIONS = [
  'Asingan', 'Binmaley', 'Calasiao', 'Dagupan City', 'Laoac', 'Mangaldan',
  'Mapandan', 'San Carlos', 'San Fabian', 'San Jacinto', 'San Manuel',
  'Santa Barbara', 'Santo Tomas', 'Sta Maria', 'Tayug', 'Urdaneta (Nancalobasaan)',
];

export function phDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: PH_TZ, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function earliestOrderDate(now = new Date()) {
  const today = phDate(now);
  const daysAhead = now.getTime() >= Date.parse(`${today}T15:00:00+08:00`) ? 2 : 1;
  return phDate(new Date(Date.parse(`${today}T12:00:00+08:00`) + daysAhead * 86_400_000));
}

const PREVIEW_HOURS = {days:[0,1,2,3,4,5,6], open:'08:00', close:'17:00'};
export const DELIVERY_HOURS = {days:[0,1,2,3,4,5,6], open:'08:00', close:'20:00'};

export function availableSlots(date, now = new Date(), hours = PREVIEW_HOURS) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < earliestOrderDate(now)) return [];
  if (!hours || !Array.isArray(hours.days)) return [];
  const weekday = new Date(`${date}T12:00:00+08:00`).getUTCDay();
  if (!hours.days.includes(weekday)) return [];
  const slots = [];
  for (let minutes = 8 * 60; minutes <= 20 * 60; minutes += 30) {
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    const value = `${hh}:${mm}`;
    const at = new Date(`${date}T${value}:00+08:00`);
    if (value >= hours.open && value <= hours.close && !Number.isNaN(at.getTime()) && phDate(at) === date) slots.push(value);
  }
  return slots;
}

export function feeForDistance(distanceKm, minimumFee, perKm, includedKm = 0) {
  const distance = Number(distanceKm);
  const minimum = Number(minimumFee);
  const extra = Number(perKm);
  const included = Number(includedKm);
  if (![distance, minimum, extra, included].every(Number.isFinite) || Math.min(distance, minimum, extra, included) < 0) return null;
  return Math.round((minimum + Math.ceil(Math.max(0, distance - included)) * extra) * 100) / 100;
}

export function haversineKm(a, b) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function cartSubtotal(products, cart) {
  return products.reduce((sum, product) => sum + product.price * (cart[product.id] || 0), 0);
}
