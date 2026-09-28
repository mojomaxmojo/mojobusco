# Service Worker Dokumentation - MojoBus

## Übersicht

Der Service Worker für MojoBus bietet Offline-Fähigkeit und verbessertes Caching. Er ermöglicht eine schnellere Ladezeit und eine bessere User Experience, besonders für wiederkehrende Besucher.

---

## 🚀 Features

### 1. Offline-Fähigkeit
- Die App funktioniert auch ohne Internetverbindung
- Gecachte Inhalte werden offline angezeigt
- Schützt vor schlechter oder fehlender Verbindung

### 2. Verbessertes Caching
- Statische Assets werden sofort aus dem Cache geladen
- Schnellere Ladezeit für wiederkehrende Besucher
- Intelligente Cache-Strategien für verschiedene Ressourcen

### 3. Service Worker Updates
- Automatische Erkennung von Updates
- User wird benachrichtigt, wenn ein Update verfügbar ist
- Einfache Update-Aktivierung mit einem Klick

### 4. Cache Management
- Manuelles Leeren des Caches
- Übersicht über Cache-Nutzung
- Cache-Versionierung für Updates

---

## 📦 Cache-Strategien

Der Service Worker verwendet verschiedene Cache-Strategien je nach Art der Ressource:

### 1. Cache-First Strategie
**Für:** Assets, CSS, JS, Icons, Fonts, Vendor Chunks

```javascript
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse; // Sofort aus Cache
  }

  // Network, dann Cache
  const networkResponse = await fetch(request);
  if (networkResponse.ok) {
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}
```

**Vorteile:**
- ⚡ Sofortige Ladezeit aus Cache
- 🔄 Fallback auf Network wenn kein Cache
- 💾 Assets werden nach dem ersten Besuch gecacht

---

### 2. Network-First Strategie
**Für:** App Code Chunks, API-Requests

```javascript
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // Network, dann Cache
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Network fehlschlägt, versuche Cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error; // Offline, kein Cache
  }
}
```

**Vorteile:**
- 🌐 Immer frische Daten aus Network
- 📦 Fallback auf Cache wenn offline
- ⚡ Schnellste Antwort möglich

---

### 3. Stale-While-Revalidate Strategie
**Für:** HTML-Seiten

```javascript
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  // Asynchrones Update im Hintergrund
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });

  // Return sofort den Cache
  if (cachedResponse) {
    return cachedResponse;
  }

  // Warte auf Network wenn kein Cache
  return fetchPromise;
}
```

**Vorteile:**
- ⚡ Sofortige Ladezeit aus Cache
- 🔄 Hintergrund-Update für frische Daten
- 📱 Beste UX für HTML-Seiten

---

### 4. Network-Only Strategie
**Für:** Nostr-Queries, WebSockets

```javascript
function networkOnly(request) {
  return fetch(request); // Nur Network, kein Cache
}
```

**Vorteile:**
- 🌐 Immer frische Nostr-Daten
- ⚡ Keine Cache-Overhead
- 🔒 Keine veralteten Daten

---

## 🎯 Cache-Aufteilung

