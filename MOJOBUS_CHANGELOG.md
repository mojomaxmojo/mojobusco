# MojoBus – Changelog-Archiv

> Alle abgeschlossenen Änderungen. Wird von der KI nicht automatisch geladen.
> Bei Debugging oder Nachvollziehen von Änderungen hier nachlesen.

---

## 16.06.2026

- AGENTS.md: MojoBus-Header ergänzt, Verweis auf MOJOBUS_CONTEXT.md
- Claude via OpenRouter: `api.anthropic.com` → `openrouter.ai/api/v1/chat/completions`, Modell `~anthropic/claude-sonnet-latest`, Key `OPENROUTER_API_KEY`
- Fix /bilder Filter: `liveFilter` auf `kinds: [1]` reduziert, kind:30023 ausgeschlossen
- Entfernt: `.ttf` Font-Dateien (189+178+194 KB) – GTmetrix Score 50→A

## 17.06.2026

- Fix: `/bilder` + `/notes` Filter-Chaos (297→60 Events, unsichtbare Bilder, falsche transformEvent)
- `generate-site-data.js`: Erste Bild-URL aus vollem Content als `['image', url]` Tag gespeichert
- `extractImages()` liest primär aus Tags: `image` > `imeta` > `r` > Content-Fallback
- Commits: b99ca17, 20238d7, 122ace5

## Juni 2026 – TikTok Promotion System

System-Übersicht → `MOJOBUS_CONTEXT.md` Abschnitt "TikTok System"

### 21.06.2026
- Piper TTS → Edge TTS ersetzt (node-edge-tts@1.2.10, Seraphina ⭐ Standard)
- KI-Modell Switcher (Llama 4 ↔ Claude)
- Voiceover Volume Slider (0.00–1.50)
- CTA-Endkarte: PNG-Logo + Bus 25% größer
- Vignette entfernt (war Ursache für dunkle Ränder)
- Caption-Schrift 50% vergrößert
- Multi-Select ContentSelector (1-3 Artikel)
- Defaults: Claude, Speed 1.0, Musik -25%, Full-Line Captions
- About-Seite neu gestaltet
- Commits: 7d2b696, f008dbc, bb599b4, df18a7c, 87625e4, 4f58ad4, 74b2327, 0a2cdff

### 25.06.2026
- ffprobe-Fix: `execFileAsync = promisify(execFile)` fehlte (Commits: 548d011, 2ae8e94)
- RouteMap-Sync-Fix: 5 Bugs behoben, slide-genaue MP3s, `calculateDuration()` + `showRouteMap`
- +1s Stille nach Voiceover-Segment (Commit: 57f904c)
- TikTok-Prompt ausgelagert nach `src/config/prompts/tiktok.js`
- ffmpeg/ffprobe Pfad: `/usr/local/bin/` (CentminMod-Symlinks)

### 26.06.2026 (Vormittag)
- TikTok Prompt-System komplett überarbeitet: 5 Hook-Mechaniken, voiceoverMode, platform-Parameter, thumbnail-Feld
- Bridge aus Voiceover entfernt (Werbejingle-Sound)
- Voiceover-Sync: slide-genaue MP3s via ffprobe
- Hook 5s → 5s; HookDimOverlay 55%; hookCaption = location statt hookText
- imageContexts: 1 Eintrag pro Bild (statt pro Artikel)
- Commits: 02ffc6b, ece8ace, af9fe37, 7271bbc, d948e27

### 26.06.2026 (Abend)
- Caption Safe Zone per Plattform (TikTok 20%, Reels 25%, YouTube 18%)
- Pill-Hintergrund: rgba(0,0,0,0.28) + blur(4px)
- Dual-Event Publishing: kind 34236 + kind 1 für Feed-Clients
- JSON-Dump `/data/videos.json` + Prerender + Hybrid-Hook
- Commits: aac4452, 6875397, 31f2f2b

### 28.06.2026 – Capacitor-Kompatibilität
- Root Cause: `file:///android_asset/` → relative URLs werden zu `file:///api/`
- Fix: `getApiBaseUrl()` + `getDataBaseUrl()` – bei Capacitor absolute URLs
- Alle 10 API-Calls in TikTokPromotion.tsx korrigiert
- Videos.tsx: `isCapacitorNative()` + `inView` initial true
- Musik-Vorschau Play-Button (useRef HTMLAudioElement, absolute URL `/server/music/`)
- Commits: c190141, 03ae76f, 1f35509, 663690c, 2b3a65c

### 29.06.2026 – Revert auf 87758dc
- Hook-Score/Bild-Empfehlung/Hook-Banner komplett rückgängig (d4c3ae6 → 87758dc)
- Neu eingebracht: Musik fadeInSec 0.3s (Commit: 894ebe1)
- Hybrid-Prompt: Bild-Detail als Anker + Innenleben als Stimme (Commit: 1000d81)
- ContentSelector: Medien als Default (Commit: 51c562c)

### Juli 2026 – Prompt-Feinschliff + Retention-Template
- Paket A (tiktok.js): Fragment-Splitter-Bug, bodyMaxChars, Floskel-Blacklist, Hook↔Bild-1, Thumbnail≠Hook, Foster-Rhythmus dynamisch, Multi-Source-Bilder, Voiceover-Anglizismen
- Paket B (Remotion): HOOK_SECONDS plattformabhängig (TikTok 3s, Reels 4s, YouTube 5s), HookTitle Spring, HookDimOverlay 0.40, Hook-Emoji aus
- Paket C: Retention-Template (PAYOFF + LOOP + KÖDER)
- Leere-Caption-Pipeline sync-sicher

