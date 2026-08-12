const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/responses'
const MODEL = 'openai/gpt-5.6-luna'

function extractText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim()
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string' && content.text.trim()) return content.text.trim()
    }
  }
  return ''
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'method_not_allowed' })

  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN
  if (!token) return res.status(503).json({ ok:false, gatewayConfigured:false, model:MODEL, error:'gateway_credentials_unavailable' })

  try {
    const response = await fetch(GATEWAY_URL, {
      method:'POST',
      headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json', 'X-Title':'Romas Main Business App - Roma AI' },
      body:JSON.stringify({ model:MODEL, input:'Reply with exactly: ROMA_AI_GATEWAY_OK', max_output_tokens:32, reasoning:{ effort:'none' } })
    })
    const raw = await response.text()
    let payload
    try { payload = JSON.parse(raw) } catch { payload = { raw:raw.slice(0,500) } }
    if (!response.ok) {
      const e = payload?.error || payload
      return res.status(response.status).json({ ok:false, gatewayConfigured:true, gatewayStatus:response.status, model:MODEL, error:e?.code || e?.type || 'gateway_request_failed', message:e?.message || 'AI Gateway rejected the activation probe.' })
    }
    const text = extractText(payload)
    return res.status(200).json({ ok:text.includes('ROMA_AI_GATEWAY_OK'), gatewayConfigured:true, gatewayStatus:response.status, model:MODEL, response:text || null })
  } catch (error) {
    return res.status(502).json({ ok:false, gatewayConfigured:true, model:MODEL, error:'gateway_network_error', message:error instanceof Error ? error.message : String(error) })
  }
}
