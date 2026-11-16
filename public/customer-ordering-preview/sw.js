// The ordering app stays network-first so prices, availability, and orders are current.
// Its narrow scope also keeps the staff app's offline fallback out of customer ordering.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Roma\'s Ordering</title><body style="font:16px system-ui;padding:32px;color:#5f151a"><h1>You are offline</h1><p>Reconnect to the internet to place or check an order.</p></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )))
})
