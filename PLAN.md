# Refactoring-Plan: Modularisierung von `render.js` + `MojoBusVideo.tsx`

**Ziel:** beide Dateien in kleine, getrennte Module aufteilen, ohne die Funktionalität zu verändern.  
**Rahmen:**

- `server/remotion/render.js` (Render-Orchestrator, Node.js)
- `server/remotion/MojoBusVideo.tsx` (Remotion-Hauptkomponente)
- Verwendende Dateien: `server/remotion/index.tsx` (Compositions-Eintrag) und `server/routes/video.js` (API-Route)

**Regeln für diesen Plan:**

1. Reihenfolge nach Risiko: Konstanten/Konfiguration zuerst, Helfer/Feature-Module danach, stark vernetzte Orchestrator-Dateien zuletzt.
2. Pro Schritt **ein** auslagerbares Modul.
3. Kein Verhalten ändern, kein Umschreiben, keine „Verbesserungen“.
4. Sobald etwas in ein anderes Modul wandert, importiert die bisherige Datei es; re-exports bleiben erlaubt, damit Aufrufer (z. B. `index.tsx` oder `server/routes/video.js`) nicht sofort umgebaut werden müssen.

---

## Schritt 1: `server/remotion/constants.js` – zentrale Konstanten

**Neue Datei:** `server/remotion/constants.js`

**Wandert dorthin (exakt):**

- `OUTPUT_DIR`
- `IMAGES_DIR`
- `COMPOSITION_IDS`
- `MIME_TYPES`
- `FASTSTART_EXTENSIONS`

**Imports/Exports in der neuen Datei:**

```js
import path from 'path';
import os from 'os';

export const OUTPUT_DIR = path.join(os.tmpdir(), 'remotion-renders');
export const IMAGES_DIR = path.join(os.tmpdir(), 'remotion-images');
export const COMPOSITION_IDS = { ... };
export const MIME_TYPES = { ... };
export const FASTSTART_EXTENSIONS = new Set(['.mp4', '.mov']);
```

**Anpassung in `server/remotion/render.js`:**

- Entfernen der obigen fünf Definitionen.
- `import { OUTPUT_DIR, IMAGES_DIR, COMPOSITION_IDS, MIME_TYPES, FASTSTART_EXTENSIONS } from './constants.js';` einfügen.
- `os` aus den Imports entfernen, falls danach nicht mehr verwendet wird.

**Anpassung in `server.js` / `server/routes/video.js`:**  
Keine, sofern `render.js` die Konstanten weiter intern nutzt.

**Testhinweis:**

- Eine Render-Anfrage starten.
- Prüfen, dass im Log weiterhin `OUTPUT_DIR`/`IMAGES_DIR` unter `/tmp/remotion-renders` bzw. `/tmp/remotion-images` erscheinen und die Composition-IDs `MojoBusVideo-16-9/9-16/1-1` unverändert sind.

---

## Schritt 2: `server/remotion/binaries.js` – ffmpeg/ffprobe-Auflösung

**Neue Datei:** `server/remotion/binaries.js`

**Wandert dorthin (exakt):**

- `findBinary(name)`
- `FFMPEG_PATH`
- `FFPROBE_PATH`
- `FFPROBE` (Alias)

**Imports/Exports in der neuen Datei:**

```js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const findBinary = (name) => { ... };
export const FFMPEG_PATH = process.env.FFMPEG_PATH || findBinary('ffmpeg');
export const FFPROBE_PATH = process.env.FFPROBE_PATH || findBinary('ffprobe');
export const FFPROBE = FFPROBE_PATH;
```

**Anpassung in `server/remotion/render.js`:**

- `findBinary`, `FFMPEG_PATH`, `FFPROBE_PATH` und `const FFPROBE = FFPROBE_PATH;` entfernen.
- `import { FFMPEG_PATH, FFPROBE_PATH, FFPROBE } from './binaries.js';` einfügen.
- `execSync` aus den Imports entfernen, falls danach nicht mehr direkt benötigt wird.

**Anpassung in `server.js` / `server/routes/video.js`:**  
Keine.

**Testhinweis:**

- Im Render-Log muss weiterhin exakt derselbe ffmpeg-Pfad auftauchen (z. B. `/usr/local/bin/ffmpeg`).
- Ein kurzer Render-Test sollte nicht mit „ffmpeg not found“ abbrechen.

---

## Schritt 3: `server/remotion/duration.ts` – Hook-/Dauer-Konstanten

**Neue Datei:** `server/remotion/duration.ts`

**Wandert dorthin (exakt):**

