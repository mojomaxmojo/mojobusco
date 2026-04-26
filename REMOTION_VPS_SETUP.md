# Remotion VPS Setup — CentminMod AlmaLinux 9.7

## Überblick

Remotion ersetzt FFmpeg für die Video-Generierung in MojoBus.
- **VPS**: CentminMod, AlmaLinux 9.7, 8GB RAM
- **FFmpeg**: Bleibt auf `/opt/bin/ffmpeg` — Remotion nutzt es intern
- **Port**: 3002 (gleicher server.js, neue Routen dazugekommen)
- **Neuer API-Endpunkt**: `POST /api/render-remotion`

---

## Schritt 1: Node.js Version prüfen (min. 18)

```bash
node --version
# Muss >= 18.0.0 sein

# Falls älter: Update über CentminMod
centmin.sh menu → Option 9 (Node.js Update)
# oder direkt:
nvm install 20
nvm use 20
```

---

## Schritt 2: Remotion Packages installieren

```bash
# In den server/ Ordner wechseln
cd /var/www/mojobus.co/server

# Remotion Kern-Packages (Pflicht)
npm install @remotion/renderer @remotion/bundler remotion react react-dom @types/react @types/react-dom

# NEU: Google Fonts — Montserrat Brand-Schrift (offline, kein CDN-Aufruf beim Render)
npm install @remotion/google-fonts

# NEU: Motion Blur — Film-Feeling beim Ken Burns Zoom
npm install @remotion/motion-blur

# NEU: Captions — Wort-für-Wort Untertitel (85% schauen ohne Ton!)
npm install @remotion/captions
```

### Alle auf einmal (empfohlen):
```bash
npm install @remotion/renderer @remotion/bundler remotion react react-dom \
  @types/react @types/react-dom \
  @remotion/google-fonts @remotion/motion-blur @remotion/captions
```

### NEU: Skill-Packages (v2.0) — alle 4 Skills:
```bash
# Beat-Sync (useAudioData)
npm install @remotion/media-utils

# Transitions (wipe, clockWipe, fade)
npm install @remotion/transitions

# Shapes (RouteMapLine)
npm install @remotion/shapes

# Lottie Bus-Icon
npm install @remotion/lottie lottie-web

# Alle 4 auf einmal:
npm install @remotion/media-utils @remotion/transitions @remotion/shapes \
  @remotion/lottie lottie-web
```

### Alle Packages gesamt (vollständig):
```bash
npm install @remotion/renderer @remotion/bundler remotion react react-dom \
  @types/react @types/react-dom \
  @remotion/google-fonts @remotion/motion-blur @remotion/captions \
  @remotion/media-utils @remotion/transitions @remotion/shapes \
  @remotion/lottie lottie-web
```

### Erwartete Installation (~4-5 Minuten):
```
added 980 packages in 4m
```

---

## Schritt 3: TypeScript Support für server/ (einmalig)

Remotion-Compositions sind in TypeScript geschrieben.
Der Bundler kompiliert sie automatisch — **kein separater TS-Compiler nötig**.

```bash
# Prüfen ob tsconfig im server/ vorhanden:
ls /var/www/mojobus.co/server/tsconfig.json

# Falls nicht vorhanden, erstellen:
cat > /var/www/mojobus.co/server/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": false,
    "allowJs": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {}
  },
  "include": ["remotion/**/*", "*.ts", "*.tsx"],
  "exclude": ["node_modules"]
}
EOF
```

---

## Schritt 4: React als Dependency hinzufügen

```bash
cd /var/www/mojobus.co/server
npm install react react-dom @types/react @types/react-dom
```

---

## Schritt 5: Google Fonts für Remotion (Montserrat)

Remotion kann Webfonts verwenden. Sicherstellen dass der VPS Internet-Zugang hat:

```bash
# Test Internet-Zugang
curl -I https://fonts.googleapis.com
# Erwartet: HTTP/2 200
```

Falls kein Internet-Zugang möglich → Fonts lokal hosten:
```bash
# Font-Ordner anlegen
mkdir -p /var/www/mojobus.co/server/remotion/fonts

# Montserrat herunterladen
curl -o /var/www/mojobus.co/server/remotion/fonts/Montserrat-Bold.woff2 \
  "https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-Y3tcoqK5.woff2"
```

---

## Schritt 6: Umgebungsvariablen prüfen

```bash
cat /var/www/mojobus.co/.env
# oder
cat /etc/systemd/system/mojobus-server.service
```

Folgende Variablen müssen gesetzt sein:
```bash
FFMPEG_PATH=/opt/bin/ffmpeg
FFPROBE_PATH=/opt/bin/ffprobe
PORT=3002
```

