# STRUKTURANALYSE: render.js + MojoBusVideo.tsx

---

## 1. LOGISCHE BEREICHE

### render.js (1376 Zeilen)

| Bereich | Beschreibung | Zeilen |
|---|---|---|
| **A. Imports & Setup** | Node-Module-Imports, `__dirname`, Pfadauflösung | 1–48 |
| **B. Voiceover-Segment-Generierung** | Einzelne TTS-MP3s pro Segment via Edge/Piper | 50–143 |
| **C. Voiceover-Concat & Sync** | Segmente zu einer getakteten `voiceover_sync.mp3` zusammenfügen inkl. Lückenfüller | 151–327 |
| **D. Weitere Imports** | videoDuration, ambient, sfx, audioNormalize, Verzeichnis-Konstanten | 329–351 |
| **E. Lokaler HTTP-Server** | Temporärer HTTP-Server mit Range-Request-Support (206 Partial Content) | 353–468 |
| **F. Chrome/Chromium-Setup** | Chrome-Binary finden, Berechtigungen setzen, Chromium-Optionen | 470–537 |
| **G. Bundle-Cache** | Remotion-Webpack-Bundle cachen mit Retry bei esbuild-Abstürzen | 539–595 |
| **H. Download-Funktionen** | Bilder, Audio, Karten von URLs herunterladen, Extensions erkennen, Faststart | 597–922 |
| **I. Haupt-Render-Funktion** | `renderMojoBusVideo`: gesamter Render-Prozess (Download → Server → Bundle → Render → Normalize → Cleanup) | 924–1343 |
| **J. Export-Funktionen** | `invalidateBundleCache`, `cleanupRender`, `cleanupOldRenders` | 1345–1375 |

### MojoBusVideo.tsx (928 Zeilen)

| Bereich | Zeilen |
|---|---|
| **A. Imports** | React/Remotion, alle Subkomponenten (KenBurnsImage, ColorGrade, HookTitle, AudioLayer, BeatSync, CinematicEffects usw.) | 1–67 |
| **B. Props Interface** | `MojoBusVideoProps` – vollständiges Typsystem mit allen Parametern für v2.0 | 70–166 |
| **C. Hook-Konfiguration** | `HOOK_SECONDS`-Map (plattformabhängig), `getHookSeconds()` | 168–184 |
| **D. HookDimOverlay** | Interne Komponente zur Abdunkelung des Hook-Slides | 191–208 |
| **E. calculateDuration** | Externe Funktion zur Berechnung der Gesamt-Frames | 212–229 |
| **F. Haupt-Komponente MojoBusVideo** | Die gesamte Composition mit 15+ Layern | 233–927 |

---

## 2. INVENTAR

### render.js

#### Bereich A: Imports & Setup

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 10–22 | Imports (bundle, renderMedia, selectComposition, ensureBrowser, path, fs, child_process, crypto, http, https, promisify) | A | Alle Node.js-und Remotion-Imports |
| 24 | `__dirname` | A | Ermittelt das aktuelle Verzeichnis via `import.meta.url` |
| 28–39 | `findBinary(name)` | A | Sucht ffmpeg/ffprobe in statischen CentminMod-Pfaden und via `command -v` |
| 40–41 | `FFMPEG_PATH`, `FFPROBE_PATH` | A | Finale Binary-Pfade (Umgebungsvariable oder automatisch gefunden) |
| 48 | `FFPROBE` | A | Alias für `FFPROBE_PATH` (für Funktionen, die den alten Namen nutzen) |

#### Bereich B: Voiceover-Segment-Generierung

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 50–143 | `generateVoiceoverSegments(segments, voiceoverModel, voiceoverSpeed, effectiveEngine, sessionDir)` | B | Generiert für jeden Text ein TTS-MP3 (Edge TTS oder Piper), misst die Dauer via ffprobe und kopiert die Datei ins sessionDir |

