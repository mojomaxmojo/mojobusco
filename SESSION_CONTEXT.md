# MojoBus – Session Context für nächsten Chat

## Letzter Session (11.06.2026) – Capacitor APK GPS-Fix

### Problem
Auf dem Smartphone (Pixel 6a / GrapheneOS) wurde GPS beim Bild-Upload nicht automatisch aus EXIF gelesen. Der Standard `<input type="file">` im Capacitor WebView strippt EXIF-GPS – exifr.js bekommt leere Daten.

### Gelöst ✅
**Ansatz**: `@capawesome/capacitor-file-picker` → native `content://` URI → rohe Bytes → `exifr.gps(arrayBuffer)`

```typescript
// Kernel: src/lib/capacitorGps.ts – pickFilesNative()
FilePicker.pickFiles() → content:// URI
fetch(URI) oder FilePicker.readFile() → ArrayBuffer
exifr.gps(arrayBuffer) → GPS aus Original-Datei (kein Strip!)
```

- `@capacitor-community/exif` **komplett rausgeworfen** – war eine Blackbox, hat content:// nicht verlässlich geöffnet
- `exifr.js` allein reicht – liest GPS aus rohen Bytes zuverlässig
- Neuer Button **"📱 Galerie öffnen (Android)"** im Medien-Tab
- `isCapacitorNative()` prüft 3 Methoden (Capacitor, __Capacitor, getPlatform)
- Geolocation-Fallback für alle Plattformen (Geräte-Standort wenn EXIF leer)

### Was noch offen ist
- Auf CachyOS: `git pull && npm run apk` bauen und auf Pixel 6a testen
- Wenn's klappt: Deploy auf VPS (`bash deploy-main.sh --force`)
- Falls nicht: `fetch(content://)` könnte in Android WebView blockiert sein → dann nur `FilePicker.readFile()` als Fallback

### APK Build (CachyOS)
```bash
cd ~/Mojobus-APK/mojobusco
git checkout origin/main -- package.json package-lock.json  # bei Konflikten
git pull origin main
npm run apk  # = npm install → build → cap sync → manifest patchen → APK
```

APK liegt dann in: `android/app/build/outputs/apk/debug/app-debug.apk`

### Wichtige Dateien
```
src/lib/capacitorGps.ts           → pickFilesNative(), extractGpsViaRawBytes()
src/pages/publish/MediaUploadForm.tsx → handleNativePick(), Button + Standard-Input
src/pages/publish/PlaceForm.tsx        → gleicher Capacitor-Fallback
scripts/patch-android-manifest.js      → ACCESS_MEDIA_LOCATION einfügen
capacitor.config.ts                    → webDir: dist, appId: co.mojobus.app
```

### APK Build-Dependencies (in devDependencies)
- `@capacitor/cli` + `@capacitor/android`
- `@capawesome/capacitor-file-picker`
- `@capacitor/geolocation`
- `@capacitor-community/exif` (installiert, aber nicht mehr im Code verwendet)

### Android Permissions (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.ACCESS_MEDIA_LOCATION" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

### Backup-Branches (alle auf GitHub)
- `backup-1` bis `backup-11` – jeder Optimierungsschritt einzeln gesichert
- `backup-11` = letzter Stand VOR dem GPS-Neuansatz (commit f736198)

### Server
- **Repository:** https://github.com/mojomaxmojo/mojobusco
- **Domain:** https://mojobus.co
- **Server:** AlmaLinux 9.7 (CentminMod), Nginx, Node.js
- **Deploy:** `cd /root/deploy-git/mojobusco && bash deploy-main.sh --force`
- **Dev:** Shakespeare (browser-based IDE)

### Autoren
- **Mojo:** `4d584dab7c880a9809e7df0476d745bfe9a3fe91a1c062bc1fec024e0b5e1f1f`
- **Susanne:** `94ebd1c0940881de438b7f3c532b73e0d4d6c6b0160d3fe0b8a55fe49d477bd4`
- **Relay:** `wss://relay.mojobus.co`