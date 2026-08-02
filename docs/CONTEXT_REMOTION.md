# Kontext: Remotion / Video-Render / Voiceover

> Nur lesen bei Aufgaben rund um Video-Rendering, TTS, Sync, Cinematic Effects.
> Regeln & Tabus → `AGENTS.md` | Deploy-Schritte → `docs/CONTEXT_DEPLOY.md`

---

## Wichtige Dateien

| Datei | Zweck |
|-------|-------|
| `server/remotion/components/Thumbnail.tsx` | Dedizierte 1920×1080 Thumbnail-Composition für YouTube Longform |
| `server/remotion/render/` | Render-Engine als Modul (`core.js`, `thumbnail.js`, `utils.js`, `index.js`). Video + Thumbnail, slide-genaue MP3s, ffprobe-Sync, concat |
| `server/remotion/MojoBusVideo.tsx` | Remotion-Hauptkomponente (< 500 Zeilen); enthält gemeinsame Schichten und verzweigt auf ShortsLayer / LongformLayer |
| `server/remotion/flows/ShortsLayer.tsx` | 9:16 / 1:1-spezifische Overlays (BeatSync, Waveform, LottieBus, BeatVelocityPunch, PerSlideCaption) |
| `server/remotion/flows/LongformLayer.tsx` | 16:9-spezifische Overlays (CinematicLetterbox, PerSlideCaption) |
| `server/remotion/components/CinematicEffects.tsx` | 6 Schnitt-Effekte (ZoomPunch, WhipPan, FlashCut, LightLeak, Letterbox, MatchCutZoom) |
| `server/remotion/components/KenBurnsImage.tsx` | noise/breathing/focus-in/handheld + GammaFade |
| `server/remotion/components/RouteMapLine.tsx` | Animierte Routen-Karte mit Puls-Ring + Labels |
| `server/remotion/edge.js` | Edge TTS (Seraphina ⭐, Fallback: Piper) |
| `server/remotion/audioNormalize.js` | Zwei-Pass ffmpeg-loudnorm: −14,5 LUFS integrated / −1 dBTP True Peak (Post-Render) |
| `src/lib/routeFromGps.ts` | GPS→Route: Haversine-Dedupe, Nominatim-Geocoding, 9:16-Aspect |

Stack: Remotion v4, Edge TTS, FFmpeg.

---

## Voiceover-System (Edge TTS primär)

**Paket**: `node-edge-tts@^1.2.10` (nicht `edge-tts@1.0.1` – TypeScript-Only!)
**Architektur**: Nur dynamischer `import()` in render.js. Fallback-Kette: Edge → Piper → kein Voiceover.

| Stimme | ID | Typ |
|--------|-----|-----|
| Seraphina ⭐ | `de-DE-SeraphinaMultilingualNeural` | weiblich, beste Qualität (Standard) |
| Florian | `de-DE-FlorianMultilingualNeural` | männlich, sehr natürlich |
| Katja | `de-DE-KatjaNeural` | weiblich, rein Deutsch |
| Conrad | `de-DE-ConradNeural` | männlich, rein Deutsch |
| Amala | `de-DE-AmalaNeural` | weiblich, rein Deutsch |
| Killian | `de-DE-KillianNeural` | männlich, rein Deutsch |
| Gisela | `de-DE-GiselaNeural` | weiblich, rein Deutsch |
| Bernd | `de-DE-BerndNeural` | männlich, rein Deutsch |
| Elke | `de-DE-ElkeNeural` | weiblich, rein Deutsch |
| Ralf | `de-DE-RalfNeural` | männlich, rein Deutsch |
| Tanja | `de-DE-TanjaNeural` | weiblich, rein Deutsch |

**Hinweis zu "Denglisch"/Umlaut**: Seraphina/Florian sind `MultilingualNeural`-
Stimmen, die pro Wort automatisch die Sprache erkennen und dadurch bei
Fremdwörtern/Anglizismen gelegentlich englisch aussprechen bzw. Umlaute
leicht anders betonen können. Klingen aber insgesamt am natürlichsten,
deshalb bewusst als Standard gewählt. Die klassischen Stimmen (Katja, Conrad,
etc.) sind eine Alternative, falls das im Einzelfall stört.

---

## Voiceover-Sync-Architektur (slide-genau, kein Drift)

```
Für jeden Slide:
  slide_N_audio.mp3   (Edge TTS Output)
  slide_N_silence.mp3 (ffmpeg -t exactDuration reine Stille)
  slide_N.mp3 = concat(audio + silence)  → ffprobe misst echte Dauer

perSlideArray = [gemessene_dauer_0, ..., gemessene_dauer_N]
voiceover_sync.mp3 = concat aller slide_N.mp3 mit -c copy (kein Drift)
Video-Slide-Frames = Math.round(echte_dauer × fps)
```

**Regeln**:
- `perSlideArray` muss den RouteMap-Eintrag enthalten
- `calculateDuration()` braucht `showRouteMap` + `platform` als Parameter
- ffmpeg/ffprobe: `/usr/local/bin/` (CentminMod Symlinks) – nie `/opt/bin/` hartcodieren

