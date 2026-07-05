# MojoBus – Session Context

> Vollständige Changelog-Historie → **`MOJOBUS_CHANGELOG.md`**
> Nostr-Framework-Referenz → **`AGENTS_NOSTR_REF.md`**

---

## Projekt-Übersicht

MojoBus ist eine Nostr-basierte Vanlife/Travel-Plattform (Reiseerlebnisse, Campingplätze, Fotos mit GPS). Läuft als **PWA + Android APK (Capacitor 8)**.

- **Domain**: https://mojobus.co | **Relay**: wss://relay.mojobus.co
- **Repo**: https://github.com/mojomaxmojo/mojobusco
- **Server**: AlmaLinux 9.7 CentminMod, Nginx, Node.js, Brotli
- **AI-API**: Systemd-Service `ai-api`, Port 3002 (`server/`)
- **Cron**: Prerender 6:00, JSON-Dumps 6:15, RSS alle 6h

---

## Tech-Stack

| Layer | Technologie |
|-------|------------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 3, shadcn/ui |
| Nostr | @nostrify/nostrify@^0.46.4 |
| Mobile | Capacitor 8, @capawesome/capacitor-file-picker, exifr@^7.1.3 |
| State | TanStack Query @^5.56.2 |
| SEO | @unhead/react@^2.0.10 |
| Backend | Node.js, Express, Groq, OpenRouter (Claude/Gemini) |
| Render | Remotion v4, Edge TTS (Seraphina), FFmpeg |

---

## Config-Verzeichnis (`src/config/`)

| Datei | Zweck |
|-------|-------|
| `authors.json` | **Single Source of Truth**: pubkey, npub, nip05 |
| `relays.ts` | Relay-Listen, Autor-Zuordnung, DEFAULT_APP_CONFIG |
| `blossom.ts` | Blossom-Server für Medien-Uploads |
| `routes.ts` | Routen-Definitionen |
| `mainMenu.ts` | Hauptnavigation Desktop + Mobile |
| `cache.ts` | Cache-Zeiten (24h Listen, 7d Profile, 1y Bilder) |
| `performance.ts` | Infinite Scroll, Cache, Relay-Config |
| `imageService.ts` | Bildoptimierung (weserv/imgproxy/Cloudflare) |
| `prompts/tiktok.js` | Foster Huntington TikTok-Prompt (**darf bearbeitet werden**) |
| `prompts/*.js` | Andere Prompt-Dateien: **TABU – niemals ändern** |

**Regel**: Neue Konfigurationen IMMER nach `src/config/`. Nie hartcodieren.

---

## Wichtige Dateien

| Datei | Zweck |
|-------|-------|
| `src/hooks/usePreloadedData.ts` | Hybrid-Hook: JSON-Dump sofort + Live-Relay Hintergrund |
| `src/hooks/useVideos.ts` | Lädt kind 34236+34235, Hybrid-Hook, Capacitor-kompatibel |
| `src/pages/TikTokPromotion.tsx` | TikTok-Video-Generator (4-Schritte UI) |
| `src/pages/Videos.tsx` | Video-Feed (kind 34236 NIP-71, 9:16 + 16:9) |
| `src/lib/routeFromGps.ts` | GPS→Route: Haversine-Dedupe, Nominatim-Geocoding, 9:16-Aspect |
| `public/sw.js` | Service Worker v21: staleWhileRevalidate + Cache-First |
| `server/server.js` | Express-Backend: KI-API, Remotion, Bot-Middleware |
| `server/remotion/render.js` | Render-Engine: slide-genaue MP3s, ffprobe-Sync, concat |
| `server/remotion/MojoBusVideo.tsx` | Remotion-Hauptkomponente |
| `server/remotion/components/CinematicEffects.tsx` | 6 Schnitt-Effekte (ZoomPunch, WhipPan, FlashCut, LightLeak, Letterbox, MatchCutZoom) |
| `server/remotion/components/KenBurnsImage.tsx` | noise/breathing/focus-in/handheld + GammaFade |
| `server/remotion/components/RouteMapLine.tsx` | Animierte Routen-Karte mit Puls-Ring + Labels |
| `server/remotion/edge.js` | Edge TTS (Seraphina ⭐, Fallback: Piper) |
| `scripts/generate-site-data.js` | Slim-JSON-Dumps (kein content), Cron 6:15 |
| `scripts/prerender-static.js` | Statische HTML mit NIP-19 Dateinamen, Cron 6:00 |
| `mojobus.co.ssl.conf` | Nginx: Bot-Prerender, Brotli, `/data/` max-age=86400 |

