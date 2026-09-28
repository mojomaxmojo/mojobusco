# 🔧 MojoBus Konfigurations-Übersicht

> **Aktualisiert:** 2026-09-28 (Domain mojobus.co, Config-Quellen relays.ts +
> performance.ts, Nginx = CentminMod-Vhost korrigiert)
> Alle wichtigen Einstellungen für die manuelle Bearbeitung an einem Ort.

---

## 📂 Konfigurationsdateien

### 1. Autoren + Nostr (`src/config/relays.ts` + `src/config/authors.json`)

#### Autoren — Single Source of Truth: `src/config/authors.json`

```json
{
  "authors": [
    {
      "id": "mojo", "name": "Max",
      "npub": "npub1f4vym2mu3q9fsz08muz8d469hl568l5358qx90qlaspyuz67ru0sfxvupf",
      "pubkey": "4d584dab7c880a9809e7df0476d745bfe9a3fe91a1c062bc1fec024e0b5e1f1f",
      "nip05": "mojo@mojobus.co"
    },
    {
      "id": "susanne", "name": "Susanne",
      "npub": "npub1jn4arsy5pzqausut0u79x2mnur2dd34szcxnlc9c5407f828002qdls5wz",
      "pubkey": "94ebd1c0940881de438b7f3c532b73e0d4d6c6b0160d3fe0b8a55fe49d477bd4",
      "nip05": "susanne@mojobus.co"
    }
  ]
}
```

`relays.ts` re-exportiert `AUTHORS` (Anzeige-Name „Max" für id `mojo`).
Alle Cron-Skripte lesen **authors.json** — Pubkeys nie duplizieren
(AGENTS-Regel 1).

#### Nostr Event Kinds (`src/config/nostr.ts` + Projekt-weit)

```typescript
kinds: {
  note: 1,          // Short notes / Media-Posts
  longform: 30023,  // Artikel + Places (type=place), NIP-23
  metadata: 0,      // Profile metadata
}
// Weitere aktive Kinds: 30025 (Trips), 34235/34236 (Videos, NIP-71),
// 30078 (NIP-78 App-Data), 27235 (NIP-98-Auth), 39041/9042/9043/39044 (Budget)
```

#### Verfügbare Relays (`src/config/relays.ts` → `RELAYS`)

| Name | URL | Kategorie |
|------|-----|-----------|
| Damus | `wss://relay.damus.io` | fast |
| Strfry | `wss://nostr.strfry.net` | fast |
| Primal | `wss://relay.primal.net` | reliable |
| Nostr.Bitcoiner | `wss://nostr.bitcoiner.social` | search |
| MojoBus Private | `wss://relay.mojobus.co` | stable |
| MojoBus Budget | `wss://relay.mojobus.co/private` | stable (NIP-42) |

#### Presets (`RELAY_PRESETS`)

| Preset | Relays | Timeout |
|--------|--------|---------|
| mojobus | relay.mojobus.co + relay.primal.net | 3000ms |
| fast | relay.mojobus.co + relay.primal.net | 4000ms |
| balanced | + nos.lol | 5000ms |
| mojo_publish / susanne_publish | relay.mojobus.co | 3000ms |
| mojo_blossom / susanne_blossom | Blossom: relay.mojobus.co | — |
| budget | relay.mojobus.co/private | 10000ms |

#### Read/Write-Konfiguration (`DEFAULT_APP_CONFIG` in relays.ts)

```typescript
read:  { relayUrls: ['wss://relay.mojobus.co', 'wss://relay.primal.net'],
         maxRelays: 2, queryTimeout: 3000 },
write: { relayUrls: ['wss://relay.mojobus.co', 'wss://relay.primal.net'],
         maxRelays: 2, activeRelay: 'wss://relay.mojobus.co' },
enableDeduplication: true,
```

---

### 2. App-Konfiguration (`src/App.tsx` + `src/config/performance.ts`)

Die QueryClient-Defaults kommen **nicht mehr inline** aus App.tsx, sondern aus
`DEFAULT_PERFORMANCE_CONFIG` (`src/config/performance.ts`):

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      staleTime: 1000 * 60 * 10,   // 10 Minuten (cache.staleTime)
      gcTime: 1000 * 60 * 60,      // 1 Stunde (cache.gcTime)
      retry: 1,                    // relay.retry.attempts
      retryDelay: exponential (500ms base → max 3000ms),
    },
  },
});
```

Die App-Relay-Config wird aus `relays.ts` gespreadt:

```typescript
const defaultConfig: AppConfig = {
  theme: THEME_CONFIG.defaultTheme,
  ...DEFAULT_APP_CONFIG,   // read/write/enableDeduplication (siehe oben)
};
```

`AppConfig`-Interface: `src/contexts/AppContext.ts` (theme, relayUrls,
activeRelay, maxRelays, enableDeduplication, queryTimeout — plus read/write
in der DEFAULT_APP_CONFIG-Struktur).

---

## 🎮 Performance-Optimierungs-Parameter

### Infinite Scroll / Feeds

- `itemsPerPage: 15` (`DEFAULT_PERFORMANCE_CONFIG.infiniteScroll`,
  konsumiert von Leon.tsx/DIY.tsx)
- `FIRST_PAINT_CONFIG`: `firstPaintTimeout: 2000ms`, `firstPaintLimit: 15`,
  `homeCardCount: 3`, `progressiveTimeout: 7500ms` — Hybrid-Laden
  (JSON-Dump sofort, Relay progressiv) via `usePreloadedData`
- Social-Counts im Batch: `useBatchedSocialCounts` (1–2 Queries pro Feed-Seite)

### Bild-Optimierung (`src/lib/imageUtils.ts` + `src/config/imageService.ts`)

Externer Optimierungs-Service (**images.weserv.nl**, Standard) — Größen/Qualität
siehe `imageUtils.ts`; Env-Schalter: `VITE_IMAGE_SERVICE_URL`,
`VITE_IMAGE_SERVICE_TYPE`, `VITE_ENABLE_IMAGE_SERVICE`,
`VITE_DEFAULT_IMAGE_QUALITY`, `VITE_DEFAULT_IMAGE_FORMAT`
(**VITE_-Prefix**, nicht NEXT_PUBLIC_). Details: `docs/IMAGE_SERVICE_CONFIG.md`.

### Code Splitting (`vite.config.ts` — aktueller Stand)

#### Vendor-Chunks

```typescript
'react-vendor'        → react, react-dom, scheduler
'milkdown-vendor'     → Milkdown + ProseMirror (nur Editor)
'nostr-vendor'        → nostr-tools, @nostrify, @noble, @scure
'react-query-vendor'  → @tanstack/react-query
'router-vendor'       → react-router(-dom)
'qrcode-vendor'       → qrcode (nur Zap-Dialog)
'map-vendor'          → leaflet, react-leaflet (nur /map)
```

Radix UI: **kein** manueller Chunk mehr (Rollup splittet automatisch pro
Route). `@getalby/sdk`/`webln`: lazy via `await import()` in `useNWC.ts`.
Alle Assets mit Hash → 1 Jahr immutable cachebar. Details:
`docs/VENDOR_CHUNK_OPTIMIZATION.md`.

---

## 🌐 Deployment-Konfiguration

**Standard:** eigener VPS (CentminMod, AlmaLinux 9.8) — Details:
`docs/CONTEXT_DEPLOY.md` + `docs/VPS_DEPLOY_GUIDE.md`.

### Nginx (`mojobus.co.ssl.conf` im Repo → VPS)

```nginx
# CentminMod-Pfad auf dem VPS (NICHT /etc/nginx/):
# /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf

