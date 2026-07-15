# STRUKTURANALYSE: server.js & server/remotion/MojoBusVideo.tsx

---

## 1. LOGISCHE BEREICHE

### server.js (144 Zeilen)

| Bereich | Zeilen | Beschreibung |
|---------|--------|-------------|
| **A – Importe & Setup** | 1–60 | Alle `import`-Anweisungen, Express-App-Erzeugung, Port-Konstante |
| **B – Middleware** | 62–72 | CORS, JSON-Parser, Bot-Meta-Tag-Middleware |
| **C – Routen-Mounting** | 74–92 | Einbinden der 4 Router (content, video, tiktok, tiktokUpload) |
| **D – Error-Handler** | 94–108 | Globaler Express-Fehlerhandler (JSON-Ausgabe) |
| **E – Health/Admin-Endpunkte** | 110–135 | `/api/health`, `/api/bot-cache/clear`, Pinterest-Promotion-API |
| **F – Server-Start** | 137–144 | `app.listen()` mit Logging der Konfiguration |

### server/remotion/MojoBusVideo.tsx (927 Zeilen)

| Bereich | Zeilen | Beschreibung |
|---------|--------|-------------|
| **A – Importe & Typdefinitionen** | 1–166 | React/Remotion-Imports, Komponenten-Imports, Props-Interface `MojoBusVideoProps` |
| **B – Hilfskonstanten & -funktionen** | 168–229 | `HOOK_SECONDS`, `getHookSeconds()`, `HookDimOverlay`-Komponente, `calculateDuration()` |
| **C – Hauptkomponente (Props-Deklaration)** | 233–294 | `MojoBusVideo`-Komponente, Destrukturierung aller Props mit Defaults |
| **D – Slideshow-Berechnung (useVideoConfig)** | 295–340 | Frame-Berechnungen: `hookFrames`, `ctaFrames`, `slideDefs`, `slideshowFrames`, `perSlide`, `slideStartFrame` |
| **E – MediaRenderer Komponente** | 342–434 | Inline-Komponente für Bild/Video-Auswahl + Speed-Ramping |
| **F – Effekt-Vorberechnung** | 436–504 | `TRANSITION_FRAMES`, Fallback-Beats, Route-Koordinaten, Cinematic Effects, `matchCutMap`, heroWordWindows, `videoDuckWindows` |
| **G – Return-JSX: Schicht 1 (Bilder + Transitionen)** | 506–646 | ColorGradeWrapper, Hook-Sequence, Slideshow-Loop (jeder Slide mit WhipPan/Punch/MatchCut/FadeOut), CTA-Hintergrund |
| **H – Return-JSX: Schicht 2–5 (Overlays)** | 648–690 | ColorGradeOverlay, HookDimOverlay, HookTitle, LocationBadge |
| **I – Return-JSX: Schicht 6–8 (Captions)** | 692–744 | PerSlideCaption, Summary/StoryCaption, manuelle Captions |
| **J – Return-JSX: Schicht 9–9c (CTA + Letterbox)** | 746–785 | MojoBusCTA, LottieBusIcon, CinematicLetterbox |
| **K – Return-JSX: Schicht 10–10b (Balken)** | 787–808 | ProgressBar, AudioWaveformBar |
| **L – Return-JSX: Schicht 11–11c (Audio)** | 810–844 | AudioLayer für Musik, Voiceover, Ambient |
| **M – Return-JSX: Schicht 12–15 (Effekte)** | 846–922 | BeatSyncLayer, FlashCut/LightLeak, StickerPop, SfxLayer |

---

## 2. INVENTAR

### server.js — Vollständiges Inventar

