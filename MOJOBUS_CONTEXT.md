# MojoBus – Session Context

## Projekt-Übersicht
MojoBus ist eine Nostr-basierte Vanlife/Travel-Plattform zum Teilen von Reiseerlebnissen, Campingplätzen, Fotos mit GPS-Daten. Läuft als **PWA + Android APK (Capacitor)**.

## Tech-Stack
- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS 3, shadcn/ui
- **Backend**: Kein Server – rein clientseitig via Nostr (NIP-23 Long-Form + NIP-94 Media)
- **Storage**: Blossom (Media), Nostr (Events/Posts)
- **Mobile**: Capacitor 8 (@capacitor/android, @capawesome/capacitor-file-picker)
- **Deployment**: AlmaLinux 9.7 CentminMod, Nginx, Node.js

## 📁 Wichtige Dateien

| Datei | Zweck |
|-------|-------|
| `src/lib/capacitorGps.ts` | Native Dateiauswahl + EXIF-GPS via exifr.js |
| `src/lib/gpsExtraction.ts` | GPS-Extraktion für Browser (Standard) |
| `src/pages/publish/MediaUploadForm.tsx` | Medien-Upload mit GPS-Button |
| `src/pages/publish/PlaceForm.tsx` | Orte-Formular (Standard-Dateiauswahl) |
| `src/components/ArticleView.tsx` | Artikel-Detailansicht mit SEO + JSON-LD |
| `src/components/NoteView.tsx` | Notes-Detailansicht mit SEO |
| `src/components/SEOHead.tsx` | Dynamische Meta-Tags, OG, Twitter, JSON-LD |
| `src/lib/jsonld.ts` | JSON-LD Structured Data Generators |
| `src/lib/imageUtils.ts` | Bildoptimierung via images.weserv.nl |
| `src/config/imageService.ts` | Image-Service Konfiguration (weserv/imgproxy/Cloudflare) |
| `src/config/performance.ts` | Performance-Konfiguration |
| `src/config/cache.ts` | Granulare Cache-Zeiten (24h Listen, 7d Profile, 1y Bilder) |
| `src/config/routes.ts` | Routen-Definitionen |
| `src/AppRouter.tsx` | Router mit Lazy Loading |
| `public/fonts.css` | **font-display: optional** (kein CLS durch Font-Swap) |
| `public/sw.js` | Service Worker v21 – staleWhileRevalidate für /data/, Cache-First für Prerender |
| `src/hooks/usePreloadedData.ts` | Generischer Hybrid-Hook: JSON-Dump sofort + Live-Relay im Hintergrund |
| `scripts/prerender-static.js` | Prerender: statische HTML-Seiten mit NIP-19 Dateinamen |
| `scripts/generate-sitemap.js` | Generiert sitemap.xml (Cron: täglich 6:00) |
| `scripts/generate-site-data.js` | Generiert **Slim**-JSON-Dumps ohne content (Cron: täglich 6:15) |
| `scripts/generate-feed.js` | Generiert RSS 2.0 Feed (Cron: alle 6h) |
| `scripts/patch-android-manifest.js` | Patcht AndroidManifest.xml (Permissions) |
| `scripts/copy-icons.js` | Kopiert Icons aus public/ in Android-Ordner |
| `capacitor.config.ts` | Capacitor-Konfiguration (appId: co.mojobus.app) |
| `mojobus.co.ssl.conf` | Nginx-Config: Bot-Prerender + Brotli + Caching + `/data/` mit max-age=86400 |
| `src/config/prompts/tiktok.js` | **Foster Huntington TikTok-Prompt** – 5 Hook-Mechaniken, Retention-Bogen, voiceoverMode, Plattform-Parameter |
| `server/remotion/MojoBusVideo.tsx` | Remotion-Hauptkomponente – HookDimOverlay, perSlideArray-Sync, Caption-Styles |
| `server/remotion/render.js` | Render-Engine – Slide-genaue MP3s, ffprobe-Sync, Ambient, Concat-Voiceover |
| `src/pages/Videos.tsx` | **NEU** Video-Feed-Seite – kind 34236 NIP-71, Lazy Loading, Single-Column |
| `src/hooks/useVideos.ts` | **NEU** Hook zum Laden von kind 34236+34235 Video-Events |
| `server/remotion/components/KenBurnsImage.tsx` | KenBurns mit noise/breathing/focus-in/handheld + GammaFade |
| `src/pages/TikTokPromotion.tsx` | TikTok-Video-Generator – Remotion-Render + KI-Text + Capacitor-kompatibel via `getApiBaseUrl()` |

## ⚙️ Config-Verzeichnis (`src/config/`)

Alle Konfigurationen sind zentral in `src/config/` abgelegt. **Neue Konfigurationen immer hier erstellen**, nicht verteilt im Code.

| Datei | Zweck | Type |
|-------|-------|------|
| `src/config/authors.json` | **Single Source of Truth** für Autoren (pubkey, npub, nip05) | JSON |
| `src/config/relays.ts` | Relay-Listen, Autor-Relay-Zuordnung, Presets, DEFAULT_APP_CONFIG | TypeScript |
| `src/config/blossom.ts` | Blossom-Server für Medien-Uploads (autor-spezifisch) | TypeScript |
| `src/config/nostr.ts` | Legacy-Nostr-Config (re-exportiert aus relays.ts) | TypeScript |
| `src/config/app.ts` | App-Einstellungen (Theme, UI, Performance) | TypeScript |
| `src/config/types.ts` | Zentrale Typdefinitionen für alle Configs | TypeScript |
| `src/config/routes.ts` | Routen-Definitionen | TypeScript |
| `src/config/mainMenu.ts` | Hauptnavigation (Desktop + Mobile) | TypeScript |
| `src/config/menu.ts` | Legacy-Menü-Konfiguration | TypeScript |
| `src/config/countries.ts` | Länder-Datenbank mit Koordinaten, Keywords, Routen | TypeScript |
| `src/config/diy.ts` | DIY-Kategorien | TypeScript |
| `src/config/rvlife.ts` | RV Life Kategorien | TypeScript |
| `src/config/articles.ts` | Artikel-Kategorien | TypeScript |
| `src/config/tags.ts` | Tag-Definitionen und -Gruppen | TypeScript |
| `src/config/tagConfigs.ts` | Erweiterte Tag-Konfigurationen | TypeScript |
| `src/config/contentCategories.ts` | Content-Kategorie-Definitionen | TypeScript |
| `src/config/imageService.ts` | Bildoptimierungs-Service (weserv/imgproxy/Cloudflare) | TypeScript |
| `src/config/imageOptimization.ts` | Legacy-Bildoptimierung | TypeScript |
| `src/config/performance.ts` | Performance-Konfiguration (Infinite Scroll, Cache, Relay) | TypeScript |
| `src/config/performance.config.ts` | Build-Performance-Config (Minify, Sourcemaps) | TypeScript |
| `src/config/cache.ts` | Granulare Cache-Konfiguration (24h/7d/1y) | TypeScript |
| `src/config/prompts/` | **⚠️ TABU – NIEMALS ÄNDERN!** (außer tiktok.js – wird aktiv weiterentwickelt) KI-Prompt-Vorlagen | JS |
| `src/config/budget.ts` | Haushaltsbuch-Konfiguration | TypeScript |
| `src/config/video.ts` | Video-Konfiguration | TypeScript |
| `src/config/leon.ts` | Leon-Story Konfiguration | TypeScript |
| `src/config/zeitwohnmobil.ts` | ZeitWohnmobil-Konfiguration | TypeScript |
| `src/config/README.md` | Detaillierte Config-Dokumentation | Markdown |

**Regel**: Jede neue Konfiguration gehört nach `src/config/`. Keine hartcodierten Werte im Quellcode – immer aus den Config-Dateien importieren.

### ⛔ Tabu-Zonen – Niemals ändern

| Pfad | Grund |
|------|-------|
| `src/config/prompts/` (außer tiktok.js) | **KI-Prompt-Konfiguration** – läuft im Browser (Vite-Build) **und** im Node.js Server (`ai-api`). Änderungen an articles/notes/place/media/trips/lifestyles zerstören die KI-Content-Erstellung. **tiktok.js darf bearbeitet werden** (wird aktiv weiterentwickelt). |
| `server/` | **Node.js Backend** – wird vom `ai-api` Systemd-Service verwendet. Keine Änderungen ohne separates Deployment. |

### ✅ Performance-Optimierungen (Juni 2026)

| Maßnahme | Wirkung | Dateien |
|----------|---------|---------|
| **Skeleton-Grids** statt LoadingSpinner | CLS von 0.4 → ~0 | Home, Notes, Places, Images, DIY, RVLife, Leon, Articles |
| **font-display: optional** | Kein CLS durch Font-Swap | `public/fonts.css` |
| **Critical CSS inline** | LCP von 2.1s → ~1.2s | `index.html` |
| **Logo preload** fetchpriority=high | LCP schneller | `index.html` |
| **aspect-[3/4]** für ImageCards | CLS-freies Bildlayout | `Images.tsx` |
| **Nur 3 Font-Gewichte** statt 7 | 149KB → 95KB Font-Ladung | `public/fonts.css` |
| **GTmetrix Score** | 58% → **A (90/100)** | Alle oben |

