# Implementierungsplan: Audio-Loudness-Normalisierung (−14 bis −15 LUFS integrated, −1 dBTP)

> Ziel: Alle von Remotion gerenderten Videos (TikTok/Reels/YouTube) erhalten nach dem
> Render einen zweiten, audio-only Nachbearbeitungsschritt, der die Musik-/Voiceover-/
> Ambient-Mischung auf **−14,5 LUFS integrated** (Zielkorridor −14 bis −15) und
> **−1 dBTP True Peak** normalisiert – konsistent mit YouTube/TikTok/Instagram-Loudness-Standards.
> Der Video-Stream wird dabei NICHT neu encodiert (`-c:v copy`) → keine Qualitätsverluste,
> keine Frame-/Timing-Änderungen an der Remotion-Composition.

---

## ⚠️ Hinweis zu AGENTS.md-Tabus

- `src/config/prompts/` wird **nicht** berührt (kein KI-Prompt betroffen).
- `server/` wird geändert – gemäß AGENTS.md Regel nur mit explizitem Auftrag. Der User-Auftrag
  „Implementierungsplan für −14 bis −15 LUFS / −1 dBTP" **ist** dieser explizite Auftrag, da
  Loudness-Normalisierung ausschließlich in der Render-Pipeline (`server/remotion/`) umsetzbar
  ist. Vor der eigentlichen Code-Umsetzung (nach diesem Plan) sollte das trotzdem kurz mit dem
  User bestätigt werden.
- Neue Konfiguration (Zielwerte) kommt nach `src/config/` (Regel 1) – als `.js`-Datei, weil
  `server/` (Node, kein Build-Step) sie direkt per ESM-`import` laden muss, genauso wie es bei
  `src/config/prompts/*.js` bereits gehandhabt wird.
- Es entstehen keine neuen Browser-`fetch()`-Calls → `getApiBaseUrl()`/`getDataBaseUrl()`-Regel
  ist nicht betroffen (die ffmpeg-Normalisierung läuft serverseitig, nicht über eine neue Route).
  Bereits bestehende `/api/render-remotion/status/:jobId`-Route wird nur um ein Response-Feld
  erweitert, keine neue URL.
- ffmpeg/ffprobe-Pfade: bestehende `findBinary()`/`FFMPEG_PATH`/`FFPROBE_PATH`-Logik aus
  `render.js` wird wiederverwendet (kein neues Hardcoding von `/opt/bin/` o.ä.).

---

## 1. Liste aller zu ändernden/neuen Dateien

| # | Datei | Status |
|---|-------|--------|
| 1 | `src/config/audio.js` | **NEU** |
| 2 | `server/remotion/audioNormalize.js` | **NEU** |
| 3 | `server/remotion/render.js` | Änderung |
| 4 | `server/server.js` | Änderung |
| 5 | `src/pages/TikTokPromotion.tsx` | Änderung |
| 6 | `src/components/RemotionVideoBlock.tsx` | Änderung |
| 7 | `docs/CONTEXT_REMOTION.md` | Änderung (Dokumentation) |

---

## 2. Pro Datei: was geändert wird und warum

### 2.1 `src/config/audio.js` (NEU)

**Zweck**: Single Source of Truth für alle Loudness-Zielwerte – niemals Werte wie `-14.5`
oder `-1.0` direkt in `render.js`/`audioNormalize.js` hartcodieren (Regel 1).

Inhalt (Konstanten, keine Logik):

- `LOUDNESS_TARGET_I = -14.5` (LUFS integrated, Mitte des geforderten Korridors −14 … −15)
- `LOUDNESS_TARGET_TP = -1.0` (dBTP True Peak)
- `LOUDNESS_TARGET_LRA = 11` (Loudness Range – ffmpeg-loudnorm-Standardwert, sinnvoll für
  Voiceover+Musik-Mix mit moderater Dynamik)
- `LOUDNESS_OUTPUT_SAMPLE_RATE = 48000` (loudnorm arbeitet intern bei 192 kHz-Analyse,
  Standard-Output 48 kHz für AAC/MP4)
