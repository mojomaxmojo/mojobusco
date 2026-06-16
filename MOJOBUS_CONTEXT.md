# MojoBus – Session Context
Zuletzt aktualisiert: Juni 2026 – Stufe 2 Performance-Optimierungen

## Projekt-Übersicht
MojoBus ist eine Nostr-basierte Vanlife/Travel-Plattform zum Teilen von Reiseerlebnissen, Campingplätzen, Fotos mit GPS-Daten. Laeuft als **PWA + Android APK (Capacitor)**.

## Tech-Stack
- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS 3, shadcn/ui
- **Backend**: Kein Server – rein clientseitig via Nostr (NIP-23 Long-Form + NIP-94 Media)
- **Storage**: Blossom (Media), Nostr (Events/Posts)
- **Mobile**: Capacitor 8 (@capacitor/android, @capawesome/capacitor-file-picker)
- **Deployment**: AlmaLinux 9.7 CentminMod, Nginx, Node.js

---

## Wichtige Dateien

| Datei | Zweck |
|-------|-------|
| `src/lib/capacitorGps.ts` | Native Dateiauswahl + EXIF-GPS via exifr.js |
| `src/lib/gpsExtraction.ts` | GPS-Extraktion fuer Browser (Standard) |
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
| `public/fonts.css` | font-display: optional (kein CLS durch Font-Swap) |
| `public/sw.js` | Service Worker v19 – Cache-Strategien fuer alle Ressourcen |
| `scripts/prerender-static.js` | Prerender: statische HTML-Seiten mit NIP-19 Dateinamen |
| `scripts/generate-sitemap.js` | Generiert sitemap.xml (Cron: taeglich 6:00) |
| `scripts/generate-site-data.js` | Generiert Slim-JSON-Dumps (Cron: taeglich 6:15) |
| `scripts/generate-feed.js` | Generiert RSS 2.0 Feed (Cron: alle 6h) |
| `scripts/patch-android-manifest.js` | Patcht AndroidManifest.xml (Permissions) |
| `scripts/copy-icons.js` | Kopiert Icons aus public/ in Android-Ordner |
| `capacitor.config.ts` | Capacitor-Konfiguration (appId: co.mojobus.app) |
| `mojobus.co.ssl.conf` | Nginx-Config: Bot-Prerender + Brotli + Caching + /data/ Cache |

---

## Config-Verzeichnis (src/config/)

Alle Konfigurationen zentral in `src/config/`. **Neue Konfigurationen immer hier erstellen**, nicht verteilt im Code.

| Datei | Zweck | Type |
|-------|-------|------|
| `src/config/authors.json` | **Single Source of Truth** fuer Autoren (pubkey, npub, nip05) | JSON |
| `src/config/relays.ts` | Relay-Listen, Autor-Relay-Zuordnung, Presets, DEFAULT_APP_CONFIG | TypeScript |
| `src/config/blossom.ts` | Blossom-Server fuer Medien-Uploads (autor-spezifisch) | TypeScript |
| `src/config/nostr.ts` | Legacy-Nostr-Config (re-exportiert aus relays.ts) | TypeScript |
| `src/config/app.ts` | App-Einstellungen (Theme, UI, Performance) | TypeScript |
| `src/config/types.ts` | Zentrale Typdefinitionen fuer alle Configs | TypeScript |
| `src/config/routes.ts` | Routen-Definitionen | TypeScript |
| `src/config/mainMenu.ts` | Hauptnavigation (Desktop + Mobile) | TypeScript |
| `src/config/menu.ts` | Legacy-Menue-Konfiguration | TypeScript |
| `src/config/countries.ts` | Laender-Datenbank mit Koordinaten, Keywords, Routen | TypeScript |
| `src/config/diy.ts` | DIY-Kategorien | TypeScript |
| `src/config/rvlife.ts` | RV Life Kategorien | TypeScript |
| `src/config/articles.ts` | Artikel-Kategorien | TypeScript |
| `src/config/tags.ts` | Tag-Definitionen und -Gruppen | TypeScript |
| `src/config/tagConfigs.ts` | Erweiterte Tag-Konfigurationen | TypeScript |
| `src/config/contentCategories.ts` | Content-Kategorie-Definitionen | TypeScript |
| `src/config/imageService.ts` | Bildoptimierungs-Service (weserv/imgproxy/Cloudflare) | TypeScript |
| `src/config/performance.ts` | Performance-Konfiguration (Infinite Scroll, Cache, Relay) | TypeScript |
| `src/config/cache.ts` | Granulare Cache-Konfiguration (24h/7d/1y) | TypeScript |
| `src/config/prompts/` | **TABU – NIEMALS AENDERN!** KI-Prompt-Vorlagen | JS |
| `src/config/budget.ts` | Haushaltsbuch-Konfiguration | TypeScript |
| `src/config/video.ts` | Video-Konfiguration | TypeScript |
| `src/config/leon.ts` | Leon-Story Konfiguration | TypeScript |
| `src/config/zeitwohnmobil.ts` | ZeitWohnmobil-Konfiguration | TypeScript |
| `src/config/README.md` | Detaillierte Config-Dokumentation | Markdown |