### ✅ Performance-Optimierungen Runde 2 – Listenseiten (Juni 2026)

**Problem**: `/artikel`, `/notes`, `/bilder`, `/plaetze` luden 3–6s wegen Live-Relay-Queries.  
**Lösung**: Hybrid-Ansatz – JSON-Dump sofort, Relay nur für neue Events im Hintergrund.

| Maßnahme | Wirkung | Dateien |
|----------|---------|---------|
| **SW v19**: `staleWhileRevalidate` für `/data/` | Wiederholungsbesuch: ~800ms → 0ms | `public/sw.js` |
| **SW v19**: NetworkError-Fix (`ok`-Prüfung vor `cache.put`, `clone()`) | Stabiler bei Offline | `public/sw.js` |
| **`usePreloadedData`**: `Promise.all` für parallele Fetches | ~250ms gespart | `src/hooks/usePreloadedData.ts` |
| **`useNotes`** auf `usePreloadedData` umgestellt | 3–5s → ~200ms | `src/hooks/useNotes.ts` |
| **`Images.tsx`** auf `usePreloadedData` umgestellt | 2–3s → ~200ms | `src/pages/Images.tsx` |
| **`usePlaces`** auf `usePreloadedData` umgestellt | 2–3s → ~200ms | `src/hooks/useLongformArticles.ts` |
| **`generate-site-data.js`**: Slim-JSON, kein `content` | articles.json ~80% kleiner | `scripts/generate-site-data.js` |
| **Nginx** `/data/`: `max-age=86400, stale-while-revalidate` | Browser-Cache 1 Tag | `mojobus.co.ssl.conf` |

**JSON-Dump Struktur** (`/data/`):
- `articles.json` – kind-30023, **kein content**, nur Tags: title/summary/image/d/t
- `places.json` – kind-30023 mit type=place, kein content
- `notes.json`, `bilder.json`, `trips.json` – kind-1, content auf 200 Zeichen gekürzt
- `index.json` – Timestamp (`generatedAtUnix`), Anzahlen, Dauer

**Hooks-Übersicht**:
- `usePreloadedArticles()` → `/data/articles.json` + Relay-Live
- `usePlaces()` → `/data/places.json` + Relay-Live
- `useNotes()` → `/data/notes.json` + Relay-Live (Infinite Scroll clientseitig)
- Images.tsx → `/data/bilder.json` + Relay-Live
- `useLongformArticle()`, `useNote()` → **nur Relay** (Detailseiten, brauchen vollen Content)

**Wichtig nach Deploy**: `node scripts/generate-site-data.js` einmal manuell ausführen damit neue Slim-JSONs vorhanden sind.

### ✅ Prerender-Cache-System (Juni 2026)

Das Prerender generiert statische HTML-Seiten mit **NIP-19 Dateinamen** (naddr1..., note1..., npub1...).

| Komponente | Beschreibung |
|------------|-------------|
| `scripts/prerender-static.js` | Generiert `.html`-Dateien mit NIP-19 IDs als Dateiname |
| `mojobus.co.ssl.conf` | Bot-Weiterleitung: `/{naddr}` → `/prerender/{naddr}.html` etc. |
| `public/sw.js` | Cache-First für `/prerender/` → sofort ausgeliefert |
| `scripts/generate-site-data.js` | Generiert `/data/articles.json` etc. für schnelle Relay-freie Nutzung |

**Ablauf:**
1. Cron 6:00 → `prerender-static.js` generiert HTML-Seiten
2. Cron 6:15 → `generate-site-data.js` generiert JSON-Dumps
3. Bot/User kommt → Nginx liefert statisches HTML (kein Relay!)
4. Wenn Seite nicht im Cache → Fallback auf SPA → lädt vom Relay

**Manuell ausführen:**
```bash
node /root/deploy-git/mojobusco/scripts/prerender-static.js
node /root/deploy-git/mojobusco/scripts/generate-site-data.js
```

## 📱 Android APK Build (CachyOS)
```bash
cd ~/Mojobus-APK/mojobusco
git pull origin main
npm run apk
```
APK: `android/app/build/outputs/apk/debug/app-debug.apk`

## 🚀 VPS Deploy (AlmaLinux 9.7)
```bash
ssh root@server
cd /root/deploy-git/mojobusco
bash deploy-main.sh --force

# Nginx-Config manuell aktualisieren (falls geändert):
cp mojobus.co.ssl.conf /etc/nginx/conf.d/mojobus.co.ssl.conf
nginx -t && systemctl reload nginx

# Daten-Dumps generieren (nach erstem Deploy):
node scripts/generate-site-data.js
```

## ✅ GPS-Fix – WAS FUNKTIONIERT
**Problem**: Auf Android 10+ werden GPS-EXIF-Daten aus `content://` URIs auf Systemebene redacted.

**Lösung** (funktioniert!):
1. `pickFiles({ readData: true })` – liest base64 direkt vom Picker
2. `ACCESS_MEDIA_LOCATION` Permission via `FilePicker.requestPermissions(['accessMediaLocation'])` zur Laufzeit anfordern
3. `exifr.gps(file)` auf dem File-Objekt
4. `URL.createObjectURL(file)` für Preview

**Wichtig**: `ACCESS_MEDIA_LOCATION` muss ZUR LAUFZEIT angefragt werden (reicht nicht im Manifest!):
```typescript
const result = await FilePicker.requestPermissions({
  permissions: ['accessMediaLocation']
});
// result.accessMediaLocation === 'granted'
```

## 🎯 Buttons im Medien-Upload (alle horizontal, Mobil 100x100 Quadrate)
1. **"Auswahl"** – `<input type="file">` (Standard-Dateiauswahl)
2. **"📱 Bilder GPS"** – `handleNativePick()` (Capacitor FilePicker + EXIF-GPS)

## 📦 Wichtige Packages (devDependencies)
- `@capawesome/capacitor-file-picker@^8.0.2` – Native Dateiauswahl
- `@capacitor/geolocation@^8.0.0` – Geräte-Standort
- `@capacitor/core@^8.0.0` – Capacitor Core
- `@capacitor/cli@^8.0.0` + `@capacitor/android@^8.0.0` – APK Build
- `exifr@^7.1.3` – EXIF-GPS Lesen aus rohen Bytes
- `@tanstack/react-query@^5.56.2` – Daten-Fetching + Caching
- `@unhead/react@^2.0.10` – SEO Head-Management
- `@nostrify/nostrify@^0.46.4` – Nostr-Client

## 🌐 Server
- **Domain**: https://mojobus.co
- **Repository**: https://github.com/mojomaxmojo/mojobusco
- **Server**: AlmaLinux 9.7 (CentminMod), Nginx, Node.js, Brotli
- **Relay**: wss://relay.mojobus.co
- **AI-API**: Node.js Backend, Systemd-Service `ai-api`, Port 3002 (liegt in `server/`)
- **RSS Feed**: https://mojobus.co/feed.xml (Cron alle 6h)
- **Sitemap**: https://mojobus.co/sitemap.xml (Cron täglich 6:00)
- **Prerender**: https://mojobus.co/prerender/ (Cron täglich 6:00)
- **JSON-Dumps**: https://mojobus.co/data/articles.json etc. (Cron täglich 6:15)

## 👥 Autoren (Nostr)

Die Autoren-Stammdaten werden **nicht hartcodiert**, sondern kommen aus der zentralen Config:

| Quelle | Datei | Beschreibung |
|--------|-------|-------------|
| **Single Source of Truth** | `src/config/authors.json` | Einzige Stelle mit pubkey, npub, nip05 |
| **TypeScript-Import** | `src/config/relays.ts` → `AUTHORS` | Von Komponenten genutzt |
| **Cron-Scripts** | `scripts/*.js` → Import aus `authors.json` | Alle Scripts lesen aus derselben JSON |

**So werden Autoren hinzugefügt/geändert:**
Nur `src/config/authors.json` bearbeiten – alle anderen Dateien (relays.ts, blossom.ts, authorUtils.ts, BudgetPage.tsx, Cron-Scripts) referenzieren diese Datei automatisch via Import.

```bash
# Aktuelle Autoren (aus src/config/authors.json):
cat src/config/authors.json | jq '.authors[] | {name, pubkey, nip05}'
```

## 🔧 Wichtige Branches (GitHub)
- **main** – Aktive Entwicklung
- **backup-gps** – GPS-Fix funktionierender Stand (Commit 97b8dc4)
- **caption-improvements-v2** – Bildunterschriften (alter Stand)

