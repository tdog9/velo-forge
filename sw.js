// TurboPrep Service Worker v2
const CACHE_NAME = 'turboprep-202604281114';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/design-system.css',
  '/layout-fix.css',
  '/app.js',
  '/plans.js',
  '/state.js',
  '/tracker.js',
  '/admin.js',
  '/strava.js',
  '/raceLog.js',
  '/timer.js',
  '/aifeatures.js',
  '/healthcheck.js',
  '/raceday.js',
  // Modules added after this list was last hand-edited. Without these
  // entries, first-install offline can't load chat / Garmin / Fitbit
  // and the page hard-errors before the stale-while-revalidate fetch
  // path covers them.
  '/teamchat.js',
  '/garmin.js',
  '/fitbit.js'
];

// Install: cache core assets, force activate immediately
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// Activate: delete ALL old caches (including cgs-turboprep-v1 and any blob SW caches)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Notification click handler. Routes the user to the URL embedded in
// the notification's data payload (e.g. /?go=team-chat) — even when an
// existing window is already open. Was previously just focusing the
// existing window without navigating, so a coach-broadcast push never
// landed the user on the chat tab.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = e.notification.data?.url || '/';
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (list.length > 0) {
      const client = list[0];
      try { await client.focus(); } catch(err) {}
      // Tell the page to navigate. The page listens via
      // navigator.serviceWorker.addEventListener('message') and routes
      // to the right tab without a full reload.
      try { client.postMessage({ type: 'NAV', url: targetUrl }); } catch(err) {}
      return;
    }
    return self.clients.openWindow(targetUrl);
  })());
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

  // Network-first for HTML only — we want the shell to track deploys so the
  // bootstrap version-check script in index.html can invalidate caches.
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
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

  // Stale-while-revalidate for JS, CSS, images, fonts — cache version is
  // stamped with the commit SHA (see scripts/stamp-version.js), so each
  // deploy produces a fresh CACHE_NAME and old caches are wiped on activate.
  // Within a deploy, serving the cached copy gives near-instant repeat loads.
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
