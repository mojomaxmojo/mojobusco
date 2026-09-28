# Remotion VPS Setup — CentminMod AlmaLinux 9.7

## Überblick

Remotion ersetzt FFmpeg für die Video-Generierung in MojoBus.
- **VPS**: CentminMod, AlmaLinux 9.7, 8GB RAM
- **Server-Pfad**: `/home/nginx/domains/mojobus.co/public/server`
- **Service-Name**: `ai-api` (systemd) — nicht `mojobus-server`!
- **FFmpeg**: Bleibt auf `/opt/bin/ffmpeg` — Remotion nutzt es intern
- **Port**: 3002 (gleicher server.js, neue Routen dazugekommen)
- **Neuer API-Endpunkt**: `POST /api/render-remotion`
- **Deploy**: `bash deploy-main.sh --force` (aus `/root/deploy-git/mojobusco/`)

---

## systemd-Unit: ai-api

Der Service heißt **`ai-api`**, NICHT `mojobus-server`:

```ini
# /etc/systemd/system/mojobus-server.service
[Unit]
Description=MojoBus API Server (Node.js)
After=network.target
Requires=network.target

[Service]
Nice=10
CPUQuota=300%
Type=simple
User=root
Group=root
WorkingDirectory=/home/nginx/domains/mojobus.co/public/server
ExecStart=/bin/bash -c "XAI_API_KEY=... GROQ_API_KEY=... ANTHROPIC_API_KEY=... OPENROUTER_API_KEY=... /usr/bin/node --max-old-space-size=4096 /home/nginx/domains/mojobus.co/public/server/server.js"
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ai-api
LimitNOFILE=65536
MemoryLimit=6144M

[Install]
WantedBy=multi-user.target
```

Wichtige Parameter für Remotion:
- `--max-old-space-size=4096` → 4GB Heap für Bundle + Render
- `CPUQuota=300%` → max 3 Kerne (deckt sich mit `concurrency: 3` in render.js)
- `MemoryLimit=6144M` → ~6GB RAM

---

## Server-Pfad (einmalig festlegen)

Der tatsächliche Server-Pfad ist **`/home/nginx/domains/mojobus.co/public/server`**.
Alle folgenden Befehle beziehen sich auf diesen Pfad.

```bash
cd /home/nginx/domains/mojobus.co/public/server
```

---

## Deploy-Methode (empfohlen)

Der einfachste Weg: deploy-main.sh im Git-Verzeichnis ausführen:

```bash
cd /root/deploy-git/mojobusco
bash deploy-main.sh --force
```

Das Skript:
1. Zieht den neuesten Code von `origin/main`
2. Installiert Frontend-Dependencies (mit `--legacy-peer-deps`)
3. Baut das Vite-Frontend
4. Kopiert alles in den Ziel-Pfad (inkl. server/)
5. Installiert Server-Dependencies (npm install im server/)
6. Prüft Remotion-Packages und installiert fehlende nach
7. Startet den `ai-api` Service neu
8. Leert den Remotion Bundle-Cache

**Wichtig bei Deployment-Fehlern durch React 19 Peer-Dep Konflikte:**
Eine `.npmrc` im Root des Repos setzt `legacy-peer-deps=true` → Frontend-Build läuft sauber.

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

Alle Remotion-Packages sind in `server/package.json` eingetragen.
Einfach `npm install` im server/-Verzeichnis:

```bash
cd /home/nginx/domains/mojobus.co/public/server
npm install
```

### Vollständige Package-Liste (in package.json):

```json
{
  "dependencies": {
    "@remotion/renderer": "^4.0.476",
    "@remotion/bundler": "^4.0.476",
    "@remotion/google-fonts": "^4.0.476",
    "@remotion/motion-blur": "^4.0.476",
    "@remotion/captions": "^4.0.476",
    "@remotion/media-utils": "^4.0.476",
    "@remotion/transitions": "^4.0.476",
    "@remotion/shapes": "^4.0.476",
    "@remotion/lottie": "^4.0.476",
    "@remotion/noise": "^4.0.476",
    "remotion": "^4.0.476",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "lottie-web": "^5.13.0",
    // Transitiv benötigt für @remotion/bundler (rspack):
    "css-loader": "^7.1.4",
    "@rspack/core": "^2.0.8"
  }
}
```

⚠️ **Wichtig**: `css-loader` und `@rspack/core` werden vom `@remotion/bundler` (via rspack) benötigt. Fehlen diese, erscheint:
```
Error: Cannot find module '../css-loader/index.js'
```

### Erwartete Installation (~2-3 Minuten):
```
added 980 packages in 2m
```

---

## Schritt 3: TypeScript Support für server/ (einmalig)

```bash
# Prüfen ob tsconfig im server/ vorhanden:
ls /home/nginx/domains/mojobus.co/public/server/tsconfig.json

# Falls nicht vorhanden, erstellen:
cat > /home/nginx/domains/mojobus.co/public/server/tsconfig.json << 'EOF'
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

## Schritt 4: Server neu starten

```bash
# systemd (Standard):
systemctl restart ai-api
journalctl -u ai-api -f --no-hostname -o cat

# Oder manuell:
cd /home/nginx/domains/mojobus.co/public/server
node server.js

# Nach einem Deploy (deploy-main.sh) startet der Server automatisch neu.
```

---

## Schritt 5: Installation testen

```bash
curl http://localhost:3002/api/render-remotion/check