---

## Schritt 7: server.js neu starten

```bash
# Mit PM2 (Standard bei CentminMod):
pm2 restart mojobus-server
pm2 logs mojobus-server --lines 50

# Oder mit systemd:
systemctl restart mojobus-server
journalctl -u mojobus-server -f

# Oder manuell:
cd /var/www/mojobus.co
node server/server.js
```

---

## Schritt 8: Installation testen

```bash
# API-Check (gibt JSON zurück)
curl http://localhost:3002/api/render-remotion/check

# Erwartete Antwort:
{
  "remotion": "installed",
  "ffmpeg": "6.x.x",
  "ffmpegPath": "/opt/bin/ffmpeg",
  "musicFiles": 3,
  "activeJobs": 0
}
```

---

## Schritt 9: Test-Render (optional)

```bash
curl -X POST http://localhost:3002/api/render-remotion \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrls": [
      "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1280",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1280",
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1280"
    ],
    "title": "Test Video",
    "lifestyle": "mojobus",
    "aspectRatio": "16:9",
    "secondsPerImage": 4
  }'

# Gibt zurück: { "jobId": "abc123..." }

# Status prüfen:
curl http://localhost:3002/api/render-remotion/status/abc123
```

---

## Speicher & Performance

| Resource | Verbrauch |
|---|---|
| RAM (Bundle) | ~300MB beim ersten Render |
| RAM (Render) | ~500MB-1GB pro Job |
| CPU | 75% der Kerne (automatisch) |
| Erster Render | 30-90s (Bundle-Warmup) |
| Folgerender | 5-20s (Bundle gecacht) |

### Mit 8GB RAM empfohlen:
```bash
# Node.js Heap vergrößern falls nötig
NODE_OPTIONS="--max-old-space-size=4096" node server/server.js
```

---

## Nginx Konfiguration (unverändert)

Die bestehende Nginx-Config muss **nicht** geändert werden.
Alle neuen Routes (`/api/render-remotion/*`, `/api/music/*`)
sind unter dem gleichen Port 3002 erreichbar.

```nginx
# Bereits in mojobus.co.ssl.conf vorhanden:
location /api/ {
    proxy_pass http://localhost:3002;
    proxy_read_timeout 300;  # ← Wichtig: mind. 300s für lange Renders!
    proxy_connect_timeout 60;
}
```

### Timeout erhöhen falls nötig:
```bash
# In /etc/nginx/conf.d/mojobus.co.ssl.conf
location /api/ {
    proxy_pass http://localhost:3002;
    proxy_read_timeout 600;       # 10 Minuten
    proxy_send_timeout 600;
    proxy_connect_timeout 60;
    client_max_body_size 50m;
}

nginx -t && nginx -s reload
```

---

## Troubleshooting

### Problem: "Remotion nicht installiert"
```bash
cd /var/www/mojobus.co/server
npm install @remotion/renderer @remotion/bundler remotion react react-dom
pm2 restart mojobus-server
```

### Problem: "Cannot find module 'react'"
```bash
cd /var/www/mojobus.co/server
npm install react react-dom
```

### Problem: Render bricht ab (OOM)
```bash
# Mehr RAM für Node.js:
# In PM2 ecosystem.config.js:
node_args: '--max-old-space-size=4096'
pm2 restart mojobus-server
```

### Problem: Erster Render dauert sehr lang (>2min)
Normal! Beim ersten Render bündelt Remotion alle TypeScript-Komponenten.
Ab dem zweiten Render ist der Bundle gecacht → viel schneller.

### Problem: FFmpeg nicht gefunden
```bash
ls -la /opt/bin/ffmpeg
which ffmpeg
# Falls anders:
export FFMPEG_PATH=/usr/bin/ffmpeg
```

### Logs prüfen:
```bash
pm2 logs mojobus-server --lines 100 | grep -i remotion
```

---

## Remotion Skills — Was ist eingebaut (v2.0)