| # | Zeile(n) | Name / Route | Bereich | Beschreibung |
|---|----------|-------------|---------|-------------|
| 1 | 1–11 | `import express/cors/multer/axios/path/fs/url/child_process/util/crypto/os` | A | Standard-Node-Pakete importieren |
| 2 | 12 | `execFileAsync` | A | `promisify(execFile)` – Async-Version von `execFile` |
| 3 | 14 | `import { FFMPEG, FFPROBE, MUSIC_DIR, TMP_DIR }` | A | Medien-Pfad-Konfiguration aus `config/media-paths.js` |
| 4 | 15 | `import { ZOOM_PAN_EFFECTS, ASPECT_SIZES, LIFESTYLE_MUSIC_PROMPTS }` | A | Musik-Prompt-Konfiguration aus `config/music-prompts.js` |
| 5 | 16 | `import { handleMulterError, sanitizeInput, validateApiKey, safelyParseJSON }` | A | HTTP-Hilfsfunktionen aus `utils/http-helpers.js` |
| 6 | 17–24 | `import { getLocalMusicFile, downloadImage, generateElevenLabsMusic, buildFilterComplex, readJpegDimensions, runFfmpeg }` | A | Bild/FFmpeg-Utilities aus `utils/image-ffmpeg.js` |
| 7 | 25 | `import { generateWithModel }` | A | KI-Content-Service aus `services/ai-content.js` |
| 8 | 26 | `import contentRouter` | A | Content-Router aus `routes/content.js` |
| 9 | 27 | `import createVideoRouter` | A | Video-Router-Factory aus `routes/video.js` |
| 10 | 28 | `import tiktokRouter` | A | TikTok-Router aus `routes/tiktok.js` |
| 11 | 29 | `import tiktokUploadRouter` | A | TikTok-Upload-Router aus `routes/tiktokUpload.js` |
| 12 | 31–51 | `import { getLifestyleConfig, getGenderPromptAddition, generateMediaPrompt, generateTripPrompt, generateTripCaptionPrompt, generateArticlePrompt, generateArticleSummaryPrompt, generateArticleTitlesPrompt, generateNotePrompt, generatePlacePrompt, getMediaImageAnalysisPrompt, getMediaVideoAnalysisPrompt, getTripImageAnalysisPrompt, getArticleImageAnalysisPrompt, getNoteImageAnalysisPrompt, getPlaceImageAnalysisPrompt }` | A | Prompt-Funktionen aus `src/config/prompts/index.js` |
| 13 | 54 | `import { botMiddleware, getBotCacheStats, clearBotCache }` | A | Bot-Meta-Tag-Middleware aus `bot-middleware.js` |
| 14 | 57 | `import promotionRouter` | A | Pinterest-Promotion-Router aus `promotion-api.js` |
| 15 | 59 | `const app = express()` | A | Express-App-Instanz erzeugen |
| 16 | 60 | `const PORT = process.env.PORT \|\| 3002` | A | Port aus Umgebungsvariable oder 3002 |
| 17 | 62 | `app.use(cors())` | B | CORS-Middleware aktivieren |
| 18 | 63 | `app.use(express.json())` | B | JSON-Parser-Middleware aktivieren |
| 19 | 72 | `app.use(botMiddleware)` | B | Bot-Meta-Tag-Middleware aktivieren |
| 20 | 76 | `app.use(contentRouter)` | C | Content-Generierungs-Routen mounten |
| 21 | 78–80 | `uploads-Ordner` | C | `uploads`-Verzeichnis anlegen falls nicht vorhanden |
| 22 | 84 | `app.use(createVideoRouter(PORT))` | C | Video-Routen mounten (Port wird übergeben) |
| 23 | 88 | `app.use(tiktokRouter)` | C | TikTok-Text-Generator-Routen mounten |
| 24 | 92 | `app.use(tiktokUploadRouter)` | C | TikTok-Upload-Routen mounten |
| 25 | 97–108 | Globaler Error-Handler | D | Express-Fehler-Middleware: fängt alle Fehler, gibt immer JSON zurück |
| 26 | 111–124 | `GET /api/health` | E | Health-Check: zeigt API-Key-Status, Bot-Cache-Status, Timestamp |
| 27 | 128–131 | `POST /api/bot-cache/clear` | E | Leert den Bot-Cache und gibt Anzahl gelöschter Einträge zurück |
| 28 | 135 | `app.use(promotionRouter)` | E | Pinterest-Promotion-Routen mounten unter `/api/promotion/*` |
| 29 | 137–144 | `app.listen(PORT, ...)` | F | Server starten auf konfiguriertem Port |
| 30 | 138 | `console.log('[Server] Backend läuft auf Port ${PORT}')` | F | Start-Log: Port |
| 31 | 139 | `console.log('[Server] Node.js Heap: ...')` | F | Start-Log: Heap-Nutzung |
| 32 | 140 | `console.log('[Server] GROQ_API_KEY: ...')` | F | Start-Log: Groq-API-Key-Status |
| 33 | 141 | `console.log('[Server] ANTHROPIC_API_KEY: ...')` | F | Start-Log: Anthropic-API-Key-Status |
| 34 | 142 | `console.log('[Server] OPENROUTER_API_KEY: ...')` | F | Start-Log: OpenRouter-Key-Status (für Video-Analyse) |
| 35 | 143 | `console.log('[Server] XAI_API_KEY: ...')` | F | Start-Log: xAI-Key-Status (für Video-Generierung) |

