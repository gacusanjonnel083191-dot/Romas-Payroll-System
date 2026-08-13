(() => {
  'use strict'
  if (window.__ROMA_AI_AGENT_UPGRADE__) return
  window.__ROMA_AI_AGENT_UPGRADE__ = true

  const VERSION = '2026.08.13.4-general-agent-auth'
  const previousFetch = window.fetch.bind(window)
  const fallbackStatuses = new Set([401, 403, 408, 425, 429, 500, 502, 503, 504])

  function isLegacyRomaApi(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url || ''
      const url = new URL(raw, window.location.href)
      return url.origin === window.location.origin && url.pathname === '/api/roma-ai'
    } catch { return false }
  }

  function publicSupabaseKey() {
    const client = window.__ROMA_AI_BRIDGE__?.supabase
    return String(client?.supabaseKey || client?.rest?.headers?.apikey || '')
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

  // One semantic brain: every normal question goes to the GPT-orchestrated agent first.
  // The browser already has a PUBLIC Supabase key. Passing that public key to the
  // server lets Roma AI initialize verified tools while the user's JWT remains the
  // actual authorization boundary.
  window.fetch = async function romaAiAgentFetch(input, init) {
    if (!isLegacyRomaApi(input)) return previousFetch(input, init)

    const raw = typeof input === 'string' ? input : input.url
    const url = new URL(raw, window.location.href)
    url.pathname = '/api/roma-ai-v3'
    const key = publicSupabaseKey()
    try {
      let redirected
      if (typeof input === 'string') {
        const headers = new Headers(init?.headers || {})
        if (key) headers.set('X-Roma-Supabase-Key', key)
        redirected = await previousFetch(url.pathname + url.search, { ...(init || {}), headers })
      } else {
        const request = new Request(url.toString(), input)
        const headers = new Headers(request.headers)
        if (key) headers.set('X-Roma-Supabase-Key', key)
        redirected = await previousFetch(new Request(request, { headers }))
      }
      if (redirected.ok) return redirected
      let payload = {}
      try { payload = await redirected.clone().json() } catch {}
      if (payload?.fallbackAvailable || fallbackStatuses.has(redirected.status)) return fallbackResponse(payload, redirected.status)
      return redirected
    } catch (error) {
      return fallbackResponse({ error:'roma_ai_v3_fetch_failed', message:error?.message || 'Roma AI network request failed.' }, 0)
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
    const r = await previousFetch('/api/roma-ai-v3', { cache:'no-store' })
    return r.json().catch(() => ({}))
  }

  function addChip(chips, key, label, prompt) {
    if (!chips || chips.querySelector(`[data-agent-chip="${key}"]`)) return
    const button = document.createElement('button')
    button.className = 'rai-chip'
    button.dataset.agentChip = key
    button.textContent = label
    button.addEventListener('click', () => {
      const root = document.getElementById('roma-ai-root')
      const input = root?.querySelector('textarea')
      if (!input) return
      input.value = prompt
      input.dispatchEvent(new Event('input', { bubbles:true }))
      input.focus()
    })
    chips.appendChild(button)
  }

  function enhance(root) {
    if (!root || root.dataset.agentUpgrade === VERSION) return
    root.dataset.agentUpgrade = VERSION
    const title = root.querySelector('.rai-title span')
    if (title) title.textContent = `General Business & System Agent · ${VERSION}`
    const mode = root.querySelector('.rai-mode')
    providerMeta().then(meta => {
      if (!mode) return
      if (meta?.providerConfigured) mode.textContent = 'Full AI agent · verified live system tools'
      else mode.textContent = 'Verified business fallback · Full AI provider unavailable'
    }).catch(() => {})

    const chips = root.querySelector('.rai-chips')
    addChip(chips, 'system-doctor', 'System Doctor', 'Inspect the current screen and system context. Diagnose the root cause, verify the relevant data and source code, and prepare a safe repair if needed.')
    addChip(chips, 'repair', 'Repair', 'Investigate the problem I am describing. Check the relevant live system data and approved source code, explain the root cause, and prepare a professional repair request. Do not change production unless the Owner approves and explicitly authorizes deployment.')
  }

  const observer = new MutationObserver(() => enhance(document.getElementById('roma-ai-root')))
  observer.observe(document.documentElement, { childList:true, subtree:true })
  enhance(document.getElementById('roma-ai-root'))

  window.__ROMA_AI_AGENT__ = Object.freeze({ version:VERSION, providerMeta, developer })
})()