| Komponente | Beschreibung |
|---|---|
| `KenBurnsImage` | Zoom/Pan auf Fotos (6 Richtungen, deterministisch) |
| `ColorGradeOverlay` | 6 Cinematic Looks (golden, warm, moody, blue, teal-orange, vintage) |
| `HookTitle` | Animierter Stop-the-Scroll Titel (erste 4s) |
| `LocationBadge` | Orts-Badge mit Länder-Flag (Slide-in von links) |
| `MojoBusCTA` | Lifestyle-spezifische Endkarte (letzte 6s) |
| `ProgressBar` | Retention-Balken oben im Video |
| `AudioLayer` | Musik mit Fade-In/Out (lokale Tracks) |
| `FilmGrain` | Frame-by-frame Film-Grain via SVG-Filter |
| `StoryCaption` | Story-Texte / Captions pro Bild |
| `CrossFade / ZoomBlur / FadeIn` | Professionelle Übergänge zwischen Fotos |
| ✅ `BeatSyncLayer` | **NEU:** Beat-Flash synchron zur Musik (viral!) — `useAudioData` + Fallback |
| ✅ `TransitionWrapper` | **NEU:** wipe, clockWipe, fade, slide — `@remotion/transitions` + CSS-Fallback |
| ✅ `RouteMapLine` | **NEU:** Animierte Routen-Linie auf Karte — `@remotion/shapes` + SVG |
| ✅ `LottieBusIcon` | **NEU:** Animierter CSS/Lottie Bus in Endkarte — `@remotion/lottie` + CSS |
| ✅ `AudioWaveformBar` | **NEU:** Bonus — Equalizer-Balken-Visualizer |
| ✅ `WipeEdgeGlow` | **NEU:** Bonus — Glühende Wipe-Kante |
| ✅ `BusRideOverlay` | **NEU:** Bonus — Bus fährt durchs Bild |

### Neue API-Parameter (v2.0):

| Parameter | Typ | Default | Beschreibung |
|---|---|---|---|
| `beatSyncStrength` | `0–1` | `0.6` | Beat-Flash Stärke (0 = aus) |
| `beatThreshold` | `0–1` | `0.60` | Mindest-Energie für Beat-Erkennung |
| `showWaveformBar` | `boolean` | `false` | Equalizer-Balken unten anzeigen |
| `transitionType` | `wipe\|clockWipe\|fade\|slide\|auto` | `auto` | Transitions-Typ zwischen Bildern |
| `showRouteMap` | `boolean` | `false` | Routen-Karte in mittlerem Slide |
| `routeCoords` | `RouteCoord[]` | auto | Punkte der Route (Prozent-Koordinaten) |
| `mapImageUrl` | `string` | — | Karten-Hintergrundbild URL |
| `showLottieBus` | `boolean` | `true` | Animierten Bus in Endkarte zeigen |

### Lottie Bus-Icon einrichten (optional):
```bash
# 1. Package installieren
npm install @remotion/lottie lottie-web

# 2. Bus-Animation herunterladen (von LottieFiles.com)
#    Suche: "bus" oder "oldtimer bus"
#    https://lottiefiles.com/search?q=bus&contentType=free

# 3. JSON-Datei speichern als:
mkdir -p /var/www/mojobus.co/server/remotion/lottie
cp ~/Downloads/bus-animation.json /var/www/mojobus.co/server/remotion/lottie/bus.json
```
Ohne bus.json: automatischer Fallback auf CSS-animierten Bus (sieht ebenfalls gut aus).

---

## Video-Formate und Qualität

| Format | Auflösung | FPS | Zielplattform |
|---|---|---|---|
| 16:9 | 1920×1080 | 30 | YouTube, Website |
| 9:16 | 1080×1920 | 30 | Instagram Reels, TikTok |
| 1:1 | 1080×1080 | 30 | Instagram Feed |

### Codec-Einstellungen (in `render.js`):
- **Codec**: H.264 (breite Kompatibilität)
- **CRF**: 18 (hochwertig, ~4-8 MB für 30s)
- **Concurrency**: 75% der CPU-Kerne

---

## Remotion Skills — Implementierungsstand

### ✅ Abgeschlossen (v1.0)
1. **`@remotion/google-fonts`** — Montserrat als Brand-Schrift ✓
2. **`@remotion/captions`** — Auto-Untertitel (85% schauen ohne Ton!) ✓
3. **`@remotion/motion-blur`** — Film-Feeling beim Ken Burns Zoom ✓

### ✅ NEU: Abgeschlossen (v2.0)
4. **`useAudioData` + Beat-Sync** (`BeatSyncLayer`) — Flash synchron zur Musik ✓
5. **`@remotion/transitions`** (`TransitionWrapper`) — wipe, clockWipe, fade, slide ✓
6. **`@remotion/shapes`** (`RouteMapLine`) — Routen-Linie animieren auf Karte ✓
7. **`@remotion/lottie`** (`LottieBusIcon`) — Animierter CSS/Lottie Bus ✓

### 🟢 Zukünftig (nach Launch)
8. **Remotion Lambda** (falls VPS überlastet) → Cloud-Rendering
9. **Whisper API** + `@remotion/captions` — Echte Wort-für-Wort Transkription
10. **Beat-Sync** mit Suno/ElevenLabs generierten Tracks

---

Erstellt: $(date +%Y-%m-%d)
