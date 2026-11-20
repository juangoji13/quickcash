const CACHE_NAME = 'quickcash-cache-v3';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/login'
];

// Install: Pre-cache core app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA: Error pre-caching assets during install', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up previous caches
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

// Fetch: Stale-While-Revalidate / Cache-First strategy for static assets & offline navigation
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Skip chrome-extension, NextAuth APIs or dynamic auth
  if (url.pathname.startsWith('/api/auth/')) {
    return;
  }

  // 1. Navigation requests (HTML pages): Network-first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to cached root or route
          const fallback = await caches.match('/collector/route') || await caches.match('/');
          if (fallback) return fallback;

          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>QuickCash Offline</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:sans-serif;background:#2C3E50;color:#F1C40F;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center;}h1{margin-bottom:8px;}p{color:#ECF0F1;}</style></head><body><div><h1>⚡ QuickCash Sin Conexión</h1><p>Estás en modo offline. Los datos se sincronizarán al recuperar la red.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // 2. Static assets (_next/static, images, fonts, styles): Cache-First / Stale-While-Revalidate
  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff|woff2|css|js)$/);

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