**Regel**: Jede neue Konfiguration gehoert nach `src/config/`. Keine hartcodierten Werte im Quellcode.

---

## Tabu-Zonen – Niemals aendern

| Pfad | Grund |
|------|-------|
| `src/config/prompts/` | KI-Prompt-Konfiguration – laeuft im Browser (Vite-Build) UND im Node.js Server (ai-api). Aenderungen zerstoeren die KI-Content-Erstellung. |
| `server/` | Node.js Backend – wird vom ai-api Systemd-Service verwendet. Keine Aenderungen ohne separates Deployment. |

---

## Performance-Optimierungen

### Runde 1 – CLS/LCP (Juni 2026)

| Massnahme | Wirkung | Dateien |
|-----------|---------|---------|
| Skeleton-Grids statt LoadingSpinner | CLS von 0.4 auf ~0 | Home, Notes, Places, Images, DIY, RVLife, Leon, Articles |
| font-display: optional | Kein CLS durch Font-Swap | `public/fonts.css` |
| Critical CSS inline | LCP von 2.1s auf ~1.2s | `index.html` |
| Logo preload fetchpriority=high | LCP schneller | `index.html` |
| aspect-[3/4] fuer ImageCards | CLS-freies Bildlayout | `Images.tsx` |
| Nur 3 Font-Gewichte statt 7 | 149KB auf 95KB Font-Ladung | `public/fonts.css` |
| GTmetrix Score | 58% auf A (90/100) | alle oben |

### Runde 2 – Ladezeiten Listenseiten (Juni 2026)

**Problem**: /artikel, /notes, /bilder, /plaetze luden 3-6 Sekunden wegen Live-Relay-Queries.

**Loesung: Hybrid-Ansatz**
1. Cron generiert taeglich Slim-JSON-Dumps nach /data/
2. Frontend laedt JSON sofort (100ms), kein Relay-Roundtrip
3. Live-Update nur fuer neue Events seit letztem Cron (im Hintergrund)
4. Service Worker cached /data/ via staleWhileRevalidate

| Massnahme | Dateien | Einsparung |
|-----------|---------|-----------|
| SW v19: staleWhileRevalidate fuer /data/ | `public/sw.js` | Wiederholungsbesuch: ~800ms auf 0ms |
| SW: NetworkError-Fix (ok-Pruefung vor cache.put) | `public/sw.js` | Stabilitaet |
| usePreloadedData: Promise.all fuer parallele Fetches | `src/hooks/usePreloadedData.ts` | ~250ms gespart |
| useNotes auf usePreloadedData umgestellt | `src/hooks/useNotes.ts` | 3-5s auf ~200ms |
| Images.tsx auf usePreloadedData umgestellt | `src/pages/Images.tsx` | 2-3s auf ~200ms |
| usePlaces auf usePreloadedData umgestellt | `src/hooks/useLongformArticles.ts` | 2-3s auf ~200ms |
| generate-site-data.js: Slim-JSON (kein content) | `scripts/generate-site-data.js` | articles.json ~80% kleiner |
| Nginx /data/ Block: max-age=86400 | `mojobus.co.ssl.conf` | Browser-Cache 1 Tag |

**Erwartete Ladezeiten nach Runde 2:**

