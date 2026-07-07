# Kontext: Remotion / Video-Render / Voiceover

> Nur lesen bei Aufgaben rund um Video-Rendering, TTS, Sync, Cinematic Effects.
> Regeln & Tabus → `AGENTS.md` | Deploy-Schritte → `docs/CONTEXT_DEPLOY.md`

---

## Wichtige Dateien

| Datei | Zweck |
|-------|-------|
| `server/remotion/render.js` | Render-Engine: slide-genaue MP3s, ffprobe-Sync, concat |
| `server/remotion/MojoBusVideo.tsx` | Remotion-Hauptkomponente |
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
| Seraphina ⭐ | `de-DE-SeraphinaMultilingualNeural` | weiblich, beste |
| Florian | `de-DE-FlorianMultilingualNeural` | männlich |
| Amala | `de-DE-AmalaNeural` | weiblich |

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