#### Bereich C: Voiceover-Concat & Sync

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 151–327 | `concatVoiceoverSegments(segments, sessionDir, hookDurationSec, secondsPerImage, bridgeDurationSec, muteBodyIndex, routeSlideIndex, routeDuration, videoDurations)` | C | Erzeugt aus Einzel-MP3s eine getaktete `voiceover_sync.mp3` (slide-genaue Längen, Stille-Füller, RouteMap-Stille) und retourniert `{ voiceoverFilename, perSlideArray }` |

#### Bereich D: Weitere Imports & Konstanten

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 329 | `measureSlideVideoDurations`, `isVideoFilename` (Import) | D | Importiert Video-Clip-Längen-Messung |
| 332 | `generateAmbient` (Import) | D | Importiert Atmo-Generierung |
| 335 | `generateSfx`, `SFX_TYPES` (Import) | D | Importiert SFX-Generierung |
| 338 | `normalizeRenderedVideo` (Import) | D | Importiert Loudness-Normalisierung |
| 340–341 | `OUTPUT_DIR`, `IMAGES_DIR` | D | Temp-Verzeichnisse für Render-Output und Bilder |
| 343–345 | Verzeichnis-Anlage | D | Erstellt OUTPUT_DIR/IMAGES_DIR falls nicht vorhanden |
| 347–351 | `COMPOSITION_IDS` | D | Mapping von Aspect-Ratio zu Composition-Namen |
| 356–367 | `MIME_TYPES` | D | MIME-Type-Map für den HTTP-Server (Bilder, Audio, Video) |

#### Bereich E: Lokaler HTTP-Server

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 381–468 | `startImageServer(serveDir)` | E | Startet einen temporären HTTP-Server mit Range-Request-Support (206 Partial Content) für Video-Seeking, liefert sessionDir aus, retourniert `{ port, close }` |

#### Bereich F: Chrome/Chromium-Setup

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 472–504 | `findAndFixChrome()` | F | Sucht Chrome-Headless-Shell in node_modules, setzt Ausführungsrechte (chmod 755) |
| 506–507 | `CHROME_PATH` | F | Initialisiert Chrome-Path (null wenn nicht gefunden) |
| 509–522 | `CHROMIUM_OPTIONS` | F | Chromium-Flags: swiftshader, no-sandbox, disable-gpu, single-process, etc. |
| 524–537 | `ensureChromeBinary()` | F | Stellt sicher, dass Chrome-Binary verfügbar ist, setzt Rechte rekursiv |

#### Bereich G: Bundle-Cache

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 541–544 | `bundleCache`, `isBundling`, `bundleQueue`, `bundleAttempts` | G | Globale Cache-Variablen für das Remotion-Bundle |
| 546–595 | `getBundledEntry()` | G | Bundelt die Remotion-Entry (`index.tsx`) via `@remotion/bundler`, cacht das Ergebnis, queue-t parallele Aufrufe, retry bei esbuild-EPIPE (max 3 Versuche) |

#### Bereich H: Download-Funktionen

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 599–619 | `getImageExtension(url, contentType)` | H | Ermittelt Dateiendung aus Content-Type oder URL für Bilder und Videos |
| 621–671 | `downloadFileWithType(url, destPath, attempt = 1)` | H | Lädt eine Datei (Bild/Audio/Video) von HTTP(S) herunter, folgt Redirects, prüft Mindestgröße, retry bei Fehler (max 3) |
| 676 | `FASTSTART_EXTENSIONS` | H | Set mit `.mp4`, `.mov` – Container, die Faststart brauchen |
| 703–749 | `ensureFaststart(filePath)` | H | Stellt Faststart für MP4/MOV sicher: remuxt H.264→+faststart, re-encoded HEVC/VP9→H.264 (Chrome kann kein HEVC/VP9) |
| 751–806 | `downloadAllImages(imageUrls, sessionDir)` | H | Lädt alle Bilder/Videos parallel herunter, wendet ensureFaststart an, Fallback bei Fehlschlag |
| 820–901 | `downloadAudioFile(url, sessionDir, localMusicDir)` | H | Lädt Audio herunter (3 Fälle: lokaler Pfad, localhost-API, HTTP-URL) |
| 905–922 | `downloadMapImage(url, sessionDir)` | H | Lädt das Karten-Hintergrundbild herunter |