### server/remotion/MojoBusVideo.tsx — Vollständiges Inventar

| # | Zeile(n) | Name | Typ | Bereich | Beschreibung |
|---|----------|------|-----|---------|-------------|
| 1 | 16–17 | `import React, { AbsoluteFill, Sequence, useVideoConfig, useCurrentFrame, Video }` | Import | A | React/Remotion-Kern-Importe |
| 2 | 19–29 | `import { KenBurnsImage, ..., LoadFonts }` | Import | A | 12 Basis-Komponenten (KenBurns, ColorGrade, HookTitle, LocationBadge, CTA, ProgressBar, AudioLayer, CrossFade, Captions, Fonts) |
| 3 | 32–47 | `import { BeatSyncLayer, ..., LottieBusIcon }` | Import | A | 4 neue Skills: BeatSyncLayer, TransitionWrapper, RouteMapLine, LottieBusIcon |
| 4 | 51–66 | `import { getPlatformEffects, ..., findHeroWordWindow }` | Import | A | 10 Cinematic-Effect-Komponenten + StickerPops + SfxLayer + CaptionHeroWord |
| 5 | 70–166 | `MojoBusVideoProps` | Interface | A | Vollständige Props-Definition (36 Parameter) |
| 6 | 176–180 | `HOOK_SECONDS` | Konstante | B | Plattform-spezifische Hook-Dauer (tiktok:3s, reels:4s, youtube:5s) |
| 7 | 182–184 | `getHookSeconds(platform?)` | Funktion | B | Gibt Hook-Sekunden für Plattform zurück (Fallback: tiktok) |
| 8 | 191–208 | `HookDimOverlay` | Komponente | B | Abdunkelungs-Overlay während Hook-Slide mit sanftem Fade-In/Out |
| 9 | 212–229 | `calculateDuration(imageCount, fps, secondsPerImage, perSlideArray?, showRouteMap?, platform?)` | Funktion | B | Berechnet Gesamt-Frames, Hook-Frames, CTA-Frames, Slideshow-Frames |
| 10 | 233–294 | `MojoBusVideo` | Komponente | C | Hauptkomponente — Destrukturierung aller 33 Props mit Defaultwerten |
| 11 | 295 | `const { fps, durationInFrames } = useVideoConfig()` | Aufruf | D | Remotion-Video-Konfiguration auslesen |
| 12 | 297 | `const grade = colorGrade \|\| lifestyleToGrade(lifestyle)` | Variable | D | Color-Grade aus Prop oder Lifestyle ableiten |
| 13 | 298–299 | `const images = imageUrls.slice(0, 20)` / `const imageCount` | Variable | D | Bilder auf max 20 begrenzen |
| 14 | 303–305 | `hasRouteMap`, `routeSlideIndex`, `totalSlideCount` | Variable | D | Routen-Slide-Position berechnen |
| 15 | 308–311 | `slidesSec`, `slidesFrames` | Variable | D | Slide-Dauern: dynamisch (perSlideArray) oder fix (secondsPerImage) |
| 16 | 313–314 | `hookFrames`, `ctaFrames` | Variable | D | Frame-Berechnung für Hook und CTA |
| 17 | 317–319 | `routeDurFrames` | Variable | D | Dauer des Routen-Slides in Frames |
| 18 | 324–334 | `slideDefs` | Variable | D | Array aller Slide-Definitionen (Bilder + optionale Route-Karte) |
| 19 | 333 | `totalSlides` | Variable | D | Anzahl aller Slides |
| 20 | 334 | `slideshowFrames` | Variable | D | Summe aller Slide-Frames (inkl. RouteMap) |
| 21 | 336–337 | `slideStartFrame(idx)` | Funktion | D | Start-Frame eines Slides berechnen |
| 22 | 340 | `perSlide` | Variable | D | Legacy perSlide (Fallback auf erstes Element) |
| 23 | 343 | `isVideo(url)` | Funktion | E | Prüft ob URL auf Video-Datei verweist (mp4/webm/mov/avi/mkv) |
| 24 | 372–434 | `MediaRenderer({ src, index, allowAudio?, speedRamp?, slideFrames? })` | Komponente | E | Wählt zwischen Video oder KenBurnsImage, inkl. Speed-Ramping (2-Sequence-Lösung) |
| 25 | 437 | `TRANSITION_FRAMES` | Konstante | F | ~20 Frames bei 30fps (0.67s) für Überblendungen |
| 26 | 441 | `hookEmoji` | Variable | F | Emoji-Konstante: immer `''` (deaktiviert) für rohen Foster-Look |
| 27 | 443 | `hasCaptions` | Variable | F | Boolean: Captions vorhanden und nicht 'off' |
| 28 | 446–452 | `fallbackBeats` | Variable | F | Vorberechnete Fallback-Beats für BeatSyncLayer |
| 29 | 455–457 | `effectiveRouteCoords` | Variable | F | Route-Koordinaten aus Props oder Demo-Route via `pickDemoRoute(country, location)` |
| 30 | 463–465 | `fx` | Variable | F | Plattform-Effekte via `getPlatformEffects(platform)` |
| 31 | 466 | `cutFx` | Variable | F | Cut-Effekte pro Slide via `pickCutEffect(i, platform)` |
| 32 | 467 | `matchCutMap` | Variable | F | Match-Cut-Zoom-Paare via `buildMatchCutMap(slideDefs)` |
| 33 | 469 | `whipDir(i)` | Funktion | F | WhipPan-Richtung deterministisch alternierend (left/right) |
| 34 | 475 | `locationBadgeTopPct` | Variable | F | LocationBadge Top-Position (unter Letterbox) |
| 35 | 483–490 | `videoDuckWindows` | Variable | F | Duck-Fenster für Musik/Atmo während Video-Clips mit Original-Ton |
| 36 | 496–504 | `heroWordWindows` | Variable | F | Hook-Wort-Zoom-Fenster aus Captions via `findHeroWordWindow` |
| 37 | 510 | `<LoadFonts />` | JSX | G | Fonts laden |
| 38 | 516–525 | `<Sequence> Hook-Bild </Sequence>` | JSX | G | Erstes Bild mit FadeOut auf hookFrames+TRANSITION_FRAMES |
| 39 | 528–635 | `slideDefs.map(...)` — Slideshow-Loop | JSX | G | Jeder Slide mit Effekt-Kette (Media → MatchCut → Punch → Whip → FadeOut) |
| 40 | 537–560 | Cinematic-Effekt-Berechnung pro Slide | JSX | G | `hasWhipIn`, `hasWhipOut`, `cutPunchHere`, `heroWindow`, `punchTriggerFrame`, `matchCut` |
| 41 | 563–601 | Effekt-Kette (innen → außen) | JSX | G | Schachtelung: MediaRenderer → MatchCutZoomWrapper → ZoomPunchWrapper → WhipPanWrapper |
| 42 | 604–634 | `<Sequence key={...}>` pro Slide | JSX | G | Sequence für jeden Slide inkl. Transition, RouteMapLine und WipeEdgeGlow |
| 43 | 638–644 | `<Sequence> CTA-Hintergrund </Sequence>` | JSX | G | Letztes Bild als CTA-Hintergrund mit langsamem FadeIn |
| 44 | 649 | `<ColorGradeOverlay grade={grade} />` | JSX | H | Color-Grade-Overlay-Schicht |
| 45 | 655–657 | `<Sequence> HookDimOverlay </Sequence>` | JSX | H | Gleichmäßige Abdunkelung während Hook-Slide |
| 46 | 662–672 | `<Sequence> HookTitle </Sequence>` | JSX | H | Titel-Overlay mit Emoji, Caption, Akzentfarbe |
| 47 | 679–689 | `<Sequence> LocationBadge </Sequence>` | JSX | H | Orts-Badge auf den ersten Slides |
| 48 | 694–707 | `<PerSlideCaption ... />` | JSX | I | Auto-Captions synchron zur Slideshow |
| 49 | 710–724 | `<Sequence> StoryCaption (Summary) </Sequence>` | JSX | I | Summary-Subtitle in der Mitte der Slideshow |
| 50 | 727–744 | `captions.map(...)` — manuelle Captions | JSX | I | Fallback-Captions im minimalen Stil |
| 51 | 747–755 | `<Sequence> MojoBusCTA </Sequence>` | JSX | J | CTA-Endkarte mit Website/Handle |
| 52 | 758–773 | `<Sequence> LottieBusIcon </Sequence>` | JSX | J | Animierter Bus (CSS/Lottie) in der Endkarte |
| 53 | 778–785 | `<CinematicLetterbox ... />` | JSX | J | Kino-Balken für Reels/YouTube |
| 54 | 788–794 | `<ProgressBar ... />` | JSX | K | Fortschrittsbalken während der Slideshow |
| 55 | 797–808 | `<AudioWaveformBar ... />` | JSX | K | Optionale Waveform-Visualisierung |
| 56 | 811–818 | `<AudioLayer> Musik </AudioLayer>` | JSX | L | Hintergrundmusik mit DuckWindows |
| 57 | 824–833 | `<Sequence> <AudioLayer> Voiceover </AudioLayer> </Sequence>` | JSX | L | Voiceover startet synchron mit Slideshow |
| 58 | 836–844 | `<AudioLayer> Ambient/Atmo </AudioLayer>` | JSX | L | Leise Hintergrund-Atmo mit DuckWindows |
| 59 | 848–858 | `<BeatSyncLayer ... />` | JSX | M | Beat-getriggerte Flash-Effekte während Slideshow |
| 60 | 864–893 | `slideDefs.map(...)` — FlashCut + LightLeak | JSX | M | Blitz- und Licht-Effekte auf Cuts |
| 61 | 899–911 | `slideDefs.map(...)` — StickerPop | JSX | M | Emoji-Sticker auf Cuts (Beta, gated hinter stickersEnabled) |
| 62 | 916–922 | `<SfxLayer ... />` | JSX | M | Sound-Effekte auf Cuts (Beta, gated hinter sfxEnabled) |

