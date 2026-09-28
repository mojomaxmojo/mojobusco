# Remotion VPS Setup — CentminMod AlmaLinux 9.8

> **Aktualisiert:** 2026-09-28 (frühere Version enthielt veraltete Pfade /
> Unit-Namen — siehe Änderungshistorie unten)
> **Aktive Detail-Referenz für Render-Technik:** `docs/CONTEXT_REMOTION.md`
> Regeln & Tabus → `AGENTS.md`

## Überblick

Remotion ersetzt FFmpeg für die Video-Generierung in MojoBus.

- **VPS**: CentminMod, **AlmaLinux 9.8**, 8 GB RAM, 4 vCPU (KVM)
- **Server-Pfad**: `/home/nginx/domains/mojobus.co/public/server`
- **Service-Name**: `ai-api` (systemd) — nicht `mojobus-server`!
- **FFmpeg/ffprobe**: `/usr/local/bin/ffmpeg` + `/usr/local/bin/ffprobe`
  (CentminMod-Symlinks — **NIE** `/opt/bin/` hartcodieren, AGENTS-Regel 4)
- **Port**: 3002 (server.js; Render-Routen + Download/Thumbnail-Endpunkte)
- **Haupt-Endpunkt**: `POST /api/render-remotion` (NIP-98-Auth, siehe CONTEXT_DEPLOY)
- **Deploy**: `bash deploy-main.sh --force` (aus `/root/deploy-git/mojobusco/`)

---

## systemd-Unit: ai-api

Der Service heißt **`ai-api`** (Unit: `/etc/systemd/system/ai-api.service`).
Alle Secrets/Env-Variablen liegen seit der Unit-Umstellung in **einer** Datei:
`/etc/systemd/system/ai-api.env` (`EnvironmentFile=`; `chown root:root`,
`chmod 600`, NIEMALS im Webroot). Keine Secrets mehr im `ExecStart`.

Wichtige Parameter (in der Unit bzw. ai-api.env):

- `ExecStart=/usr/bin/node --max-old-space-size=4096 …/server/server.js` → 4 GB Heap
- `CPUQuota=300%` → max 3 Kerne (deckt sich mit `concurrency: 3` im Render-Core)
- `MemoryLimit=6144M` → ~6 GB RAM
- `FFMPEG_PATH`/`FFPROBE_PATH` in ai-api.env: `/usr/local/bin/…` (oder ungesetzt →
  Auto-Erkennung über `findBinary()` in `server/remotion/binaries.js`)

---

## Server-Pfad

```bash
cd /home/nginx/domains/mojobus.co/public/server
```

---

## Deploy-Methode (Standard)

```bash
cd /root/deploy-git/mojobusco
bash deploy-main.sh --force
systemctl restart ai-api   # bei server/-Änderungen Pflicht
```

Das Skript:
1. Zieht den neuesten Code von `origin/main`
2. Installiert Frontend-Dependencies (`.npmrc`: `legacy-peer-deps`)
3. Baut das Vite-Frontend
4. Kopiert alles in den Ziel-Pfad (inkl. `server/`)
5. Installiert Server-Dependencies (npm install im `server/`)
6. Prüft Remotion-Packages und installiert fehlende nach
7. Leert den Remotion-Bundle-Cache
8. (Neustart von ai-api erfolgt manuell/je nach Deploy-Setup — prüfen!)

**Wichtig bei Deployment-Fehlern durch React 19 Peer-Dep-Konflikte:**
Eine `.npmrc` im Root des Repos setzt `legacy-peer-deps=true` → Build läuft sauber.

---

## Schritt 1: Node.js Version prüfen (min. 18)

```bash
node --version
# Muss >= 18.0.0 sein

# Falls älter: Update über CentminMod
centmin.sh menu → Option 9 (Node.js Update)
```

---

## Schritt 2: Remotion Packages installieren

Alle Remotion-Packages sind in `server/package.json` eingetragen (aktuell
**Remotion 4.0.503**). Einfach `npm install` im `server/`-Verzeichnis:

```bash
cd /home/nginx/domains/mojobus.co/public/server
npm install
```