server {
    server_name mojobus.co www.mojobus.co;
    root /home/nginx/domains/mojobus.co/public;

    # Static Asset Caching (Hash-Assets)
    location ~* \.(js|css|woff2?|png|jpg|webp|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTML: frisch (Fix #9) + Security-Header-Include
    # /prerender/ + Bot-Rewrites + @prerender_resolve → ai-api (siehe CONTEXT_DEPLOY)

    # Backend-Proxy:
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
    }

    # SPA-Fallback: try_files … /index.html
}
```

Deploy der Config:
```bash
cp mojobus.co.ssl.conf /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf
nginx -t && systemctl reload nginx
```

### Deploy (Standard)

```bash
cd /root/deploy-git/mojobusco
bash deploy-main.sh --force
systemctl restart ai-api   # bei server/-Änderungen
```

### Netlify/Vercel/Deno

`netlify.toml`, `vercel.json`, `deno.json` sind **inaktive Fallback-Configs**
(siehe `docs/DEPLOYMENT.md`) — nicht mit dem VPS-Deploy verwechseln.

---

## 🔧 Manuelle Anpassungs-Möglichkeiten

### 1. Mehr Relays für höhere Zuverlässigkeit
In `src/config/relays.ts` → `RELAY_PRESETS.mojobus.relayUrls` erweitern
(Timeout ggf. auf 4000–5000ms anheben).

### 2. Längere/shortere Cache-Zeiten
In `src/config/performance.ts` → `DEFAULT_PERFORMANCE_CONFIG.cache.staleTime/gcTime`.

### 3. Mehr Artikel pro Seite
In `src/config/performance.ts` → `infiniteScroll.itemsPerPage`.

### 4. Höhere Bildqualität
In `src/config/imageService.ts` (Default-Qualität) bzw. Env-Variablen
(`VITE_DEFAULT_IMAGE_QUALITY`).

### 5. Build-Verhalten (Minify, Sourcemaps, CSS-Split)
In `src/config/performance.config.ts` (Build-Performance) — **separat** von
`performance.ts` (QueryClient/First-Paint).

---

## 📊 Performance-Konfiguration im Überblick

| Parameter | Wert | Datei | Zweck |
|-----------|------|-------|-------|
| **Read-Relays** | mojobus.co + primal | relays.ts | Queries |
| **Write-Relay (aktiv)** | mojobus.co | relays.ts | Publishing |
| **maxRelays** | 2 | relays.ts | Parallele Relays |
| **queryTimeout** | 3000ms | relays.ts | Max. Wartezeit |
| **staleTime** | 10 min | performance.ts | Cache-Frischheit |
| **gcTime** | 1 h | performance.ts | Cache-Lebensdauer |
| **retry** | 1 (500ms→3s) | performance.ts | Fehlerversuche |
| **itemsPerPage** | 15 | performance.ts | Infinite Scroll |
| **firstPaintTimeout** | 2000ms | performance.ts | Fast-Render ohne Cache |
| **homeCardCount** | 3 | performance.ts | Home-Cards |
| **Bild-Service** | images.weserv.nl | imageService.ts | Optimierung |
| **Static Cache** | 1y immutable | nginx config | Hash-Assets |

---

## 🔄 Wie man Änderungen anwendet

1. Parameter in der entsprechenden `src/config/`-Datei ändern
   (keine Hardcoded-Werte im Quellcode — AGENTS-Regel 1)
2. `npm run build` (inkl. tsc --noEmit) muss grün sein
3. Committen + Deploy (`docs/CONTEXT_DEPLOY.md`)
4. Im Shakespeare-Preview/dev-Server wirken Config-Änderungen sofort