- `LOUDNESS_OUTPUT_AUDIO_CODEC = 'aac'`
- `LOUDNESS_OUTPUT_AUDIO_BITRATE_KBPS = 192`
- `LOUDNESS_PASS_TIMEOUT_MS_PER_SEC = 4000` (Sicherheitsfaktor für dynamisches Timeout:
  `timeout = videoDurationSec * 4000`, siehe Abschnitt 4)

Export sowohl als benanntes Objekt `AUDIO_LOUDNESS_CONFIG` als auch Einzel-Exports, damit
sowohl `import { AUDIO_LOUDNESS_CONFIG } from '../../src/config/audio.js'` (Node/server) als
auch ein potenzieller Frontend-Import (`@/config/audio`) funktioniert.

---

### 2.2 `server/remotion/audioNormalize.js` (NEU)

**Zweck**: Isoliertes Modul (analog zu `ambient.js`) für die Zwei-Pass-ffmpeg-loudnorm-Logik.
Hält `render.js` schlank und macht die Normalisierung unabhängig testbar.

**Was es enthält (Funktionsbeschreibung, kein Code):**

1. `findFfmpeg()` / Pfad-Übergabe – **kein eigenes Binary-Discovery**, sondern `FFMPEG_PATH`
   und `FFPROBE_PATH` werden von `render.js` als Parameter durchgereicht (keine doppelte
   Pfad-Logik, keine neue Hardcoding-Stelle).

2. `measureLoudness(inputPath, ffmpegPath, targetConfig)`
   - Pass 1: `ffmpeg -i <input> -af loudnorm=I=<I>:TP=<TP>:LRA=<LRA>:print_format=json -f null -`
   - Liest `stderr`, extrahiert das JSON-Objekt (loudnorm schreibt es als letzten Block nach
     stderr) via Regex `/\{[\s\S]*\}/`.
   - Gibt `{ measured_I, measured_TP, measured_LRA, measured_thresh, offset }` zurück (alle als
     `parseFloat`).
   - Fehlerfall (Parse schlägt fehl / ffmpeg exit ≠ 0): wirft Error → Aufrufer fällt auf
     „unnormalisiert lassen" zurück (siehe 2.3).

3. `applyLoudnorm(inputPath, outputPath, measured, ffmpegPath, targetConfig)`
   - Pass 2: `ffmpeg -y -i <input> -c:v copy -af "loudnorm=I=<I>:TP=<TP>:LRA=<LRA>:measured_I=<measured_I>:measured_TP=<measured_TP>:measured_LRA=<measured_LRA>:measured_thresh=<measured_thresh>:offset=<offset>:linear=true:print_format=summary" -ar <sampleRate> -c:a <codec> -b:a <bitrate>k -movflags +faststart <output>`
   - `-c:v copy`: Video-Stream bleibt bit-identisch (keine Re-Encodierung, kein Frame-Verlust,
     keine Timing-Verschiebung).
   - `linear=true`: bevorzugt lineare Verstärkung (reine Gain-Anwendung) statt dynamischer
     Kompression – erhält die Original-Dynamik der Musik/Voiceover-Mischung. ffmpeg fällt
     automatisch auf dynamische Normalisierung zurück, falls durch die Verstärkung der
     True-Peak-Grenzwert überschritten würde (wird geloggt, kein Fehler).
   - `-movflags +faststart`: MP4-Metadaten an den Dateianfang (wichtig fürs Streaming beim
     Download via `/api/render-remotion/download/:jobId`).

