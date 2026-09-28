# MojoBus - Technische Dokumentation

> **Aktualisiert:** 2026-09-28 (React 19, Cache-Werte, Event-Kinds, Routen,
> Deployment auf VPS-Realität korrigiert)
> Modul-Index & Regeln: `AGENTS.md` · Projekt-Fakten: `MOJOBUS_CONTEXT.md` ·
> Nostr-Patterns: `AGENTS_NOSTR_REF.md`

## Inhaltsverzeichnis

1. [Projektübersicht](#projektübersicht)
2. [Architektur](#architektur)
3. [Technologie-Stack](#technologie-stack)
4. [Projektstruktur](#projektstruktur)
5. [Konfigurationssystem](#konfigurationssystem)
6. [Nostr-Integration](#nostr-integration)
7. [Content-Typen](#content-typen)
8. [Hooks und State Management](#hooks-und-state-management)
9. [Routing](#routing)
10. [Performance-Optimierungen](#performance-optimierungen)
11. [Deployment](#deployment)
12. [Development-Workflow](#development-workflow)

---

## Projektübersicht

**MojoBus** ist eine dezentrale Vanlife/Travel-Plattform für Perpetual Travelers,
basierend auf dem Nostr-Protokoll. Die Autoren Max („Mojo") und Susanne
veröffentlichen Artikel, Notizen, Orte, Bilder, Trips und Videos als
Nostr-Events; die Website liest sie von den Relays und wird für Bots per
Prerender statisch ausgeliefert.

### Hauptfeatures

- **Dezentrales Publishing**: Inhalte als Nostr-Events auf Relays (eigener Haven-Relay `relay.mojobus.co` + Primal)
- **Content-Typen**: Artikel (30023), Notizen (1), Orte/Places (30023 + `type=place`), Bilder/Media (1), Trips (30025, GPS-Tracks), Videos (34235/34236, NIP-71)
- **Berichte-Assistent** (`/veroeffentlichen`): KI-Generierung, SEO-Panel, Entwürfe, Contentpläne, Brand-DNA/Kontinuität
- **Reiseziele-Hub** (`/reiseziele`): Destinations-Hub über Contentpläne (`plan`-Tag + NIP-78-Struktur)
- **Video-Pipeline**: Remotion-Rendering auf dem VPS (ai-api), TikTok/Reels/YouTube-Formate
- **Karten-Integration**: Leaflet-Karte (`/map`) mit GPS-Markern
- **Haushaltsbuch** (`/budget`): privates Budget-Tracking auf eigenem Relay-Path mit NIP-42 AUTH
- **PWA + Android-APK**: Service Worker, Capacitor 8 (`co.mojobus.app`)
- **Prerender/SEO**: statische Bot-HTML-Seiten (3-h-Cron), Sitemaps, RSS-Feeds, hreflang de/en

---

## Architektur

### Client-Side Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Application                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Pages     │  │  Components │  │       Hooks         │  │
│  │  (lazy)     │  │  (shadcn/ui)│  │  (45+ Custom Hooks) │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                Nostrify React Layer (@nostrify/react)       │
│         (NostrProvider, NostrLoginProvider, ApiAuthBridge)  │
├─────────────────────────────────────────────────────────────┤
│              React Query (TanStack Query v5)                 │
├─────────────────────────────────────────────────────────────┤
│                     Nostr Protocol                           │
│              WebSocket → Nostr Relays                        │
└─────────────────────────────────────────────────────────────┘
```

### Datenfluss

1. **Lesen**: React Query cached Relay-Queries (staleTime 10 min, siehe `src/config/performance.ts`); Feeds nutzen den **Hybrid-Hook** `usePreloadedData` (JSON-Dump sofort + Live-Relay im Hintergrund)
2. **Schreiben**: `useNostrPublish` signiert Events mit dem User-Signer (NIP-07/nsec/Bunker)
3. **KI-/Assistent-Routen**: `authedFetch` (`src/lib/apiAuth.ts`) signiert NIP-98-Auth-Events (kind 27235) gegen die ai-API
4. **Bots**: Nginx liefert statisches Prerender-HTML aus (`/prerender/`, 3-h-Cron auf dem VPS)
5. **Offline**: Service Worker (`public/sw.js`) cached Assets/Dumps

---

## Technologie-Stack

### Core Framework
- **React 19.2.8** - UI Framework
- **TypeScript 5.5.3** - Type Safety (`tsc --noEmit` im Build, `any` verboten)
- **Vite 6.3.5** - Build Tool (SWC-Plugin)

### State Management & Data Fetching
- **TanStack Query (React Query) 5.x** - Server State Management
- **@nostrify/react 0.2.8** - Nostr React Integration (via JSR)
- **@nostrify/nostrify 0.46.4** - Nostr Protocol Implementation (via JSR)

### UI Components
- **Radix UI** - Headless UI primitives (pro Route gesplittet, kein monolithischer Chunk mehr)
- **Tailwind CSS 3.4.11** - Utility-first CSS
- **shadcn/ui** - Komponenten-Design-System
- **Lucide React** - Icons (zentral: `src/lib/icons.ts`)
- **Leaflet + React-Leaflet** - Karten (eigener `map-vendor`-Chunk)
- **Milkdown** - Markdown-Editor im Berichte-Formular (eigener `milkdown-vendor`-Chunk)

### Nostr-spezifisch
- **nostr-tools 2.x** - Nostr Utility Functions (NIP-19-Encoding, NIP-98-Verify auf dem Server)
- **@getalby/sdk 5.1.1** - Lightning/NWC (lazy via `await import()` in `useNWC.ts`)

### Mobile
- **Capacitor 8** (`co.mojobus.app`) + Geolocation/File-Picker/EXIF-Plugins — alle fetch-URLs brauchen `getApiBaseUrl()`/`getDataBaseUrl()` (AGENTS-Regel 3)

### Build & Deploy
- **VPS**: CentminMod, AlmaLinux 9.8, Nginx, `deploy-main.sh`
- **Backend**: Express (`server/`, systemd `ai-api`, Port 3002) — Remotion v4, Edge TTS, FFmpeg

---

## Projektstruktur

```
/projects/mojobusco/
├── public/                      # Statische Assets + Cron-Dumps
│   ├── data/                    # JSON-Dumps (articles/places/destinations/contentplans …)
│   ├── sw.js                    # Service Worker (Version wird beim Deploy auto-erhöht)
│   └── ...
│
├── src/
│   ├── components/              # React Components
│   │   ├── ui/                  # shadcn/ui Components
│   │   ├── assistant/           # Berichte-Assistent (ContentPlanSheet, DraftsOverview …)
│   │   ├── article/             # ArticleView-Teile (PlanRelatedArticles …)
│   │   ├── auth/                # Login (NIP-07/nsec/Bunker)
│   │   ├── Header.tsx, Footer.tsx, SiteSearch.tsx
│   │   └── ...
│   │
│   ├── pages/                   # Route Pages (lazy)
│   │   ├── Home.tsx, Articles.tsx, ArticlesYear.tsx, Notes.tsx, Images.tsx
│   │   ├── Places.tsx, DestinationsPage.tsx, Videos.tsx, VideoDetail.tsx
│   │   ├── MapPage.tsx, TripDetail.tsx, About.tsx
│   │   ├── Publish.tsx + publish/  (ArticleForm + 8 Module unter articleForm/)
│   │   ├── PromotionDashboard.tsx, VideoPromotion.tsx (TikTok/Video-Generator)
│   │   ├── admin/               # AboutAdmin, DestinationsAdmin
│   │   └── BudgetPage.tsx, Settings.tsx, ServiceWorkerSettings.tsx …
│   │
│   ├── hooks/                   # ~45 Custom Hooks
│   │   ├── useNostr.ts, useNostrPublish.ts, useCurrentUser.ts
│   │   ├── usePreloadedData.ts  # Hybrid: JSON-Dump + Live-Relay
│   │   ├── useContent.ts, useLongformArticles.ts, useNotes.ts, useVideos.ts, useTrips.ts
│   │   ├── useBatchedSocialCounts.tsx  # Social-Counts-Batching
│   │   └── ...
│   │
│   ├── config/                  # ⭐ ALLE Konfigurationen (AGENTS-Regel 1)
│   │   ├── authors.json         # Single Source of Truth: Autoren-Stammdaten
│   │   ├── relays.ts            # Relays, Presets, DEFAULT_APP_CONFIG
│   │   ├── contentCategories.ts # Content-Typen + Tag-Regeln
│   │   ├── routes.ts, mainMenu.ts, app.ts, years.ts
│   │   ├── performance.ts / performance.config.ts
│   │   ├── ai-models.js         # KI-Modell-Tier (Sync-Kopie in server/config/)
│   │   ├── api-auth.js          # NIP-98-Route-Prefixe (Server liest mit)
│   │   └── prompts/             # ⛔ KI-Prompts (TABU; Ausnahme: tiktok.js)
│   │
│   ├── lib/                     # Utilities
│   │   ├── canonicalUrl.ts      # ⭐ Canonical URLs (AGENTS-Regel 2)
│   │   ├── apiBase.ts           # getApiBaseUrl()/getDataBaseUrl() (Capacitor)
│   │   ├── apiAuth.ts           # NIP-98-Signierung (authedFetch)
│   │   ├── icons.ts, imageUtils.ts, gpsExtraction.ts, jsonld.ts
│   │   └── ...
│   │
│   ├── services/                # NostrBroadcastService, ContentManagerService
│   ├── contexts/                # AppContext, NWCContext
│   ├── types/                   # TypeScript Types
│   └── App.tsx, AppRouter.tsx, main.tsx
│
├── server/                      # ⛔ ai-api Backend (nur mit Auftrag ändern)
│   ├── server.js                # Express, Port 3002 (127.0.0.1)
│   ├── routes/, services/, middleware/, config/
│   ├── remotion/                # Render-Engine (render/ core.js …, flows/, components/)
│   └── data/                    # continuity.db, assistant.db (Deploy-sicher gesichert)
│
├── scripts/                     # Cron-Pipeline (VPS): generate-site-data.js,
│                                # prerender-static.js, generate-sitemap.js,
│                                # generate-feed.js, prerender-helpers.js …
├── deploy-main.sh               # VPS-Deploy-Skript
├── mojobus.co.ssl.conf          # Nginx-Vhost-Vorlage
└── docs/, MOJOBUS_CONTEXT.md, AGENTS.md
```

---

## Konfigurationssystem

### Autoren (`src/config/authors.json` — Single Source of Truth)

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

`src/config/relays.ts` re-exportiert `AUTHORS` (mit Anzeige-Name „Max" für id
`mojo`). Alle Cron-Skripte (`scripts/*.js`) lesen **authors.json**; TypeScript-
Komponenten importieren aus relays.ts. **Niemals** Pubkeys duplizieren.

### Relay-Konfiguration (`src/config/relays.ts`)

**Relay-Kategorien**: `fast` (Damus, Strfry) · `reliable` (Primal) ·
`search` (Bitcoiner.social) · `stable` (MojoBus Private, MojoBus Budget) · `nip11`

**Presets** (`RELAY_PRESETS`):

| Preset | Relays | Timeout | Verwendung |
|--------|--------|---------|------------|
| mojobus | relay.mojobus.co + relay.primal.net | 3000ms | Standard Lesen/Schreiben |
| fast | relay.mojobus.co + relay.primal.net | 4000ms | Performance |
| balanced | + nos.lol | 5000ms | Zuverlässigkeit |
| mojo_publish / susanne_publish | relay.mojobus.co | 3000ms | Autor-Publish |
| mojo_blossom / susanne_blossom | relay.mojobus.co (Blossom) | — | Datei-Uploads |
| budget | relay.mojobus.co/private | 10000ms | Haushaltsbuch (NIP-42 AUTH) |

**DEFAULT_APP_CONFIG** (Read/Write getrennt):

```typescript
export const DEFAULT_APP_CONFIG = {
  read:  { relayUrls: ['wss://relay.mojobus.co', 'wss://relay.primal.net'],
           maxRelays: 2, queryTimeout: 3000 },
  write: { relayUrls: ['wss://relay.mojobus.co', 'wss://relay.primal.net'],
           maxRelays: 2, activeRelay: 'wss://relay.mojobus.co' },
  enableDeduplication: true,
};
```

---

## Nostr-Integration

### Event Kinds (im Projekt aktiv)

| Kind | Name | Verwendung |
|------|------|------------|
| 0 | Metadata | Profil-Daten (Name, Bild, NIP-05) |
| 1 | Short Text Note | Notizen, Media-Posts (Bilder), Teaser-Notes |
| 1111 | Comment | Kommentare (NIP-22) |
| 27235 | HTTP Auth | NIP-98-Auth für ai-api-Routen (KI/Render/Assistent) |
| 30023 | Long-form Content | Artikel **und** Places (`type=place`), NIP-23 |
| 30025 | Trip | GPS-Tracks (kind-Adressable, `encodeTripNaddr()`) |
| 30078 | App Data (NIP-78) | About-Seite, Reiseziel-Struktur (`d=co.mojobus.app.destinations`), Contentplan-Historie |
| 34235 / 34236 | Video (NIP-71) | Video-Events (`/videos`) |
| 39041 | Budget-Eintrag | Haushaltsbuch (addressable, d-Tag `budget…`) |
| 9042 / 9043 | Budget-Kategorie/Settings | Haushaltsbuch (replaceable) |
| 39044 | AFA-Eintrag | Haushaltsbuch (addressable) |
| 9041 / 9044 | Legacy | Alte reguläre Budget-Events (nur Migration) |

### Nostr-Provider Hierarchy (`src/App.tsx`)

```tsx
<UnheadProvider head={head}>        {/* SEO/Meta (with InferSeoMetaPlugin) */}
  <AppProvider>                     {/* App Config Context */}
    <QueryClientProvider>           {/* React Query */}
      <NostrLoginProvider>          {/* Login State */}
        <NostrProvider>             {/* Nostr Connection */}
          <NWCProvider>             {/* Lightning Wallet */}
            <TooltipProvider>
              <ApiAuthBridge />     {/* NIP-98: meldet Signer an authedFetch an */}
              <Toaster />
              <ServiceWorkerStatus />
              <ServiceWorkerUpdateToast />
              <AppRouter />
            </TooltipProvider>
          </NWCProvider>
        </NostrProvider>
      </NostrLoginProvider>
    </QueryClientProvider>
  </AppProvider>
</UnheadProvider>
```

### Nostr Hooks

#### useNostrPublish
Veröffentlicht signierte Events zu Relays:

```typescript
const publish = useNostrPublish();
await publish.mutateAsync({
  kind: 30023,
  content: markdownContent,
  tags: [
    ['d', 'article-id'],
    ['title', 'My Article'],
    ['type', 'article'],
    ['t', 'artikel'],
    ['t', 'mojobus'],     // immer enthalten
  ],
});
```

Tag-Aufbau zentral in `createRequiredTags()` (`src/config/contentCategories.ts`);
Publish-Flow im Berichte-Formular: `src/pages/publish/articleForm/useArticlePublish.ts`.

#### Query-Timeouts (AGENTS_NOSTR_REF.md)

Queries immer mit Timeout:
`AbortSignal.any([c.signal, AbortSignal.timeout(1500)])` — Werte je Hook
(3 s im mojobus-Preset, 10 s für Budget/AUTH).

---

## Content-Typen

### Content Categories (`src/config/contentCategories.ts`)

```typescript
export const CONTENT_CATEGORIES = {
  notes:    { kind: 1,     tags: { required: ['notes', 'note', 'mojobus'], … } },
  places:   { kind: 30023, tags: { required: ['location', 'places', 'mojobus'], … } },  // type=place
  articles: { kind: 30023, tags: { required: ['artikel', 'mojobus'], … } },               // type=article
  // Weitere Kategorien/Gruppen: src/config/tags.ts (TAG_GROUPS),
  // rvlife.ts, strandort.ts, diy.ts, leon.ts, countries.ts
};
```

### Tag-Validierung

Artikel: `d`-Tag + `title` + (`type=article` **oder** `t=artikel`).
Places: `type=place`. Media: kind 1 mit Bild-URLs (`t=media`/`bilder`).
Prerender-/Pipeline-Skripte filtern kind:1-Fremd-Content zusätzlich über
`isMojobusKind1()` (`scripts/prerender-helpers.js`) — AGENTS-Regel 15.

### Veröffentlichen (`/veroeffentlichen` — 5 Tabs)

1. **Bilder/Media** (kind 1) — Bild-Upload, EXIF/GPS, Reiseziel-Zuordnung
2. **Trips** (kind 30025) — GPS-Track, `TripPublishForm.tsx`
3. **Berichte** (kind 30023) — Milkdown-Editor, KI-Generierung, SEO-Panel, Entwürfe
4. **Plätze** (kind 30023 + `type=place`) — GPS, Rating, Facilities
5. **Note** (kind 1) — kurze Texte

Canonical URLs (AGENTS-Regel 2): Artikel/Orte `https://mojobus.co/{naddr}` ·
Trips `/trip/{naddr}` · Media `/bild/{note}` · Profile `/{npub}`
(`src/lib/canonicalUrl.ts`).

---

## Hooks und State Management

### React Query Konfiguration (`src/App.tsx` + `src/config/performance.ts`)

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      staleTime: DEFAULT_PERFORMANCE_CONFIG.cache.staleTime,  // 10 Minuten
      gcTime: DEFAULT_PERFORMANCE_CONFIG.cache.gcTime,        // 1 Stunde
      retry: DEFAULT_PERFORMANCE_CONFIG.relay.retry.attempts, // 1
      retryDelay: exponential backoff (500ms → max 3s),
    },
  },
});
```

### Wichtige Hooks

| Hook | Zweck |
|------|-------|
| `usePreloadedData` | Hybrid: JSON-Dump sofort rendern + Live-Relay progressiv |
| `useContent` | Kombinierte kind 1+30023-Query (Feeds) |
| `useLongformArticles` / `useNotes` / `useVideos` / `useTrips` | Typ-Feeds |
| `useBatchedSocialCounts` | Alle Like/Repost/Kommentar-Counts im Batch (1–2 Queries statt 50–500 Subscriptions) |
| `useCurrentUser` / `useNostrPublish` / `useNostr` | Basis (siehe AGENTS_NOSTR_REF.md) |
| `useBudget` | Haushaltsbuch (privates Relay, NIP-42 AUTH, 5 s Timeout) |
| `useUploadFile` | Blossom-Upload |

---

## Routing

### Route-Definitionen (`src/AppRouter.tsx` + `src/config/routes.ts`)

Öffentliche Seiten sind in `PUBLIC_ROUTE_DEFINITIONS` gesammelt und werden
zweimal gemappt (ohne und **mit `/en/`-Präfix**); Admin-/Auth-Seiten separat:

```typescript
// Öffentlich (je auch unter /en/…):
"/", "/artikel", "/artikel/:country",
"/artikel/jahre", "/artikel/jahr/:year",
"/artikel/diy[/:category]", "/artikel/leon[/:category]",
"/artikel/rvlife[/:category]", "/artikel/strand-ort[/:category]",
"/plaetze[/:country]", "/map", "/map/trips", "/trip/:naddr",
"/bilder[/:country]", "/bilder/natur/:category", "/bild/:nip19",
"/notes[/:country]", "/artikel/notes[/:country]",
"/videos", "/video/:naddr", "/reiseziele", "/about",
"/:nip19"

// Auth/Admin (KEIN /en/-Zugriff):
"/admin/about", "/admin/destinations", "/profile", "/settings",
"/settings/service-worker", "/settings/nostr-handler", "/budget",
"/veroeffentlichen", "/promotion", "/promotion/tiktok"

// Catch-all:
"*" → NotFound
```

### NIP-19 Deep Linking

Die `/:nip19`-Route (`NIP19Page`) fängt `/naddr1…`, `/note1…`, `/npub1…` ab
und leitet auf die passende Ansicht weiter (Canonical je Typ: AGENTS-Regel 2).

---

## Performance-Optimierungen

Details/Historie: `docs/PERFORMANCE_OPTIMIZATIONS.md`, `docs/VENDOR_CHUNK_OPTIMIZATION.md`.

### 1. Lazy Loading
Alle Pages werden per `React.lazy()` geladen; Home ist bewusst eager (LCP).

### 2. Hybrid-Daten laden
`usePreloadedData`: JSON-Dump aus `/data/` (Cron, alle 3 h) rendert sofort,
Live-Relay lädt progressiv nach (2 s Fast-Timeout, dann voll —
`FIRST_PAINT_CONFIG` in `src/config/performance.ts`).

### 3. Social-Counts-Batching
Feed-Seiten laden alle Counts in 1–2 Relay-Queries (`useBatchedSocialCounts`) —
vorher 50–500 Subscriptions pro Seitenaufruf.

### 4. Vendor-Chunks (`vite.config.ts` — aktueller Stand)

| Chunk | Inhalt |
|-------|--------|
| `react-vendor` | react, react-dom, scheduler |
| `milkdown-vendor` | Milkdown + ProseMirror (nur Editor) |
| `nostr-vendor` | nostr-tools, @nostrify, @noble, @scure |
| `react-query-vendor` | @tanstack/react-query |
| `router-vendor` | react-router(-dom) |
| `qrcode-vendor` | qrcode (nur Zap-Dialog) |
| `map-vendor` | leaflet, react-leaflet (nur `/map`) |

Radix UI wird **nicht** mehr in einem manuellen Chunk gebündelt (Rollup
splittet automatisch pro Route). `@getalby/sdk`/`webln` werden lazy geladen.
Alle Assets haben Hash-Dateinamen → 1 Jahr immutable cachebar.

### 5. Service Worker (`public/sw.js`)
Cache-First für Assets/Bilder (1 Jahr), stale-while-revalidate für `/data/`-Dumps,
Cache-First für `/prerender/`-Bot-HTML, Network-Only für Nostr-WebSockets.
Update-Toast statt Auto-Reload (`ServiceWorkerUpdateToast.tsx`). **Die Version
wird bei jedem Deploy automatisch erhöht** (`bump_sw_version()` in deploy-main.sh).

### 6. Prerender (SEO)
`scripts/prerender-static.js` generiert pro Event eine statische HTML-Datei
(NIP-19-Dateiname) inkl. Meta-Tags + JSON-LD; Nginx liefert sie Bots unter
Status 200. Sitemap/RSS ebenfalls aus dem Cron.

---

## Deployment

**Standard:** eigener VPS (CentminMod, AlmaLinux 9.8). Vollständige Anleitung:
`docs/CONTEXT_DEPLOY.md` + `docs/VPS_DEPLOY_GUIDE.md`.

```bash
ssh root@server
cd /root/deploy-git/mojobusco
bash deploy-main.sh --force
systemctl restart ai-api   # nur bei server/-Änderungen
```

| Komponente | Pfad auf dem VPS |
|------------|------------------|
| Webroot | `/home/nginx/domains/mojobus.co/public` |
| Nginx-Vhost | `/usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf` |
| Backend | systemd `ai-api`, Port 3002 (127.0.0.1), WorkingDirectory `…/public/server` |
| Backend-Env | `/etc/systemd/system/ai-api.env` (EnvironmentFile) |
| Cron-Pipeline | site-data → prerender → sitemap → feed (alle 3 h via node.sh) |

`deploy-main.sh` sichert persistente Daten (`server/data/`, `images/articles/`),
kopiert `src/config/api-auth.js` + `authors.json` extra für den Server und
erhöht die SW-Version automatisch.

Die Dateien `netlify.toml`, `vercel.json`, `deno.json` sind **inaktive
Fallback-Configs** (siehe `docs/DEPLOYMENT.md`).

### Environment-Variablen

- **Build-seitig (Frontend)**: `.env.production` (git-ignored, nur auf dem
  VPS-Checkout) — z. B. `VITE_USE_REAL_MAP=true`. VITE_*-Variablen landen im Bundle.
- **Backend**: ausschließlich `/etc/systemd/system/ai-api.env` (KI-Keys,
  `AI_AUTH_REQUIRED=1`, GSC/DFS, `MEDIA_DIR`, `FFMPEG_PATH`, …).

---

## Development-Workflow

### Scripts (package.json)

```bash
npm run dev           # Vite Dev Server (Port 8080)
npm run check         # tsc --noEmit (Typ-Check)
npm run build         # check + intelligenter Build (build-intelligent.js)
npm run build:force   # Build ohne Cache
npm run analyze       # Bundle-Analyse
npm run audit         # npm audit (Frontend + server/)
npm run test          # Build + Vitest (nur auf explizite Anforderung, AGENTS-Regel 7)
npm run apk           # Capacitor Android-APK bauen
npm run deploy        # nsite-Deploy (nostr-deploy-cli) — NICHT der VPS-Weg
```

### Git-Workflow

```bash
# AGENTS-Regel 8+9: build_project grün, dann committen
git add . && git commit -m "feat: …" && git push origin main

# Deployment siehe oben (VPS).
```

---

## Troubleshooting

### 1. Build schlägt fehl — "Cannot find module"
```bash
rm -rf node_modules dist .build-cache.json .assets-cache.json
npm install   # bei JSR-Fehlern: .npmrc beachten (@jsr-Registry, allow-remote)
npm run build
```
Details: `docs/CONTEXT_DEPLOY.md` → „.npmrc – JSR-Scope".

### 2. Events werden nicht geladen
- Relay-Status prüfen (Relay-Selector); relay.mojobus.co erreichbar?
- Browser Console auf WebSocket/CORS-Fehler prüfen
- `isMojobusKind1`-Filter: eigene Posts brauchen die MojoBus-Tags

### 3. Bilder-Upload funktioniert nicht
- Blossom-Server erreichbar? (`src/config/blossom.ts`)
- Dateigröße (Multer-Limit 20 MB/Datei auf ai-api)
- Autoren-Login nötig (NIP-98 für geschützte Routen)

### 4. Service Worker nicht aktualisiert
```javascript
navigator.serviceWorker.getRegistrations().then(rs =>
  rs.forEach(r => r.unregister()));
// Seite neu laden
```

---

## API-Referenz (Auszug)

### Nostrify Methoden

```typescript
// Query Events (immer mit Timeout!)
const events = await nostr.query([
  { kinds: [1, 30023], authors: [pubkey], limit: 50 }
], { signal: AbortSignal.any([c.signal, AbortSignal.timeout(3000)]) });

// Publish Event
await nostr.event(signedEvent, { signal: AbortSignal.timeout(15000) });
```

### ai-api (Port 3002 — Auszug, Details in CONTEXT_DEPLOY/CONTEXT_TIKTOK)

KI-/Render-/Assistent-Routen sind **NIP-98-geschützt** (`AI_AUTH_REQUIRED=1`,
Allowlist = authors.json). Öffentlich: `/api/health` (Token-geschützt),
`/api/prerender-resolve`, `/api/music/*`, Download/Thumbnail-Capability-URLs.

```bash
curl https://mojobus.co/api/generate-note -X POST   # → 401 ohne Autoren-Signatur
```

---

## Glossar

| Begriff | Bedeutung |
|---------|-----------|
| **Nostr** | Notes and Other Stuff Transmitted by Relays - Dezentrales Protokoll |
| **npub/nsec** | Öffentlicher/privater Schlüssel (Bech32, NIP-19) |
| **naddr** | Addressable-Event-Referenz (kind + pubkey + d-Tag) |
| **Relay** | Nostr-Server (hier: eigener Haven `relay.mojobus.co`) |
| **Blossom** | Nostr-kompatibler Datei-Hosting-Service (Uploads) |
| **NWC** | Nostr Wallet Connect - Lightning-Verbindung |
| **NIP-98** | HTTP-Auth via signiertem Nostr-Event (kind 27235) |
| **ai-api** | Express-Backend auf dem VPS (Port 3002, systemd) |
| **Prerender** | Statische Bot-HTML-Seiten aus dem 3-h-Cron |
| **Geohash** | Geografische Koordinaten-Kodierung |

---

## Zusammenfassung

MojoBus ist eine vollständig dezentrale Vanlife-Plattform auf Nostr-Basis mit
eigenem Backend (ai-api) für KI/Rendering/Prerender. Moderne Architektur
(React 19, Vite 6, TypeScript) optimiert für Performance durch Hybrid-Daten
(Dump + Relay), Batching, Lazy Loading und aggressive Caching-Strategien —
plus PWA/APK-Unterstützung für unterwegs.

---

*Dokumentation aktualisiert für MojoBus (Stand 2026-09-28)*