- `HOOK_SECONDS`
- `getHookSeconds(platform?)`
- `calculateDuration(...)`

**Imports/Exports in der neuen Datei:**

```ts
export const HOOK_SECONDS: Record<string, number> = { ... };
export function getHookSeconds(platform?: string): number { ... }
export function calculateDuration(...) { ... }
```

**Anpassung in `server/remotion/MojoBusVideo.tsx`:**

- Die drei Definitionen entfernen.
- `import { getHookSeconds } from './duration';` einfügen (HOOK_SECONDS/calculateDuration braucht die Komponente selbst nicht).
- Optional weiterhin `export { calculateDuration } from './duration';` ergänzen, damit `server/remotion/index.tsx` weiter `calculateDuration` aus `./MojoBusVideo` importieren kann.

**Anpassung in `server/remotion/index.tsx`:**

- Optional: stattdessen `import { calculateDuration } from './duration';` verwenden.

**Anpassung in `server.js` / `server/routes/video.js`:**  
Keine.

**Testhinweis:**

- Remotion-Player öffnen.
- Prüfen, dass Gesamtdauer und `hookFrames` pro Plattform (TikTok 3s, Reels 4s, YouTube 5s) identisch bleiben.

---

## Schritt 4: `server/remotion/components/HookDimOverlay.tsx` – Hook-Overlay

**Neue Datei:** `server/remotion/components/HookDimOverlay.tsx`

**Wandert dorthin (exakt):**

- `HookDimOverlay` (interne Komponente)

**Imports/Exports in der neuen Datei:**

```ts
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';

export const HookDimOverlay: React.FC<{ opacity: number; fps: number; hookFrames: number }> = ...
```

**Anpassung in `server/remotion/MojoBusVideo.tsx`:**

- `HookDimOverlay` entfernen.
- `import { HookDimOverlay } from './components/HookDimOverlay';` einfügen.
- `useCurrentFrame` aus den Imports entfernen (wird nur noch im Overlay verwendet).

**Anpassung in `server.js` / `server/routes/video.js`:**  
Keine.

**Testhinweis:**

- Hook-Slide im Player ansehen.
- Abdunkelung muss weiterhin 0.40 Opacity mit sanftem Fade-In (0,4s) und Fade-Out (0,5s) zeigen.

---

## Schritt 5: `server/remotion/videoProps.ts` – Props-Interface

**Neue Datei:** `server/remotion/videoProps.ts`

**Wandert dorthin (exakt):**

- `MojoBusVideoProps` (komplettes Interface)
- Dazugehörige Type-Imports: `ColorGrade`, `GammaFade`, `TransitionType`, `RouteCoord`, `CaptionStyle`

**Imports/Exports in der neuen Datei:**

```ts
import type { ColorGrade, GammaFade } from './components/ColorGradeOverlay';
import type { TransitionType } from './components/TransitionSlideshow';
import type { RouteCoord } from './components/RouteMapLine';
import type { CaptionStyle } from './components/Captions';

export interface MojoBusVideoProps { ... }
```

**Anpassung in `server/remotion/MojoBusVideo.tsx`:**

- Interface-Definition und alle `type` Imports entfernen, die nur für das Interface benötigt wurden (`GammaFade`, `TransitionType`, `RouteCoord`, `CaptionStyle`).
- `import { MojoBusVideoProps } from './videoProps';` einfügen.
- Re-Export anbieten: `export { MojoBusVideoProps } from './videoProps';`

**Anpassung in `server/remotion/index.tsx`:**

- Optional: `type MojoBusVideoProps` direkt aus `./videoProps` importieren.

**Anpassung in `server.js` / `server/routes/video.js`:**  
Keine.

**Testhinweis:**

- `build_project` muss weiterhin fehlerfrei durchlaufen (keine TypeScript-Fehler).
- Remotion-Player akzeptiert dieselben Props wie vorher.

---

## Schritt 6: `server/remotion/components/MediaRenderer.tsx` – Medien-Renderer + isVideo

**Neue Datei:** `server/remotion/components/MediaRenderer.tsx`

**Wandert dorthin (exakt):**

- `isVideo(url)`
- `MediaRenderer` (interne Komponente)

**Imports/Exports in der neuen Datei:**

```ts
import React from 'react';
import { AbsoluteFill, Sequence, Video } from 'remotion';
import { KenBurnsImage, pickDirection } from './KenBurnsImage';

export const isVideo = (url: string) => ...
export const MediaRenderer: React.FC<{ src: string; index: number; allowAudio?: boolean; speedRamp?: boolean; slideFrames?: number }> = ...
```

