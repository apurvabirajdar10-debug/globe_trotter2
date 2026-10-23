const CACHE_NAME = 'globetrotter-app-cache-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install Event: Pre-cache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old cache versions
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

// Fetch Event: Stale-While-Revalidate for app assets, bypass API & map tiles
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. DO NOT cache map tiles or external map APIs (Prompt requirement)
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('openstreetmap.org') ||
    url.hostname.includes('mapbox.com') ||
    url.pathname.includes('/maps/') ||
    url.pathname.includes('tile')
  ) {
    return; // Pass through to network
  }

  // 2. DO NOT cache API requests in Service Worker (API is synced via IndexedDB snapshots)
  if (url.pathname.startsWith('/api/')) {
    return; // Pass through to network
  }

  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // 3. Stale-While-Revalidate for app shell & static frontend assets
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch((err) => {
        // If navigation request fails while offline, return index.html SPA shell
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        throw err;
      });

      // Return cached version immediately if present, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});