Kern-Dependencies (Auszug): `remotion`, `@remotion/bundler`, `@remotion/renderer`,
`@remotion/lottie`, `@remotion/captions`, `@remotion/media-utils`,
`@remotion/google-fonts`, `node-edge-tts` (Voiceover), `better-sqlite3`,
`nostr-tools`, sowie **`css-loader` + `@rspack/core`** (vom `@remotion/bundler`
via rspack benötigt).

⚠️ **Wichtig**: Fehlen `css-loader`/`@rspack/core`, erscheint:
```
Error: Cannot find module '../css-loader/index.js'
```

---

## Schritt 3: Server neu starten

```bash
systemctl restart ai-api
journalctl -u ai-api -f --no-hostname -o cat

# Nach einem Deploy (deploy-main.sh) ggf. zusätzlich neustarten.
```

---

## Schritt 4: Installation testen

```bash
curl http://localhost:3002/api/render-remotion/check

# Erwartete Antwort (Beispiel):
{
  "remotion": "installed",
  "ffmpeg": "…",
  "ffmpegPath": "/usr/local/bin/ffmpeg",
  "musicFiles": …,
  "activeJobs": 0
}
```

---

## Schritt 5: Test-Render

```bash
# NIP-98-Auth: Der Endpunkt verlangt bei AI_AUTH_REQUIRED=1 einen
# Autoren-Header — am einfachsten über die App (/promotion/tiktok) testen.
curl -X POST http://localhost:3002/api/render-remotion \
  -H "Content-Type: application/json" \
  -d '{ "imageUrls": ["https://…"], "title": "Test Video", … }'

# Gibt zurück: { "jobId": "abc123..." }

curl http://localhost:3002/api/render-remotion/status/abc123
# Erwartet: { "status": "completed", "progress": 100, ... }

curl -o test-video.mp4 http://localhost:3002/api/render-remotion/download/abc123
```

---

## Architektur (aktueller Stand — nicht mehr render.js-Monolith)

Die Render-Logik wurde in ein Modul zerlegt (Kontext: `CONTEXT_REMOTION.md`):

| Pfad | Zweck |
|---|---|
| `server/remotion/render/core.js` | Render-Kern (Concurrency, CRF, Codec-Einstellungen) |
| `server/remotion/render/thumbnail.js` | 1920×1080 Thumbnail-Render |
| `server/remotion/render/utils.js` | Hilfsfunktionen |
| `server/remotion/render/index.js` | Modul-Exports |
| `server/remotion/MojoBusVideo.tsx` | Remotion-Hauptkomponente (< 500 Zeilen), verzweigt auf ShortsLayer/LongformLayer |
| `server/remotion/flows/` | ShortsLayer.tsx (9:16/1:1), LongformLayer.tsx (16:9) |
| `server/remotion/components/` | KenBurnsImage, CinematicEffects, RouteMapLine, AudioLayer, PerSlide-Captions u. v. m. |
| `server/remotion/edge.js` | Edge TTS (Seraphina ⭐ Standard, Fallback Piper) |
| `server/remotion/audioNormalize.js` | Zwei-Pass-loudnorm (−14,5 LUFS / −1 dBTP) |

---

## Speicher & Performance

| Resource | Verbrauch |
|---|---|
| RAM (Bundle) | ~300 MB beim ersten Render |
| RAM (Render) | ~500 MB–1 GB pro Job |
| CPU | max. 3 Kerne (CPUQuota=300%) |
| Erster Render | 30–90 s (Bundle-Warmup) |
| Folgerender | 5–20 s (Bundle gecacht) |

> ⚠️ **GLIBC-Hinweis:** Ab Remotion v4.0 braucht der Compositor glibc 2.35;
> AlmaLinux 9.8 liefert teils ältere Versionen → Remotion fällt auf den
> langsamen Software-Fallback zurück (~4 FPS). Details + Workaround-Einstellungen
> (concurrency 3, jpeg, crf 28, offthreadVideoCache): `docs/CONTEXT_REMOTION.md`
> → „Server-Hardware / Performance / GLIBC 2.35".

---

## Video-Formate und Codec

| Format | Auflösung | Zielplattform |
|---|---|---|
| 16:9 | 1920×1080 | YouTube, Website |
| 9:16 | 1080×1920 | Instagram Reels, TikTok |
| 1:1 | 1080×1080 | Instagram Feed |