## ⚠️ Bekannte Einschränkungen / Hinweise
- **Relay primal.net**: Liefert bei `generate-site-data.js` konsistent 0 Events (Timeout). Nur `relay.mojobus.co` ist produktiv. Der 20s-Timeout für primal läuft immer voll durch → Cron dauert ~40s statt ~20s.
- **SW Cache-Version**: Wird bei jedem Deploy automatisch erhöht durch `bump_sw_version()` in `deploy-main.sh`. Aktuelle Version: **v21**.
- **JSON-Dumps ohne content**: Artikel/Plätze haben keinen `content` in den JSON-Dumps. Detailseiten (`ArticleView`, `NoteView`) laden immer direkt vom Relay. Notes/Bilder haben max. 200 Zeichen `content` für Vorschautext.
- **Live-Query-Aktivierung**: `usePreloadedData` startet den Live-Relay-Query erst wenn `cronTimestamp` aus `index.json` geladen ist. Fehlt `index.json`, greift der Fallback auf eine pure Live-Query.

## 📋 Changelog – Änderungen 16.06.2026

### AGENTS.md aktualisiert
- MojoBus-spezifischer Header ergänzt (Tech-Stack, Tabu-Zonen, Config-Regel, VPS Deploy)
- Verweis auf `MOJOBUS_CONTEXT.md` für jede neue Session

### Claude-Modell auf OpenRouter umgestellt
- **Betroffene Dateien**: `server/promotion-api.js`, `server/server.js`
- **Endpoint**: `api.anthropic.com` → `openrouter.ai/api/v1/chat/completions`
- **Modell**: `claude-sonnet-4-20250514` → `~anthropic/claude-sonnet-latest`
- **Auth**: `ANTHROPIC_API_KEY` → `OPENROUTER_API_KEY` (bereits konfiguriert ✓)
- **Response-Format**: `content[0].text` → `choices[0].message.content` (OpenAI-kompatibel)
- **Grund**: Anthropic-Modellname `claude-sonnet-4-20250514` wurde von Anthropic deprecated

### Fix: /bilder Filter (Images.tsx)
- **Problem**: `liveFilter` holte `kinds: [1, 30023]`. Kind-30023 Artikel enthielten Bild-URLs im Markdown-Content, wurden fälschlich als Bilder angezeigt → 297 statt ~60 Einträge
- **Fix**: `liveFilter` auf `kinds: [1]` reduziert, kind:30023 explizit ausgeschlossen, bessere Filterlogik (type=media Tag + Content-Längen-Prüfung)
- **Commit**: 5384e99

### Entfernt: alte .ttf Font-Dateien
- **Betroffene Dateien**: `public/fonts/playfair-display-regular.ttf` (189 KB), `public/fonts/playfair-display-italic.ttf` (178 KB), `public/fonts/playfair-display-700.ttf` (194 KB)
- **Grund**: GTmetrix zählte TTF als 3. Font → Score 50/100 für Webfonts. Nur `.woff2` werden von `fonts.css` referenziert
- **Commit**: cfa8d5b

### Bekannte Baustellen (heute diagnostiziert, nicht behoben)
- **413 Payload Too Large**: Bilder >20MB werden von Nginx/Multer abgewiesen. Multer-Limit ist 20MB pro Datei. Bild-Komprimierung im Frontend (Canvas-Resize auf max 1920px, JPEG 85%) ist vorgesehen
- **Groq API Key**: War abgelaufen (`expired_api_key`). Neuer Key musste unter https://console.groq.com/keys erstellt werden

## 📋 Changelog – Änderungen 17.06.2026

### Fix: /bilder + /notes Filter-Chaos
- **Problem 1**: `/bilder` zeigte viele falsche Events (Artikel mit Bild-URLs → 297 statt ~60). `liveFilter` holte `kinds: [1, 30023]`
- **Problem 2**: `/bilder` Bilder in Cards unsichtbar. Slim-JSON kürzt Content auf 200 Zeichen → Bild-URLs im Markdown-Content abgeschnitten
- **Problem 3**: `/notes` zeigte alle Kind-1 Events (111 statt ~1). `transformEvent` griff nur auf Live-Events, nicht auf JSON-Daten
- **Problem 4**: Nach erneutem Deploy immer noch keine Bilder. Service Worker lieferte alte gecachte `bilder.json` → Hard-Reload (Shift+F5) nötig
- **Commits**: b99ca17, 20238d7, 122ace5

### generate-site-data.js: image-Tag für Slim-JSON
- **Problem**: `stripNote()` kürzt Content auf 200 Zeichen → Bild-URLs im Markdown verschwinden → `extractImages()` findet nichts
- **Fix**: Beim Erstellen des Slim-JSON die **erste Bild-URL aus dem VOLLEN Content** extrahieren und als `['image', url]` Tag speichern
- Der `image`-Tag bleibt erhalten (in `RELEVANT_TAGS_KIND1`) → `extractImages()` in Images.tsx findet die URL
- **Wichtig nach Deploy**: `node scripts/generate-site-data.js` **muss** laufen, sonst fehlt das image-Tag
- **Commit**: 122ace5

### extractImages() in Images.tsx
- Liest jetzt primär aus Tags: `image`-Tag > `imeta`-Tag > `r`-Tag > Content-Fallback
- Images erscheinen wieder in den Cards auch wenn Content gekürzt ist
- **Commit**: 20238d7

### Bekannte Baustellen (17.06.2026)
- **Service Worker Cache**: Nach Deploy + generate-site-data.js liefert SW alte JSONs. Browser-Cache leeren oder Hard-Reload (Shift+F5) nötig
- **bilder.json Größe**: 42 Events, 29.1 KB (nach image-Tag Ergänzung gewachsen)

## 📋 Changelog – TikTok Promotion System (Juni 2026)

### Überblick
Komplettes TikTok-Video-Promotion-System unter `/promotion/tiktok`. Erstellt aus Nostr-Blog-Inhalten TikTok-taugliche Videos via Remotion auf dem VPS.

| Komponente | Pfad | Beschreibung |
|------------|------|-------------|
| Dashboard | `src/pages/TikTokPromotion.tsx` | 4-Schritte UI (Content→Template→Text→Export) |
| Render-Engine | `server/remotion/` | Vollständiges Remotion v4 System |
| Piper TTS | `server/remotion/tts.js` | Text-to-Speech via Piper (Thorsten/Ramona) |
| Ambient | `server/remotion/ambient.js` | Atmo-Geräusche via FFmpeg (Meer/Regen/Wind/Feuer/Wald) |
| Blossom Upload | TikTokPromotion.tsx | MP4 → relay.mojobus.co (permanente Speicherung) |
| Nostr History | kind 30078, d-tag: `co.mojobus.app.tiktok-video-*` | Replaceable Events für Video-Metadaten |

### Features (aktiv)

| Feature | Status | Beschreibung |
|---------|--------|-------------|
| **Diashow aus Bildern** | ✅ | Ken-Burns Zoom, 8 Transitionen |
| **Video + Bilder gemischt** | ✅ | MediaRenderer erkennt mp4/webm/mov und rendert Clip |
| **Hook (0-3s)** | ✅ | Großer Text + Scale-Animation auf erstem Bild |
| **Body (3-22s)** | ✅ | Captions pro Bild, eine Zeile pro Slide |
| **Bridge (22-27s)** | ✅ | Überleitung zum Blog |
| **CTA (27-30s)** | ✅ | Endkarte mit Logo + Link |
| **TikTok-Captions (Hardcode)** | ✅ | Fest eingebrannte Untertitel |
| **Musik (vom Server)** | ✅ | Zufälliger Track aus /server/music/ (22 Tracks) |
| **Atmo-Geräusche** | ✅ | Meer, Regen, Wind, Feuer, Wald (FFmpeg-generiert) |
| **Beat-Sync** | ✅ | Schnitte synchron zur Musik |
| **RouteMap** | ✅ | Animierte Routen-Karte in der Slideshow-Mitte |
| **Lottie Bus (Endkarte)** | ✅ | Animierter MojoBus fährt im Bogen ein |
| **Voiceover (Piper TTS)** | ✅→🔀 | Thorsten (Piper) → Seraphina (Edge TTS, primär) |
| **Speed-Regler (0.6-1.2)** | ✅ | atempo-Filter, Tonhöhe bleibt |
| **Volume-Regler (0.00-1.50)** | ✅ | Lautstärke für Voiceover einstellbar |
| **Dauer pro Bild (3-10s)** | ✅ | 1s-Schritte |
| **KI-Text (Foster Huntington)** | ✅ | POST /api/tiktok/generate-text – poetisch/authentisch |
| **KI-Modell Switcher** | ✅ | Llama 4 Scout (Groq) ↔ Claude Sonnet (OpenRouter) |
| **Export** | ✅ | 3 Buttons: TikTok, Instagram, YouTube |
| **Blossom-Upload** | ✅ | MP4 dauerhaft auf relay.mojobus.co |
| **Nostr-History** | ✅ | kind 30078 + Blossom-URL → Tabelle mit Download/Löschen |
| **Toast** | ✅ | Unten zentriert · z-[999] |
| **Font-Größen** | ✅ | TikTok-Video: Hook 10vw, Captions 7vw (+50% für Mobil) |
| **CTA Bus** | ✅ | 25% größer (size 175) + PNG-Logo über Text |

