# STRUKTUR: server.js

## 1. LOGISCHE BEREICHE

| # | Bereich | Zeilen | Beschreibung |
|---|---------|--------|--------------|
| A | **Konfiguration / Setup** | 1–63 | Importe, Express-App-Erstellung, Middleware-Basis (CORS, JSON-Parser), Port-Konstante |
| B | **Bot-Meta-Tag-Middleware** | 65–72 | Bot-Erkennung für Crawler (Pinterest, Google, Facebook etc.) — MUSS vor allen Routen |
| C | **Content-Generierungs-Routen** | 74–76 | Routen für Medien-, Trip-, Artikel-, Platz- und Notiz-Generierung (KI) |
| D | **Uploads-Verzeichnis** | 78–80 | Erstellen des `uploads/`-Ordners falls nicht vorhanden |
| E | **Video-Routen** | 82–84 | Grok Imagine Video, Slideshow (FFmpeg), Remotion-Render, Musik, Transcoding |
| F | **TikTok-Text-Generator** | 86–88 | TikTok-Text-Generierungs-Routen |
| G | **TikTok-Upload** | 90–92 | Bild/Video-Upload für den Upload-Reiter |
| H | **Globaler Error-Handler** | 94–108 | Fängt alle unbehandelten Fehler ab, gibt JSON zurück |
| I | **Health-Check** | 110–124 | Server-Status-Endpunkt mit API-Key-Prüfung |
| J | **Bot-Cache leeren** | 126–131 | POST-Endpunkt zum Leeren des Bot-Middleware-Caches |
| K | **Pinterest Promotion API** | 133–135 | Pinterest-Werbe-API-Routen |
| L | **Server-Start** | 137–144 | Startet den Express-Server auf dem konfigurierten Port |

## 2. INVENTAR

### Bereich A: Konfiguration / Setup (Zeilen 1–63)

| Typ | Name | Zeile(n) | Bereich | Beschreibung |
|-----|------|-----------|---------|-------------|
| Import | `express` | 1 | A | Express-Framework |
| Import | `cors` | 2 | A | CORS-Middleware |
| Import | `multer` | 3 | A | File-Upload-Middleware |
| Import | `axios` | 4 | A | HTTP-Client für API-Aufrufe |
| Import | `path` | 5 | A | Node.js-Pfad-Modul |
| Import | `fs` | 6 | A | Dateisystem-Modul |
| Import | `fileURLToPath` | 7 | A | URL zu Dateipfad-Konverter |
| Import | `execFile`, `spawn` | 8 | A | Child-Process für ffmpeg/ffprobe |
| Import | `promisify` | 9 | A | Callback-zu-Promise-Helfer |
| Import | `crypto` | 10 | A | Kryptographie-Modul (Zufalls-IDs) |
| Import | `os` | 11 | A | Betriebssystem-Modul |
| Konstante | `execFileAsync` | 12 | A | Promisified `execFile` |
| Import | `FFMPEG, FFPROBE, MUSIC_DIR, TMP_DIR` | 14 | A | Medien-Pfad-Konfiguration |
| Import | `ZOOM_PAN_EFFECTS, ASPECT_SIZES, LIFESTYLE_MUSIC_PROMPTS` | 15 | A | Musik-Prompt- und Effekt-Konfiguration |
| Import | `handleMulterError, sanitizeInput, validateApiKey, safelyParseJSON` | 16 | A | HTTP-Hilfsfunktionen |
| Import | `getLocalMusicFile, downloadImage, generateElevenLabsMusic, buildFilterComplex, readJpegDimensions, runFfmpeg` | 17–24 | A | Bild/FFmpeg-Hilfsfunktionen |
| Import | `generateWithModel` | 25 | A | KI-Textgenerierung (Groq/OpenRouter) |
| Import | `contentRouter` | 26 | A | Content-Generierungs-Router |
| Import | `createVideoRouter` | 27 | A | Video-Routen-Factory |
| Import | `tiktokRouter` | 28 | A | TikTok-Text-Router |
| Import | `tiktokUploadRouter` | 29 | A | TikTok-Upload-Router |
| Import | `getLifestyleConfig` … `getPlaceImageAnalysisPrompt` | 34–51 | A | Prompt-Funktionen aus `src/config/prompts/index.js` |
| Import | `botMiddleware, getBotCacheStats, clearBotCache` | 54 | A | Bot-Meta-Tag-Middleware |
| Import | `promotionRouter` | 57 | A | Pinterest-Promotion-Router |
| Konstante | `app` | 59 | A | Express-Application-Instanz |
| Konstante | `PORT` | 60 | A | Server-Port (aus Umgebungsvariable oder 3002) |
| Middleware | `app.use(cors())` | 62 | A | CORS für alle Routen aktivieren |
| Middleware | `app.use(express.json())` | 63 | A | JSON-Body-Parser für eingehende Requests |

### Bereich B: Bot-Meta-Tag-Middleware (Zeilen 65–72)

