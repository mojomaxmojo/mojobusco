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
| `performance.ts` | **Schlank (ausgemistet)**: `FIRST_PAINT_CONFIG` (2s Fast-Timeout, Limit 15, 3 Home-Cards) + `DEFAULT_PERFORMANCE_CONFIG` (itemsPerPage 15, QueryClient cache/retry-Defaults). Build-Performance lebt in `performance.config.ts` |
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
| `scripts/generate-sitemap.js` | `sitemap.xml` + `sitemap-videos.xml` (Cron 6:00) |
| `scripts/generate-feed.js` | `feed.xml` (DE) + `feed-en.xml` (EN), getrennt nach `l`-Tag (Cron alle 6h) |
| `scripts/prerender-helpers.js` | Gemeinsame Helfer aller Prerender-Skripte: `isMojobusKind1()`, `isTeaserNote()`, `isPlace/isTrip/isMedia`, `encodeNaddr`, `findTranslationPair`, `isTripEvent()`, `encodeTripNaddr()`, `extractTripWaypoints/Photos/Distance()` (Trips = kind:30025, siehe unten) |
| `scripts/prerender-meta.js` | SEO-Head-Baustein (`buildHead`) + JSON-LD-Builder für alle Prerender-Templates |
| `scripts/prerender-entity-templates.js` | HTML-Templates je Event-Typ (Artikel, Note, Ort, Trip, Video, Bild, Profil) |
| `scripts/prerender-category-templates.js` | HTML-Templates für Kategorie-/Listenseiten (`/artikel`, `/notes`, `/plaetze`, ...) |
| `mojobus.co.ssl.conf` | Nginx: Bot-Prerender, Brotli, `/data/` max-age=86400 |

**Wichtig – `isMojobusKind1()` (`scripts/prerender-helpers.js`)**: Alle
kind:1-Queries in den Prerender-/Sitemap-/Site-Data-Skripten MÜSSEN mit
`isMojobusKind1(event)` gefiltert werden, bevor das Event als Note/Ort/
Trip/Media verarbeitet wird. Grund: Die Autoren-Pubkeys werden auch in
anderen Nostr-Clients (Primal, Amethyst, Damus) für private Notes,
Replies und Reposts genutzt, die nichts mit mojobus.co zu tun haben.
Kriterium: Event hat entweder das Tag `['t','mojobus']` (alle über
`/veroeffentlichen` erstellten Posts) oder ist eine automatisch erzeugte
Teaser-Note mit `a`-Tag-Verweis auf ein Original-Event (`isTeaserNote()`).
Ohne diesen Filter landen Fremd-Posts fälschlich in Sitemap, RSS-Feed
und Prerendering. **Neue kind:1-Queries in diesen Skripten immer mit
diesem Filter versehen.**

**Trip-Verarbeitung (kind:30025)**: `prerender-static.js`,
`generate-sitemap.js` und `generate-site-data.js` verarbeiten Trips
seit der kind:30025-Migration (`FEATURE-XXX-PLAN.md`, alle 7 Schritte
umgesetzt) über die echten **kind:30025**-Trip-Events
(`TripPublishForm.tsx`), nicht mehr über kind:1-Teaser-Notes.
naddr-Encoding läuft über `encodeTripNaddr()` (kein
`event.kind || 30023`-Fallback, kein `isMojobusKind1()`-Filter nötig,
da kind:30025 ausschließlich über `TripPublishForm.tsx` erzeugt wird).
`renderTripHtml()` zeigt echte Wegpunkte/Distanz statt nur Teaser-Text.

Server-seitige Dateien (`server/`) → `docs/CONTEXT_REMOTION.md` bzw. `docs/CONTEXT_TIKTOK.md`.

---

## JSON-Dumps (`/data/`)

