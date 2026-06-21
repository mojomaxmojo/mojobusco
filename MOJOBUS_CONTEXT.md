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
| `public/sw.js` | Service Worker v19 – staleWhileRevalidate für /data/, Cache-First für Prerender |
| `src/hooks/usePreloadedData.ts` | Generischer Hybrid-Hook: JSON-Dump sofort + Live-Relay im Hintergrund |
| `scripts/prerender-static.js` | Prerender: statische HTML-Seiten mit NIP-19 Dateinamen |
| `scripts/generate-sitemap.js` | Generiert sitemap.xml (Cron: täglich 6:00) |
| `scripts/generate-site-data.js` | Generiert **Slim**-JSON-Dumps ohne content (Cron: täglich 6:15) |
| `scripts/generate-feed.js` | Generiert RSS 2.0 Feed (Cron: alle 6h) |
| `scripts/patch-android-manifest.js` | Patcht AndroidManifest.xml (Permissions) |
| `scripts/copy-icons.js` | Kopiert Icons aus public/ in Android-Ordner |
| `capacitor.config.ts` | Capacitor-Konfiguration (appId: co.mojobus.app) |
| `mojobus.co.ssl.conf` | Nginx-Config: Bot-Prerender + Brotli + Caching + `/data/` mit max-age=86400 |

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
| `src/config/prompts/` | **⚠️ TABU – NIEMALS ÄNDERN!** KI-Prompt-Vorlagen | JS |
| `src/config/budget.ts` | Haushaltsbuch-Konfiguration | TypeScript |
| `src/config/video.ts` | Video-Konfiguration | TypeScript |
| `src/config/leon.ts` | Leon-Story Konfiguration | TypeScript |
| `src/config/zeitwohnmobil.ts` | ZeitWohnmobil-Konfiguration | TypeScript |
| `src/config/README.md` | Detaillierte Config-Dokumentation | Markdown |

**Regel**: Jede neue Konfiguration gehört nach `src/config/`. Keine hartcodierten Werte im Quellcode – immer aus den Config-Dateien importieren.

### ⛔ Tabu-Zonen – Niemals ändern

| Pfad | Grund |
|------|-------|
| `src/config/prompts/` | **KI-Prompt-Konfiguration** – läuft im Browser (Vite-Build) **und** im Node.js Server (`ai-api`). Änderungen zerstören die KI-Content-Erstellung. |
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
- **SW Cache-Version**: Wird bei jedem Deploy automatisch erhöht durch `bump_sw_version()` in `deploy-main.sh`. Aktuelle Version: **v19**.
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