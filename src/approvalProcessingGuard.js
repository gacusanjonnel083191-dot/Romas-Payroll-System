// Prevent payroll approval actions from remaining indefinitely in a Processing state.
// This guard adds a bounded timeout to Supabase network requests and a UI fail-safe
// for approval buttons. It does not change approval/deduction business rules.

const SUPABASE_HOST = 'hebbunlnzklavkkugtzs.supabase.co'
const REQUEST_TIMEOUT_MS = 15000
const UI_STUCK_TIMEOUT_MS = 20000

export function installApprovalProcessingGuard() {
  if (typeof window === 'undefined' || window.__approvalProcessingGuardInstalled) return
  window.__approvalProcessingGuardInstalled = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || ''
    if (!String(url).includes(SUPABASE_HOST)) return originalFetch(input, init)

    const controller = new AbortController()
    const externalSignal = init?.signal
    let abortListener = null

    if (externalSignal) {
      if (externalSignal.aborted) controller.abort(externalSignal.reason)
      else {
        abortListener = () => controller.abort(externalSignal.reason)
        externalSignal.addEventListener('abort', abortListener, { once:true })
      }
    }

    const timer = window.setTimeout(() => {
      controller.abort(new DOMException('Request timed out', 'TimeoutError'))
    }, REQUEST_TIMEOUT_MS)

    try {
      return await originalFetch(input, { ...init, signal:controller.signal })
    } finally {
      window.clearTimeout(timer)
      if (externalSignal && abortListener) externalSignal.removeEventListener('abort', abortListener)
    }
  }

  const tracked = new WeakMap()
  const processingPattern = /processing|approving|saving|releasing/i

  const inspect = () => {
    const now = Date.now()
    document.querySelectorAll('button').forEach(button => {
      const text = String(button.textContent || '').trim()
      const relevant = processingPattern.test(text) && button.disabled

      if (!relevant) {
        tracked.delete(button)
        return
      }

      const started = tracked.get(button) || now
      if (!tracked.has(button)) tracked.set(button, started)

      if (now - started >= UI_STUCK_TIMEOUT_MS) {
        // A normal approval should have completed or failed by now. Reload once so
        // the screen reflects the database truth instead of leaving a dead button.
        const key = 'approval-processing-guard-reload'
        const last = Number(sessionStorage.getItem(key) || 0)
        if (now - last > 30000) {
          sessionStorage.setItem(key, String(now))
          window.location.reload()
        }
      }
    })
  }

  const observer = new MutationObserver(inspect)
  observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['disabled'] })
  window.setInterval(inspect, 2000)
}
