# MojoBus – Projekt-Fakten (Referenz)

> Regeln & Tabus → `AGENTS.md` (dort auch der Modulindex)
> Remotion/Render → `docs/CONTEXT_REMOTION.md` | TikTok/KI → `docs/CONTEXT_TIKTOK.md` | Deploy/Server → `docs/CONTEXT_DEPLOY.md`
> Nostr-Framework → `AGENTS_NOSTR_REF.md` | Historie → `MOJOBUS_CHANGELOG.md`

---

## Tech-Stack

| Layer | Technologie |
|-------|------------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 3, shadcn/ui |
| Nostr | @nostrify/nostrify@^0.46.4 |
| Mobile | Capacitor 8 (`co.mojobus.app`), @capawesome/capacitor-file-picker, exifr@^7.1.3 |
| State | TanStack Query @^5.56.2 |
| SEO | @unhead/react@^2.0.10 |
| Backend | Node.js, Express (`server/`, ai-api Port 3002), Groq, OpenRouter |
| Render | Remotion v4, Edge TTS, FFmpeg |

---

## Config-Verzeichnis (`src/config/`)

| Datei | Zweck |
|-------|-------|
| `authors.json` | **Single Source of Truth**: pubkey, npub, nip05 |
| `relays.ts` | Relay-Listen, Autor-Zuordnung, DEFAULT_APP_CONFIG |
| `blossom.ts` | Blossom-Server für Medien-Uploads |
| `routes.ts` | Routen-Definitionen |
| `mainMenu.ts` | Hauptnavigation Desktop + Mobile |
| `cache.ts` | Cache-Zeiten (24h Listen, 7d Profile, 1y Bilder) |
| `performance.ts` | Infinite Scroll, Cache, Relay-Config, **First-Paint** (`FIRST_PAINT_CONFIG`: 2s Fast-Timeout, Limit 15, 3 Home-Cards) |
| `imageService.ts` | Bildoptimierung (weserv/imgproxy/Cloudflare) |
| `prompts/tiktok.js` | TikTok-Prompt (**darf bearbeitet werden**) |
| `prompts/*.js` (Rest) | ⛔ **TABU – niemals ändern** |

Autoren prüfen: `cat src/config/authors.json | jq '.authors[] | {name, pubkey, nip05}'`

---

## Wichtige Frontend-Dateien

| Datei | Zweck |
|-------|-------|
| `src/hooks/usePreloadedData.ts` | Hybrid-Hook: JSON-Dump sofort + Live-Relay im Hintergrund; Fallback zweistufig (2s Fast + Full progressiv) |
| `src/hooks/useVideos.ts` | Lädt kind 34236+34235, Hybrid-Hook, Capacitor-kompatibel |
| `src/pages/VideoPromotion.tsx` | Social-Video-Generator (TikTok/Reels/YouTube Shorts + Longform UI) |
| `src/pages/Videos.tsx` | Video-Feed (kind 34236 NIP-71, 9:16 + 16:9) |
| `src/lib/routeFromGps.ts` | GPS→Route: Haversine-Dedupe, Nominatim, 9:16-Aspect |
| `public/sw.js` | Service Worker v21: staleWhileRevalidate + Cache-First |
| `scripts/generate-site-data.js` | Slim-JSON-Dumps ohne content (Cron 6:15) |
| `scripts/prerender-static.js` | Statische HTML-Seiten mit NIP-19 Dateinamen (Cron 6:00) |
| `mojobus.co.ssl.conf` | Nginx: Bot-Prerender, Brotli, `/data/` max-age=86400 |

Server-seitige Dateien (`server/`) → `docs/CONTEXT_REMOTION.md` bzw. `docs/CONTEXT_TIKTOK.md`.

---

## JSON-Dumps (`/data/`)

| Datei | Inhalt |
|-------|--------|
| `articles.json` | kind-30023, kein content, Tags: title/summary/image/d/t |
| `places.json` | kind-30023 type=place, kein content |
| `notes.json` | kind-1, content max 200 Zeichen |
| `bilder.json` | kind-1 mit image-Tag, content max 200 Zeichen |
| `trips.json` | kind-1 Trips, content max 200 Zeichen |
| `videos.json` | kind 34236+34235, imeta/image/duration/title, content max 300 Zeichen |
| `index.json` | Timestamp `generatedAtUnix`, Anzahlen, Dauer |

**Wichtig**: `useLongformArticle()`, `useNote()` → **nur Relay** (Detailseiten brauchen vollen content).
Nach Deploy ausführen: `node scripts/generate-site-data.js`

---

## Hooks-Übersicht (MojoBus-spezifisch)

| Hook | Quelle | Beschreibung |
|------|--------|-------------|
| `usePreloadedArticles()` | `/data/articles.json` + Relay | Artikel-Liste (auch Home) |
| `usePlaces()` | `/data/places.json` + Relay | Plätze-Liste |
| `useNotes()` | `/data/notes.json` + Relay | Notes + Infinite Scroll |
| Images.tsx | `/data/bilder.json` + Relay | Bilder-Feed |
| `useVideos()` | `/data/videos.json` + Relay | Video-Feed (kind 34236) |
| `useTrips()` | nur Relay, zweistufig | Trips (kind 30025): 2s Fast (limit 15) + 10s Full (limit 100) im Hintergrund |
| `useLongformArticle()` | nur Relay | Detailseiten (voller content) |

**First-Paint-Strategie (Erstbesucher ohne Cache):** Fällt ein JSON-Dump aus,
läuft der Relay-Fallback in `usePreloadedData` zweistufig: FAST (2s, Limit 15 –
Relays liefern neueste zuerst) rendert sofort, FULL (voller Timeout, Limit 1000)
lädt im Hintergrund nach und blockiert nie `isLoading`. Home rendert nur
`FIRST_PAINT_CONFIG.homeCardCount` (3) Cards; Trips sind dort nicht Teil des
blockierenden `isLoading`. Werte: `src/config/performance.ts`.

---

## GPS-Fix (Android)

**Problem**: GPS-EXIF auf Android 10+ aus `content://` URIs redacted.

**Lösung**:
1. `pickFiles({ readData: true })` – base64 direkt vom Picker
2. `ACCESS_MEDIA_LOCATION` zur Laufzeit anfordern:
   ```typescript
   const result = await FilePicker.requestPermissions({ permissions: ['accessMediaLocation'] });
   ```
3. `exifr.gps(file)` auf dem File-Objekt
4. `URL.createObjectURL(file)` für Preview