| Seite | Vorher | Nach erstem Besuch | Nach Wiederholungsbesuch |
|-------|--------|--------------------|--------------------------|
| /artikel | 3-4s | ~1.2s | ~0.1s |
| /notes | 4-5s | ~1.0s | ~0.1s |
| /bilder | 2-3s | ~0.8s | ~0.1s |
| /plaetze | 2-3s | ~0.8s | ~0.1s |

---

## Daten-Architektur: Hybrid-Ansatz

### Wie Listenseiten Daten laden

```
Seitenaufruf
     |
     +---> fetch /data/{typ}.json  (parallel)
     |         |
     +---> fetch /data/index.json  (parallel via Promise.all)
               |
               +-- SW-Cache getroffen? --> sofort (0ms)
               +-- Kein Cache?        --> Nginx (100-200ms, dann gecacht)
               |
               +-- isPreloaded = true
               |       |
               |       +--> Daten sofort rendern
               |       +--> Live-Query im Hintergrund starten
               |             (nur Events neuer als cronTimestamp)
               |
               +-- isPreloaded = false (JSON fehlt)
                       |
                       +--> Fallback: pure Relay-Query (altes Verhalten)
```

### JSON-Dump Struktur (/data/)

| Datei | Inhalt | Felder |
|-------|--------|--------|
| `articles.json` | Alle kind-30023 Artikel (kein content) | id, pubkey, kind, created_at, tags(title/summary/image/d/t) |
| `places.json` | Orte (kind-30023 mit type=place) | id, pubkey, kind, created_at, tags |
| `bilder.json` | Medien-Events (kind-1 mit media-Tags) | id, pubkey, kind, created_at, tags, content(200 Zeichen) |
| `notes.json` | Kurz-Notes (kind-1) | id, pubkey, kind, created_at, tags, content(200 Zeichen) |
| `trips.json` | Trips (kind-1 mit trip-Tags) | id, pubkey, kind, created_at, tags, content(200 Zeichen) |
| `sitemap.json` | naddr-Index aller Artikel | naddr, identifier, title, pubkey, createdAt |
| `index.json` | Meta: Timestamp, Anzahlen, Dauer | generatedAt, generatedAtUnix, counts, duration |

**Wichtig**: Detailseiten (ArticleView, NoteView) laden den **vollen Content** direkt vom Relay. JSON-Dumps enthalten nur Listenseiten-Metadaten.

### Hooks Uebersicht

| Hook | Datei | Datenquelle |
|------|-------|-------------|
| `usePreloadedArticles()` | `useLongformArticles.ts` | /data/articles.json + Relay-Live |
| `usePlaces()` | `useLongformArticles.ts` | /data/places.json + Relay-Live |
| `useNotes()` | `useNotes.ts` | /data/notes.json + Relay-Live |
| `usePreloadedData('bilder')` | direkt in `Images.tsx` | /data/bilder.json + Relay-Live |
| `useLongformArticle()` | `useLongformArticles.ts` | Nur Relay (Detailseite, braucht vollen Content) |
| `useNote()` | `useNotes.ts` | Nur Relay (Detailseite) |

---

## Prerender-Cache-System

Statische HTML-Seiten mit NIP-19 Dateinamen fuer Bots (Google, Facebook, Twitter etc.).