#### Bereich I: Haupt-Render-Funktion

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 926–1343 | `renderMojoBusVideo(params)` | I | Haupt-Render-Funktion: Extrahiert alle Parameter (Z. 927–985), validiert Eingaben (Z. 987–989), erstellt sessionDir (Z. 991–997), lädt Bilder/Audio/Karte parallel (Z. 999–1012), misst Video-Clip-Längen (Z. 1017), berechnet perSlideArray (Z. 1033–1053), generiert Voiceover+Concat (Z. 1055–1109), generiert Ambient (Z. 1111–1124), generiert SFX (Z. 1126–1139), startet HTTP-Server (Z. 1145–1203), erstellt inputProps, selectComposition, renderMedia (Z. 1209–1295), Loudness-Normalisierung (Z. 1300–1315), erstellt renderResult (Z. 1320–1325), Server-Stop + Cleanup (Z. 1331–1343) |

#### Bereich J: Export-Funktionen

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 1347–1350 | `invalidateBundleCache()` | J | Setzt den Bundle-Cache zurück (für erzwungenes Re-Bundle) |
| 1352–1358 | `cleanupRender(outputPath)` | J | Löscht eine einzelne Render-Output-Datei |
| 1360–1375 | `cleanupOldRenders(maxAgeMs = 24h)` | J | Löscht alle Render-Dateien und Image-Verzeichnisse, die älter als 24h sind |

---

### MojoBusVideo.tsx

#### Bereich A: Imports

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 16–17 | React, AbsoluteFill, Sequence, useVideoConfig, useCurrentFrame, Video | A | Core React/Remotion-Imports |
| 19 | KenBurnsImage, pickDirection, GammaFade | A | Ken-Burns-Effekt-Komponente mit Richtungsauswahl und Gamma-Fade |
| 20 | ColorGradeOverlay, ColorGradeWrapper, lifestyleToGrade, ColorGrade | A | Farbkorrektur-Overlay und Wrapper |
| 21 | HookTitle | A | Titel-Overlay für den Hook-Bereich |
| 22 | LocationBadge | A | Ortsangabe-Badge |
| 23 | MojoBusCTA | A | Endkarten-CTA-Komponente |
| 24 | ProgressBar | A | Fortschrittsbalken |
| 25 | AudioLayer | A | Audio-Wiedergabe (Musik, Voiceover, Ambient) |
| 26 | FadeIn, FadeOut | A | Überblend-Effekte |
| 27 | StoryCaption | A | Manuelle Text-Untertitel |
| 28 | PerSlideCaption, CaptionStyle | A | Automatische Per-Slide-Untertitel |
| 29 | LoadFonts | A | Schriftarten-Lader |
| 33–36 | BeatSyncLayer, AudioWaveformBar, generateFallbackBeats | A | Beat-Synchronisation und Waveform-Anzeige |
| 38–41 | TransitionWrapper, WipeEdgeGlow, TransitionType | A | Übergangseffekte zwischen Slides |
| 43–46 | RouteMapLine, pickDemoRoute, RouteCoord | A | Animierte Routen-Linie auf Karte |
| 47 | LottieBusIcon | A | Animierter Lottie-Bus für Endkarte |
| 52–63 | getPlatformEffects, pickCutEffect, buildMatchCutMap, ZoomPunchWrapper, WhipPanWrapper, FlashCut, flashCutDuration, LightLeak, lightLeakDuration, CinematicLetterbox, MatchCutZoomWrapper | A | Cinematic Effects (Plattform-Matrix) |
| 64 | pickStickerForCut, StickerPop, stickerPopDuration | A | Sticker-Pops an Cut-Punkten |
| 65 | buildSfxCues, SfxLayer | A | Sound-SFX auf Cuts |
| 66 | findHeroWordWindow | A | Hero-Wort-Erkennung für Caption-Zoom |

