# Service Worker Dokumentation - MojoBus

> **Aktualisiert:** 2026-09-28 — an den aktuellen Service Worker
> (`public/sw.js`, Version wird beim Deploy **automatisch erhöht** durch
> `bump_sw_version()` in `deploy-main.sh`) angeglichen.

## Übersicht

Der Service Worker bietet Offline-Fähigkeit und stufenweises Caching:Assets
sofort aus dem Cache, Cron-Dumps stale-while-revalidate, Nostr immer live.

---

## 🚀 Features

### 1. Offline-Fähigkeit
- Gecachte Assets, Bilder und `/data/`-Dumps werden offline angezeigt
- Offline-Fallback: `503`-Antwort „Offline - Keine Verbindung" statt Crash

### 2. Stufenweises Caching
- Statische Assets/Bilder sofort aus dem Cache (1 Jahr, immutable)
- JSON-Dumps sofort aus dem Cache + Hintergrund-Update
- Nostr-Queries immer live (Network-Only)

### 3. Service Worker Updates
- SW-Version wird bei **jedem Deploy automatisch erhöht** (`bump_sw_version()`
  in `deploy-main.sh`) — keine manuelle Pflege der `CACHE_VERSION` mehr
- Update wird als **Toast mit Reload-Button** angezeigt
  (`ServiceWorkerUpdateToast.tsx`) — bewusst KEIN Auto-Reload (Formular-Schutz)

### 4. Cache Management
- Manuelles Leeren über die App: `/settings/service-worker`
- Cache-Namen versioniert (`mojobus-v{N}`); beim Aktivieren löscht der SW alle
  alten Caches

---

## 🎯 Cache-Strategien (routing im fetch-Handler, `public/sw.js`)

| # | Anfrage | Strategie | Begründung |
|---|---------|-----------|------------|
| 1 | `*.css/js/woff/woff2/ttf/eot/otf`, `/assets/*` | **Cache-First** | Hash-Assets, 1 Jahr (CACHE_TIMES.STATIC_ASSETS: 30 Tage Cache-Objekt-Lebenszeit) |
| 2 | `/data/*` | **Stale-While-Revalidate** | Cron-Dumps (3 h): sofort liefern, Hintergrund-Update |
| 3 | `/prerender/*` | **Cache-First** | Statische Bot-/SEO-Seiten aus dem Cron |
| 4 | `images.weserv.nl`, `blossom.primal.net`, `*.png/jpg/jpeg/gif/webp/avif/svg` | **Cache-First** | Bilder sind immutable (Hash/Blossom-Hash), 1 Jahr (CACHE_TIMES.IMAGES) |
| 5 | `*.html`, `/` | **Network-First** | Frische HTML-Shell (Server liefert ohnehin `must-revalidate`) |
| 6 | `/api/*` | **Stale-While-Revalidate** | API-Antworten schnell + Hintergrund-Frische |
| 7 | `wss:`-WebSockets, `relay.*`-Hosts | **Network-Only** | Nostr immer live, kein Cache |
| — | Default | **Network-First** | Sicherer Fallback |

**Robustheits-Fixes in `staleWhileRevalidate()`:** Hintergrund-Fetch wird nur
bei `response.ok` gecacht (kein 404/500 im Cache), Fehler werden immer
abgefangen (kein unhandled rejection), Offline → letzter Cache-Stand oder 503.

**Precache beim Install:** `/icon.png`, `/apple-touch-icon.png`,
`/mojobuslogo.png`, Favicons + Cache-Version-Eintrag.

---

## 🛠️ API (`src/lib/serviceWorker.ts`)

```typescript
import {
  registerServiceWorker, unregisterServiceWorker,
  isOnline, addOnlineStatusListener,
  clearCaches, hasUpdate, activateUpdate,
  isCached, getFromCache, addToCache,
} from '@/lib/serviceWorker';

const registration = await registerServiceWorker();
await clearCaches();
const updateAvailable = await hasUpdate();
activateUpdate();
```

