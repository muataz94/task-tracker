// App-shell cache only — no data caching (all data goes through Apps Script
// POST calls, which Service Workers can't meaningfully cache/replay here).
const CACHE_NAME = 'tasktracker-shell-v8';
const SHELL_FILES = [
  './', './index.html', './manifest.webmanifest',
  './style.css?v=11', './dashboard-v2.css?v=3', './mobile-v2.css?v=2', './mobile-v3.css?v=1',
  './i18n.js?v=2', './config.js', './cache.js?v=2', './api.js?v=3',
  './tables.js?v=2', './dashboard.js', './kanban.js', './chat.js?v=6',
  './quotations.js?v=2', './invoices.js?v=2', './vendors.js?v=2', './messaging.js?v=2',
  './purchasereqs.js?v=2', './ai-chat.js', './notifications.js?v=3',
  './budget.js?v=2', './analytics.js', './offline.js?v=4', './dashboard-v2.js?v=3',
  './mobile-nav.js?v=3', './mobile-v3.js?v=1',
  './forms-v4.js?v=1',
  './assets/icons/apple-touch-icon.png', './assets/icons/icon-192.png', './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png', './assets/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for the app shell, falling back to cache when offline.
// Never intercept POST (all Apps Script data calls) — only GET navigations/assets.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
