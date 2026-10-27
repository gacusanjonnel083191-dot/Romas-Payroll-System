const encoder = new TextEncoder()

export async function rateLimitKey(secret, scope, subject) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(`${scope}:${subject}`))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function consumeRateLimit(admin, secret, scope, subject, limit, windowSeconds) {
  const keyHash = await rateLimitKey(secret, scope, subject)
  const {data, error} = await admin.rpc('customer_order_consume_rate_limit', {
    p_key_hash:keyHash, p_limit:limit, p_window_seconds:windowSeconds,
  })
  if (error) return 'unavailable'
  return data === true ? 'allowed' : 'limited'
}