---

## 3. ABHÄNGIGKEITEN

### 3.1 server.js interne Abhängigkeiten

```
app.listen()  [F] ── verwendet ──→ PORT [A]
                                    app [A]
                                    getBotCacheStats() via import [A]
                                    clearBotCache() via import [A]

app.use(botMiddleware) [B] ──→ botMiddleware aus bot-middleware.js

app.use(contentRouter) [C] ──→ contentRouter aus routes/content.js
                                contentRouter nutzt: generateWithModel (ai-content.js),
                                handleMulterError/sanitizeInput/validateApiKey (http-helpers.js),
                                sämtliche Prompt-Funktionen (src/config/prompts/index.js)
                                validateApiKey() prüft process.env.GROQ_API_KEY

app.use(createVideoRouter(PORT)) [C] ──→ createVideoRouter(PORT) aus routes/video.js
                                          video.js nutzt: FFMPEG/FFPROBE/MUSIC_DIR/TMP_DIR,
                                          ZOOM_PAN_EFFECTS/ASPECT_SIZES/LIFESTYLE_MUSIC_PROMPTS,
                                          getLocalMusicFile/downloadImage/generateElevenLabsMusic/
                                          buildFilterComplex/readJpegDimensions/runFfmpeg
                                          process.env.XAI_API_KEY, process.env.PPQ_API_KEY,
                                          process.env.GROQ_API_KEY (indirekt via generateWithModel)

app.use(tiktokRouter) [C] ──→ tiktokRouter aus routes/tiktok.js

app.use(tiktokUploadRouter) [C] ──→ tiktokUploadRouter aus routes/tiktokUpload.js

app.use(promotionRouter) [E] ──→ promotionRouter aus promotion-api.js

GET /api/health [E] ──→ getBotCacheStats() aus bot-middleware.js
                         process.env.GROQ_API_KEY, ANTHROPIC_API_KEY,
                         OPENROUTER_API_KEY, XAI_API_KEY
```