---

## Autoren

Nur `src/config/authors.json` bearbeiten. Alle anderen Dateien importieren daraus.

```bash
cat src/config/authors.json | jq '.authors[] | {name, pubkey, nip05}'
```

---

## GPS-Fix (Android)

**Problem**: GPS-EXIF auf Android 10+ aus `content://` URIs redacted.

**Lösung**:
1. `pickFiles({ readData: true })` – base64 direkt vom Picker
2. `ACCESS_MEDIA_LOCATION` zur Laufzeit anfordern:
```typescript
const result = await FilePicker.requestPermissions({ permissions: ['accessMediaLocation'] });
```
3. `exifr.gps(file)` auf dem File-Objekt
4. `URL.createObjectURL(file)` für Preview

---

## Capacitor / Absolute URLs (KRITISCH)

Capacitor läuft im `file:///android_asset/` Kontext → relative URLs schlagen fehl.

**Regel**: Jede neue fetch-URL braucht den Prefix:
```typescript
// TikTokPromotion.tsx
const base = getApiBaseUrl()  // '' im Browser, 'https://mojobus.co' in App
fetch(`${base}/api/render-remotion/check`)

// useVideos.ts
const base = getDataBaseUrl()
fetch(`${base}/data/videos.json`)

// Musik (statisch via Nginx, NICHT über /api/music/)
`${base}/server/music/filename.mp3`
```

---

## JSON-Dumps (`/data/`)

| Datei | Inhalt |
|-------|--------|
| `articles.json` | kind-30023, kein content, Tags: title/summary/image/d/t |
| `places.json` | kind-30023 type=place, kein content |
| `notes.json` | kind-1, content max 200 Zeichen |
| `bilder.json` | kind-1 mit image-Tag, content max 200 Zeichen |
| `trips.json` | kind-1 Trips, content max 200 Zeichen |
| `videos.json` | kind 34236+34235, imeta/image/duration/title, content max 300 Zeichen |
| `index.json` | Timestamp `generatedAtUnix`, Anzahlen, Dauer |

**Nach Deploy ausführen**: `node scripts/generate-site-data.js`

---

## Hooks-Übersicht (MojoBus-spezifisch)

| Hook | Quelle | Beschreibung |
|------|--------|-------------|
| `usePreloadedArticles()` | `/data/articles.json` + Relay | Artikel-Liste |
| `usePlaces()` | `/data/places.json` + Relay | Plätze-Liste |
| `useNotes()` | `/data/notes.json` + Relay | Notes + Infinite Scroll |
| Images.tsx | `/data/bilder.json` + Relay | Bilder-Feed |
| `useVideos()` | `/data/videos.json` + Relay | Video-Feed (kind 34236) |
| `useLongformArticle()` | nur Relay | Detailseiten (brauchen vollen content) |

---

## TikTok System

### Prompt-System (`src/config/prompts/tiktok.js`)

| Export | Beschreibung |
|--------|-------------|
| `FOSTER_HUNTINGTON_SYSTEM_PROMPT` | System-Prompt: Stil-Kern, Verbotswörter, JSON-Format |
| `generateTikTokUserPrompt(params)` | User-Prompt: Hook + Body + Retention + Watch-Time |
| `PLATFORM_CONFIG` | TikTok/Reels/YouTube: hookMaxChars, bodyMaxChars, Hashtag-Strategie |
| `TEMPLATE_CONFIG` | story, listicle, reveal, movie, retention |

**6 Hook-Mechaniken**: Zahlen, Paradox, Szene, Subtext, Kontrast, Fehler/Preis

**Foster-Rhythmus**: kurz. kurz. LANG (12-14 Wörter). kurz. – 1 langer Satz pro 3-4 Slides

**Wichtige Regeln**:
- bodyLines[i] = Bild i (Reihenfolge heilig!)
- bodyLines[0] = zweiter Hook (verstärkt Spannung, nie ruhig)
- Fremden-Test: Hook funktioniert ohne Vorwissen in 1 Sekunde
- Köder ab 5 Bildern (buildWatchtimeRules), nicht bei retention
- Soft-Loop nur TikTok
- Voiceover-Modus: vollständige Sätze, keine Anglizismen außer Eigennamen

