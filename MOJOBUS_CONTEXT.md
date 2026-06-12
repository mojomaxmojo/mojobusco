# MojoBus – Session Context

## Projekt-Übersicht
MojoBus ist eine Nostr-basierte Vanlife/Travel-Plattform zum Teilen von Reiseerlebnissen, Campingplätzen, Fotos mit GPS-Daten. Läuft als **PWA + Android APK (Capacitor)**.

## Tech-Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
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
| `src/config/routes.ts` | Routen-Definitionen |
| `src/AppRouter.tsx` | Router mit Lazy Loading |
| `scripts/patch-android-manifest.js` | Patcht AndroidManifest.xml (Permissions) |
| `scripts/copy-icons.js` | Kopiert Icons aus public/ in Android-Ordner |
| `scripts/generate-sitemap.js` | Generiert sitemap.xml (Cron: täglich 6:00) |
| `scripts/generate-site-data.js` | Generiert statische JSON-Dumps (Cron: täglich 6:15) |
| `scripts/generate-feed.js` | Generiert RSS 2.0 Feed (Cron: alle 6h) |
| `capacitor.config.ts` | Capacitor-Konfiguration (appId: co.mojobus.app) |

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

## 🌐 Server
- **Domain**: https://mojobus.co
- **Repository**: https://github.com/mojomaxmojo/mojobusco
- **Server**: AlmaLinux 9.7 (CentminMod), Nginx, Node.js
- **Relay**: wss://relay.mojobus.co
- **RSS Feed**: https://mojobus.co/feed.xml (Cron alle 6h)
- **Sitemap**: https://mojobus.co/sitemap.xml (Cron täglich 6:00)

## 👥 Autoren (Nostr)

Die Autoren-Stammdaten werden **nicht hartcodiert**, sondern kommen aus der zentralen Config:

| Quelle | Datei | Beschreibung |
|--------|-------|-------------|
| **Single Source of Truth** | `src/config/authors.json` | Einzige Stelle mit pubkey, npub, nip05 |
| **TypeScript-Import** | `src/config/relays.ts` → `AUTHORS` | Von Komponenten genutzt |
| **Cron-Scripts** | `scripts/*.js` → Import aus `authors.json` | Alle 5 Scripts lesen aus derselben JSON |

**So werden Autoren hinzugefügt/geändert:**
Nur `src/config/authors.json` bearbeiten – alle anderen Dateien (relays.ts, blossom.ts, authorUtils.ts, BudgetPage.tsx, Cron-Scripts) referenzieren diese Datei automatisch via Import.

```bash
# Aktuelle Autoren (aus src/config/authors.json):
cat src/config/authors.json | jq '.authors[] | {name, pubkey, nip05}'
```

## 🔧 Wichtige Branches (GitHub)
- **main** – Aktive Entwicklung
- **backup-gps** – GPS-Fix funktionierender Stand (Commit 97b8dc4)
- **caption-improvements-v2** – Bildunterschriften