### 3.2 MojoBusVideo.tsx interne Abhängigkeiten

**Bereichsübergreifende Variablen** (werden in einem Bereich berechnet und in mehreren anderen genutzt):

| Variable | Berechnet in | Genutzt in |
|----------|-------------|-----------|
| `grade` | D (297) | H (649), überall via ColorGradeWrapper |
| `images` / `imageCount` | D (298–299) | G (516, 528, 638), H (679), I (710, 727), J (siehe Schichten) |
| `hasRouteMap` | D (303) | D (304, 317, 326), I (698) |
| `routeSlideIndex` | D (304) | D (317, 326, 329), I (698) |
| `totalSlideCount` | D (305) | D (308, 322) |
| `slidesSec` | D (308–310) | D (311) |
| `slidesFrames` | D (311) | D (318, 327, 330), H (686), I (700, 713) |
| `hookFrames` | D (313) | G (517, 529–533, 639), H (655, 662), J (747, 748, 760, 783, 793), K (792, 793, 799), L (825), M (849) |
| `ctaFrames` | D (314) | D (334), G (639), J (747, 761) |
| `slideDefs` | D (324–331) | D (334, 337), F (466, 467, 484–488, 496–504), G (528–634), I (699, 701, 728–729), M (864, 893, 899, 918) |
| `totalSlides` | D (333) | G (529, 534, 544) |
| `slideshowFrames` | D (334) | G (639), J (747, 760, 783, 793), K (793, 799), M (849) |
| `slideStartFrame(i)` | D (336–337) | G (531, 557, 558), H (680), I (701, 731–732), M (867, 885, 901, 918) |
| `perSlide` | D (340) | D (330), H (686, 687), I (713, 719) |
| `hasCaptions` | F (443) | I (694, 710, 727) |
| `fallbackBeats` | F (446–452) | M (855) |
| `effectiveRouteCoords` | F (455–457) | G (608–609) |
| `fx` | F (463–465) | F (467, 475), G (546–548, 568–579, 586–601), J (778), M (869, 880) |
| `cutFx` | F (466) | F (543–545), M (865, 899, 918) |
| `matchCutMap` | F (467) | G (560, 566) |
| `whipDir(i)` | F (469) | G (591) |
| `locationBadgeTopPct` | F (475) | H (687) |
| `videoDuckWindows` | F (483–490) | L (816, 842) |
| `heroWordWindows` | F (496–504) | G (547–559) |
| `TRANSITION_FRAMES` | F (437) | G (517–520, 533, 594, 619, 626, 628) |