**Anpassung in `server/remotion/MojoBusVideo.tsx`:**

- `const isVideo = ...` und `const MediaRenderer = ...` entfernen.
- `import { MediaRenderer, isVideo } from './components/MediaRenderer';` einfügen.
- `Video`, `Sequence` und `KenBurnsImage`, `pickDirection` aus den Imports entfernen (werden nur noch im MediaRenderer verwendet). `Sequence` nutzt die Hauptkomponente weiterhin.
- Aufrufstellen anpassen:
  - `<MediaRenderer src={images[0]} index={0} />`
  - `<MediaRenderer src={images[d.imageIdx]} index={def.imageIdx + 1} allowAudio={keepOriginalAudio} speedRamp={speedRampEnabled} slideFrames={thisSlideFrames} />`
  - `<MediaRenderer src={images[imageCount - 1]} index={imageCount + 1} />`

**Anpassung in `server.js` / `server/routes/video.js`:**  
Keine.

**Testhinweis:**

- Ein Video-Clip, ein Bild und Speed-Ramp müssen weiterhin korrekt ausgespielt werden.
- `keepOriginalAudio=true` duckt Musik/Atmo weiterhin in Video-Slides.

---

## Schritt 7: `server/remotion/mediaServer.js` – lokaler HTTP-Bildserver

**Neue Datei:** `server/remotion/mediaServer.js`

**Wandert dorthin (exakt):**

- `startImageServer(serveDir)`

**Imports/Exports in der neuen Datei:**

```js
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { MIME_TYPES } from './constants.js';

export function startImageServer(serveDir) { ... }
```

**Anpassung in `server/remotion/render.js`:**

- `startImageServer` und `MIME_TYPES` entfernen.
- `import { startImageServer } from './mediaServer.js';` einfügen.
- `createServer` und `http` aus den Imports entfernen.

**Anpassung in `server.js` / `server/routes/video.js`:**  
Keine.

**Testhinweis:**

- Render-Log zeigt weiterhin `Bild-Server läuft auf http://127.0.0.1:<port>`.
- Größere MP4-Clips (>10 MB) rendern weiterhin ohne `delayRender`-Timeout (Range-Requests 206).

---

## Schritt 8: `server/remotion/mediaDownload.js` – Download-/Faststart-Logik

**Neue Datei:** `server/remotion/mediaDownload.js`

**Wandert dorthin (exakt):**

- `getImageExtension(url, contentType)`
- `downloadFileWithType(url, destPath, attempt = 1)`
- `ensureFaststart(filePath)`
- `downloadAllImages(imageUrls, sessionDir)`
- `downloadAudioFile(url, sessionDir, localMusicDir)`
- `downloadMapImage(url, sessionDir)`

**Imports/Exports in der neuen Datei:**

```js
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { FFMPEG_PATH, FFPROBE_PATH } from './binaries.js';
import { FASTSTART_EXTENSIONS } from './constants.js';

const execFileAsync = promisify(execFile);

export function getImageExtension(...) { ... }
export function downloadFileWithType(...) { ... }
export async function ensureFaststart(filePath) { ... }
export async function downloadAllImages(imageUrls, sessionDir) { ... }
export async function downloadAudioFile(url, sessionDir, localMusicDir) { ... }
export async function downloadMapImage(url, sessionDir) { ... }
```

**Anpassung in `server/remotion/render.js`:**

- Alle oben genannten Funktionen und `downloadFileWithType`-Helfer entfernen.
- `import { downloadAllImages, downloadAudioFile, downloadMapImage } from './mediaDownload.js';` einfügen.
- `http`, `https` und `promisify`/`util` aus den Imports entfernen, falls danach nicht mehr benötigt.

**Anpassung in `server.js` / `server/routes/video.js`:**  
Keine.

**Testhinweis:**

- Render starten.
- Logs für Bilder/Audio/Karten-Downloads identisch.
- hochgeladene HEVC-Videos werden weiterhin zu H.264 + Faststart re-encoded.

---

## Schritt 9: `server/remotion/voiceover.js` – Voiceover-Generierung + Concat

**Neue Datei:** `server/remotion/voiceover.js`

**Wandert dorthin (exakt):**

- `generateVoiceoverSegments(segments, voiceoverModel, voiceoverSpeed, effectiveEngine, sessionDir)`
- `concatVoiceoverSegments(segments, sessionDir, hookDurationSec, secondsPerImage, bridgeDurationSec, muteBodyIndex, routeSlideIndex, routeDuration, videoDurations)`
- `MAX_TTS_CHARS`

**Imports/Exports in der neuen Datei:**