4. `normalizeRenderedVideo(outputPath, sessionDir, ffmpegPath, ffprobePath, videoDurationSec)`
   – Orchestrierungs-Funktion, die `render.js` aufruft:
   - Ziel-Timeout dynamisch: `Math.max(30000, videoDurationSec * LOUDNESS_PASS_TIMEOUT_MS_PER_SEC)`
     je Pass (da `-c:v copy` sehr schnell ist, reicht i.d.R. deutlich weniger als Echtzeit,
     Sicherheitsfaktor 4× deckt langsame VPS-I/O ab).
   - Temp-Datei: `<sessionDir>/normalized.mp4` (liegt im ohnehin per Timeout gelöschten
     `sessionDir`, kein zusätzliches Cleanup nötig).
   - Bei Erfolg: `fs.renameSync(tempPath, outputPath)` → Original wird durch normalisierte
     Version ersetzt (gleicher Dateiname, gleicher Pfad → keine Änderung an
     `job.outputPath`/Download-Route nötig).
   - Bei Fehler in Pass 1 oder Pass 2: Warnung loggen, **Original-Datei unverändert lassen**,
     `{ normalized: false, reason: err.message }` zurückgeben – Render-Job schlägt NICHT fehl,
     nur die Loudness-Info fehlt.
   - Rückgabe bei Erfolg: `{ normalized: true, targetI, targetTP, measuredI, measuredTP }`.

---

### 2.3 `server/remotion/render.js` (Änderung)

**Was geändert wird:**

1. **Neuer Import** (nach Zeile 322, wo `ambient.js` importiert wird):
   - `import { normalizeRenderedVideo } from './audioNormalize.js';`
   - `import { AUDIO_LOUDNESS_CONFIG } from '../../src/config/audio.js';`

2. **Nach erfolgreichem `renderMedia()`-Call** (aktuell Zeile ~1035-1045, direkt nach
   `console.log('[Remotion] ✅ Fertig: ...')` und **vor** dem Befüllen von `renderResult`):
   - Aufruf `await normalizeRenderedVideo(outputPath, sessionDir, FFMPEG_PATH, FFPROBE_PATH, composition.durationInFrames / composition.fps)`.
   - Ergebnis in eine lokale Variable `loudnessInfo` schreiben.
   - `fileSizeMB` muss NACH der Normalisierung neu berechnet werden (Dateigröße ändert sich
     minimal durch AAC-Re-Encoding der Audiospur, z. B. 192 kbps statt Remotion-Default) – die
     bestehende Zeile `const sizeMB = (fs.statSync(outputPath).size / ...)` muss deshalb NACH
     dem Normalisierungs-Schritt stehen, nicht davor.

3. **`renderResult`-Objekt erweitern** um:
   ```
   loudness: loudnessInfo   // { normalized, targetI, targetTP, measuredI?, measuredTP?, reason? }
   ```

4. **Fehlerbehandlung**: Normalisierung läuft in eigenem `try/catch` – ein Fehler dort darf
   NIEMALS den gesamten Render-Job auf `failed` setzen (Video ist ja bereits fertig gerendert).
   Bei Fehler: `loudnessInfo = { normalized: false, reason: err.message }`, Warnung loggen,
   weiter mit unverändertem `outputPath`.

5. **Kein Einfluss auf `inputProps`, `calculateDuration()`, `MojoBusVideoProps` oder irgendeine
   Frame-Berechnung** – die Normalisierung passiert erst NACHDEM `composition.durationInFrames`
   bereits feststeht und das MP4 fertig geschrieben ist. Es ändert sich ausschließlich der
   Audio-Stream-Inhalt (Lautstärke/Codec/Bitrate), nicht die Anzahl der Video-Frames.

---

### 2.4 `server/server.js` (Änderung)

**Was geändert wird:**

1. Nach `const result = await renderer.renderMojoBusVideo({...})` (aktuell Zeile ~2323):
   - `job.loudness = result.loudness || null` zusätzlich zu den bestehenden
     `job.outputPath/fileSizeMB/videoDurationSec/frames`-Zuweisungen.

2. **GET `/api/render-remotion/status/:jobId`** (aktuell Zeile ~2397-2412):
   - Response-Objekt um `loudness: job.loudness || null` erweitern.
   - Keine neue Route, keine neue fetch-URL → `getApiBaseUrl()`-Regel nicht betroffen (bestehende
     Route wird nur um ein Feld reicher).

