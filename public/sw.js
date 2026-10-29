/**
 * ARV KKBK Service Worker
 * Caches ONLY the static app shell.
 * NEVER intercepts or caches any patient record data (which lives exclusively in IndexedDB).
 */

const CACHE_NAME = 'arv-kkbk-v3';

// Assets to pre-cache on install
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).catch((err) => {
      console.warn('Pre-cache notice:', err);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Only handle same-origin HTTP(S) requests
  if (url.origin !== self.location.origin) return;

  // 1. Navigation requests (Opening the app, launching from iOS Home Screen WebClip)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline or network error, return cached index.html or base
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return caches.match('./index.html').then((fallback) => {
              if (fallback) return fallback;
              return caches.match('./');
            });
          });
        })
    );
    return;
  }

  // 2. Static Assets (JS, CSS, images, icons, manifest)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback if asset request fails
          return cachedResponse;
        });
    })
  );
});
