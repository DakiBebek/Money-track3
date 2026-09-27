const CACHE = 'duitku-v1';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Network-first untuk HTML (biar selalu dapat versi terbaru saat online),
// cache-first untuk aset statis, dan tetap bisa buka halaman shell saat offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // biarkan Supabase & CDN lewat langsung

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        caches.open(CACHE).then(c => c.put('/index.html', res.clone()));
        return res;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }))
  );
});