### API-Endpunkte (Server Port 3002)

| Endpunkt | Methode | Funktion |
|----------|---------|----------|
| `/api/render-remotion` | POST | Video rendern (9:16, Bilder, Captions, Musik, TTS) |
| `/api/render-remotion/status/:jobId` | GET | Render-Fortschritt |
| `/api/render-remotion/download/:jobId` | GET | MP4-Download |
| `/api/render-remotion/check` | GET | Remotion + FFmpeg + Edge TTS + Piper Status |
| `/api/render-remotion/invalidate-bundle` | POST | Bundle-Cache leeren |
| `/api/render-remotion/history` | GET | Abgeschlossene Render-Jobs |
| `/api/music/list` | GET | Verfügbare Musik-Tracks |
| `/api/tiktok/generate-text` | POST | Foster-Huntington-Texte (param: model='llama4'|'claude') |
| `/api/tiktok/analyze-images` | POST | **NEU** Vision-KI Bild-Analyse (Groq → Claude Fallback) |

### Piper TTS Installation

```bash
# Binary + Stimm-Modelle (einmalig auf VPS)
mkdir -p /opt/piper/voices
cd /opt/piper
wget https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz
tar xzf piper_linux_x86_64.tar.gz
cp piper/piper /opt/piper/piper  # Binary ins Root kopieren

cd /opt/piper/voices
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx.json
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/ramona/low/de_DE-ramona-low.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/ramona/low/de_DE-ramona-low.onnx.json
```

### ✅ Edge TTS (aktiv, primär) – Piper als Fallback

Edge TTS (Microsoft, `server/remotion/edge.js`) hat Piper als primäre TTS-Engine abgelöst.

**Paket**: `node-edge-tts@^1.2.10` (Node.js-kompatibler Fork, MIT, 6.7M Downloads/Monat)
**Warum nicht `edge-tts`**: `edge-tts@1.0.1` ist TypeScript-Only (`"main": "index.ts"`) → Node.js kann es nicht importieren.

**Architektur**:
- **Kein statischer Import** in `render.js` – nur `await import('./edge.js')` in der Funktion
- Automatischer Fallback: Edge → Piper → kein Voiceover
- Edge liefert **MP3**, Piper liefert **WAV** – unterschiedliche Dateinamen (`voiceover.mp3` vs `voiceover.wav`)

**Edge TTS Stimmen (deutsch)**:
| ID | Name | Typ | Qualität |
|---|------|-----|----------|
| `de-DE-SeraphinaMultilingualNeural` | Seraphina ⭐ | weiblich | beste |
| `de-DE-FlorianMultilingualNeural` | Florian | männlich | hoch |
| `de-DE-AmalaNeural` | Amala | weiblich | hoch |
| `de-DE-KatjaNeural` | Katja | weiblich | hoch |
| `de-DE-ConradNeural` | Conrad | männlich | hoch |

**Piper TTS** (Fallback, weiterhin installiert):
- `de_DE-thorsten-medium` – männlich
- `de_DE-ramona-low` – weiblich

**Engine-Auswahl**: Automatisch aus Modell-Präfix: `de-DE-*` → Edge, `de_DE-*` → Piper

**Dashboard**: Voiceover-Sektion mit:
- An/Aus Toggle (deaktiviert wenn weder Edge noch Piper verfügbar)
- Stimmen-Auswahl (5 Edge + 2 Piper)
- Speed-Regler (0.60-1.20)
- Volume-Regler (0.00-1.50, Default 1.00)
- Zeichen-Zähler
- Text-Vorschau

### Bekannte Baustellen (TikTok)
- **Remotion Bundle**: Nach Code-Änderungen im server/remotion/ muss der Bundle-Cache invalidiert werden: `curl -X POST http://localhost:3002/api/render-remotion/invalidate-cache`
- **Render-Dauer**: Erst-Render dauert ~1-2 Min (Bundle + Download). Folge-Render ~30-60s
- **Voiceover Standard**: AUS – muss explizit aktiviert werden
- **Video-Quellen**: Aktuell nur Bilder + Video-URLs aus Nostr-Events. Kein direkter Upload
- **MP4 auf Blossom**: Wird beim Löschen des Nostr-Events nicht gelöscht (nur Event wird ungültig)

## 📋 Changelog – Änderungen 21.06.2026

### Piper TTS → Edge TTS ersetzt (aktiv, primär)
- **Betroffene Dateien**: `server/remotion/edge.js` (NEU), `server/remotion/render.js`, `server/server.js`, `server/package.json`, `src/pages/TikTokPromotion.tsx`
- **Paket**: `node-edge-tts@^1.2.10` (Node.js-kompatibel, MIT). Nicht `edge-tts` (TypeScript-Only!)
- **Architektur**: Nur dynamischer `import()` in render.js, kein statischer Import
- **Fallback**: Edge → Piper → kein Voiceover (automatisch)
- **Stimmen**: 5 Edge-Stimmen (Seraphina ⭐ Standard) + 2 Piper-Stimmen (Fallback)
- **Badge**: Header zeigt "Edge" oder "Piper" je nach Verfügbarkeit
- **Commits**: 7d2b696, 7321e31, fa85931

### KI-Modell Switcher (Schritt 2 TikTok)
- **Betroffene Dateien**: `src/pages/TikTokPromotion.tsx`
- Neuer State `aiModel` (Default: `llama4`)
- Toggle-Switch zwischen Llama 4 Scout (Groq, kostenlos) und Claude Sonnet (OpenRouter)
- Modell wird dynamisch an `/api/tiktok/generate-text` gesendet
- **Commit**: f008dbc

### Voiceover Volume Slider
- **Betroffene Dateien**: `src/pages/TikTokPromotion.tsx`, `server/server.js`, `server/remotion/render.js`, `server/remotion/MojoBusVideo.tsx`
- Slider 0.00-1.50 (Default 1.00) im Dashboard
- Hartcodiertes `volume={1.0}` in MojoBusVideo.tsx durch `voiceoverVolume`-Prop ersetzt
- **Commit**: bb599b4

### CTA-Endkarte verbessert
- **Betroffene Dateien**: `server/remotion/components/MojoBusCTA.tsx`, `server/remotion/MojoBusVideo.tsx`
- PNG-Logo (Blossom) blendet zeitgleich mit MOJOBUS-Text ein
- Bus 25% größer (size 140→175)
- **Commit**: df18a7c

### Vignette entfernt
- **Betroffene Dateien**: `server/remotion/components/ColorGradeOverlay.tsx`
- Radiale Vignette (transparent→35% Schwarz am Rand) entfernt
- War Ursache für "dunkle Ränder" – nicht der Blur!
- **Commit**: 102967d

### Lauftext in Videos um ~50% vergrößert
- **Betroffene Dateien**: `server/remotion/components/Captions.tsx`, `server/remotion/components/StoryCaption.tsx`
- TikTok-Word-Captions hatten KEINE font-size → Browser-Default ~16px → winzig auf Pixel 6a
- Alle Caption-Font-Sizes um ~50% erhöht (z.B. 4.5vw→7vw)
- **Commit**: 87625e4

### Depot-Informationen
- Nach jedem Deploy `bash deploy-main.sh --force` ausführen (ink. `npm install` für Server-Dependencies)
- Bundle-Cache nach Code-Änderungen invalidieren: `curl -X POST http://localhost:3002/api/render-remotion/invalidate-cache`
- Oder deploy-main.sh macht das automatisch beim Restart

### Multi-Select (1-3 Artikel/Posts) im TikTok Dashboard
- **Betroffene Dateien**: `src/components/pin/ContentSelector.tsx`, `src/pages/TikTokPromotion.tsx`
- ContentSelector: Single-Select → Multi-Select (max 3) mit Checkboxen
- TikTokPromotion: `selectedContent[]` statt single, Merge aller Bilder unique (max 20)
- Titel + Summaries kombiniert für KI-Textgenerierung
- **Commit**: 4f58ad4

### Fix: ContentSelector – separate AbortSignals pro Query + kürzeres Timeout
- **Problem**: Alle 4 Nostr-Queries teilten ein AbortSignal → primal.net-Timeout brach alle ab → 0 Artikel
- **Fix**: Jede Query hat eigenen `AbortSignal.timeout(8000ms)` + Debug-Logs
- **Commit**: 1c41fba, 37582f3, 60836f6