| Komponente | Beschreibung |
|------------|-------------|
| `scripts/prerender-static.js` | Generiert .html-Dateien mit NIP-19 IDs als Dateiname |
| `mojobus.co.ssl.conf` | Bot-Weiterleitung: /{naddr} auf /prerender/{naddr}.html |
| `public/sw.js` | cacheFirst fuer /prerender/ – sofort ausgeliefert |
| `scripts/generate-site-data.js` | Generiert /data/*.json fuer schnelle Relay-freie Nutzung |

**Cron-Ablauf auf dem VPS:**
```
06:00  prerender-static.js   --> /prerender/*.html (SEO fuer Bots)
06:15  generate-site-data.js --> /data/*.json      (Slim-JSON fuer SPA)
*/6h   generate-feed.js      --> /feed.xml         (RSS Feed)
taegl. generate-sitemap.js   --> /sitemap.xml
```

**Manuell ausfuehren:**
```bash
node /root/deploy-git/mojobusco/scripts/prerender-static.js
node /root/deploy-git/mojobusco/scripts/generate-site-data.js
```

---

## Service Worker (public/sw.js)

Aktuelle Version: **v19** (wird bei jedem Deploy automatisch erhoet von bump_sw_version())

Cache-Strategien in Reihenfolge:

| Pfad/Muster | Strategie | Begruendung |
|-------------|-----------|-------------|
| *.css, *.js, *.woff* | cacheFirst | Vite-Hashes: immutable |
| /assets/ | cacheFirst | Vite-Hashes: immutable |
| /data/*.json | staleWhileRevalidate | Taeglich per Cron aktualisiert |
| /prerender/ | cacheFirst | Taeglich per Cron, SEO-HTML |
| images.weserv.nl | cacheFirst | Immutable optimierte Bilder |
| blossom.primal.net, *.jpg/png etc. | cacheFirst | Immutable Blossom-Hashes |
| *.html, / | networkFirst | index.html: immer frisch |
| /api/ | staleWhileRevalidate | API-Endpunkte |
| wss:, relay.* | networkOnly | WebSockets nicht cachebar |
| alles andere | networkFirst | sicher |

**staleWhileRevalidate-Fixes (v19):**
- networkResponse.ok-Pruefung vor cache.put (kein 404/500 wird gecacht)
- NetworkError wird im .catch abgefangen (kein Absturz bei Offline)
- cachedResponse.clone() (Response-Body nur 1x lesbar)
- fetchPromise.catch() fuer Hintergrund-Fetch (kein unhandled rejection)

---

## Nginx-Konfiguration (mojobus.co.ssl.conf)

Relevante Location-Blocks:

```nginx
# JSON-Dumps: 1 Tag Cache, Browser + CDN
location /data/ {
    alias /home/nginx/domains/mojobus.co/public/data/;
    expires 1d;
    add_header Cache-Control "public, max-age=86400, stale-while-revalidate=86400";
    add_header Vary "Accept-Encoding";
    add_header Access-Control-Allow-Origin "*";
    try_files $uri =404;
}

# Prerender fuer Bots
location ^~ /prerender/ {
    alias /home/nginx/domains/mojobus.co/public/prerender/;
    expires 1d;
    add_header Cache-Control "public, no-transform";
    try_files $uri =404;
}

# SPA + Bot-Weiterleitung
location / {
    if ($is_bot = 1) {
        rewrite ^/(naddr1[0-9a-z]+)$ /prerender/$1.html break;
        rewrite ^/(note1[0-9a-z]+)$ /prerender/$1.html break;
        rewrite ^/(npub1[0-9a-z]+)$ /prerender/$1.html break;
    }
    try_files $uri $uri/ /index.html;
}
```

**Nach Nginx-Config-Aenderung:**
```bash
cp mojobus.co.ssl.conf /etc/nginx/conf.d/mojobus.co.ssl.conf
nginx -t && systemctl reload nginx
```

---

## VPS Deploy (AlmaLinux 9.7)

```bash
ssh root@server
cd /root/deploy-git/mojobusco
bash deploy-main.sh --force

# Nach erstem Deploy oder nach generate-site-data.js Aenderungen:
node scripts/generate-site-data.js