**Call-Graph innerhalb der Komponente**:

```
MojoBusVideo (Komponente)
├── useVideoConfig() [Remotion Hook]
├── useCurrentFrame() [in HookDimOverlay]
├── getHookSeconds(platform) [B]
│   └── HOOK_SECONDS [B]
├── calculateDuration(...) [B – Export-Funktion, nicht in Komponente aufgerufen]
├── generateFallbackBeats(...) [F – aufgerufen in Komponente]
├── pickDemoRoute(country, location) [F]
├── getPlatformEffects(platform) [F]
│   └── pickCutEffect(i, platform) [F]
├── buildMatchCutMap(slideDefs) [F]
├── findHeroWordWindow(captionText, startFrame, frames) [F]
├── isVideo(url) [E]
├── MediaRenderer({src, index, ...}) [E]
│   ├── KenBurnsImage [E]
│   ├── Video (Remotion) [E]
│   └── AbsoluteFill / Sequence [E]
├── lifestyleToGrade(lifestyle) [D]
├── pickDirection(index) [E]
├── LightLeak({seed}) [M]
├── FlashCut({color}) [M]
├── flashCutDuration(fps) [M]
├── lightLeakDuration(fps) [M]
├── pickStickerForCut(i) [M]
├── stickerPopDuration(fps) [M]
├── buildSfxCues(cutFx, frameArray) [M]
└── getRemotionRenderer() [wird in video.js gerufen, nicht in dieser Datei]
```