### Defaults aktualisiert: Claude, Speed 1.0, Musik -25%, Full-Line Captions
- **Betroffene Dateien**: `src/pages/TikTokPromotion.tsx`, `server/server.js`, `server/remotion/render.js`, `server/remotion/MojoBusVideo.tsx`
- KI-Modell Default: `llama4` → `claude`
- Voiceover Speed Default: `0.80` → `1.00`
- Musik Volume: `0.72` → `0.54` (25% leiser)
- Caption-Style Default: `tiktok` → `full-line` (ganzer Satz auf einmal)
- Prompt: "3-4 Sätze" → dynamisch "EXAKT X Sätze (einer pro Bild)" via `imageCount`
- **Commit**: 74b2327

### About-Seite neu gestaltet
- **Betroffene Dateien**: `src/pages/About.tsx`
- Hero bleibt, alle Texte durch vollständige Inhalte ersetzt (Geschichte, Leon, Nostr, 3 Säulen)
- Reisende: mojo + SumSum mit spezifischen Bios, Tags, Pubkeys
- Farbige Gradient-Akzente pro Abschnitt
- Author-Pubkeys aus `authors.json` statt hartcodiert (Profilbilder-Fix)
- **Commit**: 0a2cdff, 10ddaeb

### Roadmap aktualisiert
- Batch-Rendering → Render-Queue (VPS-Schonung)
- Whisper entfernt (nicht benötigt)
- Features sortiert von einfach (Kapitel-Marker) bis schwer (Green-Screen)
- **Commit**: 7b814d3

## 🗺️ TikTok-Roadmap (von einfach zu schwer)

### Stufe 0 ✅ (Abgeschlossen)
- ✅ Bilder → Diashow (Ken-Burns)
- ✅ Hook + Captions + CTA
- ✅ Musik + Voiceover (Edge TTS) + Atmo
- ✅ RouteMap + Lottie Bus
- ✅ Foster Huntington KI-Texte (Llama 4 / Claude)
- ✅ Blossom Upload + Nostr History
- ✅ Toast bottom-center
- ✅ Volume-Slider + Speed-Regler
- ✅ Multi-Select (1-3 Artikel)
- ✅ Full-Line Captions (ein Satz pro Bild)
- ✅ Dynamische Body-Sätze pro Bildanzahl

### Stufe 1 ⏳ (Einfach – Frontend + Erweiterungen)

| Rang | Feature | Aufwand | Beschreibung |
|------|---------|---------|-------------|
| 1 | **Kapitel-Marker** | Gering | Captions in Abschnitte unterteilen – Hook, Body (X Sätze), Bridge, CTA behalten ihre eigenen Captions |
| 2 | **Medien per Drag&Drop** | Gering | Miniaturbilder im Dashboard mit der Maus in die richtige Reihenfolge ziehen |
| 3 | **Einfacher Trim** | Gering | Video von Sekunde X bis Y zuschneiden via FFmpeg (`-ss`, `-to`) |

### Stufe 2 ⏳ (Mittel – Backend + Dashboard)

| Rang | Feature | Aufwand | Beschreibung |
|------|---------|---------|-------------|
| 4 | **Timeline-Editor** | Mittel | Komplette visuelle Zeitleiste: Medien sortieren, löschen, hinzufügen, Captions + Dauer pro Element |
| 5 | **Multi-Download als ZIP** | Gering | Nach Render alle MP4s als eine ZIP-Datei herunterladen |
| 6 | **Video-Split** | Mittel | Ein langes Video via FFmpeg in X kürzere Clips aufteilen |
| 7 | **Render-Queue** | Mittel | Videos nacheinander rendern (nicht parallel – VPS-Überlastung vermeiden) mit Fortschrittsanzeige pro Job |

### Stufe 3 ⏳ (Schwer – KI / FFmpeg)

| Rang | Feature | Aufwand | Beschreibung |
|------|---------|---------|-------------|
| 8 | **Automatischer Hook (KI)** | Hoch | KI erkennt die spannendste Videostelle und setzt sie als Hook (erste 3s) |
| 9 | **Bild-zu-Video (KI)** | Hoch | Statische Fotos per KI leicht animieren (Wolken, Wellen, Gras) |
| 10 | **Green-Screen** | Mittel | Grünen Hintergrund via FFmpeg chromakey ersetzen |

---

## 📋 Changelog – Änderungen 25.06.2026

### ✅ ffprobe-Fix (Voiceover-Dauer wurde nie ausgelesen)

**Problem-Ursachenkette** (3 separate Bugs):

| Bug | Ursache | Commit |
|-----|---------|--------|
| `execFileAsync is not defined` | `promisify(execFile)` importiert aber nie der Variable zugewiesen | `548d011` |
| `/opt/bin/ffprobe` existiert nicht | CentminMod/AlmaLinux installiert ffprobe nach `/usr/local/bin/` | `2ae8e94` |
| Dauer immer 0.00s | Kombination beider Fehler → catch-Block → Fallback auf Dateigröße | — |

**Fix**: `render.js` – nach `import { promisify } from 'util'` fehlendes `const execFileAsync = promisify(execFile)` hinzugefügt. Pfad-Erkennung via `command -v ffprobe` statt hartcodiertem `/opt/bin/`.

**Diagnose-Methode**: catch-Block in render.js temporär mit vollständiger Fehlermeldung patchen:
```bash
sed -i 's/} catch {/} catch (ffErr) { console.error(`FFPROBE CRASH: ${ffErr.message}`);/' \
  /home/nginx/domains/mojobus.co/public/server/remotion/render.js
systemctl restart ai-api
```

---

### ✅ RouteMap-Sync-Fix (Voiceover lief über Routen-Karte)

**Problem**: Animierte Routen-Karte (Mitte der Slideshow) zerstörte den kompletten Audio-Sync. Voiceover redete über die Karte statt Stille.

**Ursachen** (mehrere Layers):

| Layer | Bug | Datei | Commit |
|-------|-----|-------|--------|
| 1 | `perSlideArray` für `imageCount` Bilder berechnet, aber `slideDefs` hat `imageCount+1` Einträge | `render.js` | `8f195e9` |
| 2 | RouteMap-Stille nachträglich in `perSlideArray` eingefügt, NACH `voiceover_sync.mp3`-Erstellung | `render.js` | `d4b5aad` |
| 3 | `calculateDuration` prüfte `perSlideArray.length === imageCount` → RouteMap macht +1 → Fallback auf `3×4s` → Video nur 22s statt 41s | `MojoBusVideo.tsx` | `ac40213` |
| 4 | `calculateMetadata` in `index.tsx` übergab `showRouteMap` nicht → `durationInFrames` immer falsch | `index.tsx` | `ac40213` |
| 5 | `silence.mp3` nur 1s lang, concat-`duration`-Padding mit `-c copy` bei MP3 unzuverlässig → Stille war effektiv 1s statt 6.7s | `render.js` | `97493b2` |

**Finale Lösung**:
- `concatVoiceoverSegments()` bekommt `routeSlideIndex` + `routeDuration` als Parameter
- `route_silence.mp3` wird mit **exakter Dauer** per ffmpeg generiert (`-t ${routeDuration}`)
- `perSlideArray` inkl. RouteMap-Eintrag bereits in der Funktion berechnet
- `calculateDuration()` hat neuen Parameter `showRouteMap` → `totalSlideCount = imageCount + 1`
- Alle 3 `calculateMetadata`-Aufrufe in `index.tsx` übergeben `props.showRouteMap`

**Architektur nach Fix** (3 Bilder + RouteMap):
```
voiceover_sync.mp3:
  [hook(4s), img0_vo(7.4s), route_silence(8.6s), img1_vo(7.6s), img2_vo(7.6s), bridge(6s)]

perSlideArray = [7.4, 8.6(route), 7.6, 7.6]   ← 4 Einträge = totalSlideCount ✅
slideDefs     = [img0, route, img1, img2]        ← 4 Einträge ✅
durationInFrames = (4+8.6+7.6+7.6+6) × 25 = 1030 Frames = 41.2s ✅
```

---

### ✅ +1s Stille nach Voiceover-Segment

- **Betroffene Datei**: `server/remotion/render.js`
- **Fix**: `Math.max(readingTime, audioTime + 1)` statt `Math.max(readingTime, audioTime) + 1`
- Jedes Voiceover-Segment hat jetzt 1s Stille am Ende → nächster Slide startet nicht sofort nach dem letzten Wort
- **Commit**: `57f904c`

---

### ✅ TikTok-Prompt ausgelagert nach src/config/prompts/tiktok.js

- **Problem**: `FOSTER_HUNTINGTON_SYSTEM_PROMPT` war hartcodierter String in `server/server.js`
- **Fix**: Neue Datei `src/config/prompts/tiktok.js` mit `export const FOSTER_HUNTINGTON_SYSTEM_PROMPT`
- Export in `src/config/prompts/index.js` hinzugefügt
- `server/server.js` importiert jetzt aus `../src/config/prompts/index.js`
- **Commit**: `42155a2`
- **Prompt anpassen**: Nur `src/config/prompts/tiktok.js` bearbeiten