| Typ | Name | Zeile(n) | Bereich | Beschreibung |
|-----|------|-----------|---------|-------------|
| Middleware | `app.use(botMiddleware)` | 72 | B | Erkennt Crawler (Pinterest, Google etc.) und liefert statisches HTML mit OG/Twitter/Pinterest-Meta-Tags |

### Bereich C: Content-Generierungs-Routen (Zeilen 74–76)

| Typ | Name | Zeile(n) | Bereich | Beschreibung |
|-----|------|-----------|---------|-------------|
| Route | `app.use(contentRouter)` | 76 | C | Bindet alle Content-Generierungs-Endpunkte ein (`/api/generate-media-article`, `/api/generate-trip`, `/api/generate-article`, `/api/generate-place`, `/api/generate-note`) |

### Bereich D: Uploads-Verzeichnis (Zeilen 78–80)

| Typ | Name | Zeile(n) | Bereich | Beschreibung |
|-----|------|-----------|---------|-------------|
| Funktion | `fs.mkdirSync('uploads')` | 78–80 | D | Erstellt das `uploads/`-Verzeichnis falls nicht vorhanden |

### Bereich E: Video-Routen (Zeilen 82–84)

| Typ | Name | Zeile(n) | Bereich | Beschreibung |
|-----|------|-----------|---------|-------------|
| Route | `app.use(createVideoRouter(PORT))` | 84 | E | Bindet alle Video-Routen ein (Grok, Slideshow, Remotion, Musik, Transcoding) — siehe Bereich E in `video.js` |

### Bereich F: TikTok-Text-Generator (Zeilen 86–88)

| Typ | Name | Zeile(n) | Bereich | Beschreibung |
|-----|------|-----------|---------|-------------|
| Route | `app.use(tiktokRouter)` | 88 | F | Bindet TikTok-Text-Generierungs-Routen ein |

### Bereich G: TikTok-Upload (Zeilen 90–92)

| Typ | Name | Zeile(n) | Bereich | Beschreibung |
|-----|------|-----------|---------|-------------|
| Route | `app.use(tiktokUploadRouter)` | 92 | G | Bindet TikTok-Upload-Routen ein |

### Bereich H: Globaler Error-Handler (Zeilen 94–108)

| Typ | Name | Zeile(n) | Bereich | Beschreibung |
|-----|------|-----------|---------|-------------|
| Middleware | `app.use((err, req, res, next) => { … })` | 97–108 | H | Globaler Error-Handler: fängt Multer-Fehler und alle unbehandelten Fehler ab, gibt immer JSON zurück |

### Bereich I: Health-Check (Zeilen 110–124)

| Typ | Name | Zeile(n) | Bereich | Beschreibung |
|-----|------|-----------|---------|-------------|
| Route | `GET /api/health` | 111–124 | I | Server-Status-Endpunkt; zeigt Konfigurationsstatus aller API-Keys (Groq, Anthropic, OpenRouter, xAI), Bot-Middleware-Cache-Statistiken und Timestamp |

### Bereich J: Bot-Cache leeren (Zeilen 126–131)

| Typ | Name | Zeile(n) | Bereich | Beschreibung |
|-----|------|-----------|---------|-------------|
| Route | `POST /api/bot-cache/clear` | 128–131 | J | Leert den Bot-Middleware-Response-Cache und gibt die Anzahl gelöschter Einträge zurück |

### Bereich K: Pinterest Promotion API (Zeilen 133–135)

| Typ | Name | Zeile(n) | Bereich | Beschreibung |
|-----|------|-----------|---------|-------------|
| Route | `app.use(promotionRouter)` | 135 | K | Bindet Pinterest-Promotion-Routen unter `/api/promotion/*` ein |

### Bereich L: Server-Start (Zeilen 137–144)

| Typ | Name | Zeile(n) | Bereich | Beschreibung |
|-----|------|-----------|---------|-------------|
| Funktion | `app.listen(PORT, () => { … })` | 137–144 | L | Startet den Express-Server; loggt Port, Heap-Nutzung und Status aller API-Keys (Groq, Anthropic, OpenRouter, xAI) |

---

## ANHANG: Übersicht der importierten Sub-Router

### `contentRouter` (server/routes/content.js) — 925 Zeilen

| Route | Methode | Beschreibung |
|-------|---------|-------------|
| `/api/generate-media-article` | POST | Medien-Artikel mit KI (Bild+Video-Analyse via Groq/OpenRouter) |
| `/api/generate-trip` | POST | Trip-Beschreibung + Captions pro Station |
| `/api/generate-article` | POST | Reisebericht/Artikel mit Summary + Titel-Vorschlägen |
| `/api/generate-place` | POST | Platz-Beschreibung mit Bildanalyse |
| `/api/generate-note` | POST | Kurze Notiz mit KI |

### `createVideoRouter(PORT)` (server/routes/video.js) — 1330 Zeilen

