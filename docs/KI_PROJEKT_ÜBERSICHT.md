# KI-Projektübersicht: MojoBus.co

> **Aktualisiert:** 2026-09-28
> Kurz-Übersicht für AI-Sessions. Ausführlich: `MOJOBUS_CONTEXT.md` (Projekt-Fakten)
> · `AGENTS.md` (Regeln & Tabus + Modulindex) · `docs/DOKUMENTATION.md` (Technik).

## Projekt-Struktur und Architektur

### Übersicht

MojoBus.co ist eine Nostr-basierte React-Anwendung für eine Vanlife/Travel-
Plattform (Artikel, Orte, Trips, Videos, Bilder, Haushaltsbuch). Die Inhalte
liegen als Nostr-Events auf einem eigenen Relay (Haven, `relay.mojobus.co`) +
Primal; das Backend (`ai-api` auf dem VPS) übernimmt KI-Generierung,
Video-Rendering (Remotion), Prerender-Pipeline und Assistent-Funktionen.

### Kern-Funktionen

1. **Nostr-Integration**: Publishing + Lesen über @nostrify (eigener Relay + Primal)
2. **Authentifizierung**: Login mit NIP-07 / NIP-46-Bunker / nsec (mit Warnhinweis)
3. **Content-Typen**: Artikel (30023), Notizen (1), Places (30023 `type=place`), Media (1), Trips (30025), Videos (34235/34236 NIP-71)
4. **Berichte-Assistent** (`/veroeffentlichen`): KI-Texte, SEO-Panel, Entwürfe, Contentpläne (📋), Brand-DNA/Kontinuität + Wetter, GSC-/DataForSEO-Themen mit Nachfrage
5. **Video-Generator** (`/promotion/tiktok`): Remotion-Render (Shorts 9:16 / Longform 16:9), Edge-TTS-Voiceover, Foster-Huntington-Prompts
6. **Reiseziele-Hub** (`/reiseziele` + `/admin/destinations`): NIP-78-Struktur, Pillar-Auto-Erkennung via `t=hub` + `plan`-Tag
7. **Media-Hosting**: Blossom-Uploads (`relay.mojobus.co`), Bild-Optimierung via images.weserv.nl
8. **Kartenintegration**: Leaflet-Karte (`/map`) mit GPS-Markern (`gps_lat`/`gps_lon`)
9. **Haushaltsbuch** (`/budget`): privates Budget-Tracking (kinds 39041/9042/9043/39044) mit NIP-42 AUTH
10. **Zap-Unterstützung**: Lightning-Zaps via NWC (`useNWC`, lazy @getalby/sdk)

### Technologie-Stack

- **Frontend**: React 19 (19.2.8) mit TypeScript 5.5
- **Build-Tool**: Vite 6 (`tsc --noEmit` im Build; `any` verboten)
- **Styling**: TailwindCSS 3, shadcn/ui, Radix UI, Lucide Icons (zentral `@/lib/icons`)
- **State-Management**: React Query (TanStack Query v5)
- **Routing**: React Router DOM 6
- **Karten**: Leaflet mit React-Leaflet (`map-vendor`-Chunk)
- **Markdown-Editor**: Milkdown (`milkdown-vendor`-Chunk)
- **Nostr-Bibliotheken**: @nostrify/nostrify + @nostrify/react (JSR), nostr-tools
- **SEO**: @unhead/react
- **Mobile**: Capacitor 8 (`co.mojobus.app`) — fetch-URLs immer mit `getApiBaseUrl()`/`getDataBaseUrl()`
- **Backend**: Node.js/Express (`server/`, systemd `ai-api`, Port 3002), Remotion v4, Edge TTS, FFmpeg (`/usr/local/bin/`)

### Projektstruktur

```
/projects/mojobusco/
├── src/
│   ├── components/          # UI-Komponenten (ui/, assistant/, article/, auth/ …)
│   ├── contexts/            # React Contexts (AppContext, NWCContext)
│   ├── hooks/               # ~45 Custom Hooks (Nostr, Auth, Feeds, Budget …)
│   ├── lib/                 # Utilities (canonicalUrl, apiBase, apiAuth, gps …)
│   ├── pages/               # Route-Komponenten (+ publish/, admin/, promotion/)
│   ├── services/            # NostrBroadcastService, ContentManagerService
│   ├── types/               # TypeScript-Typen
│   └── config/              # ⭐ ALLE Konfigurationen
├── public/                  # Statische Assets + Cron-Dumps (data/, prerender/)
├── server/                  # ⛔ ai-api Backend (nur mit Auftrag ändern)
├── scripts/                 # Cron-Pipeline: site-data → prerender → sitemap → feed
├── deploy-main.sh           # VPS-Deploy
└── docs/                    # Kontext-Doku (siehe AGENTS-Modulindex)
```

### Wichtige Konfigurationsdateien