### 3.3 Bereichsübergreifende Nutzung in server.js

| Variable | Definiert in | Genutzt in |
|----------|-------------|-----------|
| `PORT` (3002) | A (60) | C (84: `createVideoRouter(PORT)`), F (137: `app.listen(PORT)`) |
| `app` (Express) | A (59) | B (62, 63, 72), C (76, 84, 88, 92), D (97), E (111, 128, 135), F (137) |
| `execFileAsync` | A (12) | Nur in video.js (Slide-Job-Start) |
| `process.env.GROQ_API_KEY` | — (env) | A (29: `validateApiKey`), E (114: Health-Check), F (140: Start-Log) |
| `process.env.ANTHROPIC_API_KEY` | — (env) | E (115: Health-Check), F (141: Start-Log) |
| `process.env.OPENROUTER_API_KEY` | — (env) | E (116: Health-Check), F (142: Start-Log), content.js (116ff) |
| `process.env.XAI_API_KEY` | — (env) | E (117: Health-Check), F (143: Start-Log), video.js (60: grok-video) |
| `botMiddleware` | import (54) | B (72) |
| `getBotCacheStats` | import (54) | E (119) |
| `clearBotCache` | import (54) | E (129) |

---

## 4. AUFTEILUNGSVORSCHLAG für MojoBusVideo.tsx

Die Datei ist 927 Zeilen lang und vereint Props-Typdefinition, Hilfskomponenten, Berechnungslogik und das gesamte visuelle Layout in einer Datei. Eine Aufteilung in 5–8 Dateien wäre sinnvoll:

### Datei 1: `types.ts` (oder `MojoBusVideoProps.ts`)
**Inhalt**: Das komplett `MojoBusVideoProps`-Interface (Zeilen 70–166)
**Begründung**: Typdefinitionen gehören nicht in die Render-Komponente. Diese Datei kann von anderen Komponenten (z.B. calculateDuration) importiert werden, ohne dass React-Rendering importiert werden muss.

### Datei 2: `layout.tsx`
**Inhalt**:
- `MojoBusVideo`-Hauptkomponente **ohne** Props-Interface (Zeilen 233–294 + 295–926, aber nur der Return-JSX-Teil)
- NUR der JSX-Return-Teil (Zeilen 506–926) — die visuelle Anordnung der Schichten
- Die Berechnungen (Zeilen 295–340) und Effekt-Vorberechnungen (Zeilen 436–504) könnten als `useMemo`-Hooks hier bleiben

### Datei 3: `media-renderer.tsx`
**Inhalt**:
- `isVideo(url)` — URL-Prüfung (Zeile 343)
- `MediaRenderer`-Komponente — Bild/Video-Auswahl + Speed-Ramping (Zeilen 372–434)
**Begründung**: Diese Komponente ist semantisch eigenständig (Medien-Ausgabe) und wird nur in der Slideshow-Loop benötigt.

### Datei 4: `slide-utils.ts`
**Inhalt**:
- `HOOK_SECONDS`-Konstante (Zeilen 176–180)
- `getHookSeconds(platform?)` (Zeilen 182–184)
- `calculateDuration(...)` (Zeilen 212–229)
- `HookDimOverlay`-Komponente (Zeilen 191–208)
- `slideStartFrame(idx)` — verschoben aus der Komponente (Zeile 336–337)
**Begründung**: Diese Funktionen sind reine Berechnungshilfen ohne visuelle Logik. `calculateDuration` wird auch exportiert und extern genutzt.

### Datei 5: `effects-setup.ts`
**Inhalt**:
- Die gesamte Effekt-Vorberechnung (Zeilen 436–504):
  - `TRANSITION_FRAMES` (437)
  - `fallbackBeats` (446–452)
  - `effectiveRouteCoords` (455–457)
  - `fx`, `cutFx`, `matchCutMap` (463–467)
  - `whipDir(i)` (469)
  - `locationBadgeTopPct` (475)
  - `videoDuckWindows` (483–490)
  - `heroWordWindows` (496–504)
