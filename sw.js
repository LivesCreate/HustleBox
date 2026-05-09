// HustleBox Service Worker
// CACHE_NAME must be bumped on every release (matches VERSION in index.html)
const CACHE_NAME = 'hustlebox-v1.1.0';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './version.txt',
  './news.json',
  './icon-512.png',
  './icon-foreground.png',
  './icon-background.png',
  './logo-full.png'
];

// Install — pre-cache shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS).catch(() => {}))
  );
});

// Activate — wipe ALL old caches (cache-clear-on-update is mandatory)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — network-first for HTML/JSON, cache-first for everything else
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isShell =
    req.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('version.txt');

  if (isShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('./index.html')))
    );
  } else {
    event.respondWith(
      caches.match(req).then((cached) => {
        return (
          cached ||
          fetch(req).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
            return res;
          })
        );
      })
    );
  }
});

// Push event handler — foundation for future Web Push notifications
// Currently no push server exists; handler is in place so push payloads work the day server is wired up
self.addEventListener('push', (event) => {
  let data = { title: 'HustleBox', body: '', tag: 'general' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    tag: data.tag,
    icon: 'icon-512.png',
    badge: 'icon-512.png',
    data: data.data || {},
    requireInteraction: false
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click — focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});

// Message handler — used by client to force skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