| Datei | Inhalt |
|-------|--------|
| `articles.json` | kind-30023, kein content, Tags: title/summary/image/d/t |
| `places.json` | kind-30023 type=place ODER kind-1 (nur `isMojobusKind1()`-gefiltert), kein/wenig content |
| `notes.json` | kind-1, nur `isMojobusKind1()`-gefiltert, content max 200 Zeichen |
| `bilder.json` | kind-1 mit image-Tag, nur `isMojobusKind1()`-gefiltert, content max 200 Zeichen |
| `trips.json` | kind-30025 Trip-Events, authors-gefiltert (kein `isMojobusKind1()` nötig), Tags: d/title/summary/image/waypoint/distance/distance_unit/video/country/category/trip_type/t/l/L. Wird von keinem Frontend-Hook konsumiert (`useTrips()` fragt direkt kind:30025 vom Relay ab). |
| `videos.json` | kind 34236+34235, imeta/image/duration/title, content max 300 Zeichen |
| `index.json` | Timestamp `generatedAtUnix`, Anzahlen, Dauer |

**Wichtig**: `useLongformArticle()`, `useNote()` → **nur Relay** (Detailseiten brauchen vollen content).
Nach Deploy ausführen: `node scripts/generate-site-data.js`

**Feeds (`/feed.xml` + `/feed-en.xml`)**: RSS 2.0, getrennt nach `l`-Tag
(DE/EN) statt einem gemischtsprachigen Feed. Nur kind-30023-Artikel ohne
`isPlace()` (Orte werden ausgefiltert, sonst landen sie fälschlich als
"Artikel" im Feed). `<enclosure>` nutzt den echten MIME-Type der
Bild-Endung + versucht die echte Byte-Größe per HEAD-Request zu holen.
Generiert von `scripts/generate-feed.js` (Cron alle 6h).

---

## Inhaltstypen → NIP / Kind-Zuordnung

| Inhalt | Kind | NIP | Hinweise |
|--------|------|-----|----------|
| **Artikel** | 30023 | **NIP-23** (Long-form Content, addressable) | `title/summary/image/d/t`, `l`-Tag für Sprache (DE/EN) |
| **Plätze** | 30023 `type=place` ODER kind 1 | NIP-23 bzw. **NIP-01** | Orte über `type=place`-Tag von Artikeln unterschieden; kind-1-Fälle nur `isMojobusKind1()`-gefiltert |
| **Trips** | 30025 | Custom Addressable (kein offizieller NIP) | Ausschließlich über `TripPublishForm.tsx` erzeugt; naddr via `encodeTripNaddr()`, kein `isMojobusKind1()`-Filter nötig |
| **Videos** | 34235 (16:9), 34236 (9:16/Short) | **NIP-71** (Video Events) | API-tags aus `imeta`, image/duration/title |
| **Bilder** | kind 1 mit `image`-Tag | NIP-01 | Nur `isMojobusKind1()`-gefiltert |
| **Notes** | kind 1 | NIP-01 | Nur `isMojobusKind1()`-gefiltert |

**Referenz-Routen** (canonical URLs): Artikel/Orte `/{naddr}`, Notes `/{note}`,
Trips `/trip/{naddr}`, Bilder `/bild/{note}`, Profile `/{npub}`,
Videos `/video/{naddr}`.

**Kanonische NIP-19-URLs OHNE Relay-Hints (SEO-Regel):** Web-URLs werden immer
mit `canonicalNaddr()` (`src/lib/canonicalUrl.ts`) kodiert — `naddrEncode`
ohne `relays`. Relay-Hints ändern den kompletten Bech32-String (Derselbe
Artikel = andere URL) und passen dann nicht zu Sitemap/Prerender-Datei.
Frontend: ArticleView/Places/Articles/Kategorie-Pages/MapMarkerPopup kodieren
kanonisch. Geteilte Client-Links MIT Hints löst der Server auf:
`GET /api/prerender-resolve?uri=…` (`server/routes/prerender-fallback.js`)
dekodiert den NIP-19-String, entfernt Hints und antwortet 301 auf die
kanonische URL — oder 404, wenn es keine Prerender-Datei gibt. Nginx reicht
404s aus `/prerender/` dorthin (`error_page 404 = @prerender_resolve;`
in `mojobus.co.ssl.conf` — NIEMALS `error_page 404 = /index.html`, das
lieferte Bots Homepage-Metas unter Status 200).