| Route | Methode | Beschreibung |
|-------|---------|-------------|
| `/api/generate-video` | POST | Grok Imagine Video (xAI) — Text/Image/Reference-to-Video |
| `/api/video-status/:jobId` | GET | xAI Video-Status-Polling |
| `/api/generate-slideshow` | POST | FFmpeg Slideshow (Legacy) |
| `/api/slideshow-music-status` | GET | Verfügbare Musik-Dateien auflisten |
| `/api/slideshow-status/:jobId` | GET | Slideshow-Job-Status |
| `/api/slideshow-download/:jobId` | GET | Slideshow-Video-Download |
| `/api/debug-video` | POST | xAI Video-API-Debug |
| `/api/debug-rotation` | GET | Bild-Rotations-Test |
| `/api/render-remotion` | POST | **Remotion** Video Generator (Haupt-Render) |
| `/api/render-remotion/status/:jobId` | GET | Remotion-Render-Status (Polling) |
| `/api/render-remotion/download/:jobId` | GET | Remotion-Video-Download |
| `/api/render-remotion/history` | GET | Remotion-Job-Verlauf |
| `/api/render-remotion/check` | GET | Remotion-Installations-Check |
| `/api/render-remotion/invalidate-bundle` | POST | Bundle-Cache leeren |
| `/api/render-remotion/invalidate-cache` | POST | Alias für invalidate-bundle |
| `/api/music/list` | GET | Musik-Track-Liste |
| `/api/music/:filename` | GET | Musik-Datei als Audio-Stream |
| `/api/transcode-video` | POST | Video-Transcoding (Upload + ffmpeg) |
| `/api/transcode-video/status/:jobId` | GET | Transcoding-Job-Status |
| `/api/transcode-video/download/:jobId` | GET | Transkodiertes Video herunterladen |

### `tiktokRouter` (server/routes/tiktok.js) — Binärdatei (~16.7 KB)

### `tiktokUploadRouter` (server/routes/tiktokUpload.js) — 120 Zeilen

| Route | Methode | Beschreibung |
|-------|---------|-------------|
| `/api/tiktok/upload-media` | POST | Bild/Video-Datei hochladen |
| `/api/tiktok/uploads/:filename` | GET | Hochgeladene Datei abrufen |

### `promotionRouter` (server/promotion-api.js) — Binärdatei (~30.3 KB)

### `botMiddleware` (server/bot-middleware.js) — 692 Zeilen

| Funktion/Route | Zeile(n) | Beschreibung |
|----------------|----------|-------------|
| `isBot(userAgent)` | 203–207 | Prüft ob User-Agent ein bekannter Bot ist |
| `escapeHtml(str)` | 214–222 | Escaped HTML-Sonderzeichen für sichere Meta-Tags |
| `truncate(str, maxLen)` | 230–235 | Kürzt Text auf maximale Länge |
| `extractImageFromEvent(event)` | 242–261 | Extrahiert erstes Bild aus Nostr-Event |
| `extractEventMetadata(event)` | 268–288 | Extrahiert Metadaten (Titel, Summary, Bild) aus Nostr-Event |
| `fetchNostrEvent({ kind, pubkey, identifier, eventId })` | 298–333 | Lädt Nostr-Event vom Relay |
| `buildBotHtml(meta)` | 340–451 | Generiert vollständiges HTML mit OG/Twitter/Pinterest-Meta-Tags |
| `parseNostrPath(pathname)` | 463–487 | Parst URL-Pfad und extrahiert NIP-19-Daten |
| `botMiddleware(req, res, next)` | 552–669 | Haupt-Middleware: erkennt Bots, liefert Meta-Tag-HTML |
| `getBotCacheStats()` | 672–681 | Gibt Cache-Statistiken zurück (Health-Check) |
| `clearBotCache()` | 684–689 | Leert den Response-Cache manuell |

---

## Analysierte Dateien (Code nicht verändert)

- **`server/remotion/render.js`** (1376 Zeilen) — Remotion Render-Engine: Bild-Download, lokaler HTTP-Server mit Range-Request-Support, Chrome-Findung, Bundle-Cache, Voiceover-Segment-Generierung, Audio-Concat, Ambient/SFX-Generierung, Haupt-Render-Funktion `renderMojoBusVideo(params)` mit Audio-Loudness-Normalisierung.

- **`server/remotion/MojoBusVideo.tsx`** (928 Zeilen) — Haupt-Remotion-Composition (v2.0): React-Komponente mit BeatSyncLayer, TransitionWrapper (wipe/fade/slide/glitch etc.), RouteMapLine, LottieBusIcon, CinematicEffects (ZoomPunch, WhipPan, FlashCut, LightLeak, Letterbox, MatchCutZoom), Captions (tiktok/chunked/full-line/minimal), mehrschichtiges Audio-System (Musik/Voiceover/Ambient/SFX), ProgressBar und plattformabhängige Hook-Dauer (TikTok 3s / Reels 4s / YouTube 5s).