#### `src/config/authors.json` (+ `relays.ts`)
- **Single Source of Truth** für Autoren: pubkey, npub, nip05, Anzeige-Name
  (Mojo→„Max", Susanne)
- `relays.ts`: RELAYS (Kategorien), RELAY_PRESETS, DEFAULT_APP_CONFIG (read/write)

#### `src/config/types.ts`
Zentrale Typdefinitionen (MenuItem, Country, DIYCategory, ArticleCategory,
Author, RelayConfig, Route …).

#### `src/config/nostr.ts`
Legacy-Basis-Konstanten (kinds 1/30023/0, Cache-Defaults); aktive Kinds siehe
Tabelle unten.

#### Weitere
`contentCategories.ts` (Tag-Regeln), `routes.ts` + `mainMenu.ts`, `app.ts`
(SITE_URL), `years.ts`, `ai-models.js` (KI-Tier, Sync-Kopie in
`server/config/`), `api-auth.js` (NIP-98-Prefixe), `performance.ts` +
`performance.config.ts`, `prompts/` (⛔ Tabu; Ausnahme `tiktok.js`).

### Autoren- und Relay-Konfiguration

#### Autoren
1. **Max („Mojo")**:
   - NPUB: `npub1f4vym2mu3q9fsz08muz8d469hl568l5358qx90qlaspyuz67ru0sfxvupf`
   - Pubkey: `4d584dab7c880a9809e7df0476d745bfe9a3fe91a1c062bc1fec024e0b5e1f1f`
   - NIP-05: `mojo@mojobus.co`

2. **Susanne**:
   - NPUB: `npub1jn4arsy5pzqausut0u79x2mnur2dd34szcxnlc9c5407f828002qdls5wz`
   - Pubkey: `94ebd1c0940881de438b7f3c532b73e0d4d6c6b0160d3fe0b8a55fe49d477bd4`
   - NIP-05: `susanne@mojobus.co`

#### Relay-Konfiguration (Details: `docs/KONFIGURATION.md`)
- **Read (Standard)**: `relay.mojobus.co` + `relay.primal.net`, 2 Relays, 3000ms
- **Write (aktiv)**: `relay.mojobus.co`
- **Blossom-Uploads**: `relay.mojobus.co`
- **Haushaltsbuch**: `relay.mojobus.co/private` mit NIP-42 AUTH, 10s-Timeout
- Alle Presets/URLs zentral in `relays.ts` (kein Hardcoding)

### Hooks und Services

#### Wichtige Hooks (Auswahl — 45+ in `src/hooks/`)
- `useNostr.ts`: Nostr-Verbindung (Re-Export @nostrify/react)
- `useNostrPublish.ts`: Event-Veröffentlichung
- `useCurrentUser.ts`: Login-State
- `usePreloadedData.ts`: Hybrid JSON-Dump + Live-Relay
- `useContent.ts` / `useLongformArticles.ts` / `useNotes.ts` / `useVideos.ts` / `useTrips.ts`: Feeds
- `useBatchedSocialCounts.tsx`: Social-Counts-Batching (Feeds)
- `useBudget.ts` + `useBudgetRelay.ts`: Haushaltsbuch (NIP-42)
- `useNWC.ts` / `useWallet.ts`: Lightning (lazy SDK-Load)
- `useUploadFile.ts`: Blossom-Upload
- `useAuthors.ts` / `useAuthorRelays.ts`: Autoren/Relay-Management

#### Services
- `NostrBroadcastService.ts`: Event-Broadcasting mit Retry-Logik
- `ContentManagerService.ts`: Inhaltsverwaltung und -validierung

### Seitenstruktur (Auswahl)
`Home` · `Articles` (+ `ArticlesYear` Jahresarchiv, DIY/Leon/RVLife/StrandOrt-
Unterkategorien) · `Notes` · `Images` (+ Natur) · `Places` · `MapPage` ·
`TripsPage`/`TripDetail` · `Videos`/`VideoDetail` · `DestinationsPage`
(`/reiseziele`) · `Publish` (`/veroeffentlichen`, 5 Tabs) ·
`PromotionDashboard` (`/promotion`) · `VideoPromotion` (`/promotion/tiktok`) ·
`BudgetPage` · `About` · `admin/AboutAdmin` + `admin/DestinationsAdmin` ·
`Settings` · `ServiceWorkerSettings` · `Profile` · `NotFound`

### Nostr-Integration

#### Event-Kinds (aktiv im Projekt)

| Kind | Zweck |
|------|-------|
| 0 | Profil-Metadaten |
| 1 | Kurznotizen / Media-Posts / Teaser-Notes |
| 1111 | Kommentare (NIP-22) |
| 27235 | NIP-98-HTTP-Auth (KI-/Assistent-Routen) |
| 30023 | Artikel + Places (`type=place`, NIP-23) |
| 30025 | Trips (GPS-Tracks) |
| 30078 | NIP-78 App-Data (About, Destinations-Struktur, Contentplan-Historie) |
| 34235/34236 | Videos (NIP-71) |
| 39041 | Budget-Einträge (addressable) |
| 9042/9043 | Budget-Kategorien/-Settings |
| 39044 | AFA-Einträge |
| 9041/9044 | Legacy-Budget (nur Migration) |

#### Tag-Strukturen
- `d`: Identifier (replaceable/addressable) · `t`: Themen-Tags ·
  `type`: article|place|media|trip · `l`: Sprache (de/en) ·
  `plan`/`t=hub`: Reiseziel-Zuordnung (Contentplan/Pillar) ·
  `g`: Geohash · `gps_lat`/`gps_lon`: Koordinaten · `e`/`p`: Referenzen ·
  `published_at`: Original-Datum (bei Edits unverändert!)

### Deployment und Build

#### Build-System
- **Build**: `npm run build` (= `tsc --noEmit` + `build-intelligent.js` mit Cache)
- **Dev-Server**: `npm run dev` (Port 8080)
- **Analyse**: `npm run analyze` (Bundle-Analyse)
- **Tests**: `npm run test` (Vitest) — **nur auf explizite Anforderung** (AGENTS-Regel 7)

#### Deployment (Standard: eigener VPS)
1. **VPS (produktiv)**: `deploy-main.sh --force` auf
   `/root/deploy-git/mojobusco` → Webroot
   `/home/nginx/domains/mojobus.co/public` + ai-api-Neustart.
   Details: `docs/CONTEXT_DEPLOY.md`, `docs/VPS_DEPLOY_GUIDE.md`
2. Cron-Pipeline auf dem VPS (alle 3 h): site-data → prerender → sitemap → feed
3. `netlify.toml` / `vercel.json` / `deno.json` = **inaktive Fallback-Configs**

### Security und Zugriffskontrolle

#### Autorisierung
- KI-/Render-/Assistent-Routen: **NIP-98-Auth** (kind 27235), Allowlist =
  `src/config/authors.json`, `AI_AUTH_REQUIRED=1` in `ai-api.env`
- Frontend signiert via `authedFetch` (`src/lib/apiAuth.ts`, `ApiAuthBridge`)
- nsec-Login nur mit Warnhinweis (Extension/Bunker bevorzugt)

#### Private Relays
- `relay.mojobus.co` (stable): Schreiben nur für die Autoren
- `relay.mojobus.co/private` (Budget): NIP-42 AUTH, lesen+schreiben nur Autoren

### Sicherheits-Hardening (umgesetzt, Juni 2026)

Alle 10 Items aus `docs/PLAN_SICHERHEIT_SEO_OPTIMIERUNG.md` sind umgesetzt
(XSS-Fix in `convertTextLinks`, AI_AUTH_REQUIRED=1, Health/Bot-Cache-Token,
CORS-Allowlist, Security-Header via `security-headers.conf` (CSP Report-Only),
nsec-Warnung, Prerender-Unterkategorien + hreflang, HTML must-revalidate +
SW-Update-Toast, ESLint `no-explicit-any` + `npm run audit` + Promotion-Rate-Limits).

### Erweiterungshinweise

1. **Relay-Konfiguration**: `src/config/relays.ts` (nie hartcodieren)
2. **Autoren-Verwaltung**: `src/config/authors.json` (Single Source of Truth)
3. **Neue Content-Typen**: `src/config/contentCategories.ts` + passender Hook
4. **Neue KI-Endpunkte**: Prefix in `src/config/api-auth.js` ergänzen (NIP-98!)
5. **TypeScript**: Typen aus `src/config/types.ts`, **kein `any`** (ESLint error)
6. **Neue fetch-URLs**: immer `getApiBaseUrl()`/`getDataBaseUrl()` (Capacitor)

### Bekannte Einschränkungen
1. Primal-Relay flakt gelegentlich (0 Events bei Timeout) — produktive Quelle ist relay.mojobus.co
2. SW-Cache: nach Deploy + Cron ggf. Hard-Reload nötig (Update-Toast vorhanden)
3. Offline-First teilweise (SW cached Dumps/Assets, Nostr-Queries immer live)
4. GLIBC-Besonderheit: Remotion-Compositor läuft auf AlmaLinux 9.8 im
   Software-Fallback (~4 FPS) — Details `docs/CONTEXT_REMOTION.md`

---

**Letzte Aktualisierung**: 2026-09-28
**Projektstatus**: Produktiv (mojobus.co)
**Nostr-Integration**: Vollständig (eigener Haven-Relay + Primal)
**Autoren**: Max („Mojo"), Susanne
**Backend**: ai-api auf VPS (CentminMod, AlmaLinux 9.8, Port 3002)