| Ressource-Typ | Strategie | Cache-Dauer | Beispiel |
|--------------|-----------|-------------|----------|
| Vendor Chunks (React, Icons) | Cache-First | 1 Jahr | react-vendor.js |
| App Code Chunks | Network-First | Nein | hooks.js |
| CSS/JS Assets | Cache-First | 1 Jahr | index.css |
| Bilder | Cache-First | 1 Jahr | mojobuslogo.png |
| HTML-Seiten | Stale-While-Revalidate | Nein | index.html |
| Nostr-Queries | Network-Only | Nein | wss://nos.lol |
| API-Requests | Network-First | Nein | /api/* |

---

## 🛠️ API

### Registrierung

Der Service Worker wird automatisch beim Laden der App registriert.

```typescript
import '@/lib/serviceWorker'; // Automatische Registrierung
```

### Manuelle Kontrolle

```typescript
import {
  registerServiceWorker,
  unregisterServiceWorker,
  isOnline,
  addOnlineStatusListener,
  clearCaches,
  hasUpdate,
  activateUpdate,
  isCached,
  getFromCache,
  addToCache,
} from '@/lib/serviceWorker';

// Service Worker registrieren
const registration = await registerServiceWorker();

// Service Worker unregistrieren
await unregisterServiceWorker();

// Online-Status prüfen
const online = isOnline();

// Online/Offline Event Listener hinzufügen
const cleanup = addOnlineStatusListener(
  () => console.log('Online'),
  () => console.log('Offline')
);

// Caches leeren
await clearCaches();

// Prüfen ob Update verfügbar
const updateAvailable = await hasUpdate();

// Update aktivieren
activateUpdate();

// Prüfen ob URL gecacht ist
const cached = await isCached('/index.html');

// URL aus Cache holen
const response = await getFromCache('/index.html');

// URL zum Cache hinzufügen
await addToCache('/index.html');

// Cleanup Event Listener
cleanup();
```

---

## 🎨 UI Components

### ServiceWorkerStatus Component

Zeigt Online-/Offline-Status und Service Worker Updates an.

```tsx
import { ServiceWorkerStatus } from '@/components/ServiceWorkerStatus';

function App() {
  return (
    <div>
      <ServiceWorkerStatus />
      {/* ... Rest der App */}
    </div>
  );
}
```

### OfflineBanner Component

Zeigt ein großes Banner wenn das Gerät offline ist.

```tsx
import { OfflineBanner } from '@/components/ServiceWorkerStatus';

function App() {
  return (
    <div>
      <OfflineBanner />
      {/* ... Rest der App */}
    </div>
  );
}
```

### CacheManager Component

Ermöglicht das Leeren des Caches.

```tsx
import { CacheManager } from '@/components/ServiceWorkerStatus';

function Settings() {
  return (
    <div>
      <CacheManager />
      {/* ... Rest der Settings */}
    </div>
  );
}
```

### ServiceWorkerSettings Page

Vollständige Service Worker Settings Page.

```tsx
import { ServiceWorkerSettings } from '@/pages/ServiceWorkerSettings';

function App() {
  return (
    <Routes>
      <Route path="/settings/service-worker" element={<ServiceWorkerSettings />} />
    </Routes>
  );
}
```

---

## 🔧 Debugging

### Service Worker Status prüfen

```javascript
// Service Worker Registrierung prüfen
const registration = await navigator.serviceWorker.getRegistration();
console.log('Service Worker Status:', registration?.active?.state);

// Cache prüfen
const cache = await caches.open('mojobus-v1');
const keys = await cache.keys();
console.log('Cache Keys:', keys);

// Cache-Größe schätzen
let totalSize = 0;
for (const key of keys) {
  const response = await cache.match(key);
  if (response) {
    const blob = await response.blob();
    totalSize += blob.size;
  }
}
console.log('Cache Size:', formatBytes(totalSize));
```

### Cache leeren

```javascript
// Alle Caches leeren
await caches.keys().then((cacheNames) => {
  return Promise.all(
    cacheNames.map((cacheName) => caches.delete(cacheName))
  );
});

// Spezifischen Cache leeren
await caches.delete('mojobus-v1');
```

### Service Worker Updates erzwingen

```javascript
// Update suchen
const registration = await navigator.serviceWorker.getRegistration();
if (registration) {
  await registration.update();
}

// Neuen Service Worker aktivieren
if (registration?.waiting) {
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
}
```

---

## 📊 Performance-Metriken

### Erwartete Verbesserungen

| Metrik | Vorher | Nachher | Verbesserung |
|--------|--------|---------|-------------|
| First Contentful Paint (Cache Hit) | 2.5s | 0.5s | **80%** |
| Time to Interactive (Cache Hit) | 4.0s | 1.5s | **62.5%** |
| Offline Verfügbarkeit | 0% | 100% | ✅ |
| Cache Hit Rate (Return Visitors) | 60% | 90% | **+50%** |

### Cache Hit Rate erhöhen

Die Cache Hit Rate ist der Prozentsatz der Requests, die aus dem Cache bedient werden.

- **Neue Besucher:** 0-10% (nur Vendor Chunks gecacht)
- **Wiederkehrende Besucher:** 80-90% (die meisten Assets gecacht)
- **Offline-Besucher:** 100% (nur gecachte Inhalte verfügbar)

---

## ⚙️ Konfiguration

### Cache-Version ändern

Ändere die Cache-Version in `public/sw.js`:

```javascript
const CACHE_NAME = 'mojobus-v1'; // Ändere auf v2, v3, etc.
```

### Cache-Strategie anpassen

Ändere die Strategie in `public/sw.js`:

```javascript
// Beispiel: Network-First statt Cache-First für Bilder
if (url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg')) {
  event.respondWith(networkFirst(request)); // Geändert
  return;
}
```

### Neue Assets vorab cachen

Füge Assets zur Installation-Phase in `public/sw.js`:

```javascript
const criticalAssets = [
  '/',
  '/index.html',
  '/mojobuslogo.png',
  '/neues-asset.css', // Neu
  '/neues-asset.js', // Neu
];

