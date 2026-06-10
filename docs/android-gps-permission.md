# Android GPS Permission – Für Capacitor APK notwendig

## 1. Manifest ergänzen

Edit `android/app/src/main/AndroidManifest.xml` – die Permission **vor** dem `<application>` Tag einfügen:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<!-- ⬇️ GPS aus EXIF-Daten (Android Photo Picker workaround) -->
<uses-permission android:name="android.permission.ACCESS_MEDIA_LOCATION" />
<!-- ⬇️ Dateizugriff für FilePicker (Android ≤12) -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<!-- ⬇️ Dateizugriff für FilePicker (Android 13+) -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

## 2. APK neu bauen

```bash
cd /home/max/Mojobus-APK/mojobusco
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

## 3. Warum das wichtig ist

Seit Android 11 (API 30) redacted der Android Photo Picker GPS-Daten aus EXIF.
Die `ACCESS_MEDIA_LOCATION` Permission erlaubt der App, die unredacted Datei zu lesen.
Ohne diese Permission liefert `@capacitor-community/exif.getCoordinates()` immer `undefined`.