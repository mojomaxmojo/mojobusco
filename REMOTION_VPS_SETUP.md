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

### Erwartete Installation (~3-4 Minuten):
```
added 950 packages in 3m
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

## Remotion Skills — Was ist eingebaut

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

### Geplante Erweiterungen (TODO):

| Skill | Package | Nutzen |
|---|---|---|
| Beat-Cuts | `useAudioData` | Schnitte synchron zur Musik |
| Untertitel | `@remotion/captions` | 85% schauen ohne Ton |
| Custom Wellen | `@remotion/shapes` | Dekorative Routen-Animation |
| Lottie-Icons | `@remotion/lottie` | Fertige Animationen (Wellen, Karte) |
| Motion Blur | `@remotion/motion-blur` | Film-Feeling beim Ken Burns Zoom |
| Google Fonts | `@remotion/google-fonts` | Brand-Schrift Montserrat offline |

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

## Empfohlene Remotion Skills für MojoBus

Sortiert nach Priorität für eure Inhalte:

### 🔴 Hoch (sofort umsetzen)
1. **`@remotion/google-fonts`** — Montserrat als Brand-Schrift, offline auf VPS
2. **`@remotion/captions`** — Auto-Untertitel (85% schauen ohne Ton!)
3. **`@remotion/motion-blur`** — Film-Feeling beim Ken Burns Zoom

### 🟡 Mittel (nächste Iteration)
4. **`useAudioData` + Beat-Sync** — Schnitte synchron zur Musik → viral
5. **`@remotion/transitions`** — `wipe`, `slide`, `clockWipe` (professionell)
6. **`@remotion/shapes`** — Routen-Linie animieren (Karte → Route → Ziel)
7. **Lottie** — Fertige Animations-Icons (Kompass, Bus-Icon, Wellen)

### 🟢 Later (nach Launch)
8. **Remotion Lambda** (falls VPS überlastet) → Cloud-Rendering
9. **Beat-Sync** mit Suno/ElevenLabs Musik
10. **AR-Overlays** via Remotion Compositions

---

Erstellt: $(date +%Y-%m-%d)