#### Bereich B: Props Interface

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 70–166 | `MojoBusVideoProps` | B | Vollständiges Props-Interface mit allen v2.0-Parametern: imageUrls, title, summary, location, country, lifestyle, musicUrl, secondsPerImage, aspectRatio, colorGrade, captions, captionStyle, platform, websiteUrl, handle, accentColor, motionBlurStrength, voiceoverUrl, perSlideArray, voiceoverVolume, ambientUrl, hookCaption, ctaText, beatSyncStrength, beatThreshold, showWaveformBar, transitionType, showRouteMap, routeCoords, mapImageUrl, showLottieBus, cinematicEffects, keepOriginalAudio, stickersEnabled, sfxEnabled, sfxUrls, speedRampEnabled |

#### Bereich C: Hook-Konfiguration

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 176–180 | `HOOK_SECONDS` | C | Konstante: Hook-Dauer pro Plattform (TikTok 3s, Reels 4s, YouTube 5s) |
| 182–184 | `getHookSeconds(platform?)` | C | Gibt die Hook-Dauer in Sekunden für die angegebene Plattform zurück |

#### Bereich D: HookDimOverlay

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 191–208 | `HookDimOverlay` | D | Interne React-Komponente: gleichmäßige Abdunkelung des Hook-Slides mit sanftem Fade-in (0.4s) und Fade-out (0.5s) |

#### Bereich E: calculateDuration

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 212–229 | `calculateDuration(imageCount, fps, secondsPerImage, perSlideArray?, showRouteMap?, platform?)` | E | Berechnet `{ totalFrames, hookFrames, ctaFrames, slideshowFrames }` aus Bildanzahl, FPS, und Optionen – inkl. dynamischer perSlideArray-Unterstützung |

#### Bereich F: Haupt-Komponente MojoBusVideo

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 233–294 | `MojoBusVideo` (Komponenten-Deklaration + Destrukturierung) | F | Hauptkomponente mit Default-Werten für alle Props |
| 295 | `useVideoConfig()` | F | Liest fps und durationInFrames aus der Remotion-Konfiguration |
| 297–298 | `grade`, `images`, `imageCount` | F | Bereitet Farbkorrektur und Bild-Array vor (max 20 Bilder) |
| 303–311 | `hasRouteMap`, `routeSlideIndex`, `totalSlideCount`, `slidesSec`, `slidesFrames` | F | Berechnet Slide-Index und Frame-Zahlen inkl. optionalem RouteMap-Slide |
| 313–314 | `hookFrames`, `ctaFrames` | F | Frame-Zahlen für Hook und CTA |
| 317–319 | `routeDurFrames` | F | Frame-Dauer des RouteMap-Slides |
| 324–340 | `slideDefs` | F | Baut das flache Slide-Array (`type: 'image'` oder `type: 'route'`) mit Frame-Zahlen |
| 336–337 | `slideStartFrame(idx)` | F | Berechnet den Start-Frame eines Slides aus dem offset |
| 340 | `perSlide` | F | Legacy perSlide-Wert |
| 343 | `isVideo(url)` | F | Erkennt Video-URLs an der Extension (.mp4, .webm, .mov, .avi, .mkv) |
| 372–434 | `MediaRenderer` | F | Interne Komponente: rendert Video (mit optionalem Speed-Ramp) oder KenBurnsImage je nach URL-Typ |
| 437 | `TRANSITION_FRAMES` | F | Konstante: 20 Frames (0.67s bei 30fps) für Überblendungen |
| 441 | `hookEmoji` | F | Konstante: Emoji im Hook (leer – roher Foster-Look) |
| 443 | `hasCaptions` | F | Boolean: ob Captions aktiv sind |
| 446–452 | `fallbackBeats` | F | Fallback-Beats für BeatSyncLayer vorberechnen |
| 455–457 | `effectiveRouteCoords` | F | Routen-Koordinaten (aus Props oder Demo-Route per Land) |
| 463–467 | `fx`, `cutFx`, `matchCutMap` | F | Cinematic Effects: Plattform-Matrix, Cut-Plan, Match-Cut-Map |
| 469 | `whipDir(i)` | F | WhipPan-Richtung (deterministisch alternierend left/right) |
| 475 | `locationBadgeTopPct` | F | Top-Offset für LocationBadge unterhalb Letterbox |
| 483–490 | `videoDuckWindows` | F | Duck-Fenster für Musik/Atmo während Video-Slides mit Original-Audio |
| 496–504 | `heroWordWindows` | F | Hero-Wort-Fenster pro Slide (Caption-Text mit `**...**`) |

