# MojoBus – Nächste Session (Start 25.06.2026)

## Letzter Commit
`bf008e9` – "Fix: execFile + promisify fehlten im Import – ffprobe war immer undefined"
Repo: https://github.com/mojomaxmojo/mojobusco

## Deployment
```bash
cd /root/deploy-git/mojobusco && git pull origin main && bash deploy-main.sh --force
```
VPS: AlmaLinux 9.7, CentminMod, Nginx  
Server: `ai-api` (Systemd, Port 3002)  
Pfad: `/home/nginx/domains/mojobus.co/public/`

## 💥 KRITISCH – Diese Session fixen

### 1. ffprobe imports fixen ✅ (Commit bf008e9)
- `execFile` und `promisify` fehlten in `server/remotion/render.js` imports
- Dadurch waren ALLE Voiceover-Dauern = 0.00s → Sync basierte nur auf Lesezeit
- **Muss deployed werden!** Der Commit ist noch nicht auf dem VPS.

### 2. Nach Deploy testen
- TikTok Video rendern
- `journalctl -u ai-api -f | grep -i "ffprobe\|duration\|Segment"` prüfen
- Sollte zeigen: `Dauer: 2.34s` statt `0.00s` und `ffprobe für Segment` ohne "fehlgeschlagen"

---

## ✅ Letzte Session erledigt (22.-24.06.2026)

### About Backoffice (`/admin/about`)
- Neue Config: `src/config/about.ts` – Typen + Default-Inhalte
- Neuer Hook: `src/hooks/useAboutContent.ts` – kind 30078, d-tag: `co.mojobus.app.about-page`
- Admin-Seite: `src/pages/admin/AboutAdmin.tsx` – Tab-basierte Maske mit Markdown-Editoren
- Menü: Account → "📝 About verwalten"
- Route: `/admin/about` (login-geschützt, nur Mojo/Susanne)
- Fallback: DEFAULT_ABOUT_DATA wenn kein Event existiert

### TikTok Voiceover-Sync
- **Statt einer großen MP3**: Per-Segment Voiceover + ffmpeg concat
- `concatVoiceoverSegments()` in `render.js` – concat alle Segmente zu `voiceover_sync.mp3`
- Jedes Segment bekommt `duration $slideDur` – ffmpeg pad't automatisch mit Stille
- **Achtung**: `execFile` + `promisify` fehlten im Import – Dauer wurde nie ausgelesen

### perSlideArray (dynamische Slide-Längen)
- Berechnung IMMER (auch ohne Voiceover):
  - Lesezeit = max(3.5s, textLen/14 + 0.5s Atempause)
  - +1s Transition
  - Voiceover-Dauer (via ffprobe, wenn verfügbar)
  - min = secondsPerImage (User-Einstellung)
- `calculateDuration()` akzeptiert `perSlideArray` für korrekte Gesamtlänge

### Captions (PerSlideCaption)
- Neue Komponente ersetzt AutoCaptions/WordHighlightCaptions
- Timing basiert auf `slidesFrames` (dynamisch, aus perSlideArray)
- Stile: `chunked` (Default), `tiktok`, `full-line`
- Position: `bottom: 35%` (Safe Zone)
- RouteMap-Slide: Caption ausgeblendet (leerer String im Array)

### RouteMap als EXTRA Slide
- Früher: RouteMap ERSETZTE Slide 2 → Bild + Voiceover verloren
- Jetzt: RouteMap wird dazwischengeschoben
- `slideDefs[]` baut flache Liste: [img0, img1, route, img2, ...]
- `muteVoiceoverSlide` → silence statt Voiceover für Karten-Slide
- Caption: leerer String für Route-Slide → nichts sichtbar

### Weitere Fixes
- Musik "Keine Musik" funktioniert (`noMusic: true` im Payload)
- Musik Volume: 0.54 → 0.49 (−10%)
- Atmo: ffmpeg Filter von aeval auf anoisesrc+bandpass umgestellt
- MP4 wird 24h behalten (vorher 30s)
- Bilder-Download sequentiell (wie Original)

---

## ❌ Bekannte Baustellen

### 1. ffprobe Import-Fehlt (MUSS gefixt werden)
- `render.js` importiert weder `execFile` noch `promisify`
- → `execFileAsync` ist undefined → ffprobe schlägt immer fehl
- → Commit `bf008e9` deployed diesen Fix

### 2. KI generiert mehrere Zeilen pro Bild
- `bodyLines` werden via `while(overflow)` zusammengeführt
- Prompt verstärkt: "Mehrere Sätze in EINE Zeile (durch Punkt getrennt)"
- Funktioniert meist, aber nicht immer perfekt

### 3. `npm ci` schlägt fehl
- deploy-main.sh fällt auf `npm install` zurück (funktioniert trotzdem)

### 4. TransitionWrapper importiert aber ungenutzt
- `MojoBusVideo.tsx` importiert `TransitionWrapper` aus TransitionSlideshow
- Wird im neuen slideDefs-Rendering nicht mehr verwendet
- Könnte entfernt werden

---

## 📋 Nächste Roadmap-Features

### Stufe 1 (Einfach – Frontend)
1. ✅ **Kapitel-Marker** – (umgesetzt: separate HookCaption + CTAText)
2. ✅ **Medien per Drag&Drop** – (umgesetzt: @dnd-kit in Step 2)
3. ⬜ **Einfacher Trim** – Video von Sekunde X bis Y via FFmpeg

### Stufe 2 (Mittel – Backend + Dashboard)
4. ⬜ **Timeline-Editor** – visuelle Zeitleiste
5. ⬜ **Multi-Download als ZIP**
6. ⬜ **Video-Split** – langes Video in X Clips
7. ⬜ **Render-Queue** – nacheinander, kein Parallel

---

## 🔧 Wichtige Configs

| Config | Ort |
|--------|-----|
| Autoren | `src/config/authors.json` (Single Source of Truth) |
| Relays | `src/config/relays.ts` |
| Blossom | `src/config/blossom.ts` |
| Video | `src/config/video.ts` |
| Performance | `src/config/performance.ts` |
| About Defaults | `src/config/about.ts` |

## ⛔ Tabu-Zonen – Niemals ändern
- `src/config/prompts/` – KI-Prompt-Vorlagen
- `server/` – Node.js Backend (Systemd `ai-api`)