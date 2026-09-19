/* Service Worker — FinNote
   แคชไฟล์แอปไว้ใช้ออฟไลน์ + ป้องกันจอขาวจากแคชเก่า */
const CACHE = 'finnote-v5-' + '20260919b';   // เปลี่ยนทุกครั้งที่อัป → ล้างแคชเก่าอัตโนมัติ
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', (e) => {
  // ติดตั้งเวอร์ชันใหม่ทันที ไม่รอ
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  // ลบแคชเก่าทุกเวอร์ชันที่ไม่ใช่ตัวปัจจุบัน แล้วคุมทุกแท็บทันที
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Network first เสมอ (ได้ไฟล์ใหม่ก่อน) → ถ้าออฟไลน์ค่อยใช้แคช
   index.html ใช้ network-first เข้มเป็นพิเศษ กันเสิร์ฟหน้าเก่าค้าง */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.includes('supabase.co')) return;

  // เอกสาร/หน้าเว็บ (navigate) → network first เข้ม
  const isDoc = e.request.mode === 'navigate' || url.endsWith('/') || url.endsWith('index.html');
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});

self.addEventListener('message', (e) => {
  // เผื่อสั่งล้างแคชจากแอปได้
  if (e.data === 'CLEAR_CACHE') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const c of clients) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
