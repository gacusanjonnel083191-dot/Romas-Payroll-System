;(function installBreakPunchRequestGuard() {
  if (typeof window === 'undefined' || window.__romasBreakPunchRequestGuardInstalled) return
  window.__romasBreakPunchRequestGuardInstalled = true

  const SUPABASE_HOST = 'hebbunlnzklavkkugtzs.supabase.co'
  const BREAK_LOG_PATH = '/rest/v1/break_logs'
  const ACTION_LOCK_MS = 15000
  const SUCCESS_LOCK_MS = 30000
  const originalFetch = window.fetch.bind(window)
  const pendingBreakOutRequests = new Map()
  const recentSuccessfulBreakOuts = new Map()

  function getRequestUrl(input) {
    return typeof input === 'string' ? input : input?.url || ''
  }

  function getRequestMethod(input, init = {}) {
    return String(init?.method || input?.method || 'GET').toUpperCase()
  }

  function parseJsonBody(body) {
    if (typeof body !== 'string' || !body.trim()) return null
    try { return JSON.parse(body) } catch { return null }
  }

  function getBreakOutRequestKey(input, init = {}) {
    const url = getRequestUrl(input)
    if (!url || !url.includes(SUPABASE_HOST)) return ''
    if (getRequestMethod(input, init) !== 'POST') return ''

    let pathname = ''
    try { pathname = new URL(url, window.location?.origin || 'https://localhost').pathname } catch { return '' }
    if (pathname !== BREAK_LOG_PATH) return ''

    const payload = parseJsonBody(init?.body)
    const row = Array.isArray(payload) ? payload[0] : payload
    const attendanceLogId = String(row?.attendance_log_id || '').trim()
    const breakOut = String(row?.break_out || '').trim()
    if (!attendanceLogId || !breakOut) return ''
    return `break-out:${attendanceLogId}`
  }

  function duplicateInsertSuccess() {
    return new Response('', {
      status: 201,
      statusText: 'Created',
      headers: { 'content-type':'application/json' }
    })
  }

  window.fetch = async (input, init = {}) => {
    const key = getBreakOutRequestKey(input, init)
    if (!key) return originalFetch(input, init)

    const now = Date.now()
    if ((recentSuccessfulBreakOuts.get(key) || 0) > now) return duplicateInsertSuccess()

    const existingRequest = pendingBreakOutRequests.get(key)
    if (existingRequest) {
      try {
        const existingResponse = await existingRequest
        if (existingResponse?.ok) return duplicateInsertSuccess()
      } catch {
        // The first attempt failed. Allow this attempt to try normally.
      }
    }

    const requestPromise = originalFetch(input, init)
    pendingBreakOutRequests.set(key, requestPromise)
    try {
      const response = await requestPromise
      if (response?.ok) {
        const lockUntil = Date.now() + SUCCESS_LOCK_MS
        recentSuccessfulBreakOuts.set(key, lockUntil)
        window.setTimeout(() => {
          if ((recentSuccessfulBreakOuts.get(key) || 0) <= Date.now()) recentSuccessfulBreakOuts.delete(key)
        }, SUCCESS_LOCK_MS + 1000)
      }
      return response
    } finally {
      if (pendingBreakOutRequests.get(key) === requestPromise) pendingBreakOutRequests.delete(key)
    }
  }

  const lockedButtons = new WeakMap()
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('button')
    if (!button) return
    const label = String(button.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase()
    if (label !== 'BREAK OUT' && label !== 'BREAK IN') return

    const now = Date.now()
    const lockedUntil = lockedButtons.get(button) || 0
    if (lockedUntil > now) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }

    lockedButtons.set(button, now + ACTION_LOCK_MS)
    const previousPointerEvents = button.style.pointerEvents
    button.dataset.romasBreakPunchPending = 'true'
    button.style.pointerEvents = 'none'

    window.setTimeout(() => {
      lockedButtons.delete(button)
      if (!button.isConnected) return
      if (button.dataset.romasBreakPunchPending === 'true') delete button.dataset.romasBreakPunchPending
      if (button.style.pointerEvents === 'none') button.style.pointerEvents = previousPointerEvents
    }, ACTION_LOCK_MS)
  }, true)
})()
