// VeloForge Service Worker — Offline Support
const CACHE_NAME = 'veloforge-v8';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/plans.js',
  '/app.js'
];

// Install: cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API/Firestore, cache-first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Network-first for API calls, Firestore, and Strava
  if (url.pathname.startsWith('/.netlify/') ||
      url.hostname.includes('firestore') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('strava') ||
      url.hostname.includes('googleapis')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else (HTML, CSS, JS, images)
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetched = fetch(event.request).then(response => {
        // Update cache with fresh copy
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