**Layer 1 – Bilder mit Ken Burns + Transitions:**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 510 | `<LoadFonts />` | F | Lädt Schriftarten |
| 513 | `<ColorGradeWrapper grade={grade}>` | F | Farbkorrektur-Wrapper um den gesamten Bild-Layer |
| 516–525 | **Hook-Slide** (erstes Bild + FadeOut) | F | Sequenz: erstes Bild mit Ausblendung über TRANSITION_FRAMES |
| 528–635 | **Slideshow** (alle Bilder + RouteMap + Transitions + Cinematic Effects) | F | Dynamische Sequenz-Schleife über `slideDefs` mit:
| 533–534 | `seqDuration` | F | Dauer inkl. TRANSITION_FRAMES für Übergang |
| 542–560 | `hasWhipIn`, `hasWhipOut`, `punchHere`, `punchTriggerFrame`, `matchCut` | F | Cinematic-Effekt-Berechnungen pro Slide |
| 563–601 | `slideContent` (Effekt-Kette) | F | Schachtelt: MediaRenderer → MatchCutZoom → ZoomPunch → WhipPan |
| 603–633 | `<Sequence>` pro Slide | F | Rendert entweder `RouteMapLine` oder Bild mit `FadeOut` + optionalem `WipeEdgeGlow` |
| 638–644 | **CTA Hintergrund** (letztes Bild + FadeIn) | F | Letztes Bild mit sehr langsamem Zoom für die Endkarte |

**Layer 2 – Color Grade Overlay:**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 649 | `<ColorGradeOverlay grade={grade} />` | F | Farbkorrektur-Overlay über allen Bildern |

**Layer 3 – Hook-Abdunkelung:**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 655–657 | `<HookDimOverlay>` | F | Gleichmäßige Abdunkelung (0.40) während des Hook-Slides |

**Layer 4 – Hook Titel:**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 662–672 | `<HookTitle>` | F | Titel-Overlay mit plattformabhängiger Dauer (sofort sichtbar) |

**Layer 5 – Location Badge:**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 679–690 | `<LocationBadge>` | F | Ortsangabe oben links unterhalb Letterbox |

**Layer 6 – Per-Slide Captions (Auto-Captions):**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 694–707 | `<PerSlideCaption>` | F | Dynamische, synchrone Untertitel pro Slide |

**Layer 7 – Summary Subtitle:**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 710–724 | `<StoryCaption>` (Summary) | F | Zusammenfassungs-Text in der Mitte der Slideshow (nur ohne Captions) |

**Layer 8 – Manuelle Captions:**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 727–744 | Manuelle `<StoryCaption>`-Schleife | F | Einzelne Caption-Texte (wenn AutoCaptions aus) |

**Layer 9 – CTA Endkarte:**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 747–755 | `<MojoBusCTA>` | F | Endkarte mit Website, Handle, CTA-Text |

**Layer 9b – Lottie Bus in CTA:**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 758–774 | `<LottieBusIcon>` | F | Animierter Lottie-Bus in der Endkarte (drive-in Effekt) |

**Layer 9c – Cinematic Letterbox:**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 779–786 | `<CinematicLetterbox>` | F | Schwarze Balken oben/unten (Reels 6%, YouTube 8%), fahren ein/aus |

**Layer 10 – Progress Bar:**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 789–795 | `<ProgressBar>` | F | Fortschrittsbalken oben während der Slideshow |

