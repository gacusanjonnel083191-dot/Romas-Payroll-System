export async function callStaffOrdering(client, serviceUrl, publishableKey, action, payload = {}) {
  if (!client || !serviceUrl || !publishableKey) throw new Error('Supabase environment variables are missing.')
  const {data:{session}} = await client.auth.getSession()
  if (!session?.access_token) throw new Error('Sign in to review orders.')
  const response = await fetch(`${serviceUrl.replace(/\/$/, '')}/functions/v1/public-ordering`, {
    method:'POST', headers:{
      'Content-Type':'application/json', apikey:publishableKey,
      Authorization:`Bearer ${session.access_token}`,
    }, body:JSON.stringify({action,...payload}),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || !result.ok) throw new Error(result.message || 'The ordering service is unavailable.')
  return result
}