**Charakter-Block (WER SCHREIBT)**:
- Mojo & Susanne – 36 Jahre alter US-Oldtimer-Bus, 10m, 7.5t, Perpetual Travelers
- Leon (Soul Leon) – Rhodesian Ridgeback, vorausgegangen, **NIE als lebender Begleiter**
- Das Fahrzeug heißt Mojobus – nie "Van", nie "Camper"

### API-Endpunkte (Port 3002)

| Endpunkt | Methode | Funktion |
|----------|---------|----------|
| `/api/render-remotion` | POST | Video rendern |
| `/api/render-remotion/status/:jobId` | GET | Render-Fortschritt |
| `/api/render-remotion/download/:jobId` | GET | MP4-Download |
| `/api/render-remotion/check` | GET | System-Status |
| `/api/render-remotion/invalidate-bundle` | POST | Bundle-Cache leeren |
| `/api/render-remotion/history` | GET | Abgeschlossene Jobs |
| `/api/music/list` | GET | Musik-Tracks |
| `/api/tiktok/generate-text` | POST | Foster-Texte (model: llama4/claude) |
| `/api/tiktok/analyze-images` | POST | Vision-KI pro Bild |

### KI-Modelle

| Modell | Endpoint | Zweck |
|--------|----------|-------|
| Llama 4 Scout | Groq, `GROQ_API_KEY` | Standard, kostenlos |
| Claude Sonnet | OpenRouter, `OPENROUTER_API_KEY` | TikTok-Texte |
| Gemini 2.5 Flash | OpenRouter | Video-Analyse |

**Claude-Config**: `max_tokens: 16384`, `reasoning: { effort: 'low' }`, `timeout: 90s`
(claude-sonnet-latest → Reasoning-Modell, braucht großes Token-Budget)
Automatischer Groq-Fallback wenn Claude leere Antwort liefert.

### Voiceover-System (Edge TTS primär)

**Paket**: `node-edge-tts@^1.2.10` (nicht `edge-tts@1.0.1` – TypeScript-Only!)
**Architektur**: Nur dynamischer `import()` in render.js. Fallback: Edge → Piper → kein Voiceover.

| Stimme | ID | Typ |
|--------|-----|-----|
| Seraphina ⭐ | `de-DE-SeraphinaMultilingualNeural` | weiblich, beste |
| Florian | `de-DE-FlorianMultilingualNeural` | männlich |
| Amala | `de-DE-AmalaNeural` | weiblich |

### Remotion Voiceover-Sync-Architektur

```
Für jeden Slide:
  slide_N_audio.mp3  (Edge TTS Output)
  slide_N_silence.mp3 (ffmpeg -t exactDuration reine Stille)
  slide_N.mp3 = concat(audio + silence)  → ffprobe misst echte Dauer

perSlideArray = [gemessene_dauer_0, ..., gemessene_dauer_N]
voiceover_sync.mp3 = concat aller slide_N.mp3 mit -c copy (kein Drift)
Video-Slide-Frames = Math.round(echte_dauer × fps)
```

**ffmpeg/ffprobe Pfad**: `/usr/local/bin/` (CentminMod Symlinks) – nie `/opt/bin/` hartcodieren

### Cinematic Effects

6 Effekte in `CinematicEffects.tsx` – gesteuert durch `platform`-Prop + `cinematicEffects: true/false`

| Effekt | TikTok | Reels | YouTube |
|--------|--------|-------|---------|
| ZoomPunch | 0.12 stark | 0.07 dezent | aus |
| WhipPan | ✅ | ✅ | ✅ |
| FlashCut | weiß | aus | schwarz |
| LightLeak | aus | ✅ | ✅ |
| Letterbox | 0% | 6% | 8% |
| MatchCutZoom | ✅ | ✅ | ✅ |

### Publish-Flow

```
Video fertig → ☑️ "Auf /videos publizieren" (default: an)
  AN  → kind 34236 (NIP-71, /videos) + kind 1 (Amethyst/Primal Feed)
  AUS → kind 30078 (app-intern, nur History)
```