---

## Hooks-Übersicht (MojoBus-spezifisch)

| Hook | Quelle | Beschreibung |
|------|--------|-------------|
| `usePreloadedArticles()` | `/data/articles.json` + Relay | Artikel-Liste (auch Home) |
| `usePlaces()` | `/data/places.json` + Relay | Plätze-Liste |
| `useNotes()` | `/data/notes.json` + Relay | Notes + Infinite Scroll |
| Images.tsx | `/data/bilder.json` + Relay | Bilder-Feed |
| `useVideos()` | `/data/videos.json` + Relay | Video-Feed (kind 34236) |
| `useTrips()` | nur Relay, zweistufig | Trips (kind 30025): 2s Fast (limit 15) + 10s Full (limit 100) im Hintergrund. Beide Queries filtern nach `authors: NOSTR_CONFIG.authorPubkeys` (Fix `FEATURE-XXX-PLAN.md` Schritt 6). |
| `useLongformArticle()` | nur Relay | Detailseiten (voller content) |
| `useContinuityTracking()` | `/api/continuity/track` | Meldet nach Publish Artikel/Platz/Note/Media/Trip an die Kontinuitäts-DB (nicht-blockierend, Capacitor-kompatibel) |
| `useBatchedSocialCounts()` | 1–2 Relay-Batch-Queries pro Feed | **Social-Counts-Batch**: SocialBatchProvider um Feed-Grids (Home, Notes, Articles, Places, Images) lädt Likes/Reposts/Comments/Zaps für ALLE Cards in einer Query (`['social-counts','batch',…]` + `['zaps','batch',…]`). SocialBar liest im Batch-Scope aus dem Context statt pro Card eigene Queries zu starten (vorher 50–500 Subscriptions pro Feed-Aufruf). Invalidation-Flows unverändert: Like/Repost → `['social-counts']`-Prefix, Zap → `['zaps']`-Prefix. 60s-Zap-Polling nur noch auf Detailseiten (`useZaps(..., { poll })`). `useAuthor` ohne Retry, 7d-Cache, statischer Fallback aus `AUTHORS` (`relays.ts`) bei fehlendem kind:0-Profil. |

**First-Paint-Strategie (Erstbesucher ohne Cache):** Fällt ein JSON-Dump aus,
läuft der Relay-Fallback in `usePreloadedData` zweistufig: FAST (2s, Limit 15 –
Relays liefern neueste zuerst) rendert sofort, FULL (voller Timeout, Limit 1000)
lädt im Hintergrund nach und blockiert nie `isLoading`. Home rendert nur
`FIRST_PAINT_CONFIG.homeCardCount` (3) Cards; Trips sind dort nicht Teil des
blockierenden `isLoading`. Werte: `src/config/performance.ts`.

---

## Kontinuitäts-Gedächtnis + Wetter-Kontext (in /veroeffentlichen)

**Zweck**: Nach dem Publish werden Artikel/Plätze/Notes/Medien/Trips in einer
eigenen SQLite-DB (`server/data/continuity.db`, gleiches Muster wie
`jobs.db`) erfasst: Ort, Motive, Entitäten, Stimmung, offene Fäden. Vor der
NÄCHSTEN KI-Generierung wird diese Historie abgerufen und als zusätzliche
Zeile in `contextLines` eingespeist – zusammen mit echten Wetterdaten
(open-meteo, kostenlos, kein API-Key). So erfindet die KI keine Zahlen mehr
fürs Wetter und wiederkehrende Motive/Orte/offene Fäden werden bewusst
variiert oder aufgegriffen statt zufällig wiederholt.

**Konfiguration** (Autoren-Daten bleiben in `src/config/authors.json`, hier
keine hartcodierten Werte):