Registrierung erfolgt automatisch beim App-Start (App.tsx →
`ServiceWorkerStatus`-Komponente).

---

## 🎨 UI

| Komponente | Ort | Zweck |
|------------|-----|-------|
| `ServiceWorkerStatus` | `src/components/` | Online/Offline-Status + Update-Check |
| `OfflineBanner` | `src/components/ServiceWorkerStatus.tsx` | Banner bei Offline |
| `CacheManager` | `src/components/ServiceWorkerStatus.tsx` | Cache leeren (Settings) |
| `ServiceWorkerUpdateToast` | `src/components/` | Toast „Neue Version verfügbar" + Reload-Button (Fix #9) |
| `ServiceWorkerSettings` | `src/pages/` | `/settings/service-worker` — Status, Cache-Verwaltung |

---

## 🔧 Debugging

### Status prüfen
```javascript
const registration = await navigator.serviceWorker.getRegistration();
console.log('SW Status:', registration?.active?.state);
const keys = await (await caches.open('mojobus-v21')).keys();  // Versionsname siehe /settings/service-worker
```

### Update erzwingen
```javascript
const reg = await navigator.serviceWorker.getRegistration();
await reg?.update();
reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
```

### Caches leeren
```javascript
await caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
```

---

## ⚙️ Konfiguration

### Cache-Version
Wird **automatisch** beim Deploy erhöht (deploy-main.sh: `bump_sw_version()`).
Manuelle Anpassung der `CACHE_VERSION` in `public/sw.js` ist nur für
Sonderfälle nötig (z. B. lokaler Test).

### Cache-Zeiten (`CACHE_TIMES` in sw.js)
```javascript
STATIC_ASSETS: 30 Tage (Cache-Objekt-Lebenszeit für CSS/JS/Fonts)
IMAGES:        1 Jahr (immutable URLs)
API:           5 Minuten
```

### Neue Assets vorab cachen
`CRITICAL_ASSETS`-Array im `install`-Handler von `public/sw.js` erweitern.

---

## 🔒 Sicherheit

- **Kein Caching für:** Nostr-WebSockets (Network-Only), Auth-Requests über
  `Authorization: Nostr …` laufen über `/api/` (SWR, Sensible werden nicht
  dauerhaft exposiert — Signatur im Header, nicht im Body)
- Cache-Invalidation automatisch: neuer SW (neue Version) → alte Caches
  gelöscht; Deploy erhöht die Version zuverlässig

---

## 🐛 Troubleshooting

| Problem | Lösung |
|---------|--------|
| SW lädt nicht | DevTools → Application → Service Workers prüfen; `unregisterServiceWorker()` + `registerServiceWorker()` |
| Cache leeren funktioniert nicht | Console-Fehler prüfen; manuell: DevTools → Application → Clear storage |
| Update wird nicht angezeigt | `registration.update()` erzwingen; prüfen ob deploy-main.sh die Version erhöht hat (`grep CACHE_VERSION public/sw.js`) |
| Offline nur weiße Seite | Prerender-/Dump-Fallbacks: `/` lädt network-first — ohne Netz die zuletzt gecachten Dumps prüfen (`/data/*.json`) |
| Alte JSON-Dumps nach Deploy | Hard-Reload (Shift+F5); SWR holt beim nächsten Lauf frisch (bekannte Einschränkung, siehe CONTEXT_DEPLOY) |

---

## ✅ Best Practices

### DO
- ✅ Cache-First für Assets mit Hash/immutable URLs
- ✅ Stale-While-Revalidate für Cron-Dumps
- ✅ Versionierung + Auto-Bump beim Deploy
- ✅ Update-Toast statt Auto-Reload

### DON'T
- ❌ Kein Caching für WebSockets/Nostr-Queries
- ❌ Keine 404/500-Antworten in den Cache (Fix ist eingebaut)
- ❌ Kein Auto-Reload der App (kann Formulareingaben zerstören)
