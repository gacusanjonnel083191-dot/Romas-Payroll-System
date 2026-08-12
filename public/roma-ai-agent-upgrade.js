(() => {
  'use strict'
  if (window.__ROMA_AI_AGENT_UPGRADE__) return
  window.__ROMA_AI_AGENT_UPGRADE__ = true

  const VERSION = '2026.08.13.1-weather'
  const previousFetch = window.fetch.bind(window)
  const fallbackStatuses = new Set([408, 425, 429, 500, 502, 503, 504])
  let weatherContextUntil = 0

  function isLegacyRomaApi(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url || ''
      const url = new URL(raw, window.location.href)
      return url.origin === window.location.origin && url.pathname === '/api/roma-ai'
    } catch { return false }
  }

  function messageFromRequest(init) {
    try {
      if (typeof init?.body !== 'string') return ''
      return String(JSON.parse(init.body)?.message || '').trim()
    } catch { return '' }
  }

  function isPureWeatherQuestion(message) {
    const q = String(message || '').toLowerCase()
    if (!q) return false
    const weather = /\b(weather|pagasa|forecast|rain|rainfall|thunderstorm|storm|bagyo|ulan|panahon|habagat|red|yellow|green)\b/i.test(q)
    const weatherFollowup = Date.now() < weatherContextUntil && /^(how about|what about|paano naman|kumusta naman|dagupan|calasiao|binmaley|mangaldan|san |santa |santo )/i.test(q)
    const crossModule = /\b(production|produce|sales|expense|delivery|deliveries|outlet|inventory|stock|payroll|costing|pricing|reseller|employee|staff|business impact|forecast production)\b/i.test(q)
    const modification = /\b(fix|debug|repair|modify|edit|delete|remove|deploy|redesign|replace)\b/i.test(q) || /\b(change|update)\s+(the\s+)?(code|system|app|module|button|layout|logic|database)\b/i.test(q)
    return (weather || weatherFollowup) && !crossModule && !modification
  }

  async function refreshWeatherIfNeeded(init) {
    const message = messageFromRequest(init)
    if (!isPureWeatherQuestion(message)) return
    weatherContextUntil = Date.now() + 15 * 60 * 1000
    try {
      const headers = new Headers(init?.headers || {})
      headers.set('Content-Type','application/json')
      await previousFetch('/api/roma-ai-weather-refresh', {
        method:'POST',
        headers,
        body:'{}',
        cache:'no-store'
      })
    } catch { /* stale-cache fallback remains available */ }
  }

  function fallbackResponse(payload = {}, originalStatus = 0) {
    return new Response(JSON.stringify({
      ok: false,
      error: payload?.error || 'roma_ai_agent_transport_unavailable',
      message: payload?.message || 'Full AI is temporarily unavailable. Using the verified business engine instead.',
      fallbackAvailable: true,
      originalStatus
    }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store' }
    })
  }

  window.fetch = async function romaAiAgentFetch(input, init) {
    if (!isLegacyRomaApi(input)) return previousFetch(input, init)
    await refreshWeatherIfNeeded(init)
    const raw = typeof input === 'string' ? input : input.url
    const url = new URL(raw, window.location.href)
    url.pathname = '/api/roma-ai-v2'
    try {
      const redirected = typeof input === 'string'
        ? await previousFetch(url.pathname + url.search, init)
        : await previousFetch(new Request(url.toString(), input), init)
      if (redirected.ok) return redirected
      let payload = {}
      try { payload = await redirected.clone().json() } catch {}
      if (payload?.fallbackAvailable || fallbackStatuses.has(redirected.status)) return fallbackResponse(payload, redirected.status)
      return redirected
    } catch (error) {
      return fallbackResponse({ error:'roma_ai_v2_fetch_failed', message:error?.message || 'Roma AI network request failed.' }, 0)
    }
  }

  async function token() {
    const bridge = window.__ROMA_AI_BRIDGE__
    const { data } = await bridge?.supabase?.auth?.getSession?.() || {}
    return data?.session?.access_token || ''
  }

  async function developer(action, changeRequestId) {
    const t = await token()
    if (!t) throw new Error('login_session_required')
    const r = await previousFetch('/api/roma-ai-developer', {
      method: action ? 'POST' : 'GET',
      headers: { Authorization:`Bearer ${t}`, ...(action ? {'Content-Type':'application/json'} : {}) },
      body: action ? JSON.stringify({ action, changeRequestId }) : undefined
    })
    const p = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(p?.error || `developer_broker_${r.status}`)
    return p
  }

  async function providerMeta() {
    const r = await previousFetch('/api/roma-ai-v2', { cache:'no-store' })
    return r.json().catch(() => ({}))
  }

  function enhance(root) {
    if (!root || root.dataset.agentUpgrade === VERSION) return
    root.dataset.agentUpgrade = VERSION
    const title = root.querySelector('.rai-title span')
    if (title) title.textContent = `Business & System Assistant · ${VERSION}`
    const mode = root.querySelector('.rai-mode')
    providerMeta().then(meta => {
      if (!mode) return
      if (meta?.providerConfigured) mode.textContent = 'AI provider detected · verified fallback ready'
      else mode.textContent = 'Verified business engine · Full AI awaiting provider activation'
    }).catch(() => {})

    const chips = root.querySelector('.rai-chips')
    if (chips && !chips.querySelector('[data-agent-chip="system-doctor"]')) {
      const doctor = document.createElement('button')
      doctor.className = 'rai-chip'
      doctor.dataset.agentChip = 'system-doctor'
      doctor.textContent = 'System Doctor'
      doctor.addEventListener('click', () => {
        const input = root.querySelector('textarea')
        if (!input) return
        input.value = 'Inspect the current screen and system context. Tell me what is wrong, why it is happening, and prepare a safe fix if needed.'
        input.dispatchEvent(new Event('input', { bubbles:true }))
        input.focus()
      })
      chips.appendChild(doctor)
    }
  }

  const observer = new MutationObserver(() => enhance(document.getElementById('roma-ai-root')))
  observer.observe(document.documentElement, { childList:true, subtree:true })
  enhance(document.getElementById('roma-ai-root'))

  window.__ROMA_AI_AGENT__ = Object.freeze({ version:VERSION, providerMeta, developer })
})()
