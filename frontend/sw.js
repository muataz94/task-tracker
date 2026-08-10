// App-shell cache only — no data caching (all data goes through Apps Script
// POST calls, which Service Workers can't meaningfully cache/replay here).
const CACHE_NAME = 'tasktracker-shell-v4';
const SHELL_FILES = [
  './', './index.html', './style.css', './dashboard-v2.css', './mobile-v2.css',
  './i18n.js', './config.js', './cache.js', './api.js',
  './tables.js', './dashboard.js', './kanban.js', './chat.js',
  './quotations.js', './invoices.js', './vendors.js', './messaging.js',
  './purchasereqs.js', './ai-chat.js', './notifications.js',
  './budget.js', './analytics.js', './offline.js', './dashboard-v2.js',
  './mobile-nav.js',
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