```js
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { FFMPEG_PATH, FFPROBE } from './binaries.js';

const execFileAsync = promisify(execFile);

async function generateVoiceoverSegments(...) { ... }
async function concatVoiceoverSegments(...) { ... }

export { generateVoiceoverSegments, concatVoiceoverSegments };
```

**Anpassung in `server/remotion/render.js`:**

- Beide Voiceover-Funktionen und `MAX_TTS_CHARS` entfernen.
- `import { generateVoiceoverSegments, concatVoiceoverSegments } from './voiceover.js';` einfügen.

**Anpassung in `server.js` / `server/routes/video.js`:**  
Keine.

**Testhinweis:**

- Voiceover-Render starten.
- Prüfen, dass `voiceover_sync.mp3` generiert wird und die `perSlideArray`-Werte im Log identisch sind.
- Leere Segmente (Stille-Slides) bleiben an derselben Position.

---

## Schritt 10: `server/remotion/chrome.js` – Chrome/Chromium-Setup

**Neue Datei:** `server/remotion/chrome.js`

**Wandert dorthin (exakt):**

- `findAndFixChrome()`
- `CHROME_PATH`
- `CHROMIUM_OPTIONS`
- `ensureChromeBinary()`

**Imports/Exports in der neuen Datei:**

```js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { ensureBrowser } from '@remotion/renderer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const CHROMIUM_OPTIONS = { ... };
export let CHROME_PATH = null; // bzw. const-Initialisierung wie bisher
export function ensureChromeBinary() { ... }
// Initialaufruf beibehalten
ensureChromeBinary().catch(() => {});
```

**Anpassung in `server/remotion/render.js`:**

- `findAndFixChrome`, `CHROME_PATH`, `CHROMIUM_OPTIONS`, `ensureChromeBinary()` entfernen.
- `import { CHROME_PATH, CHROMIUM_OPTIONS } from './chrome.js';` einfügen.
- `ensureBrowser` und `execSync` aus den Imports entfernen.

**Anpassung in `server.js` / `server/routes/video.js`:**  
Keine.

**Testhinweis:**

- Render starten.
- Im Log muss weiterhin derselbe Chrome-Pfad gefunden und „Chrome bereit“ ausgegeben werden.

---

## Schritt 11: `server/remotion/bundle.js` – Remotion-Bundle-Cache

**Neue Datei:** `server/remotion/bundle.js`

**Wandert dorthin (exakt):**

- `bundleCache` / `isBundling` / `bundleQueue` / `bundleAttempts`
- `getBundledEntry()`
- `invalidateBundleCache()`

**Imports/Exports in der neuen Datei:**

```js
import { bundle } from '@remotion/bundler';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let bundleCache = null;
let isBundling = false;
let bundleQueue = [];
let bundleAttempts = 0;

export async function getBundledEntry() { ... }
export function invalidateBundleCache() { ... }
```

**Anpassung in `server/remotion/render.js`:**

- Caching-Variablen, `getBundledEntry`, `invalidateBundleCache` entfernen.
- `import { getBundledEntry, invalidateBundleCache } from './bundle.js';` einfügen.
- Re-Export beibehalten, damit `server/routes/video.js` weiter `renderer.invalidateBundleCache()` verwenden kann:
  ```js
  export { invalidateBundleCache } from './bundle.js';
  ```
- `bundle` aus den Imports entfernen.

**Anpassung in `server.js` / `server/routes/video.js`:**

- Keine, sofern `render.js` `invalidateBundleCache` weiter exportiert.
- **Alternative:** `import { invalidateBundleCache } from '../remotion/bundle.js';` direkt in `video.js` einfügen und den Re-Export weglassen.

**Testhinweis:**

- Erster Render baut Bundle; zweiter Render nutzt Bundle-Cache (deutlich schneller).
- Der Admin/Invalidate-Endpoint setzt den Cache weiterhin zurück.

---

## Schritt 12: `server/remotion/MojoBusVideo.tsx` – Restkomponente aufgeräumt

**Dies ist kein neues Modul, sondern die abschließende Bereinigung der Hauptkomponente.**

**Was in `server/remotion/MojoBusVideo.tsx` bleibt:**

- Nur die Hauptkomponente `MojoBusVideo` mit allen 15+ Layern.
- Imports der zuvor extrahierten Module:
  ```ts
  import { getHookSeconds } from './duration';
  import { MojoBusVideoProps } from './videoProps';
  export { MojoBusVideoProps } from './videoProps';
  import { HookDimOverlay } from './components/HookDimOverlay';
  import { MediaRenderer, isVideo } from './components/MediaRenderer';
  ```