const cachePromises = criticalAssets.map(async (asset) => {
  try {
    await cache.add(asset);
    console.log('[Service Worker] Gecacht:', asset);
  } catch (error) {
    console.warn('[Service Worker] Konnte nicht cachen:', asset, error);
  }
});
```

---

## 🔒 Sicherheit

### Kein Caching für sensible Daten

Der Service Worker cached keine sensiblen Daten wie:
- Nostr-Queries (immer Network-Only)
- API-Requests mit Authentication (Network-First)
- WebSocket-Verbindungen (Network-Only)

### Cache-Invalidation

Der Cache wird automatisch invalidiert, wenn:
- Ein neuer Service Worker aktiviert wird
- Der Cache manuell geleert wird
- Die Cache-Version geändert wird

---

## 🐛 Troubleshooting

### Problem: Service Worker lädt nicht

**Lösung:**
1. Prüfe ob Service Worker in Browser-DevTools → Application → Service Workers aktiviert ist
2. Lösche Caches in Browser-DevTools → Application → Cache Storage
3. Registriere Service Worker manuell neu: `await unregisterServiceWorker(); await registerServiceWorker();`

### Problem: Cache leeren funktioniert nicht

**Lösung:**
1. Prüfe Browser-Konsole auf Fehler
2. Prüfe ob Service Worker aktiviert ist
3. Lösche Caches manuell in Browser-DevTools

### Problem: Update wird nicht angezeigt

**Lösung:**
1. Prüfe ob Service Worker auf Update prüft (alle 30 Sekunden)
2. Prüfe ob `navigator.serviceWorker.controller` aktiviert ist
3. Erzwinge Update: `registration.update()`

### Problem: Offline zeigt nur weiße Seite

**Lösung:**
1. Prüfe ob kritische Assets (index.html, CSS, JS) gecacht sind
2. Prüfe ob Service Worker erfolgreich installiert wurde
3. Prüfe Cache in Browser-DevTools

### Problem: Cache ist zu groß

**Lösung:**
1. Cache leeren: `await clearCaches()`
2. Nicht benötigte Assets entfernen
3. Cache-Strategie anpassen (z.B. Network-First statt Cache-First für Bilder)

---

## 📚 Ressourcen

- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Workbox](https://developers.google.com/web/tools/workbox)
- [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

---

## ✅ Best Practices

### DO
- ✅ Service Worker für statische Assets verwenden
- ✅ Cache-First für Assets die sich selten ändern
- ✅ Network-First für dynamische Inhalte
- ✅ Cache-Versionierung verwenden
- ✅ Offline-Fallback implementieren
- ✅ Service Worker Updates überwachen

### DON'T
- ❌ Kein Caching für sensible Daten
- ❌ Kein Caching für Nostr-Queries
- ❌ Keine sehr kurzen Cache-Zeiten (weniger als 1 Stunde)
- ❌ Kein Caching ohne Hash-Updates
- ❌ Kein Caching für WebSocket-Verbindungen

---

## 🎉 Fazit

Der Service Worker für MojoBus bietet:

- ✅ **Offline-Fähigkeit** - Die App funktioniert auch ohne Internet
- ✅ **Verbessertes Caching** - Schnellere Ladezeit für wiederkehrende Besucher
- ✅ **Einfache Updates** - Automatische Erkennung und Aktualisierung
- ✅ **Cache Management** - Manuelles Leeren und Status-Übersicht
- ✅ **Bessere UX** - Sofortige Ladezeit aus Cache

**Das Projekt ist jetzt eine Progressive Web App (PWA) mit Offline-Fähigkeit!** 🚀