3. **GET `/api/render-remotion/history`** (aktuell Zeile ~2487-2508):
   - Analog `loudness: job.loudness || null` ins gemappte Objekt aufnehmen (damit die
     History-Liste im Frontend die Loudness-Info nachträglich anzeigen kann).

4. Kein Eingriff in Prompt-Importe (`../src/config/prompts/index.js` bleibt unberührt) und
   keine Änderung an bestehenden Body-Parametern von `POST /api/render-remotion`.

---

### 2.5 `src/pages/TikTokPromotion.tsx` (Änderung)

**Betroffenes Interface** (Zeile 108-115):

```
interface RenderStatus {
  jobId: string
  status: 'queued' | 'rendering' | 'completed' | 'failed'
  progress: number
  fileSizeMB: number | null
  videoDurationSec: number | null
  error: string | null
  loudness?: {                 // NEU
    normalized: boolean
    targetI?: number
    targetTP?: number
    measuredI?: number
    measuredTP?: number
    reason?: string
  } | null
}
```

**Warum**: Die Polling-Funktion `startPolling()` (Zeile 778-815) merged bereits das komplette
Status-Response-Objekt via `setRenderStatus(prev => prev ? { ...prev, ...data } : null)` –
`loudness` kommt also automatisch mit, sobald es in der Server-Response existiert. Es muss nur
im Interface deklariert werden (sonst TS-Fehler bei `strict`-Zugriffen).

**UI-Ergänzung**: Im „Fertig"-Zustand (dort wo aktuell `${data.fileSizeMB}MB · ${data.videoDurationSec}s`
im Toast steht, Zeile ~798-801, sowie im Ergebnis-Bereich der Video-Vorschau) eine kleine
Zeile ergänzen, z. B. „🔊 −14,5 LUFS · −1 dBTP" wenn `loudness.normalized === true`, sonst
keine Anzeige (kein Fehler-UI nötig, da Normalisierung optional/best-effort ist).

---

### 2.6 `src/components/RemotionVideoBlock.tsx` (Änderung)

**Betroffener Typ** (Zeile 184-188, `videoInfo`-State):

```
const [videoInfo, setVideoInfo] = useState<{
  sizeMB: string;
  duration: string;
  frames?: number;
  loudness?: { normalized: boolean; targetI?: number; targetTP?: number } | null;  // NEU
} | null>(null);
```

**Warum**: `videoInfo` wird beim Abschluss des Polls (Zeile ~387-391) aus `pollData` befüllt –
`pollData.loudness` muss dort zusätzlich übernommen werden:
```
setVideoInfo({
  sizeMB: pollData.fileSizeMB,
  duration: pollData.videoDurationSec,
  frames: pollData.frames,
  loudness: pollData.loudness ?? null,   // NEU
});
```

**UI-Ergänzung**: Im „Ergebnis"-Block (Zeile ~826-833, wo bereits
`✅ Blossom · {videoInfo?.duration}s · {videoInfo?.sizeMB}MB · {resolvedGrade}` steht) den
Loudness-Badge ergänzen, z. B. `· 🔊 −14,5 LUFS`.

---

### 2.7 `docs/CONTEXT_REMOTION.md` (Änderung)

- Neue Tabellenzeile unter „Wichtige Dateien": `server/remotion/audioNormalize.js` →
  „Zwei-Pass ffmpeg-loudnorm: −14,5 LUFS integrated / −1 dBTP True Peak (Post-Render)".
- Neuer Abschnitt „## Audio-Loudness-Normalisierung" mit Kurzbeschreibung (Ziel, zwei Pässe,
  `-c:v copy`, Fallback-Verhalten bei Fehler).
- Neue Debug-Zeile unter „## Debug":
  `journalctl -u ai-api -f | grep -i "loudnorm\|LUFS\|dBTP"`

---

## 3. Betroffene Typen/Interfaces (Zusammenfassung)