| Datei | Zweck |
|-------|-------|
| `server/services/continuity-store.js` | DB-Fundament: `initContinuityDatabase()` + `savePost`/`saveMotifs`/`saveEntities`/`saveOpenThreads`, `getRecentMotifs` (letzte 60 Posts), `getLocationHistory`, `getOpenThreads`, `resolveThread`, `deletePostChildren` (löscht bei erneutem Tracking desselben `dTag` alle alten Motive/Fäden – verhindert Duplikate bei Replaceable Content) |
| `server/services/weather-lookup.js` | open-meteo: `geocodeLocation` (permanenter Geocache), `getWeatherForDate` (Forecast/Archiv je 92-Tage-/16-Tage-Schwelle), `describeWeather` |
| `server/config/weather-codes.js` | `WMO_CODE_DE` – WMO-Wettercodes → kurze deutsche Beschreibung |
| `server/services/generation-context.js` | `getGenerationContext({location,country,date,gpsLat,gpsLon})` → `{ locationHistory, recentMotifs, openThreads, weather }` |
| `server/prompts/continuity-extraction.js` | `buildExtractionPrompt` – weist Mini-Lion an, NUR JSON (Motifs/Entitäten/Mood/Threads) zu extrahieren |
| `server/routes/content/continuity.js` | `POST /api/continuity/track` – extrahiert + speichert, antwortet immer `{ ok: true }` (blockiert Publish nie) |
| `src/hooks/useContinuityTracking.ts` | Frontend-Hook: `trackPublishedPost(...)` (nicht-blockierend, console.warn bei Fehler) |
| `src/config/prompts/lifestyles.js` | **Tabu-Ausnahme**: `buildContinuityContextLine(continuity)` (am Dateiende, kein bestehender Export verändert) |

**Schema** (`server/data/continuity.db`, wird beim Serverstart automatisch
angelegt – `initContinuityDatabase()` + `initWeatherCache()` laufen in
`server.js`):

- `posts` (id, type, kind, title, location, country, mood, published_at)
- `post_motifs` (post_id, motif) · `post_entities` (post_id, entity) ·
  `open_threads` (id, post_id, thread, resolved, created_at)
- `geocode_cache` (key, lat, lon) · `weather_cache` (key, temp, code, wind)

**Ablauf auf `/veroeffentlichen`**:
1. Publish (Artikel/Platz/Note/Media/Trip) → `trackPublishedPost(...)` → `POST /api/continuity/track`.
2. Route extrahiert per Mini-Modell (`generateWithModel(prompt, 'mini', ...)`)
   Motive/Entitäten/Mood/offene Fäden und speichert sie (vorher
   `deletePostChildren` entfernt alte Versionen).
3. Nächste Generierung ruft `getGenerationContext(...)` auf →
   `continuity`-Feld wird in den Prompt-Aufruf gemischt.
4. `generateX*Prompt` baut via `buildContinuityContextLine(continuity)` eine
   Zusatzzeile in `contextLines` (Wetter/Ort/Motive/offene Fäden).

**Geteilte Welt / Einschränkungen**: kein Autor-Filter (Mojo + Susanne teilen
dieselbe Kontinuität). Leere/unbekannte Location → Orts-Historie übersprungen,
Motive/offenen Fäden werden trotzdem geliefert. Motive-Fenster = letzte 60
Posts. `type` wird NICHT als Text in den Prompt geschrieben (nur intern).
Wetter-GPS: vom ersten Bild mit GPS, sonst Geocoding von `location`+`country`
(gerundet auf 2 Dezimalstellen, ~1km). Trips: nur erster/Hauptort (Wegpunkt 1).
Schwelle Forecast/Archiv: 92 Tage; >16 Tage Zukunft → Wetter überspringen.

