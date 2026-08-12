// Roma's Donuts - Service Worker
const CACHE_NAME = 'romas-payroll-v2-roma-ai-20260812-13'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
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
  // Only cache GET requests
  if (event.request.method !== 'GET') return
  // Don't cache Supabase API calls
  if (event.request.url.includes('supabase.co')) return

  // App navigation must be network-first so a successful production deployment
  // cannot stay hidden behind an older cached index that omits a restored module.
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