### 03.07.2026 – Hotfixes
- Claude Reasoning-Modell: max_tokens 4096→16384, reasoning effort:low, timeout 45s→90s, Groq-Fallback
- Fix: Bild-Text-Zuordnung (flatten→split→slice Bug, positions-erhaltende Bereinigung)
- tiktok.js: BILD-ANKER-PFLICHT, Selbstcheck neu sortiert, "Gehe Bild für Bild"
- UI: Voiceover-Toggle in Schritt 2

### TikTok-Watchtime-Update (tiktok.js)
- Hook-Limits: TikTok 55→40, Reels 70→55, YouTube 90→80 Zeichen
- bodyLines[0] = zweiter Hook
- Fremden-Test als Pflicht-Block
- Köder für alle Templates (ab 5 Bildern, buildWatchtimeRules())
- Soft-Loop nur TikTok
- 6. Hook-Mechanik: FEHLER/PREIS-HOOK
- Blacklist erweitert
- Selbstcheck neu sortiert (10 Punkte)

### hookAlternatives (A/B-Hook-Auswahl)
- KI liefert 3 Hooks mit 3 verschiedenen Mechaniken
- server.js: Deduplizierung + Bereinigung
- TikTokPromotion.tsx: klickbare Hook-Buttons (★ = KI-Favorit)

### RouteMap-Fix: letzter Ort schlecht sichtbar
- Label-Fade: Ziel bei `coordProgress=1.0` blieb bei 33% Opacity hängen
- Ziel-Label unter dem Punkt (statt darüber, vom Bus-Marker verdeckt)
- Puls-Ring sichtbar ab 90% der Karten-Slide-Dauer
- Label größer + bold + Akzent-Border

### Cinematic Effects (6 neue Effekte)
- `server/remotion/components/CinematicEffects.tsx` (NEU)
- ZoomPunch, WhipPan, FlashCut, LightLeak, CinematicLetterbox, MatchCutZoom
- Plattform-Matrix: TikTok/Reels/YouTube je andere Effekt-Kombination
- Prop `cinematicEffects` (default true) – false = alle Effekte aus
- Deploy: `bash deploy-main.sh --force` + `systemctl restart ai-api` + Bundle-Invalidate

### RouteMap: Echte Route aus GPS-Daten
- `src/lib/routeFromGps.ts` (NEU)
- GPS-Extraktion aus `gps_lat`/`gps_lon`-Tags, Dedupe < 2 km, max 6 Stationen
- Reverse-Geocoding via Nominatim (gecacht, 1.1s Rate-Limit)
- GPS→Prozent: Haversine, cos(lat)-Korrektur, 9:16-Aspect
- UI: grün "Echte Route: N Stationen" / amber "Demo-Route"
- Frontend-only (server/remotion unverändert, routeCoords floss bereits durch)

### 26.07.2026 – Refactoring-Plan Schritt 35 + Start-Fehler behoben
- `server/remotion/MojoBusVideo.tsx` verkleinert (< 500 Zeilen)
  - Gemeinsame Schichten verbleiben in `MojoBusVideo.tsx`
  - Shorts-spezifische Layer ausgelagert nach `server/remotion/flows/ShortsLayer.tsx`
  - Longform-spezifische Layer ausgelagert nach `server/remotion/flows/LongformLayer.tsx`
- `server/remotion/render/` in Module aufgeteilt (`core.js`, `thumbnail.js`, `utils.js`, `index.js`)
- Bugfix Import-Pfade: `server/routes/content/*.js`, `server/routes/promotion/routes.js`, `server/routes/video/*.js` verwendeten falsche `../`-Pfade zu `src/`, `utils/`, `services/`, `config/`, `remotion/`
- Bugfix `server/routes/video/transcode.js`: fehlender `execFile`-Import ergänzt
- Bugfix doppelte Exports entfernt in `server/remotion/render/core.js`, `thumbnail.js`, `utils.js`
- Deploy notwendig: `bash deploy-main.sh --force` + `systemctl restart ai-api` + Bundle-Invalidate

---

## Performance-Optimierungen (Juni 2026)

| Maßnahme | Wirkung |
|----------|---------|
| Skeleton-Grids statt LoadingSpinner | CLS 0.4 → ~0 |
| font-display: optional | Kein CLS durch Font-Swap |
| Critical CSS inline | LCP 2.1s → ~1.2s |
| Logo preload fetchpriority=high | LCP schneller |
| aspect-[3/4] für ImageCards | CLS-freies Bildlayout |
| Nur 3 Font-Gewichte | 149KB → 95KB |
| GTmetrix Score | 58% → A (90/100) |

### Listenseiten-Performance (Runde 2)
- Hybrid-Ansatz: JSON-Dump sofort + Relay-Live im Hintergrund
- SW v19+: staleWhileRevalidate für `/data/`, NetworkError-Fix
- `usePreloadedData`: Promise.all parallel
- Slim-JSON ohne content: articles.json ~80% kleiner
- `/notes`, `/bilder`, `/plaetze`: 3–5s → ~200ms

### Prerender-Cache-System
- `scripts/prerender-static.js`: HTML mit NIP-19 Dateinamen (Cron 6:00)
- Bot-Weiterleitung: `/{naddr}` → `/prerender/{naddr}.html`
- SW Cache-First für `/prerender/`