- `MediaRenderer` Aufrufe anpassen, falls nicht bereits in Schritt 6 passiert.

**Anpassung in `server.js` / `server/routes/video.js`:**  
Keine.

**Testhinweis:**

- Remotion-Player öffnen.
- Visuelle Prüfung aller Schichten: Hook-Titel, Slideshow mit Übergängen, RouteMap, CTA, Lottie-Bus, Letterbox, ProgressBar, Waveform, Captions (Auto + manuell), Audio, Beat-Sync, Sticker/SFX.
- Das generierte Video muss pixel-identisch zur Vorgängerversion aussehen.

---

## Schritt 13: `server/remotion/render.js` – Render-Orchestrator aufgeräumt

**Dies ist kein neues Modul, sondern die abschließende Bereinigung der Render-Datei.**

**Was in `server/remotion/render.js` bleibt:**

- `renderMojoBusVideo(params)`
- `cleanupRender(outputPath)`
- `cleanupOldRenders(maxAgeMs = 24h)`
- Imports aller neuen Module:
  ```js
  import { OUTPUT_DIR, IMAGES_DIR, COMPOSITION_IDS } from './constants.js';
  import { FFMPEG_PATH, FFPROBE_PATH, FFPROBE } from './binaries.js';
  import { generateVoiceoverSegments, concatVoiceoverSegments } from './voiceover.js';
  import { downloadAllImages, downloadAudioFile, downloadMapImage } from './mediaDownload.js';
  import { startImageServer } from './mediaServer.js';
  import { CHROME_PATH, CHROMIUM_OPTIONS } from './chrome.js';
  import { getBundledEntry } from './bundle.js';
  import { measureSlideVideoDurations } from './videoDuration.js';
  import { generateAmbient } from './ambient.js';
  import { generateSfx, SFX_TYPES } from './sfx.js';
  import { normalizeRenderedVideo } from './audioNormalize.js';
  ```

**Anpassung in `server.js` / `server/routes/video.js`:**

- `import remotionRenderer from '../remotion/render.js';` bleibt unverändert, da `renderMojoBusVideo`, `cleanupRender`, `cleanupOldRenders` und ggf. `invalidateBundleCache` weiterhin über `render.js` erreichbar sind.
- **Alternative:** Falls gewünscht, die Cleanup-Funktionen direkt aus einem neuen `server/remotion/cleanup.js` exportieren und in `video.js` importieren.

**Testhinweis (wichtiger End-to-End-Check):**

1. In der App einen vollständigen Remotion-Render anstoßen (z. B. `/api/render-remotion`).
2. Erfolg prüfen: `outputPath` zeigt auf `/tmp/remotion-renders/mojobus-<session>.mp4`.
3. Dateigröße, Länge (Sekunden) und fertige MP4 mit Libx264/AAC vergleichen.
4. Keine neuen Fehler in den Server-Logs.

---

## Checkliste

- [x] Schritt 1: `constants.js` erstellt, `render.js` nutzt Imports
- [x] Schritt 2: `binaries.js` erstellt, `render.js` nutzt ffmpeg/ffprobe davon
- [x] Schritt 3: `duration.ts` erstellt, `MojoBusVideo.tsx`/`index.tsx` angepasst
- [x] Schritt 4: `components/HookDimOverlay.tsx` erstellt, `MojoBusVideo.tsx` importiert es
- [x] Schritt 5: `videoProps.ts` erstellt, `MojoBusVideo.tsx` importiert/re-exportiert es
- [x] Schritt 6: `components/MediaRenderer.tsx` erstellt, `isVideo` dort exportiert, Aufrufe in `MojoBusVideo.tsx` aktualisiert
- [x] Schritt 7: `mediaServer.js` erstellt, `render.js` importiert `startImageServer`
- [x] Schritt 8: `mediaDownload.js` erstellt, Download-Helpers in `render.js` entfernt
- [x] Schritt 9: `voiceover.js` erstellt, Voiceover-Logik in `render.js` entfernt
- [x] Schritt 10: `chrome.js` erstellt, Chrome-Setup in `render.js` entfernt
- [x] Schritt 11: `bundle.js` erstellt, Bundle-Cache + `invalidateBundleCache` in `render.js` entfernt
- [x] Schritt 12: `MojoBusVideo.tsx` enthält ausschließlich die Hauptkomponente
- [ ] Schritt 13: `render.js` enthält ausschließlich den Render-Orchestrator
- [ ] `build_project` fehlerfrei
- [ ] Ein vollständiger Remotion-Render im Browser erfolgreich und visuell unverändert
