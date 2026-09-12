/* FinNote: document fallback is never returned for JavaScript/CSS. */
const PREFIX = 'finnote-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE = PREFIX + '20260913-white-screen-fix-1';
const INDEX = new URL('./index.html', self.registration.scope).href;
const ASSETS = ['./index.html', './manifest.json', './icon.svg'];
const ownsCache = key => key.startsWith(PREFIX);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // The document is required; missing optional icons must not discard it.
    await cache.add(new Request(INDEX, { cache: 'reload' }));
    await Promise.all(ASSETS.slice(1).map(path =>
      cache.add(new URL(path, self.registration.scope).href).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => ownsCache(key) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isLocal = url.origin === self.location.origin && url.href.startsWith(self.registration.scope);
  const isDependency = url.origin === 'https://cdn.jsdelivr.net' &&
    /^\/npm\/(react|react-dom)@18\.3\.1\/umd\//.test(url.pathname);
  const isStyleDependency = url.origin === 'https://cdn.tailwindcss.com';
  if (!isLocal && !isDependency && !isStyleDependency) return;
  // Leave API calls and user data out of the shell cache.
  const isDocument = request.mode === 'navigate';
  if (!isDocument && !['script', 'style', 'image', 'font', 'manifest'].includes(request.destination)) return;
  const responsePromise = (async () => {
    const cache = await caches.open(CACHE);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(request, { signal: controller.signal, ...(isDocument ? { cache: 'no-cache' } : {}) });
      if (!response.ok && response.type !== 'opaque') throw new Error('HTTP ' + response.status);
      if (request.destination === 'script' && /text\/html/i.test(response.headers.get('content-type') || '')) {
        throw new Error('Expected JavaScript, received HTML');
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (isDocument) {
        const page = await cache.match(INDEX);
        if (page) return page;
        return new Response('<!doctype html><meta charset="utf-8"><p>FinNote: เชื่อมต่ออินเทอร์เน็ตแล้วลองเปิดใหม่</p>', {
          status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
      return Response.error();
    } finally { clearTimeout(timeout); }
  })();
  event.respondWith(responsePromise);
  event.waitUntil(responsePromise.then(async response => {
    if (!response.ok && response.type !== 'opaque') return;
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }).catch(() => {}));
});

self.addEventListener('message', event => {
  if (event.data === 'CLEAR_CACHE') {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(ownsCache).map(key => caches.delete(key)))));
  }
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then(clients => {
    for (const client of clients) {
      if (client.url.startsWith(self.registration.scope) && 'focus' in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(self.registration.scope);
  }));
});