**Codec-Regel (AGENTS-Regel 14, IMMER):**
- **libx264 (H.264) + aac + `-movflags +faststart`**
- **NIEMALS HEVC/H.265/VP9** — Chromium headless (Remotion) und Teile der
  Browser können es nicht decodieren. Eingehende HEVC/VP9-Dateien werden
  vor dem Render nach H.264 transcodiert (`ensureFaststart` in
  `server/remotion/mediaDownload.js`).
- CRF 28 · x264-Preset medium · Pixel-Format yuv420p

---

## Troubleshooting

### Problem: "Cannot find module '../css-loader/index.js'"
```bash
cd /home/nginx/domains/mojobus.co/public/server
npm install css-loader @rspack/core --save
```

### Problem: "npm install" im Root schlägt fehl (React 19 Peer-Dep-Konflikt)
```bash
cd /root/deploy-git/mojobusco
npm install --legacy-peer-deps
# Oder direkt: bash deploy-main.sh --force
```

### Problem: Render bleibt "queued" oder "failed"
```bash
journalctl -u ai-api --no-hostname -o cat --since "10 min ago" | grep -i remotion

# Bundle-Cache leeren (nach Code-Änderungen):
curl -X POST http://localhost:3002/api/render-remotion/invalidate-bundle
# oder: systemctl restart ai-api (leert In-Memory-Caches mit)
```

### Problem: Render bricht ab (OOM)
```bash
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

### Problem: Erster Render dauert sehr lang (>2 min)
Normal! Beim ersten Render bündelt Remotion alle TypeScript-Komponenten
(esbuild/rspack). Ab dem zweiten Render ist das Bundle gecacht → 5–20 s.

### Problem: FFmpeg nicht gefunden / falscher Pfad
```bash
which ffmpeg      # → /usr/local/bin/ffmpeg (CentminMod)
which ffprobe     # → /usr/local/bin/ffprobe
# Falls abweichend: FFMPEG_PATH in /etc/systemd/system/ai-api.env setzen,
# NIEMALS /opt/bin/ hartcodieren (AGENTS-Regel 4).
systemctl restart ai-api
```

### Problem: EPIPE / esbuild-Absturz beim Bundling
```bash
# In der Render-Engine eingebaute Retry-Logik (3 Versuche).
# Falls nötig: Chrome-Binary-Rechte setzen
chmod -R 755 /home/nginx/domains/mojobus.co/public/server/node_modules/.remotion
chmod -R 755 /home/nginx/domains/mojobus.co/public/server/node_modules/@esbuild
```

---

## Nginx-Konfiguration (nur Ausschnitt — aktuelle Vorlage: mojobus.co.ssl.conf)

```nginx
# CentminMod-Vhost: /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf
location /api/ {
    proxy_pass http://127.0.0.1:3002;   # ai-api bindet auf 127.0.0.1 (Security-Audit)
    proxy_read_timeout 600;             # 10 Minuten für lange Renders
    proxy_send_timeout 600;
    proxy_connect_timeout 60;
    client_max_body_size 50m;
}
```

```bash
nginx -t && systemctl reload nginx
```

---

## Wichtige Pfade (Cheat Sheet)

| Pfad | Zweck |
|---|---|
| `/home/nginx/domains/mojobus.co/public/server/` | Server-Installation (node_modules, remotion/) |
| `/home/nginx/domains/mojobus.co/public/server/server.js` | Express-Server (Port 3002, bindet auf 127.0.0.1) |
| `/home/nginx/domains/mojobus.co/public/server/remotion/` | Remotion-Komponenten + Render-Modul (`render/`) |
| `/home/nginx/domains/mojobus.co/public/server/music/` | Musik-Tracks für Videos |
| `/root/deploy-git/mojobusco/` | Git-Repository (deploy-main.sh) |
| `/etc/systemd/system/ai-api.service` | systemd-Unit |
| `/etc/systemd/system/ai-api.env` | Env/Secrets (EnvironmentFile) |

---

Erstellt: 2026-06-13 · Aktualisiert: 2026-09-28
(Korrekturen: AlmaLinux 9.8 statt 9.7 · ffmpeg in /usr/local/bin statt /opt/bin ·
Render-Modul `render/` statt render.js-Monolith · Unit ai-api.service mit
ai-api.env statt Secrets im ExecStart · Endpunkt `invalidate-bundle` statt
`invalidate-cache` · Remotion 4.0.503)