**Begründung**: Diese Logik ist komplex und eigenständig — sie berechnet alle Effekte basierend auf Props und Plattform. Könnte als Custom Hook `useCinematicEffects(props)` gekapselt werden.

### Datei 6: `slide-loop.tsx`
**Inhalt**:
- Die gesamte Slideshow-Loop (Zeilen 528–635):
  - `slideDefs.map(...)` inkl. aller Effekt-Bedingungen (`hasWhipIn`, `cutPunchHere`, `punchTriggerFrame`, `matchCut` etc.)
  - Die Effekt-Kette (Media → MatchCut → Punch → Whip → FadeOut, Zeilen 563–601)
  - Die `<Sequence>`-Ausgabe pro Slide (Zeilen 604–634)
  - Hook-Bild (Zeilen 516–525)
  - CTA-Hintergrund (Zeilen 638–644)
**Begründung**: Dies ist der komplexeste visuelle Teil (ca. 110 Zeilen). Die Loop könnte als eigenständige Sub-Komponente `SlideshowLoop` ausgegliedert werden.

### Datei 7: `slideshow-layers.tsx`
**Inhalt**:
- Alle Overlay-Schichten, die **nicht** Teil der Slideshow-Loop sind:
  - Schicht 2: ColorGradeOverlay (649) [→ aus layout.tsx]
  - Schicht 3: HookDimOverlay (655–657) [→ aus layout.tsx]
  - Schicht 4: HookTitle (662–672) [→ aus layout.tsx]
  - Schicht 5: LocationBadge (679–689) [→ aus layout.tsx]
  - Schicht 6: PerSlideCaption (694–707) [→ aus layout.tsx]
  - Schicht 7: StoryCaption/Summary (710–724) [→ aus layout.tsx]
  - Schicht 8: manuelle Captions (727–744) [→ aus layout.tsx]
**Begründung**: Diese Schichten sind unabhängig voneinander und könnten als Gruppe betrachtet werden, aber jede einzelne ist nur ~10–30 Zeilen. Zusammen als `SlideshowLayers`-Komponente sinnvoll.

### Datei 8: `overlay-layers.tsx`
**Inhalt**:
- Schicht 9: MojoBusCTA (747–755)
- Schicht 9b: LottieBusIcon (758–773)
- Schicht 9c: CinematicLetterbox (778–785)
- Schicht 10: ProgressBar (788–794)
- Schicht 10b: AudioWaveformBar (797–808)
- Schicht 11: AudioLayer — Musik (811–818)
- Schicht 11b: AudioLayer — Voiceover (824–833)
- Schicht 11c: AudioLayer — Ambient (836–844)
- Schicht 12: BeatSyncLayer (848–858)
- Schicht 13: FlashCut + LightLeak (864–893)
- Schicht 14: StickerPop (899–911)
- Schicht 15: SfxLayer (916–922)
**Begründung**: Diese "finalen" Schichten sind alle additiv und unabhängig voneinander. Sie könnten als Bottom-Overlays zusammengefasst werden.

### Alternative: Reduzierte Aufteilung (6 Dateien statt 8)

| Datei | Enthält |
|-------|---------|
| `types.ts` | Props-Interface (70–166) |
| `slide-utils.ts` | HOOK_SECONDS, getHookSeconds, calculateDuration, HookDimOverlay, slideStartFrame (168–229, 336–337) |
| `media-renderer.tsx` | isVideo, MediaRenderer (343–434) |
| `use-video-effects.ts` | Alle Effekt-Vorberechnungen als Custom Hook `useVideoEffects` (436–504) |
| `slideshow-loop.tsx` | Slideshow-Loop (Bild- + Route-Slides) (506–644) |
| `MojoBusVideo.tsx` | **Stark reduzierte Hauptdatei**: Importe, Props-Destrukturierung, Basisberechnungen (295–340), Einbindung aller Sub-Komponenten + Overlay-Anordnung (646–926) |

---

*Erstellt am: 2025-01-28 – Vollständigkeitsprüfung: Alle Funktionen, Routen, Konstanten und Komponenten aus beiden Dateien erfasst.*
