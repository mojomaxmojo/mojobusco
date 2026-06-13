/**
 * Service Worker für MojoBus
 * Offline-Fähigkeit und verbessertes Caching
 */

// ============================================================================
// CACHE-KONFIGURATION
// ============================================================================
const CACHE_VERSION = 10; // Cache Version erhöhen (war 9, jetzt 10) - react-vendor-Fix Deploy
const CACHE_NAME = `mojobus-v${CACHE_VERSION}`; // Version aus Konfiguration

// Cache-Zeiten (in Sekunden)
const CACHE_TIMES = {
  STATIC_ASSETS: 30 * 24 * 60 * 60, // 30 Tage (CSS, JS, Fonts)
  IMAGES: 365 * 24 * 60 * 60, // 1 Jahr (Bilder sind immutable!)
  API: 5 * 60, // 5 Minuten (API-Endpunkte)
};

console.log('[Service Worker] Cache Version:', CACHE_VERSION);
console.log('[Service Worker] Cache Name:', CACHE_NAME);
console.log('[Service Worker] Bild-Cache-Zeit:', CACHE_TIMES.IMAGES / (24 * 60 * 60), 'Tage (1 Jahr für immutable Assets)');

// ============================================================================
// CACHE-STRATEGIEN
// ============================================================================

/**
 * Cache-First Strategie
 * Versucht zuerst Cache, dann Network
 * Für Assets die sich nie ändern (Bilder) oder selten ändern (CSS, JS, Icons)
 * BILDER: 1 Jahr Cache (immutable URLs)
 * ASSETS: 30 Tage Cache
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Wenn Network fehlschlägt und nichts im Cache, return offline fallback
    return new Response('Offline - Keine Verbindung', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
}

/**
 * Network-First Strategie
 * Versucht zuerst Network, dann Cache
 * Für HTML und API-Requests (immer frische Daten)
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Wenn Network fehlschlägt und nichts im Cache, return offline fallback
    return new Response('Offline - Keine Verbindung', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
}

/**
 * Stale-While-Revalidate Strategie
 * Liefert sofort aus Cache, aktualisiert im Hintergrund
 * Für dynamische Inhalte (HTML-Seiten)
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then(networkResponse => {
    cache.put(request, networkResponse.clone());
    return networkResponse;
  }).catch(error => {
    console.log('[Service Worker] Fetch error:', error);
    return cachedResponse || new Response('Offline - Keine Verbindung', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  });

  if (cachedResponse) {
    return cachedResponse;
  }

  return fetchPromise;
}

/**
 * Network-Only Strategie
 * Lädt immer frisch vom Network
 * Für Nostr-Relays und WebSockets
 */
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    return new Response('Offline - Keine Verbindung', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
}

// ============================================================================
// INSTALL EVENT (Cache-Invalidierung & Precaching)
// ============================================================================

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install Event - Cache Version:', CACHE_VERSION);
  console.log('[Service Worker] Bild-Cache-Zeit:', CACHE_TIMES.IMAGES / (24 * 60 * 60), 'Tage (1 Jahr für immutable Assets)');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cache opened:', cache);

      // 🚀 OPTIMIZATION: Precache kritische Assets
      const CRITICAL_ASSETS = [
        '/icon.png',
        '/apple-touch-icon.png',
        '/mojobuslogo.png',
        '/favicon-32x32.png',
        '/favicon-16x16.png',
      ];

      // Cache kritische Assets parallel
      const precachePromises = CRITICAL_ASSETS.map((url) => {
        return fetch(url).then((response) => {
          if (response.ok) {
            return cache.put(url, response);
          }
          return Promise.resolve();
        }).catch((error) => {
          console.warn('[Service Worker] Failed to precache:', url, error);
          return Promise.resolve();
        });
      });

      // Cache Version speichern
      const cacheVersionRequest = new Request('/api/cache-version');
      const cacheVersionResponse = new Response(
        JSON.stringify({ version: CACHE_VERSION, name: CACHE_NAME }),
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Cache-Version': CACHE_VERSION.toString(),
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );

      return Promise.all([...precachePromises, cache.put(cacheVersionRequest, cacheVersionResponse)]);
    }).catch((error) => {
      console.error('[Service Worker] Install failed:', error);
    })
  );
});

// ============================================================================
// ACTIVATE EVENT
// ============================================================================

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate Event - Cache Version:', CACHE_VERSION);

  // Alte Caches leeren
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .map((cacheName) => {
            // Nur alte Caches leeren (nicht den aktuellen)
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
            return Promise.resolve();
          })
      );
    }).then(() => {
      // Alle Clients benachrichtigen
      return self.clients.claim();
    }).catch((error) => {
      console.error('[Service Worker] Activate failed:', error);
    })
  );
});

// ============================================================================
// FETCH EVENT (Cache-Strategien)
// ============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

// ============================================================================
// CACHE-STRATEGIE AUSWAHL
// ============================================================================

