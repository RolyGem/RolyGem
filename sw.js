const CACHE_NAME = 'gemini-fusion-chat-v4';

// Core app shell resources
const urlsToCache = [
  '/',
  '/index.html',
  '/index.css',
  '/icon.svg',
  '/manifest.webmanifest',
  '/index.tsx'
];

self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache).catch(err => {
          console.error('[Service Worker] Failed to cache resources:', err);
        });
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Only cache static assets. Never cache dynamic endpoints to avoid storage bloat.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const urlObj = new URL(req.url);
  const sameOrigin = urlObj.origin === self.location.origin;

  const isStaticAsset = sameOrigin && (
    urlObj.pathname === '/' ||
    urlObj.pathname === '/index.html' ||
    urlObj.pathname.endsWith('.css') ||
    urlObj.pathname.endsWith('.js') ||
    urlObj.pathname.endsWith('.svg') ||
    urlObj.pathname.endsWith('.webmanifest') ||
    urlObj.pathname.startsWith('/assets/') ||
    urlObj.pathname.startsWith('/dist/')
  );

  if (!sameOrigin || !isStaticAsset) {
    // Let non-static or cross-origin requests pass without caching.
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        // Update cache in background
        fetch(req).then(resp => {
          if (resp && resp.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(req, resp.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return resp;
      }).catch(() => {
        if (req.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (!cacheWhitelist.includes(cacheName)) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim()) // Take control immediately
  );
});

// Handle messages from the main app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

