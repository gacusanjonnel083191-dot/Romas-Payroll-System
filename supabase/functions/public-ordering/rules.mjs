export const DELIVERY_COVERAGE = ['Binmaley', 'Calasiao', 'Dagupan City', 'Mangaldan', 'Santa Barbara'];

export function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function validateSchedule(date, time, now = new Date()) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (typeof time !== 'string' || !/^(0[8-9]|1[0-6]):(00|30)$|^17:00$/.test(time)) return null;
  const scheduled = new Date(`${date}T${time}:00+08:00`);
  if (Number.isNaN(scheduled.getTime())) return null;
  const dateInManila = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(scheduled);
  if (dateInManila !== date || scheduled.getTime() < now.getTime() + 60 * 60_000) return null;
  return scheduled.toISOString();
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