**Backfill (Bestandsdaten nachtragen):** `scripts/backfill-continuity.js` holt
alle veröffentlichten Events (30023/30025/1, Autor-Filter + isMojobusKind1 +
Teaser/EN-Filter) von den Relays und schreibt sie per DIREKTEM DB-Zugriff +
Mini-LLM-Extraktion (deepseek-v4-pro, native fetch — gleiche Parameter wie
die Track-Route) in die Live-continuity.db. better-sqlite3: Repo-Import mit
Automatik-Fallback auf die funktionierende Webroot-Kopie
(public/server/node_modules) — umgeht npm allow-scripts-Blockaden.
Aufruf auf dem VPS:
```bash
cd /root/deploy-git/mojobusco && git pull
OPENROUTER_API_KEY=$(grep '^OPENROUTER_API_KEY=' /etc/systemd/system/ai-api.env | cut -d= -f2-) \
node scripts/backfill-continuity.js
```
Default-DB-Pfad ist die Live-DB im Webroot (Override: CONTINUITY_DATA_DIR);
fehlt die Datei → Abbruch statt falsche leere DB. Idempotent (hasPost-Skip,
abbruch-/fortsetzbar). better-sqlite3 ist auch als Root-Deps eingetragen
(11.x); falls das Repo-Binding fehlt, greift der Webroot-Fallback
(Override: CONTINUITY_WEBROOT_NODE_MODULES).
Hintergrund: Vor Deploy-Fix 882527a wurde server/data/ bei jedem Deploy
gelöscht — die Historie der Altartikel fehlte.

---

## Berichte-Assistent (/veroeffentlichen)

KI-Unterstützung im Berichte-Tab — **nur Vorschläge**, der User curates per
Klick. Kein Autopilot, kein Cron. Der EINZIGE Weg nach draußen ist der
explizite Klick „Bericht veröffentlichen" (Signatur browserseitig via NIP-07,
kein Server-Key).