| Typ/Interface | Datei | Änderung |
|---|---|---|
| `AUDIO_LOUDNESS_CONFIG` (neuer Export) | `src/config/audio.js` | NEU |
| Rückgabewert `normalizeRenderedVideo()` | `server/remotion/audioNormalize.js` | NEU: `{ normalized, targetI, targetTP, measuredI?, measuredTP?, reason? }` |
| Rückgabewert `renderMojoBusVideo()` (`renderResult`) | `server/remotion/render.js` | Feld `loudness` ergänzt |
| `remotionJobs`-Map Job-Objekt | `server/server.js` | Feld `loudness` ergänzt |
| JSON-Response `/api/render-remotion/status/:jobId` | `server/server.js` | Feld `loudness` ergänzt |
| JSON-Response `/api/render-remotion/history` | `server/server.js` | Feld `loudness` ergänzt |
| `interface RenderStatus` | `src/pages/TikTokPromotion.tsx` | Feld `loudness?` ergänzt |
| `videoInfo`-State-Typ | `src/components/RemotionVideoBlock.tsx` | Feld `loudness?` ergänzt |

`MojoBusVideoProps`, `calculateDuration()`, alle Remotion-`<Composition>`-Definitionen in
`server/remotion/index.tsx` sowie `AudioLayer.tsx` bleiben **unverändert** – die Normalisierung
greift ausschließlich nach `renderMedia()`, außerhalb der React/Remotion-Render-Pipeline.

---

## 4. Remotion Frame-/Timing-Berechnungen

**Ergebnis der Prüfung: Es sind keine Frame- oder Timing-Werte in `MojoBusVideo.tsx` oder
`index.tsx` zu ändern.** Begründung + Nachweis anhand der bestehenden, unveränderten Werte
(FPS = 25, siehe `index.tsx` Zeile 34):

| Berechnung | Formel | Ergebnis (unverändert) |
|---|---|---|
| `HOOK_SECONDS.tiktok` → Frames | `3 × 25` | 75 Frames |
| `HOOK_SECONDS.reels` → Frames | `4 × 25` | 100 Frames |
| `HOOK_SECONDS.youtube` → Frames | `5 × 25` | 125 Frames |
| `ctaFrames` | `6 × 25` | 150 Frames |
| `TRANSITION_FRAMES` | `Math.round(25 × 0.67)` | 17 Frames (0,68s) |
| Musik-Fade-In (`AudioLayer volume=0.34 fadeInSec=0.3`) | `Math.round(0.3 × 25)` | 8 Frames |
| Musik-Fade-Out (Default `fadeOutSec=3`, nicht überschrieben) | `Math.round(3 × 25)` | 75 Frames |
| Voiceover-Fade-In (`fadeInSec=0.1`) | `Math.round(0.1 × 25)` | 3 Frames (JS `Math.round(2.5)=3`) |
| Voiceover-Fade-Out (`fadeOutSec=0.5`) | `Math.round(0.5 × 25)` | 13 Frames (`Math.round(12.5)=13`) |
| Ambient-Fade-In (`fadeInSec=0.5`) | `Math.round(0.5 × 25)` | 13 Frames |
| Ambient-Fade-Out (`fadeOutSec=3`) | `Math.round(3 × 25)` | 75 Frames |

Diese Werte bestimmen nur die **Innen-Video-Lautstärkekurve** (Ducking/Fades) zur Render-Zeit.
Die Zwei-Pass-loudnorm-Normalisierung setzt danach an – auf der bereits gemischten,
fertig-gerenderten Audiospur des kompletten MP4 (inkl. aller obigen Fades). Die
`durationInFrames`/`composition.fps`-Werte aus `selectComposition()` (Zeile 987-991 in
`render.js`) ändern sich durch den Normalisierungsschritt nicht – `-c:v copy` garantiert
Frame-für-Frame-Identität des Video-Streams vor und nach der Normalisierung.

**Timeout-Berechnung für die zwei ffmpeg-Pässe** (einzige neue „Timing"-Formel im System,
betrifft NICHT Remotion-Frames, sondern Node.js-Prozess-Timeouts):

```
timeoutMs = Math.max(30000, videoDurationSec × 4000)
```