**Struktur**:
```
src/config/prompts/
├── tiktok.js      ← FOSTER_HUNTINGTON_SYSTEM_PROMPT (TikTok Voiceover-Stil)
├── articles.js    ← generateArticlePrompt()
├── notes.js       ← generateNotePrompt()
├── place.js       ← generatePlacePrompt()
├── media.js       ← generateMediaPrompt()
├── trips.js       ← generateTripPrompt()
├── lifestyles.js  ← fosterHuntingtonStyle, getGenderPromptAddition
└── index.js       ← re-exportiert alles
```

---

### ⚠️ Wichtige Hinweise für nächste Session

**ffmpeg/ffprobe auf CentminMod/AlmaLinux 9.7**:
- `which ffprobe` → `/usr/local/bin/ffprobe` (Symlink auf `/opt/bin/ffprobe`)
- `which ffmpeg`  → `/usr/local/bin/ffmpeg`  (Symlink auf `/opt/bin/ffmpeg`)
- `render.js` erkennt den Pfad automatisch via `command -v ffprobe`
- `server.js` sucht via `fs.existsSync` in `/usr/bin/`, `/usr/local/bin/`, `/opt/bin/`
- **Niemals** `/opt/bin/ffprobe` direkt hartcodieren!

**RouteMap-Debug**:
```bash
# Logs beim Rendern mit RouteMap prüfen:
journalctl -u ai-api -f | grep -i "Route\|perSlide\|Frames\|Stille"
# Erwartete Ausgabe:
# 🗺️ RouteMap-Slide in concat: Position 1 (8.6s Stille)
# 🗺️ RouteMap Slide 2 Stille (8.6s)
# Output #0, mp3, to '.../route_silence.mp3':  ← route_silence.mp3 wird generiert
# ✅ Voiceover-Sync: perSlideArray=[7.4, 8.6, 7.6, 7.6]  ← 4 Einträge bei 3 Bildern+RouteMap
# 1030 Frames @ 25fps = 41.2s  ← korrekte Gesamtlänge
```

**Letzter Commit dieser Session**: `aac4452` – Caption Safe Zone per Plattform + Pill-Hintergrund

---

## 📋 Changelog – Änderungen 26.06.2026

### TikTok Prompt-System komplett überarbeitet (02ffc6b, 9068054)

| Änderung | Beschreibung | Datei |
|----------|-------------|-------|
| `generateTikTokUserPrompt()` | User-Prompt als exportierbare Funktion (statt hartcodiert in server.js) | `tiktok.js` |
| 5 Hook-Mechaniken | Zahlen-, Paradox-, Szene-, Subtext-, Kontrast-Hook | `tiktok.js` |
| Retention-Bogen | bodyLines: Situation → Bruch → Intimität → Offen | `tiktok.js` |
| Eiserne Regel: 1 Satz pro bodyLine | Kein Punkt innerhalb eines Eintrags. Max 15 Wörter. Selbstcheck vor Antwort. | `tiktok.js` |
| Serverseitige bodyLine-Bereinigung | KI-Einträge an Satzgrenzen splitten → auf imageCount kürzen/auffüllen | `server.js` |
| Kein Wiederhohlungs-Fallback mehr | Wenn KI imageCount-1 liefert: Hook als bodyLines[0] einsetzen | `server.js` |

### voiceoverMode + Plattform-Parameter (02ffc6b, ece8ace)

| Feature | Beschreibung |
|---------|-------------|
| **voiceoverMode** | Caption-optimiert (Stakkato/Fragmente) vs TTS-optimiert (vollständige Sätze, Zahlen ausschreiben) |
| **Platform** | `'tiktok'` \| `'reels'` \| `'youtube'` – je eigene Hook-Länge, Hashtag-Strategie, CTA-Stil |
| **thumbnail** | Neues JSON-Feld: max 5 Wörter für Cover-Text, mit Live-Preview im UI |
| **Platform-Selector** | In Step 2 (vor Generieren-Button) – KI bekommt beim ersten Klick die richtige Plattform |
| **captionStyle Toggle** | Full-Line (Default) vs Karaoke/Chunked in den Render-Einstellungen |

### Bridge aus Voiceover entfernt (ece8ace, 17109fa)

- **Problem**: "Mehr auf mojobus.co" klang gesprochen wie ein Werbejingle
- **Fix**: Bridge aus `voiceoverSegmentsArray` + `voiceoverText` entfernt
- Bridge erscheint als Text-Overlay, wird nicht von Edge TTS gesprochen

**Alle Voiceover-Änderungen auf einen Blick:**

| Aspekt | Vorher | Nachher |
|--------|--------|--------|
| Segmente | `[hook, body1..bodyN, bridge]` | `[body1..bodyN]` (kein Hook, keine Bridge) |
| AudioLayer-Start | Frame 0 | `<Sequence from={hookFrames}>` (5s Offset) |
| hookCaption | `hookText` (Dopplung) | `location \|\| country` |
| Hook-Dauer | 4s | **5s** (mehr Zeit für Stop-the-Scroll) |
| Hook-Overlay | Linearer Gradient (oben hell) | **55% gleichmäßiges Dim** via HookDimOverlay |

### Voiceover-Sync: Slide-genaue MP3s (af9fe37, 33dede0)

**Fundamentaler Sync-Bug behoben:**

```
ALT: concat.txt + duration-Direktive + -c:a libmp3lame
  → MP3-Frames = ±26ms → bei 9 Slides bis zu 0.23s Drift → hörbar asynchron

NEU: slide-genaue MP3s via ffprobe-Garantie
  → Für jeden Slide: Audio + exakte Stille (ffmpeg -t) → slide_N.mp3
  → ffprobe misst echte Dauer → perSlideArray aus GEMESSENEN Werten
  → Alle slide_N.mp3 mit -c copy zu voiceover_sync.mp3 (kein Drift)
  → Video-Slide-Frames = Math.round(echte_dauer × fps) → 100% Sync
```

**Log-Ausgabe pro Slide:**
```
📐 Slide 1: 6.210s (audio 5.21s + stille 1.002s)
📐 Slide 2: 5.370s (audio 4.37s + stille 1.002s)
...
✅ voiceover_sync.mp3 (300KB, 64.77s) – 11 Slides
```

### Hook-Qualität + UI (7271bbc, 491eda3, c7f76fe)

- **HookDimOverlay** – Gleichmäßige 55% Abdunkelung während Hook-Slide (statt Gradient nur unten)
- **Hook-Prompt** – Expliziter Scroll-Stop-Test: "Würde ein fremder Mensch beim Scrollen stoppen?"
- **Dopplung entfernt** – `hookCaption` zeigt jetzt `location` statt `hookText` (war 2× sichtbar)

### imageContexts: Bild-Kontext pro Slide (d948e27)

- **Problem**: `locations` hatte 1 Eintrag pro ARTIKEL, nicht pro BILD → KI schrieb Sätze in beliebiger Reihenfolge
- **Fix**: `imageContexts[]` mit 1 Eintrag pro Bild in `sortedImages`-Reihenfolge
- Extraktion: `imeta` alt-Text → location/country aus Event-Tags → URL-Dateiname als Fallback
- Prompt: "Satz 1 bezieht sich auf Bild 1, Satz 2 auf Bild 2..."

### Bekannte Baustellen (26.06.2026)

- **HookDimOverlay Opacity**: Aktuell 0.55 (55% Abdunkelung). Bei Bedarf in `MojoBusVideo.tsx` anpassbar.
- **bodyLine-Kürzung**: Bei mehr Sätzen als Bilder werden die letzten abgeschnitten. Der Prompt zwingt zu `imageCount` Sätzen, aber der serverseitige Fallback (Satz-Splitter + Kürzen) ist das letzte Sicherheitsnetz.
- **Bundle-Cache**: Nach jeder `server/remotion/`-Code-Änderung wird der Bundle-Cache beim Deploy automatisch geleert (deploy-main.sh). Manuell: `curl -X POST http://localhost:3002/api/render-remotion/invalidate-bundle`

### Wichtige Debug-Kommandos (26.06.2026)

```bash
# Sync prüfen (pro Slide):
journalctl -u ai-api -f | grep -i "📐\|perSlideArray\|Frames\|voiceover_sync"

# bodyLine-Bereinigung prüfen:
journalctl -u ai-api -f | grep -i "bodyLines\|Bild1\|Generiert"

# RouteMap-Debug:
journalctl -u ai-api -f | grep -i "RouteMap\|🗺️"

# Bundle-Cache leeren (nach Code-Änderungen):
curl -X POST http://localhost:3002/api/render-remotion/invalidate-bundle
```

---

## 📋 Changelog – Änderungen 26.06.2026 (Abendsession)

### Vision-KI für Bild-Analyse (2a4744a)

**Neuer Endpoint** `POST /api/tiktok/analyze-images`:

