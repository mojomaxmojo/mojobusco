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
| `public/sw.js` | Service Worker mit Cache-First für Prerender |
| `scripts/prerender-static.js` | Prerender: statische HTML-Seiten mit NIP-19 Dateinamen |
| `scripts/generate-sitemap.js` | Generiert sitemap.xml (Cron: täglich 6:00) |
| `scripts/generate-site-data.js` | Generiert statische JSON-Dumps (Cron: täglich 6:15) |
| `scripts/generate-feed.js` | Generiert RSS 2.0 Feed (Cron: alle 6h) |
| `scripts/patch-android-manifest.js` | Patcht AndroidManifest.xml (Permissions) |
| `scripts/copy-icons.js` | Kopiert Icons aus public/ in Android-Ordner |
| `capacitor.config.ts` | Capacitor-Konfiguration (appId: co.mojobus.app) |
| `mojobus.co.ssl.conf` | Nginx-Config: Bot-Prcrender + Brotli + Caching |

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