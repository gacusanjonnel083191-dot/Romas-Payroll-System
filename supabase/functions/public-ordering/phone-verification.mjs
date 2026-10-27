export function normalizePhilippineMobile(value) {
  if (typeof value !== 'string' || !/^\+?[0-9\s-]{10,18}$/.test(value.trim())) return null
  const digits = value.replace(/\D/g, '')
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`
  if (/^639\d{9}$/.test(digits)) return `+${digits}`
  return null
}

export async function verifiedPhoneIdentity(admin, authorization, requestedPhone) {
  const phone = normalizePhilippineMobile(requestedPhone)
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!phone || !token) return null
  const {data, error} = await admin.auth.getUser(token)
  const user = data?.user
  if (error || !user?.id || !user.phone_confirmed_at
    || normalizePhilippineMobile(user.phone) !== phone) return null
  return {id:user.id, phone}
}
