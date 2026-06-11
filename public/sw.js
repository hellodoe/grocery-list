const CACHE_NAME = 'pantrypulse-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/src/style.css',
  '/src/app.js',
  '/src/utils.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install Event - cache core static shell assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clean up obsolete cache versions
self.addEventListener('activate', (e) => {
  e.waitUntil(
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

// Fetch Event - handle requests using caching strategies
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Network-First strategy for API endpoints
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // If successful network call, cache a copy
          if (response.status === 200) {
            const responseCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseCopy);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails (offline state)
          return caches.match(e.request);
        })
    );
    return;
  }

  // Stale-While-Revalidate strategy for static resources
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update to keep cache fresh
        fetch(e.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(e.request, networkResponse);
              });
            }
          })
          .catch(() => { /* Ignore background fetch failures offline */ });

        return cachedResponse;
      }

      return fetch(e.request);
    })
  );
});