**Layer 10b – Waveform Bar:**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 798–809 | `<AudioWaveformBar>` | F | Optionale Wellenform-Anzeige (unten) |

**Layer 11 – Audio (Musik):**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 812–819 | `<AudioLayer>` (Musik) | F | Hintergrundmusik mit Ducking während Video-Clips mit Original-Audio |

**Layer 11b – Audio (Voiceover):**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 825–834 | `<AudioLayer>` (Voiceover) | F | Voiceover startet synchron mit der Slideshow (nach Hook) |

**Layer 11c – Audio (Ambient/Atmo):**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 837–845 | `<AudioLayer>` (Ambient) | F | Leise Hintergrund-Atmo (Meer, Regen, Wind etc.) |

**Layer 12 – Beat-Sync Flash:**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 848–859 | `<BeatSyncLayer>` | F | Beat-synchrone Flash-Effekte zur Musik |

**Layer 13 – FlashCut + LightLeak:**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 865–894 | `<FlashCut>` / `<LightLeak>` | F | Blitz- oder Licht-Effekte auf den Cuts (Plattform-Matrix-gesteuert) |

**Layer 14 – Sticker/Emoji-Pops:**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 900–912 | `<StickerPop>`-Schleife | F | Animierte Emoji-Pops an Cut-Punkten (Beta, gated hinter `stickersEnabled`) |

**Layer 15 – Sound-SFX:**

| Zeile | Name | Bereich | Beschreibung |
|---|---|---|---|
| 917–923 | `<SfxLayer>` | F | Whoosh/Ding/Impact auf Cuts (Beta, gated hinter `sfxEnabled`) |

---

## 3. ZUSAMMENFASSUNG DER ABHÄNGIGKEITEN

```
render.js ruft auf:
  ├── generateVoiceoverSegments()     → edge.js / tts.js
  ├── concatVoiceoverSegments()       → ffmpeg/ffprobe
  ├── measureSlideVideoDurations()    → videoDuration.js
  ├── generateAmbient()               → ambient.js
  ├── generateSfx()                   → sfx.js
  ├── startImageServer()              → http (built-in)
  ├── findAndFixChrome()              → fs / child_process
  ├── ensureChromeBinary()            → @remotion/renderer
  ├── getBundledEntry()               → @remotion/bundler
  ├── downloadAllImages()             → https / http / fs
  ├── downloadAudioFile()             → https / http / fs
  ├── downloadMapImage()              → https / http / fs
  ├── normalizeRenderedVideo()        → audioNormalize.js
  ├── selectComposition()             → @remotion/renderer
  └── renderMedia()                   → @remotion/renderer (mit Bundle + Chrome)

MojoBusVideo.tsx rendert:
  ├── LoadFonts
  ├── ColorGradeWrapper → ColorGradeOverlay
  │   ├── Hook (FadeOut + MediaRenderer)
  │   ├── Slideshow (Sequence-Schleife)
  │   │   ├── RouteMapLine (optional)
  │   │   ├── FadeOut + MediaRenderer
  │   │   │   ├── KenBurnsImage (Bild)
  │   │   │   └── Video (Video-Clip, optional Speed-Ramp)
  │   │   ├── MatchCutZoomWrapper
  │   │   ├── ZoomPunchWrapper
  │   │   ├── WhipPanWrapper
  │   │   └── WipeEdgeGlow
  │   └── CTA (FadeIn + MediaRenderer)
  ├── HookDimOverlay
  ├── HookTitle
  ├── LocationBadge
  ├── PerSlideCaption
  ├── StoryCaption (Summary / manuelle Captions)
  ├── MojoBusCTA
  ├── LottieBusIcon
  ├── CinematicLetterbox
  ├── ProgressBar
  ├── AudioWaveformBar
  ├── AudioLayer (Musik)
  ├── AudioLayer (Voiceover)
  ├── AudioLayer (Ambient)
  ├── BeatSyncLayer
  ├── FlashCut / LightLeak (pro Cut)
  ├── StickerPop (pro Cut)
  └── SfxLayer
```