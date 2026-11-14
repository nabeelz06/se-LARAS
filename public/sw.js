// Service worker: kerangka aplikasi tersedia saat jaringan putus. API, klip, dan takarir TIDAK pernah disimpan (data pribadi dan rekaman).
const VER = 'se-laras-v0.3.0';
const SHELL = ['/', '/index.html', '/css/tokens.css', '/css/base.css', '/css/components.css', '/css/pages.css', '/css/maestro.css', '/js/main.js', '/js/theme-boot.js', '/icons/icon.svg', '/manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VER).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VER).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname === '/healthz') return;
  // jaringan dulu (selalu terbaru), cadangan dari simpanan
  e.respondWith(fetch(e.request).then((res) => { if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VER).then((c) => c.put(e.request, copy)); } return res; }).catch(() => caches.match(e.request).then((m) => m || caches.match('/index.html'))));
});