**Server (`server/`):**
| Datei | Zweck |
|-------|-------|
| `services/assistant-store.js` | SQLite `server/data/assistant.db` (WAL): `assistant_articles` (status `draft\|published`), `media`, `seo_cache` (24h-TTL). CRUD: saveArticle/getArticle/listArticles/deleteArticle/updateArticleFields/markPublished; Cache: getCached/setCached; Media: saveMediaItem/getMediaItem/listMediaItems/updateMediaItem |
| `services/report-assistant.js` | ideas (GSC + LLM-Long-Tails), researchTopic (OpenRouter Web-Plugin), continuity-suggestions (NUR-Lese-Zugriff continuity.db), link-suggestions (sitemap.json + articles.json → canonical `https://mojobus.co/{naddr}`), seo-title. 24h-Cache in seo_cache |
| `services/gsc-client.js` | Search Console Service-Account-JWT (RS256, node:crypto, Scope webmasters.readonly); striking-distance-Queries (Impressionen > 0, Ø-Position 5–20). Ohne GSC-Env: `{ available: false }` |
| `services/publish-pipeline.js` | `runPublishPipeline({ dTag, url })`: generate-site-data → prerender-static → generate-sitemap → generate-feed (execFile, Logs `[Pipeline]`), danach `pingIndexNow(urls)` (Fehler nur geloggt). Läuft NACH `res.json()` im Hintergrund |
| `routes/assistant/index.js` | Offen: `GET /api/assistant/ideas`, `POST /api/assistant/research`, `GET /api/assistant/continuity-suggestions`, `GET /api/assistant/link-suggestions`, `POST /api/assistant/seo-title`. 🔒 (Bearer ASSISTANT_API_TOKEN, timing-safe): `POST/GET /api/assistant/drafts`, `GET/DELETE /api/assistant/drafts/:id`, `PUT /api/assistant/article/:id`, `POST /api/assistant/published` |
| `routes/assistant/auth.js` | `requireAssistantToken`-Middleware (timing-safe Bearer-Check). Eigene Datei — index.js und media.js importieren sie beide; ein direkter Import von media.js aus index.js heraus wäre ein ESM-Circular-Import und crasht beim Node-Start |
| `routes/assistant/media.js` | 🔒: `POST /api/media/upload` (multer → MEDIA_DIR, `artikel-<datum>-<hash>.<ext>`), `PUT /api/media/:id` (alt/tags). Offen: `GET /api/media`, `GET /api/media/file/:id` (Fallback-Auslieferung), `POST /api/media/analyze-alt` (Vision-KI via bestehendem getArticleImageAnalysisPrompt) |
| `prompts/assistant-prompts.js` | buildResearchPrompt / buildIdeasPrompt (keine „10 Gründe"-Formate) / buildSeoTitlePrompt — KEINE Artikel-Prompts (die bleiben in `src/config/prompts/`, TABU) |

**Frontend (`src/`):**
| Datei | Zweck |
|-------|-------|
| `config/assistant.ts` | ASSISTANT_CONFIG (Endpunkte, GSC_WINDOW_DAYS=28, CACHE_TTL_HOURS=24), Marker `FACT_MARKER`/`EXPERIENCE_MARKER`, reine Funktion `buildAuthorInput({ facts, experiences, editorText })`, `SLUG_CONFIG` + `buildSmartSlug()` (Auto-Slug ohne Füllwörter: deutsche Artikel/Präpositionen gefiltert, romanische Ortsnamen-Partikel wie „das" bleiben erhalten, max. 5 Wörter — Fallback bei Publish/Draft wenn Slug-Feld leer) |
| `components/assistant/*` | useAssistantApi (getApiBaseUrl-Prefix + Bearer VITE_ASSISTANT_TOKEN), AssistantSection (kollabierbar, localStorage), IdeasPanel, ResearchBlock, MomentsBlock, LinkSuggestionsBlock (Insert an Cursorposition via `insertMarkdownRef`), SeoPublishPanel (SEO-Titel-Vorschlag, Meta-Description, Slug-Platzhalter via `buildSmartSlug`, ☑ „Alle Erlebnisse im Text sind echt" = Pflicht), DraftsOverview, MediaLibraryPanel (Dialog im Titelbild-Bereich), KiPlaceholderButton (statischer Platzhalter `public/images/platzhalter/platzhalter.jpg`, nur per Klick — echte KI-Bildgenerierung existiert im Stack nicht) |

**Ablauf:** Generieren schickt `text = buildAuthorInput(...)` (FAKTEN/ERLEBNISSE
klar markiert, Prompt selbst unverändert). Publish setzt SEO-Zusatz-Tags
(`seo_title`, `meta_description`, `slug`), ruft dann non-blocking
`POST /api/assistant/published { article_id?, d_tag, url }` → markiert Status
`published` + Pipeline + IndexNow. Ohne geladenen Entwurf/Negativpfad kann
NICHTS automatisch veröffentlicht werden (Pipeline nur hinter Token-Auth in
`/published` referenziert).

**SEO-Ausspielung:** `seo_title` → `<title>` + og:title + twitter:title +
JSON-LD headline (bzw. Place-`name`); `meta_description` → Meta-Description +
og:description + twitter:description + JSON-LD. In der SPA (ArticleView,
Place-Pfad inklusive) UND im Prerender (`renderArticleHtml`/
`renderPlaceHtml`). Fallback immer: kreativer Titel / Summary — Artikel ohne
SEO-Tags verhalten sich unverändert. Edit-Pfad in ArticleForm + PlaceForm
lädt die 3 Tags aus dem Event (sonst würde Edit+Republish sie löschen).
Orte: `slug`-Fallback `buildSmartSlug(name)`, Meta-Fallback = Ort-Beschreibung.

**Ehrlichkeits-Gate „Alle Erlebnisse im Text sind echt":** Standard ON
(abwählbar), Publish-Button ohne Haken deaktiviert — in ALLEN
KI-Formularen: ArticleForm + PlaceForm (im SeoPublishPanel integriert) sowie
NoteForm, MediaUploadForm, TripPublishForm (shared component
`components/assistant/ExperiencesConfirm.tsx`).

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