| Feature | Beschreibung |
|---------|-------------|
| **Groq Vision** | Llama 4 Scout – kostenlos, schnell, erster Versuch |
| **Claude Fallback** | Über OpenRouter – falls Groq fehlschlägt |
| **Vision-Prompt** | Sachlich: "Was ist das Hauptmotiv? Farbe, Licht, Besonderheit." |
| **Parallel** | `Promise.all` – alle Bilder gleichzeitig analysiert |
| **Cache** | Bilder mit `imeta alt`-Tag werden übersprungen (schon beschrieben) |
| **Timeout** | Groq 20s, Claude 25s |

**Prompt-Integration:**
```
BILDER IN REIHENFOLGE – von Vision-KI analysiert (FAKTEN)
PFLICHT: bodyLines[0] = Satz ZU Bild 1, bodyLines[1] = Satz ZU Bild 2
Die Reihenfolge ist ABSOLUT. Nicht interpretieren, nicht tauschen.
Schreibe aus dem INNENLEBEN – nicht: beschreibe was auf dem Bild zu sehen ist.
```

**Frontend-Flow:**
```
User klickt "KI-Text generieren"
  Schritt 1: /api/tiktok/analyze-images (Toast: "Bilder werden analysiert...")
  Schritt 2: Vision-Beschreibungen als imageContexts → /api/tiktok/generate-text
```
| Datei | Änderung |
|-------|----------|
| `server/server.js` | `analyzeOneImage()` + `/api/tiktok/analyze-images` Endpoint |
| `TikTokPromotion.tsx` | generateTikTokText() in 2 Schritte aufgeteilt + Hilfsfunktionen |
| `tiktok.js` | Prompt: "BILDER IN REIHENFOLGE – Vision-KI analysiert (FAKTEN)" |

### Leon in ewiger Erinnerung (8ac7d59)

**`lifestyles.js`** – Alle "Hund soul Leon" (als lebender Hund) ersetzt:

| Vorher | Nachher |
|--------|---------|
| `"Diesel, Kaffee, Hund soul Leon."` | `"Diesel, Kaffee. Leons Platz ist leer."` |
| `"Hund. ...genau richtig."` | `"...Leons Geruch bleibt."` |
| `"Hund soul Leon. Susanne macht die Tür auf..."` | `"Susanne macht die Tür auf. ...Leons Platz ist leer. Passt trotzdem."` |
| (vanlife) `"Hund soul Leon"` | Entfernt (nur Mojobus kennt Leon) |

**`tiktok.js` – Charakter-Block (neu):**
```
WER SCHREIBT:
  Mojo & Susanne, 36 Jahre alter US-Oldtimer-Bus, 10m, 7.5t,
  Perpetual Travelers. Leon (Soul Leon) – vorausgegangen, in Erinnerung.
  NIE als lebender Begleiter. Nie.
```

**Textqualität-Verbesserungen:**
- 15 Wörter → 6-20 Wörter + ein langer Satz (emotionaler Träger) erlaubt
- Foster-Rhythmus: kurz. kurz. LANG. kurz.
- Bild-Orientierung: "was denkt/fühlt/riecht Mojo?" statt Bildbeschreibung
- text-Limit: 1200 → 2000 Zeichen
- Markdown-Texteingabe im Frontend bereinigt (`[BILD_N]`, `**`, `##` entfernt)
- Multi-Content: `[Inhalt 1: Titel]` als separate Blöcke

### KenBurns erweitert – 4 neue Effekte (88c5640)

| Effekt | Direction | Was passiert | Wann |
|--------|-----------|-------------|------|
| **Atmender Zoom** | `'breathing'` | Sinus-Puls (2×/Slide) + Noise-Pan | Naturfotos, Tierfotos |
| **Fokus-Blur→Scharf** | `'focus-in'` | blur 4px→0 in 33% der Zeit + Zoom | Makros, emotionale Momente |
| **Handkamera** | `'handheld'` | Noise 3× höhere Frequenz, 2.5% Amplitude | Authentischer Look |
| **Gamma-Fade** | prop `gammaFade` | Farbstich/Dunkel blendet in 0.4s aus | Bild 1: `dark-in`, Bild 2: `warm-in` |

**`pickDirection()` neue Verteilung:**
```
noise      → 4 Slots (33%) – organisch
breathing  → 2 Slots (17%) – lebendig
focus-in   → 2 Slots (17%) – cinematic
handheld   → 2 Slots (17%) – authentisch
zoom/diag  → 2 Slots (17%) – klassisch
```

| Datei | Änderung |
|-------|----------|
| `KenBurnsImage.tsx` | 3 neue Direction-Typen + GammaFade + 3 neue Transform-Funktionen |
| `MojoBusVideo.tsx` | MediaRenderer übergibt gammaFade nach Index |

### Musik-Lautstärke gesenkt (08fcf34)

- Musik: `0.49` → **`0.34`** (30% leiser)
- Voiceover bleibt bei 1.0 (voll hörbar), Ambient bei 0.20
- Nur eine Stelle: `MojoBusVideo.tsx` AudioLayer

### /videos Seite + NIP-71 kind 34236 Video-Events (e0cdff2, 951affe)

**Event-Typ Umstellung:**
| Aspekt | Vorher (kind 30078) | Nachher (kind 34236) |
|--------|-------------------|-------------------|
| Nostr-Standard | App-intern | **NIP-71 Short Video** |
| content | JSON mit Meta-Daten | **Foster-Sätze (Klartext)** |
| Video-URL | `['url', ...]` Tag | **`['imeta', 'url ...', ...]`** |
| Thumbnail | Nicht vorhanden | **`['image', url]`** |
| Sichtbar auf | Nur in History | **mojobus.co/videos** |
| Andere Clients | Unsichtbar | **Zap.stream, Flare, Primal** |

**Publish-Flow im TikTok Dashboard:**
```
Video fertig → Card: ☑️ "Auf /videos publizieren" (default: an)
  → Checkbox AN:  kind 34236 (NIP-71) → erscheint auf /videos
  → Checkbox AUS: kind 30078 (app-intern) → nur in History
```

**Neue Dateien:**
| Datei | Beschreibung |
|-------|-------------|
| `src/pages/Videos.tsx` | Single-Column Feed: 9:16 (400px), 16:9 (800px), Lazy Loading, Play/Klick |
| `src/hooks/useVideos.ts` | Lädt kind 34236+34235, parst imeta/image-Tags, aspectRatio-Erkennung |

**Geänderte Dateien:**
| Datei | Änderung |
|-------|----------|
| `AppRouter.tsx` | `/videos` lazy import + `/artikel/notes` Route |
| `routes.ts` | `/videos`, `/artikel/notes` ergänzt |
| `mainMenu.ts` | Notes → unter Artikel, Videos als Toplevel 🎬 |
| `TikTokPromotion.tsx` | publishToNostr() auf 34236, History liest beide Kinds |

### Ausblick / Nächste Schritte
- ✅ **16:9 Querformat** – `/videos` unterstützt 16:9 + 9:16 (dim-Tag aktuell hartcodiert auf `1080x1920`)
- ✅ **Prerender für kind 34236** – `scripts/prerender-static.js` erweitert
- ✅ **JSON-Dump** – `/data/videos.json` für schnelles Laden
- ⬜ **Video-Detailseite**: `/video/:naddr` – einzelne Video-Seite mit OG-Tags für Social Sharing
- ⬜ **16:9 Querformat dim-Tag** im TikTok Dashboard konfigurierbar machen (aktuell hartkodiert 1080x1920)

---

## 📋 Changelog – Weiteres Update (26.06.2026)

### Caption Safe Zone per Plattform + leicht abgedunkelter Pill (aac4452)

**Problem:** Caption saß bei `bottom: 35%` – fast in der Bildmitte. Plattform-UI (Text/Captions unten) überlappte.

**Fix:** Plattform-abhängige Positionierung + Gradient durch leichten Pill ersetzt.

| Plattform | Bottom % | Abstand von unten | UI-Endet bei |
|-----------|----------|-------------------|--------------|
| **TikTok** | `20%` | 384px frei | ~350px ✅ |
| **Reels** | `25%` | 480px frei | ~450px ✅ |
| **YouTube** | `18%` | 346px frei | ~300px ✅ |

**Pill-Hintergrund (statt Gradient-Overlay):**
- `background: rgba(0,0,0,0.28)` – leicht abgedunkelt, Bild bleibt sichtbar
- `backdropFilter: blur(4px)` – sanfte Tiefenwirkung
- `borderRadius: 12px`, `padding: 0.35em 0.8em`
- TextShadow reduziert – Pill übernimmt den Kontrast
- Kein globaler Gradient mehr der das Bild abdunkelt

**Propagation:**
```
TikTokPromotion.tsx: platform → Payload
render.js:           platform → inputProps
MojoBusVideo.tsx:    platform → PerSlideCaption
Captions.tsx:        platform → CAPTION_BOTTOM[platform] → bottom
```

### Dual-Event Publishing: kind 34236 + kind 1 für Feed (6875397)

