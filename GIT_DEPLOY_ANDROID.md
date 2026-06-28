# Git Pull & Android APK Deploy

## 1. Git auf aktuellen Stand bringen (Option 2 – alle lokalen Änderungen verwerfen)

```bash
cd ~/Mojobus-APK/mojobusco
git fetch origin
git reset --hard origin/main
```

> **Hinweis:** Dies verwirft **alle** lokalen Änderungen und setzt das Repository auf den exakten Stand von `origin/main`.

## 2. Android .apk bauen

```bash
cd ~/Mojobus-APK/mojobusco
git pull origin main
npm run apk
```

Nach erfolgreichem Build findest du die .apk-Datei im Ordner:
- `~/Mojobus-APK/mojobusco/android/app/build/outputs/apk/debug/` (Debug)
- oder `~/Mojobus-APK/mojobusco/android/app/build/outputs/apk/release/` (Release)

## Kurzfassung (alles in einem Durchlauf)

```bash
cd ~/Mojobus-APK/mojobusco
git fetch origin
git reset --hard origin/main
npm run apk
```