---

## Cinematic Effects

6 Effekte in `CinematicEffects.tsx` – gesteuert durch `platform`-Prop + `cinematicEffects: true/false`

| Effekt | TikTok | Reels | YouTube |
|--------|--------|-------|---------|
| ZoomPunch | 0.12 stark | 0.07 dezent | aus |
| WhipPan | ✅ | ✅ | ✅ |
| FlashCut | weiß | aus | schwarz |
| LightLeak | aus | ✅ | ✅ |
| Letterbox | 0% | 6% | 8% |
| MatchCutZoom | ✅ | ✅ | ✅ |

---

## Original-Ton + Musik-Ducking

Video-Slides können optional mit Original-Ton statt stumm gerendert werden
(`keepOriginalAudio`). Musik/Atmo werden dafür in `AudioLayer.tsx` per
`duckWindows` nur während dieser Slides automatisch aus- und wieder
eingeblendet, Hook-Vorschau/CTA-Hintergrund bleiben immer stumm.

## Nach Remotion-Änderungen deployen

```bash
bash deploy-main.sh --force
systemctl restart ai-api
curl -X POST http://localhost:3002/api/render-remotion/invalidate-bundle
```

(Bundle-Cache wird zusätzlich automatisch durch deploy-main.sh geleert.)

## Audio-Loudness-Normalisierung

Nach dem Remotion-Render wird die Audiospur mittels Zwei-Pass-ffmpeg-loudnorm auf
**−14,5 LUFS integrated** (Zielkorridor −14 bis −15) und **−1 dBTP True Peak** normalisiert.

**Ablauf**:
1. **Pass 1** – `measureLoudness()`: ffmpeg analayst die aktuelle Loudness (`print_format=json`)
2. **Pass 2** – `applyLoudnorm()`: ffmpeg wendet die gemessenen Werte an (`linear=true`, `-c:v copy`)
3. **Ergebnis**: `{ normalized: true/false, targetI, targetTP, measuredI?, measuredTP?, reason? }`

**Wichtig**:
- Video-Stream bleibt bit-identisch (`-c:v copy`) – keine Qualitätsverluste
- Bei Fehlern bleibt das Originalvideo unverändert (graceful degradation)
- Konfiguration in `src/config/audio.js` (Single Source of Truth)

## Server-Hardware / Performance / GLIBC 2.35

**VPS**: KVM, 4 vCPUs, 8 GB RAM, AlmaLinux 9.8 (CentminMod)

### GLIBC 2.35 Problem
Ab Remotion v4.0 benötigt der integrierte **Compositor** (`@remotion/compositor-linux-x64-gnu`)
mindestens **glibc 2.35**. AlmaLinux 9.8 liefert eine ältere Version, deshalb startet der
Compositor nicht und Remotion fällt auf den langsamen Software-Fallback zurück.

Fehler im Log:
```
Compositor exited with code 1 ... GLIBC_2.35' not found
```

**Folgen**:
- Rendering ist deutlich langsamer (~4 FPS statt 20–50 FPS)
- CPU-Load bleibt niedrig (~1,7–2,2 statt 3–4), weil der Fallback schlechter parallelisiert
- Keine schnelle Lösung ohne Server-Neuaufsetzung oder Remotion v3.x (mit Breaking Changes)

### Aktuelle Render-Einstellungen (Workaround)
In `server/remotion/render/core.js`:

| Einstellung | Wert | Begründung |
|---|---|---|
| `concurrency` | `4` | 4 parallele Chrome-Tabs für bessere Auslastung |
| `imageFormat` | `jpeg` | Schneller als PNG |
| `x264Preset` | `medium` | Kompromiss Geschwindigkeit/Qualität |
| `crf` | `28` | Social-Media-optimale Dateigröße |
| `ffmpegOverride -threads` | `1` | Verhindert, dass FFmpeg alle CPUs frisst |
| `disallowParallelEncoding` | `false` | FFmpeg darf parallel encodieren |
| `offthreadVideoCacheSizeInBytes` | `256 MB` | Reduziert Speicherdruck auf 8 GB RAM |
| `timeoutInMilliseconds` | `60000` | Mehr Zeit für teure Frames |

**Systemd-Limit**: `CPUQuota=300%` im `ai-api.service` verhindert, dass die Load über 4 steigt.

### Prüfen
```bash
# GLIBC-Version
ldd --version

# Chrome-Version
node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell --version

# Remotion-Versionen
npx remotion versions
```

## Debug

```bash
# Voiceover-Sync prüfen:
journalctl -u ai-api -f | grep -i "📐\|perSlideArray\|Frames\|voiceover_sync"

# RouteMap prüfen:
journalctl -u ai-api -f | grep -i "Route\|🗺️"

# ffprobe Pfad:
which ffprobe  # → /usr/local/bin/ffprobe

# Loudness-Normalisierung prüfen:
journalctl -u ai-api -f | grep -i "loudnorm\|LUFS\|dBTP"