### TikTok-Roadmap

**Stufe 0 ✅**: Diashow, Hook, Captions, Musik, Voiceover, RouteMap, Lottie-Bus, KI-Texte, Upload, Multi-Select, Cinematic Effects, Echte GPS-Route

**Stufe 1 ⏳ (einfach)**:
1. Kapitel-Marker (Hook/Body/Bridge/CTA separate Captions)
2. Drag&Drop Medien-Reihenfolge
3. Einfacher Trim (FFmpeg -ss/-to)

**Stufe 2 ⏳ (mittel)**:
4. Timeline-Editor
5. Multi-Download als ZIP
6. Video-Split
7. Render-Queue (VPS-Schonung)

**Stufe 3 ⏳ (schwer)**:
8. Automatischer Hook (KI erkennt spannendste Stelle)
9. Bild-zu-Video (KI animiert Fotos)
10. Green-Screen (FFmpeg chromakey)

---

## VPS Deploy

```bash
ssh root@server
cd /root/deploy-git/mojobusco
bash deploy-main.sh --force

# Nginx-Config aktualisieren (falls geändert):
cp mojobus.co.ssl.conf /etc/nginx/conf.d/mojobus.co.ssl.conf
nginx -t && systemctl reload nginx

# Daten-Dumps generieren (nach erstem Deploy):
node scripts/generate-site-data.js
```

### Nach Deploy (je nach Änderung)

| Änderung | Nötige Schritte |
|----------|----------------|
| Nur tiktok.js | `deploy --force` + `systemctl restart ai-api` |
| server.js | `deploy --force` + `systemctl restart ai-api` |
| server/remotion/ | `deploy --force` + `restart ai-api` + **Bundle-Invalidate** |
| Nginx-Config | `cp mojobus.co.ssl.conf ...` + `nginx -t && systemctl reload nginx` |

```bash
# Bundle-Cache leeren (nach Remotion-Änderungen):
curl -X POST http://localhost:3002/api/render-remotion/invalidate-bundle
```

### Debug-Kommandos

```bash
# Voiceover-Sync prüfen:
journalctl -u ai-api -f | grep -i "📐\|perSlideArray\|Frames\|voiceover_sync"

# RouteMap prüfen:
journalctl -u ai-api -f | grep -i "Route\|🗺️"

# bodyLine-Bereinigung:
journalctl -u ai-api -f | grep -i "bodyLines\|Generiert"

# ffprobe Pfad prüfen:
which ffprobe  # → /usr/local/bin/ffprobe (CentminMod Symlink auf /opt/bin/ffprobe)
```

---

## Bekannte Einschränkungen

| Problem | Detail |
|---------|--------|
| **primal.net** | 0 Events bei generate-site-data.js (Timeout 20s). Nur relay.mojobus.co produktiv. |
| **SW Cache** | Nach Deploy alte JSONs im Cache → Hard-Reload (Shift+F5) nötig |
| **413 Payload** | Multer-Limit 20MB/Datei. Canvas-Resize (max 1920px) vorgesehen. |
| **Bundle-Cache** | Nach Remotion-Änderungen automatisch geleert durch deploy-main.sh |
| **Video-Detailseite** | `/video/:naddr` noch nicht implementiert (Roadmap: Stufe 1) |

---

## Branches

- **main** – Aktive Entwicklung
- **backup-gps** – GPS-Fix funktionierender Stand (Commit 97b8dc4)
- **caption-improvements-v2** – Bildunterschriften (alter Stand)

---

## Prerender + SW Cache-System

**Ablauf**:
1. Cron 6:00 → `prerender-static.js` → HTML mit NIP-19 Dateinamen
2. Cron 6:15 → `generate-site-data.js` → JSON-Dumps `/data/`
3. Bot/User → Nginx liefert statisches HTML (kein Relay!)
4. Fehlt Prerender → Fallback auf SPA → lädt vom Relay

**SW v21**: staleWhileRevalidate für `/data/`, Cache-First für `/prerender/`
SW-Version wird bei jedem Deploy automatisch erhöht durch `bump_sw_version()` in `deploy-main.sh`.

**JSON-Dump Wichtig**: `useLongformArticle()`, `useNote()` → **nur Relay** (Detailseiten brauchen vollen content).
