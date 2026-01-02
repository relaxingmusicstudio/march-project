const CACHE_NAME = 'apexlocal360-v1';
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.png',
  '/alex-avatar.png'
];
const DEV_HOSTS = new Set(['localhost', '127.0.0.1']);
let cachePutLogged = false;

const logCachePutError = (error) => {
  if (cachePutLogged) return;
  if (DEV_HOSTS.has(self.location.hostname)) {
    console.warn('[SW] cache.put failed', error);
    cachePutLogged = true;
  }
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isExtensionScheme = requestUrl.protocol === 'chrome-extension:' || requestUrl.protocol === 'devtools:';
  if (isExtensionScheme) return;
  const isHttp = requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:';
  if (!isHttp) return;
  if (requestUrl.origin !== self.location.origin) return;

  // Skip Supabase/API requests
  if (
    requestUrl.pathname.includes('/functions/') || 
    requestUrl.pathname.includes('/rest/') ||
    requestUrl.pathname.includes('/auth/')
  ) {
    return;
  }

  const shouldCache = event.request.destination !== 'document';

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response before caching
        const responseClone = response.clone();
        
        // Cache successful responses
        if (response.status === 200 && shouldCache) {
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseClone);
            })
            .catch((error) => {
              logCachePutError(error);
            });
        }
        
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Return minimal offline response for navigations
            if (event.request.mode === 'navigate') {
              return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
            }
            
            return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
          });
      })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let data = { title: 'ApexLocal360', body: 'New notification' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    tag: data.tag || 'default',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/admin/ceo';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes('/admin') && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-commands') {
    event.waitUntil(syncOfflineCommands());
  }
});

async function syncOfflineCommands() {
  // Get queued commands from IndexedDB
  // Send them to the server when back online
  console.log('[SW] Syncing offline commands...');
}
