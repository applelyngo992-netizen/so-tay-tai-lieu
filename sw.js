/* Ưu tiên lấy bản mới trên mạng; mất mạng thì dùng bản đã lưu */
const V = 'sotay-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(r)
      .then((res) => {
        if (res.ok) { const c = res.clone(); caches.open(V).then((ca) => ca.put(r, c)); }
        return res;
      })
      .catch(() => caches.match(r).then((m) => m || caches.match('/')))
  );
});
