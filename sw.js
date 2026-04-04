// VeloForge Service Worker v2
const CACHE_NAME = 'veloforge-v24';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/plans.js',
  '/state.js',
  '/tracker.js',
  '/admin.js',
  '/strava.js',
  '/racelog.js',
  '/timer.js',
  '/aifeatures.js'
];

// Install: cache core assets, force activate immediately
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// Activate: delete ALL old caches (including cgs-veloforge-v1 and any blob SW caches)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Notification click handler
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) { list[0].focus(); return; }
      return self.clients.openWindow(e.notification.data?.url || '/');
    })
  );
});

// Fetch: network-first for API/Firebase, stale-while-revalidate for assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET
  if (event.request.method !== 'GET') return;

  // Network-only for API, Firebase, Strava, auth
  if (url.pathname.startsWith('/.netlify/') ||
      url.hostname.includes('firestore') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('identitytoolkit') ||
      url.hostname.includes('strava') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('anthropic')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Network-first for HTML and JS (always get fresh code)
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for CSS, images, fonts
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetched = fetch(event.request).then(response => {
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

// Listen for SKIP_WAITING message from client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
