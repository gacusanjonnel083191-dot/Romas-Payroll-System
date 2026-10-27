export function normalizePhilippineMobile(value) {
  if (typeof value !== 'string' || !/^\+?[0-9\s-]{10,18}$/.test(value.trim())) return null;
  const digits = value.replace(/\D/g, '');
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
  if (/^639\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}