Beispiele:
- 30s Video (TikTok, kurz) → `max(30000, 120000)` = 120.000 ms (2 Min)
- 60s Video (Standard) → `max(30000, 240000)` = 240.000 ms (4 Min)
- 120s Video (YouTube Shorts max.) → `max(30000, 480000)` = 480.000 ms (8 Min)

(Faktor 4× ist bewusst großzügig, da `-c:v copy` real deutlich schneller als Echtzeit läuft;
verhindert Timeout-Fehlalarme auf einem ausgelasteten 4-Core-VPS.)

---

## 5. Reihenfolge der Änderungen

1. **`src/config/audio.js`** anlegen (Zielwerte zuerst, da alle anderen Dateien davon importieren).
2. **`server/remotion/audioNormalize.js`** anlegen (isoliertes Modul, gegen `src/config/audio.js`
   und übergebene `FFMPEG_PATH`/`FFPROBE_PATH` entwickelt/testbar ohne `render.js` anzufassen).
3. **`server/remotion/render.js`** integrieren (Import + Aufruf nach `renderMedia()` +
   `renderResult.loudness`).
4. **`server/server.js`** erweitern (Job-Objekt + `/status`- und `/history`-Response um
   `loudness` ergänzen).
5. **`src/pages/TikTokPromotion.tsx`** – Interface `RenderStatus` + kleine UI-Anzeige.
6. **`src/components/RemotionVideoBlock.tsx`** – `videoInfo`-Typ + kleine UI-Anzeige.
7. **`docs/CONTEXT_REMOTION.md`** – Dokumentation nachziehen (neue Datei, neuer Abschnitt, Debug-Zeile).
8. **Validierung**: `tsc --noEmit` (Frontend-Typen) + `npm run build` (Vite-Build) müssen
   fehlerfrei sein. `server/` hat kein `tsc`-Check (reines Node/JS) – hier stattdessen manueller
   Smoke-Test: `POST /api/render-remotion` mit einem kurzen Testjob, Log-Ausgabe von
   `[Remotion] 🔊 Loudnorm: ...` in `journalctl -u ai-api` prüfen (nach Deploy).
9. **Deploy-Hinweis** (aus `docs/CONTEXT_DEPLOY.md`, da `server/remotion/` betroffen):
   `deploy-main.sh --force` + `systemctl restart ai-api` + Bundle-Invalidate
   (`curl -X POST http://localhost:3002/api/render-remotion/invalidate-bundle`) – Bundle-Invalidate
   ist hier eigentlich nicht zwingend nötig (kein React/Remotion-Composition-Code geändert,
   nur Node-seitiges `render.js`/neues Modul), aber unschädlich und wird von `deploy-main.sh`
   ohnehin automatisch ausgeführt.
10. **Commit** nach jedem abgeschlossenen Schritt (mind. 1× nach Backend-Teil, 1× nach
    Frontend-Teil, 1× nach Doku-Update).

---

## 6. Offene Entscheidung für den User (vor Umsetzung zu bestätigen)

- **Zielwert-Feinjustierung**: Plan setzt `I = -14.5 LUFS` (Mitte des Korridors). Falls eine
  Plattform-spezifische Differenzierung gewünscht ist (z. B. TikTok `-14`, YouTube `-15`), müsste
  `AUDIO_LOUDNESS_CONFIG` um eine `platform`-Dimension erweitert werden – aktuell als einheitlicher
  Wert für alle drei Formate (`16:9`/`9:16`/`1:1`) geplant, da die Loudness-Ziele bei TikTok,
  Reels und YouTube praktisch identisch sind (alle ≈ −14 LUFS).
- **`linear=true` vs. dynamische Normalisierung**: Plan bevorzugt `linear=true` (naturgetreuer
  Klang). Bei sehr lauten Rohmischungen (z. B. Voiceover `volume=1.0` + Musik `volume=0.34`
  gleichzeitig an einer lauten Stelle) kann ffmpeg automatisch auf dynamische Normalisierung
  wechseln, um `-1 dBTP` einzuhalten – das ist Standard-loudnorm-Verhalten und erfordert keine
  Code-Verzweigung, nur ein Log-Hinweis.