# Nginx-Config manuell aktualisieren (falls geaendert):
cp mojobus.co.ssl.conf /etc/nginx/conf.d/mojobus.co.ssl.conf
nginx -t && systemctl reload nginx
```

**deploy-main.sh macht automatisch:**
- git pull origin main
- npm install
- SW Cache-Version auto-bump (bump_sw_version)
- vite build
- rsync nach /home/nginx/domains/mojobus.co/public
- ai-api Systemd-Service neu starten

---

## Android APK Build (CachyOS)

```bash
cd ~/Mojobus-APK/mojobusco
git pull origin main
npm run apk
```
APK: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## GPS-Fix – Was funktioniert

**Problem**: Auf Android 10+ werden GPS-EXIF-Daten aus content:// URIs auf Systemebene redacted.

**Loesung:**
1. `pickFiles({ readData: true })` – liest base64 direkt vom Picker
2. `ACCESS_MEDIA_LOCATION` Permission zur Laufzeit anfordern
3. `exifr.gps(file)` auf dem File-Objekt
4. `URL.createObjectURL(file)` fuer Preview

**Wichtig**: `ACCESS_MEDIA_LOCATION` muss zur Laufzeit angefragt werden:
```typescript
const result = await FilePicker.requestPermissions({
  permissions: ['accessMediaLocation']
});
// result.accessMediaLocation === 'granted'
```

## Buttons im Medien-Upload (alle horizontal, Mobil 100x100 Quadrate)
1. "Auswahl" – input type=file (Standard-Dateiauswahl)
2. "Bilder GPS" – handleNativePick() (Capacitor FilePicker + EXIF-GPS)

---

## Wichtige Packages

- `@capawesome/capacitor-file-picker@^8.0.2` – Native Dateiauswahl
- `@capacitor/geolocation@^8.0.0` – Geraete-Standort
- `@capacitor/core@^8.0.0` – Capacitor Core
- `@capacitor/cli@^8.0.0` + `@capacitor/android@^8.0.0` – APK Build
- `exifr@^7.1.3` – EXIF-GPS Lesen aus rohen Bytes
- `@tanstack/react-query@^5.56.2` – Daten-Fetching + Caching
- `@unhead/react@^2.0.10` – SEO Head-Management
- `@nostrify/nostrify@^0.46.4` – Nostr-Client

---

## Server + Infrastruktur

- **Domain**: https://mojobus.co
- **Repository**: https://github.com/mojomaxmojo/mojobusco
- **Server**: AlmaLinux 9.7 (CentminMod), Nginx, Node.js, Brotli
- **Relay**: wss://relay.mojobus.co
- **RSS Feed**: https://mojobus.co/feed.xml (Cron alle 6h)
- **Sitemap**: https://mojobus.co/sitemap.xml (Cron taeglich 6:00)
- **Prerender**: https://mojobus.co/prerender/ (Cron taeglich 6:00)
- **JSON-Dumps**: https://mojobus.co/data/articles.json etc. (Cron taeglich 6:15)
- **AI-API**: Node.js Backend, Systemd-Service ai-api, Port 3002
- **Nginx-Config**: /etc/nginx/conf.d/mojobus.co.ssl.conf (via CentminMod)

---

## Autoren (Nostr)

Single Source of Truth: `src/config/authors.json`

| Quelle | Datei | Beschreibung |
|--------|-------|-------------|
| Single Source of Truth | `src/config/authors.json` | Einzige Stelle mit pubkey, npub, nip05 |
| TypeScript-Import | `src/config/relays.ts` -> AUTHORS | Von Komponenten genutzt |
| Cron-Scripts | `scripts/*.js` -> Import aus authors.json | Alle Scripts lesen aus derselben JSON |

Autoren hinzufuegen/aendern: **nur** `src/config/authors.json` bearbeiten.
Alle anderen Dateien (relays.ts, blossom.ts, authorUtils.ts, BudgetPage.tsx, Cron-Scripts) referenzieren automatisch.

```bash
# Aktuelle Autoren anzeigen:
cat src/config/authors.json | jq '.authors[] | {name, pubkey, nip05}'
```

---

## Wichtige Branches (GitHub)

- **main** – Aktive Entwicklung
- **backup-gps** – GPS-Fix funktionierender Stand (Commit 97b8dc4)
- **caption-improvements-v2** – Bildunterschriften (alter Stand)

---

## Bekannte Einschraenkungen / Hinweise

- **Shakespeare Push**: git push von Shakespeare-Plattform aus funktioniert nicht (NetworkError). Commits muessen von CachyOS-Maschine gepusht werden: `git fetch origin && git merge origin/main && git push origin main`
- **Relay primal.net**: Liefert bei generate-site-data.js konsistent 0 Events (Timeout). Nur relay.mojobus.co ist produktiv. Primal-Query kann auf kuerzeren Timeout gesetzt oder entfernt werden.
- **SW Cache-Version**: Wird bei jedem Deploy automatisch erhoet durch bump_sw_version() in deploy-main.sh. Aktuelle Version: v19.
- **JSON-Dumps content**: Artikel haben keinen content in JSON-Dumps (nur Metadaten-Tags). Detailseiten laden immer direkt vom Relay. Notes/Bilder haben 200 Zeichen content fuer Vorschautext.
- **Live-Query Aktivierung**: Startet erst wenn cronTimestamp aus index.json bekannt ist. Bei fehlendem index.json faellt usePreloadedData auf Fallback-Live-Query zurueck.