**Problem:** kind 34236 (NIP-71) erscheint nicht im Feed von Amethyst/Primal/Damus.

**Fix:** Wenn Checkbox "Auf /videos publizieren" aktiv → **zwei Events**:

| Event | Kind | Zweck |
|-------|------|--------|
| Event 1 | `34236` | `/videos` Seite, Video-Clients (Zap.stream, Flare) |
| Event 2 | `kind 1` | Amethyst, Primal, Damus, alle Feed-Clients |

**kind 1 Struktur:**
```
content: "Foster-Sätze\n\nhttps://blossom.../video.mp4\n\n#vanlife #mojobus"
tags: [
  ['r', mp4Url],
  ['imeta', 'url ...', 'm video/mp4', 'dim 1080x1920'],
  ['a', '34236:pubkey:dTag', 'wss://relay.mojobus.co'],
  ...hashtagTags,
]
```
- mp4Url **direkt im content-Text** → Amethyst/Primal rendert es als Video
- `a`-Tag referenziert das kind 34236 Event
- kind 1 Fehler blockiert nicht – kind 34236 bereits gespeichert

### Stufe 2 – JSON-Dump + Prerender + Hybrid-Hook (31f2f2b)

| Maßnahme | Beschreibung | Datei |
|----------|-------------|-------|
| **JSON-Dump** | `/data/videos.json` mit kind 34236+34235, stripVideo() | `scripts/generate-site-data.js` |
| **Prerender** | `/prerender/video-naddr1xxx.html` mit og:video, twitter:player, JSON-LD VideoObject | `scripts/prerender-static.js` |
| **Hybrid-Hook** | `/data/videos.json` sofort + Relay-Live im Hintergrund (wie useNotes) | `src/hooks/useVideos.ts` |
| **SW-Cache** | `/data/videos.json` automatisch in staleWhileRevalidate | `public/sw.js` (kein Change) |

**generate-site-data.js:**
- kind 34236+34235 abfragen
- `stripVideo()`: relevante Tags behalten (imeta, image, duration, title, t, r)
- content auf 300 Zeichen (Foster-Sätze)
- `videos.json` schreiben, index.json: videos-Zähler

**prerender-static.js:**
- `renderVideoHtml()`: og:type=video.other, og:video, twitter:player, JSON-LD VideoObject
- Dateiname: `video-naddr1xxx.html`
- main(): kind 34236+34235 abfragen + rendern

**useVideos.ts (Hybrid-Hook):**
- Schritt 1: `/data/videos.json` + `/data/index.json` (cronTimestamp)
- Schritt 2: Relay-Live für neue Videos seit letztem Cron-Lauf
- Merge + Deduplizierung + Sortierung (wie useNotes/usePreloadedData)

### Videos Header Gradient (6875397)

Header identisch zu `/bilder` und `/notes`:
```
bg-gradient-to-br from-primary/30 via-accent/20 to-background
+ bg-gradient-to-b from-transparent to-background
+ gradient-text für Titel + Film-Icon

---

## 📋 Changelog – 28.06.2026 (Capacitor-App-Kompatibilität)

### Problem: Alle Seiten in der APK (Android Capacitor WebView) funktionierten nicht

**Root Cause:** Die Capacitor-App lädt im `file:///android_asset/` Kontext. Relative URLs wie `/api/...` und `/data/...` werden zu `file:///api/...` aufgelöst → existieren nicht → 404/Fehler.

Betroffen waren:
- `/videos` → keine Daten (kein `/data/videos.json` im file:// Kontext)
- `/promotion/tiktok` → „Remotion nicht verfügbar", „is not valid JSON"
- Musik-Vorschau → Tod-Stumm

### Fix 1: Capacitor-Erkennung + absolute URLs (`getApiBaseUrl()` / `getDataBaseUrl()`)

**Strategie:** Einmal prüfen ob `Capacitor.isNative === true`, dann absolute URLs `https://mojobus.co/api/...` verwenden statt relativer.

```typescript
function getApiBaseUrl(): string {
  try {
    const cap = (window as any).Capacitor
    const isNative =
      cap?.isNative === true ||
      (window as any).__Capacitor?.isNative === true ||
      cap?.getPlatform?.() === 'android' ||
      cap?.getPlatform?.() === 'ios'
    if (isNative) return 'https://mojobus.co'
  } catch { /* ignore */ }
  return '' // Browser → relative URLs
}
```

| Datei | Helper | Verwendung |
|-------|--------|-----------|
| `src/hooks/useVideos.ts` | `getDataBaseUrl()` | `fetch(base/data/index.json)`, `fetch(base/data/videos.json)` |
| `src/pages/TikTokPromotion.tsx` | `getApiBaseUrl()` | Alle 8 fetch + 2 window.open API-Calls |

**Alle korrigierten API-Calls in TikTokPromotion.tsx:**

| # | Endpoint | Methode |
|---|----------|--------|
| 1 | `/api/render-remotion/check` | GET |
| 2 | `/api/music/list` | GET |
| 3 | `/api/tiktok/analyze-images` | POST |
| 4 | `/api/tiktok/generate-text` | POST |
| 5 | `/api/render-remotion` | POST |
| 6 | `/api/render-remotion/status/:jobId` | GET (Polling) |
| 7 | `/api/render-remotion/download/:jobId` | GET (Blob) |
| 8 | `/api/render-remotion/history` | GET |
| 9 | `/api/render-remotion/download/:jobId` | window.open (×2) |

### Fix 2: Videos in der App sichtbar

**useVideos.ts:**
- `fetch('/data/videos.json')` → `fetch('${getDataBaseUrl()}/data/videos.json')`

**Videos.tsx VideoCard:**
- `inView` startet mit `true` wenn `isCapacitorNative()` (IntersectionObserver in WebView unzuverlässig)
- Browser: `threshold: 0` + `rootMargin: 200px` (früheres Vorladen)

### Fix 3: IntersectionObserver-Verbesserung (Desktop)

- `threshold: 0.1` → `threshold: 0` (triggert bei 1px Sichtbarkeit)
- `rootMargin: '200px'` (200px vor Eintritt vorladen)

### Fix 4: Musik-Vorschau Play-Button

**Neue UI:** Mini ▶/■ Button direkt neben dem Musik-Select

```
🎵 Musik
[ Alexguz Road Trip 279005  ▼ ]  [ ▶ ]
  22 Tracks auf dem Server  ♪ läuft…
```

**Technik:**
- `useRef<HTMLAudioElement>` – kein sichtbares `<audio>` Element
- `audio.oncanplay` → `play()` (wartet bis geladen)
- `audio.onerror` → sauberer Fallback `setPlayingPreview(false)`
- `audio.onended` → Button springt zurück auf ▶
- `handleTrackChange()` stoppt laufende Vorschau bei Track-Wechsel
- Absolute URL: `base/server/music/track.filename` (statische Dateien via Nginx, **nicht** /api/music/)

**Key Fix:** MP3s liegen unter `/server/music/` als statische Nginx-Dateien, nicht über den `/api/music/` API-Endpunkt erreichbar (gab 404). Die URL wird daher als `base/server/music/filename.mp3` aufgebaut, nicht aus `track.url`.

### Betroffene Dateien dieser Session

| Datei | Änderung |
|-------|----------|
| `src/hooks/useVideos.ts` | `getDataBaseUrl()` + absolute URLs + cronTimestamp Fallback |
| `src/pages/Videos.tsx` | `isCapacitorNative()`, `inView` initial true, threshold 0 + rootMargin 200px |
| `src/pages/TikTokPromotion.tsx` | `getApiBaseUrl()` + 10 API-Calls auf absolut + Musik-Play-Button |

### Wichtiges für zukünftige Feature-Entwicklung

- **Jede neue fetch/API-URL in TikTokPromotion.tsx** muss `${getApiBaseUrl()}` prefix haben
- **Jede neue Daten-URL in useVideos.ts** muss `${getDataBaseUrl()}` prefix haben
- **Musik-URLs**: `/server/music/filename.mp3` (statisch via Nginx), nicht `/api/music/filename`
- **Capacitor Test** nach jedem Build: immer APK bauen und auf Android testen
- Bei neuen Seiten mit API-Calls: `isCapacitorNative()` prüfen und absolute URLs bereitstellen

### Commits dieser Session

| Hash | Beschreibung |
|------|-------------|
| `c190141` | Videos in Capacitor-App sichtbar machen |
| `03ae76f` | TikTokPromotion API-Calls repariert (8 Stellen) |
| `1f35509` | 2 vergessene relative API-URLs (analyze-images, generate-text) |
| `2876670` | generateTikTokText base-Variable konsistent |
| `663690c` | Musik-Vorschau Play-Button |
| `aa82fcf` | Audio-Loading repariert (oncanplay statt sofort play()) |
| `7b291b5` | crossOrigin entfernt (NS_BINDING_ABORTED) |
| `2b3a65c` | Musik-URL auf /server/music/ korrigiert |