(() => {
  'use strict'
  if (window.__ROMA_AI_RESILIENCE__) return
  window.__ROMA_AI_RESILIENCE__ = true

  const nativeFetch = window.fetch.bind(window)
  const fallbackStatuses = new Set([401, 403, 408, 409, 425, 429, 500, 502, 503, 504])

  function isRomaAiPost(input, init) {
    try {
      const raw = typeof input === 'string' ? input : input?.url || ''
      const url = new URL(raw, window.location.href)
      const method = String(init?.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase()
      return method === 'POST' && url.origin === window.location.origin && url.pathname === '/api/roma-ai'
    } catch {
      return false
    }
  }

  function fallbackResponse(payload = {}, originalStatus = 0) {
    return new Response(JSON.stringify({
      ok: false,
      error: payload?.error || 'roma_ai_transport_unavailable',
      message: payload?.message || 'Full AI is temporarily unavailable. Using the verified business engine instead.',
      fallbackAvailable: true,
      originalStatus
    }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    })
  }

  window.fetch = async function romaAiResilientFetch(input, init) {
    if (!isRomaAiPost(input, init)) return nativeFetch(input, init)

    try {
      const response = await nativeFetch(input, init)
      if (response.ok) return response

      let payload = {}
      try { payload = await response.clone().json() } catch {}

      if (payload?.fallbackAvailable || fallbackStatuses.has(response.status)) {
        return fallbackResponse(payload, response.status)
      }
      return response
    } catch (error) {
      return fallbackResponse({
        error: 'roma_ai_fetch_failed',
        message: error?.message || 'Roma AI network request failed.'
      }, 0)
    }
  }
})()