// 1. Cache-First für Assets (CSS, JS, Icons, Fonts)
if (url.pathname.match(/\.(css|js|woff|woff2|ttf|eot|otf)$/i)) {
  event.respondWith(cacheFirst(request));
  return;
}

// 2. Cache-First für Assets-Verzeichnis
if (url.pathname.startsWith('/assets/')) {
  event.respondWith(cacheFirst(request));
  return;
}

// 3. 🚀 OPTIMIZATION: Cache-First für optimierte Bilder (images.weserv.nl)
// Reduziert Bild-Ladezeiten drastisch durch aggressives Caching
// BILDER SIND IMMUTABLE → 1 Jahr Cache ist sicher!
if (url.hostname.includes('images.weserv.nl')) {
  event.respondWith(cacheFirst(request));
  return;
}

// 4. Cache-First für Blossom-Bilder (blossom.primal.net)
// BILDER SIND IMMUTABLE → 1 Jahr Cache ist sicher!
// Blossom URLs haben eindeutige Hashes → neue Bilder haben neue URLs
if (url.hostname.includes('blossom.primal.net') || url.pathname.match(/\.(png|jpg|jpeg|gif|webp|avif|svg)$/i)) {
  event.respondWith(cacheFirst(request));
  return;
}

// 5. Network-First für HTML-Seiten
if (url.pathname.match(/\.html$/) || url.pathname === '/') {
  event.respondWith(networkFirst(request));
  return;
}

// 6. Stale-While-Revalidate für API-Endpunkte
if (url.pathname.startsWith('/api/')) {
  event.respondWith(staleWhileRevalidate(request));
  return;
}

// 7. Network-Only für Nostr-Relays und WebSockets
if (url.protocol === 'wss:' || url.hostname.includes('nos.lol') || url.hostname.includes('relay.')) {
  event.respondWith(networkOnly(request));
  return;
}

// Default: Network-First für alles andere
event.respondWith(networkFirst(request));
});

// ============================================================================
// MESSAGE EVENT (Client-Kommunikation)
// ============================================================================

self.addEventListener('message', (event) => {
  const { data } = event;
  console.log('[Service Worker] Message received:', data);

  // Cache leeren
  if (data.type === 'CLEAR_CACHE') {
    console.log('[Service Worker] Clearing cache...');
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.keys().then((keys) => {
          return Promise.all(
            keys.map((key) => cache.delete(key))
          );
        }).then(() => {
          // Cache Version zurücksetzen
          const cacheVersionRequest = new Request('/api/cache-version');
          const cacheVersionResponse = new Response(
            JSON.stringify({ version: CACHE_VERSION, name: CACHE_NAME, cleared: true }),
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Cache-Version': CACHE_VERSION.toString(),
                'Cache-Control': 'no-cache, no-store, must-revalidate'
              }
            }
          );
          return cache.put(cacheVersionRequest, cacheVersionResponse);
        });
      }).then(() => {
        // Erfolgsmeldung an Client
        event.ports[0].postMessage({
          type: 'CLEAR_CACHE_SUCCESS',
          version: CACHE_VERSION
        });
      }).catch((error) => {
        console.error('[Service Worker] Clear cache failed:', error);
        event.ports[0].postMessage({
          type: 'CLEAR_CACHE_ERROR',
          error: error.message
        });
      })
    );
  }

  // Cache-Version abrufen
  if (data.type === 'GET_CACHE_VERSION') {
    console.log('[Service Worker] Getting cache version...');
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match('/api/cache-version');
      }).then((response) => {
        if (response) {
          return response.json().then((data) => {
            event.ports[0].postMessage({
              type: 'CACHE_VERSION',
              version: data.version,
              name: data.name,
              cleared: data.cleared || false
            });
          });
        } else {
          event.ports[0].postMessage({
            type: 'CACHE_VERSION',
            version: CACHE_VERSION,
            name: CACHE_NAME,
            cleared: false
          });
        }
      }).catch((error) => {
        console.error('[Service Worker] Get cache version failed:', error);
        event.ports[0].postMessage({
          type: 'CACHE_VERSION',
          version: CACHE_VERSION,
          name: CACHE_NAME,
          cleared: false
        });
      })
    );
  }

  // Cache invalidieren
  if (data.type === 'INVALIDATE_CACHE') {
    console.log('[Service Worker] Invalidating cache...');
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.keys().then((keys) => {
          return Promise.all(
            keys.map((key) => cache.delete(key))
          );
        });
      }).then(() => {
        event.ports[0].postMessage({
          type: 'INVALIDATE_CACHE_SUCCESS',
          version: CACHE_VERSION
        });
      }).catch((error) => {
        console.error('[Service Worker] Invalidate cache failed:', error);
        event.ports[0].postMessage({
          type: 'INVALIDATE_CACHE_ERROR',
          error: error.message
        });
      })
    );
  }
});

// ============================================================================
// SKIP WAITING (beschleunigt Service Worker Updates)
// ============================================================================

self.skipWaiting();
console.log('[Service Worker] Skip waiting - Service Worker wird sofort aktiv');
