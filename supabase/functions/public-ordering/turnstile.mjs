export async function verifyTurnstileToken(token, secret, hostname, fetcher = fetch) {
  if (typeof token !== 'string' || token.length < 10 || token.length > 2048 || !secret || !hostname) return false
  const form = new URLSearchParams({secret, response:token})
  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method:'POST', body:form, signal:AbortSignal.timeout(5000),
    })
    if (!response.ok) return false
    const result = await response.json()
    if (secret === '1x0000000000000000000000000000000AA'
      && ['localhost','127.0.0.1'].includes(hostname)
      && result.success === true && result.metadata?.result_with_testing_key === true) return true
    return result.success === true && result.hostname === hostname && result.action === 'customer_order'
  } catch {
    return false
  }
}