# Erwartete Antwort:
{
  "remotion": "installed",
  "ffmpeg": "git-2026-04-26-1351c2c",
  "ffmpegPath": "/opt/bin/ffmpeg",
  "musicFiles": 22,
  "activeJobs": 0
}
```

---

## Schritt 6: Test-Render

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

# Nach 30-60s Status prüfen:
curl http://localhost:3002/api/render-remotion/status/abc123
# Erwartet: { "status": "completed", "progress": 100, ... }

# Video herunterladen:
curl -o test-video.mp4 http://localhost:3002/api/render-remotion/download/abc123
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
| Video (20s, 16:9) | ~2-3 MB bei crf 28 |

---

## Troubleshooting

### Problem: "Cannot find module '../css-loader/index.js'"
```bash
cd /home/nginx/domains/mojobus.co/public/server
npm install css-loader @rspack/core --save
```

### Problem: "npm install" im Root schlägt fehl (React 19 Peer-Dep Konflikt)
```bash
cd /root/deploy-git/mojobusco
npm install --legacy-peer-deps
# Oder direkt: bash deploy-main.sh --force (hat --legacy-peer-deps eingebaut)
```

### Problem: Remotion Render bleibt "queued" oder "failed"
```bash
# Logs prüfen:
journalctl -u ai-api --no-hostname -o cat --since "10 min ago" | grep -i remotion

# Bundle-Cache leeren (nach Code-Änderungen):
curl -X POST http://localhost:3002/api/render-remotion/invalidate-cache

# Server neustarten:
systemctl restart ai-api
```

### Problem: Render bricht ab (OOM)
```bash
# systemd hat bereits --max-old-space-size=4096 gesetzt.
# Wenn es bei 8GB RAM reicht: MemoryLimit in der Unit erhöhen.
systemctl edit ai-api
# → MemoryLimit=7168M
systemctl daemon-reload && systemctl restart ai-api
```

### Problem: "Remotion nicht installiert"
```bash
cd /home/nginx/domains/mojobus.co/public/server
npm install
systemctl restart ai-api
```

### Problem: Erster Render dauert sehr lang (>2min)
Normal! Beim ersten Render bündelt Remotion alle TypeScript-Komponenten (esbuild/rspack).
Ab dem zweiten Render ist der Bundle gecacht → viel schneller (5-20s).

### Problem: FFmpeg nicht gefunden
```bash
ls -la /opt/bin/ffmpeg
which ffmpeg
# Falls anders:
export FFMPEG_PATH=/usr/bin/ffmpeg  # dann in systemd-Unit eintragen
```

### Problem: EPIPE / esbuild-Absturz beim Bundling
```bash
# In render.js eingebaute Retry-Logik (3 Versuche).
# Falls nötig: Chrome Binary Rechte setzen
chmod -R 755 /home/nginx/domains/mojobus.co/public/server/node_modules/.remotion
chmod -R 755 /home/nginx/domains/mojobus.co/public/server/node_modules/@esbuild
```

---

## Nginx Konfiguration (unverändert)

```nginx
# In /etc/nginx/conf.d/mojobus.co.ssl.conf:
location /api/ {
    proxy_pass http://localhost:3002;
    proxy_read_timeout 600;       # 10 Minuten für lange Renders
    proxy_send_timeout 600;
    proxy_connect_timeout 60;
    client_max_body_size 50m;
}
```

```bash
nginx -t && nginx -s reload
```

---

## Wichtige Pfade (Cheat Sheet)

| Pfad | Zweck |
|---|---|
| `/home/nginx/domains/mojobus.co/public/server/` | Server-Installation (node_modules, remotion/) |
| `/home/nginx/domains/mojobus.co/public/server/server.js` | Express-Server (Port 3002) |
| `/home/nginx/domains/mojobus.co/public/server/remotion/` | Remotion-Components (TSX) |
| `/home/nginx/domains/mojobus.co/public/server/music/` | Musik-Tracks für Videos |
| `/root/deploy-git/mojobusco/` | Git-Repository (deploy-main.sh) |
| `/etc/systemd/system/mojobus-server.service` | systemd-Unit (Service: ai-api) |

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
| `StoryCaption` | Story-Texte / Captions pro Bild |
| `CrossFade / FadeIn / FadeOut` | Professionelle Übergänge zwischen Fotos |
| `BeatSyncLayer` | Beat-Flash synchron zur Musik |
| `TransitionWrapper` | wipe, clockWipe, fade, slide, morph, zoomRelay, glitch, pagePeel |
| `RouteMapLine` | Animierte Routen-Linie auf Karte |
| `LottieBusIcon` | Animierter CSS-Bus in Endkarte |
| `AudioWaveformBar` | Equalizer-Balken-Visualizer |
| `WipeEdgeGlow` | Glühende Wipe-Kante |
| `BusRideOverlay` | Bus fährt durchs Bild |

---

## Video-Formate und Qualität

| Format | Auflösung | FPS | Zielplattform |
|---|---|---|---|
| 16:9 | 1280×720 | 25 | YouTube, Website |
| 9:16 | 1080×1920 | 25 | Instagram Reels, TikTok |
| 1:1 | 1080×1080 | 25 | Instagram Feed |

### Codec-Einstellungen (in `render.js`):
- **Codec**: H.264 (breite Kompatibilität)
- **CRF**: 28 (gute Qualität, ~6x kleiner als crf 20)
- **Concurrency**: 3 parallele Tabs (4-Core VPS)
- **Pixel Format**: yuv420p
- **x264 Preset**: medium

---

Erstellt: 2026-06-13