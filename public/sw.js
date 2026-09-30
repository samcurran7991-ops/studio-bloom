// Service worker for the owner app: push notifications, notification taps, and an offline shell.
const CACHE = 'studio-leads-v1'
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}))
  self.skipWaiting()
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

// Pages: network first, fall back to the cached app shell when offline.
// Built assets (hashed file names): cache first. Supabase / API calls are never cached.
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return r }).catch(() => caches.match('/')))
    return
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r })))
  }
})

// Push from the server (supabase/functions/_shared/services.ts): { title, body, url, tag }
self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { title: 'New lead', body: e.data && e.data.text() } }
  const title = d.title || 'New lead'
  e.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: d.body || '', tag: d.tag, renotify: Boolean(d.tag), data: { url: d.url || '/app' },
      icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', vibrate: [80, 40, 80],
    })
    // Tell open windows so they can refresh and chime.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    wins.forEach((w) => w.postMessage({ type: 'push', title, url: d.url }))
    if (self.navigator && self.navigator.setAppBadge) {
      try { const n = (await self.registration.getNotifications()).length; await self.navigator.setAppBadge(n) } catch {}
    }
  })())
})

// Tapping a notification opens that lead in the app (reusing an open window when there is one).
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/app'
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const win = wins.find((w) => new URL(w.url).origin === self.location.origin)
    if (win) { await win.focus(); win.postMessage({ type: 'open', url }); return }
    await self.clients.openWindow(url)
  })())
})
