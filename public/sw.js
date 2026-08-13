// Roma's Donuts - Service Worker
const CACHE_NAME = 'romas-payroll-v2-roma-ai-20260813-03-general-agent'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
  '/roma-ai-agent-upgrade.js?v=2026.08.13.3-general-agent',
  '/roma-ai-diagnostics.js?v=2026.08.13.3-general-agent',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  if (event.request.url.includes('supabase.co')) return

  if (event.request.mode === 'navigate' || new URL(event.request.url).pathname === '/index.html') {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()))
        return response
      }).catch(() => caches.match(event.request).then(cached => cached || caches.match('/index.html')))
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      }).catch(() => cached)
      return cached || fetchPromise
    })
  )
})
