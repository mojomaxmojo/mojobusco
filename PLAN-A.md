# PLAN-A: server.js in Module aufteilen

**Ziel:** `server/server.js` (aktuell 2963 Zeilen) in 5-8 kleinere Dateien aufteilen.
**Regel:** Reines Verschieben von Code — keine Umbenennungen, keine Logik-Änderungen,
keine "Verbesserungen". Nur Code an eine neue Stelle kopieren, importieren/exportieren,
und die alte Stelle in `server.js` entfernen.

**Reihenfolge:** Schritt 1 = geringstes Risiko (reine Konstanten/Konfiguration ohne
Verknüpfung zu `app`/Routen). Schritt 8 = höchstes Risiko (stark vernetzte
Remotion/TikTok-Routen mit vielen Abhängigkeiten zu In-Memory-Jobs).

**Nach JEDEM Schritt gilt:**
1. Datei speichern.
2. Server neu starten (bzw. Shakespeare-Preview neu bauen lassen).
3. Die TESTHINWEISE unten ausführen, bevor der nächste Schritt begonnen wird.
4. Erst wenn der Test erfolgreich war, den Schritt in der Checkliste abhaken und weitermachen.

---

## Schritt 1 — `server/config/media-paths.js` (Konstanten & Pfade)

**Risiko:** sehr gering (reine Konstanten, keine Routen, keine Nebenwirkungen außer
dem einmaligen Anlegen des Temp-Ordners).

**Was verschoben wird (mit Original-Zeilennummern):**
- Zeile 16–27: Funktion `findBinary(name)`
- Zeile 28–29: Konstanten `FFMPEG`, `FFPROBE`
- Zeile 30: Konstante `MUSIC_DIR`
- Zeile 31: Konstante `TMP_DIR`
- Zeile 34: `if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })`

**Neue Imports in `media-paths.js`:**
```js
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import os from 'os'
```

**Neue Exports in `media-paths.js`:**
```js
export { FFMPEG, FFPROBE, MUSIC_DIR, TMP_DIR }
```
(`findBinary` muss NICHT exportiert werden, wird nur intern in der neuen Datei benutzt.)

**Was sich in `server.js` ändert:**
- Die Zeilen 16–34 werden entfernt.
- Stattdessen ganz oben (wo vorher diese Zeilen standen) einfügen:
  ```js
  import { FFMPEG, FFPROBE, MUSIC_DIR, TMP_DIR } from './config/media-paths.js'
  ```
- Die Imports `path`, `fs`, `fileURLToPath`, `os` bleiben in `server.js` bestehen,
  da sie an vielen anderen Stellen der Datei weiter benutzt werden.

**TESTHINWEIS (Klick-Anleitung):**
1. Öffne die Vorschau der Webseite.
2. Öffne die Seite `/veroeffentlichen` (oder wie auch immer die Publish-Seite bei dir heißt) — sie sollte laden, ohne Fehlermeldung.
3. Öffne im Browser die Adresse `.../api/health` (an die Domain deiner Vorschau anhängen). Es sollte eine JSON-Antwort mit `"status": "ok"` erscheinen — KEIN Fehler, KEIN weißer Bildschirm.
4. Öffne `.../api/slideshow-music-status` — auch hier muss JSON erscheinen (kein 500-Fehler).
5. Wenn beides funktioniert: Schritt abhaken.

---

## Schritt 2 — `server/config/music-prompts.js` (Musik/Video-Konfigurationsdaten)

**Risiko:** gering (reine Datenobjekte, keine Routen).

**Was verschoben wird:**
- Zeile 674–691: Konstante `ZOOM_PAN_EFFECTS`
- Zeile 694–698: Konstante `ASPECT_SIZES`
- Zeile 707–731: Konstante `LIFESTYLE_MUSIC_PROMPTS`

**Neue Imports in `music-prompts.js`:** keine (reine Datenobjekte, keine externen Module nötig)

**Neue Exports in `music-prompts.js`:**
```js
export { ZOOM_PAN_EFFECTS, ASPECT_SIZES, LIFESTYLE_MUSIC_PROMPTS }
```

**Was sich in `server.js` ändert:**
- Die Zeilen 674–691, 694–698, 707–731 werden entfernt (inkl. der Kommentarblöcke direkt darüber, die zu diesen Konstanten gehören).
- Am Anfang der Datei (bei den anderen Imports) hinzufügen:
  ```js
  import { ZOOM_PAN_EFFECTS, ASPECT_SIZES, LIFESTYLE_MUSIC_PROMPTS } from './config/music-prompts.js'
  ```
- Alle Stellen, die `ZOOM_PAN_EFFECTS`, `ASPECT_SIZES` oder `LIFESTYLE_MUSIC_PROMPTS` benutzen
  (u.a. in `buildFilterComplex`, `generateElevenLabsMusic`), bleiben unverändert — sie funktionieren
  weiter über den Import.

**TESTHINWEIS:**
1. Öffne die Publish-Seite und gehe zum Slideshow-Generator (Video aus Bildern erstellen).
2. Starte einen Test-Slideshow-Job mit 2-3 Bildern (lokale Musik, kein ElevenLabs, um Kosten zu sparen).
3. Prüfe, ob der Fortschrittsbalken läuft und am Ende ein Video zum Download bereitsteht.
4. Wenn das funktioniert: Schritt abhaken.

---

## Schritt 3 — `server/utils/http-helpers.js` (unabhängige Hilfsfunktionen)

**Risiko:** gering (reine Funktionen ohne Zugriff auf `app`, `slideshowJobs` o.ä.).

**Was verschoben wird:**
- Zeile 128–146: Funktion `handleMulterError`
- Zeile 153–156: Funktion `sanitizeInput`
- Zeile 159–165: Funktion `validateApiKey`
- Zeile 168–175: Funktion `safelyParseJSON`

**Neue Imports in `http-helpers.js`:** keine (Funktionen nutzen nur Standard-JS)

**Neue Exports in `http-helpers.js`:**
```js
export { handleMulterError, sanitizeInput, validateApiKey, safelyParseJSON }
```

**Was sich in `server.js` ändert:**
- Die Zeilen 128–175 (inkl. der Kommentare direkt darüber) werden entfernt.
- Import ergänzen:
  ```js
  import { handleMulterError, sanitizeInput, validateApiKey, safelyParseJSON } from './utils/http-helpers.js'
  ```
- Alle ca. 30+ Aufrufstellen von `sanitizeInput(...)`, `safelyParseJSON(...)`, `validateApiKey()`,
  `handleMulterError(...)` bleiben unverändert im Code stehen — nur die Definition zieht um.

**TESTHINWEIS:**
1. Gehe auf die Publish-Seite, Tab "Medien".
2. Lade 1 Testbild hoch, gib einen Titel ein, klicke auf "Text generieren" (KI-Artikel erzeugen).
3. Es sollte ein Artikeltext mit Hashtags erscheinen — kein Fehler wie "Server-Konfigurationsfehler" oder 500.
4. Versuche zusätzlich einen Upload mit einer zu großen Datei (>20MB) — es sollte eine verständliche Fehlermeldung ("Bild zu groß…") erscheinen, kein Absturz.
5. Wenn beides funktioniert: Schritt abhaken.

---

## Schritt 4 — `server/utils/image-ffmpeg.js` (Bild-/ffmpeg-Hilfsfunktionen)

**Risiko:** mittel-gering (reine Hilfsfunktionen, aber mit Dateisystem- und Prozess-Zugriff).

**Was verschoben wird:**
- Zeile 734–745: Funktion `getLocalMusicFile`
- Zeile 748–756: Funktion `downloadImage`
- Zeile 759–816: Funktion `generateElevenLabsMusic`
- Zeile 821–855: Funktion `buildFilterComplex`
- Zeile 862–890: Funktion `readJpegDimensions`
- Zeile 893–904: Funktion `runFfmpeg`

**Neue Imports in `image-ffmpeg.js`:**
```js
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { spawn } from 'child_process'
import { MUSIC_DIR } from '../config/media-paths.js'
import { ZOOM_PAN_EFFECTS, ASPECT_SIZES, LIFESTYLE_MUSIC_PROMPTS } from '../config/music-prompts.js'
```

**Neue Exports in `image-ffmpeg.js`:**
```js
export {
  getLocalMusicFile,
  downloadImage,
  generateElevenLabsMusic,
  buildFilterComplex,
  readJpegDimensions,
  runFfmpeg
}
```

**Was sich in `server.js` ändert:**
- Die Zeilen 734–904 (alle sechs Funktionen inkl. Kommentare direkt darüber) werden entfernt.
- Import ergänzen:
  ```js
  import {
    getLocalMusicFile,
    downloadImage,
    generateElevenLabsMusic,
    buildFilterComplex,
    readJpegDimensions,
    runFfmpeg
  } from './utils/image-ffmpeg.js'
  ```
- `runSlideshowJob` (Zeile 906+) und der Debug-Rotation-Endpunkt (Zeile 2090+) benutzen diese
  Funktionen weiter unverändert — nur über den Import statt lokale Definition.

**TESTHINWEIS:**
1. Gehe zum Slideshow-Generator, starte erneut einen Test-Job mit 3 Bildern und lokaler Musik.
2. Prüfe: Fortschritt läuft durch bis "completed", Video ist herunterladbar und spielt ab.
3. Öffne zusätzlich `.../api/debug-rotation?url=<Bild-URL>` mit einer echten Bild-URL im Browser —
   es sollte JSON mit Dimensionen erscheinen, kein 500-Fehler.
4. Wenn beides funktioniert: Schritt abhaken.

---

## Schritt 5 — `server/services/ai-content.js` (KI-Text-Generierung, Kernfunktion)

**Risiko:** mittel (wird von JEDER Content-Generierungs-Route benutzt — Fehler hier
würden sich auf viele Tabs auswirken).

**Was verschoben wird:**
- Zeile 186–253: Funktion `generateWithModel`

**Neue Imports in `ai-content.js`:**
```js
import axios from 'axios'
import { getLifestyleConfig } from '../../src/config/prompts/index.js'
```
(Pfad relativ von `server/services/` zu `src/config/prompts/index.js` anpassen — von
`server/server.js` aus war es `../src/config/prompts/index.js`; aus `server/services/`
wird es `../../src/config/prompts/index.js`.)

**Neue Exports in `ai-content.js`:**
```js
export { generateWithModel }
```

**Was sich in `server.js` ändert:**
- Zeile 186–253 wird entfernt.
- Import ergänzen:
  ```js
  import { generateWithModel } from './services/ai-content.js'
  ```
- Alle Aufrufstellen von `generateWithModel(...)` (in den Routen `/api/generate-media-article`,
  `/api/generate-trip`, `/api/generate-article`, `/api/generate-place`, `/api/generate-note`)
  bleiben unverändert stehen.

**TESTHINWEIS:**
1. Teste NACHEINANDER alle 5 Content-Tabs auf der Publish-Seite:
   - "Medien": Bild hochladen, Text generieren.
   - "Trips": Mindestens 2 Stationen mit Bild anlegen, Text generieren.
   - "Berichte": Bild hochladen, Bericht generieren.
   - "Plätze": Bild hochladen, Platz-Beschreibung generieren.
   - "Note": Bild hochladen, Notiz generieren.
2. Bei jedem Tab muss ein Text mit Hashtags erscheinen, keine Fehlermeldung.
3. Wenn ALLE 5 funktionieren: Schritt abhaken.

---

## Schritt 6 — `server/routes/content.js` (Content-Generierungs-Routen)

**Risiko:** mittel-hoch (5 Routen mit viel Bild-Analyse-Logik, aber jede Route ist
in sich abgeschlossen und unabhängig von den anderen Routen-Gruppen).

**Was verschoben wird:**
- Zeile 259–419: Route `app.post('/api/generate-media-article', ...)`
- Zeile 1312–1560: Route `app.post('/api/generate-trip', ...)`
- Zeile 1564–1764: Route `app.post('/api/generate-article', ...)`
- Zeile 1768–1941: Route `app.post('/api/generate-place', ...)`
- Zeile 1945–2031: Route `app.post('/api/generate-note', ...)`

**Neue Imports in `routes/content.js`:**
```js
import express from 'express'
import multer from 'multer'
import axios from 'axios'
import {
  getLifestyleConfig,
  generateMediaPrompt,
  generateTripPrompt,
  generateTripCaptionPrompt,
  generateArticlePrompt,
  generateArticleSummaryPrompt,
  generateArticleTitlesPrompt,
  generateNotePrompt,
  generatePlacePrompt,
  getMediaImageAnalysisPrompt,
  getMediaVideoAnalysisPrompt,
  getTripImageAnalysisPrompt,
  getArticleImageAnalysisPrompt,
  getNoteImageAnalysisPrompt,
  getPlaceImageAnalysisPrompt
} from '../../src/config/prompts/index.js'
import { handleMulterError, sanitizeInput, validateApiKey, safelyParseJSON } from '../utils/http-helpers.js'
import { generateWithModel } from '../services/ai-content.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 30,
    fieldSize: 1 * 1024 * 1024
  }
})

const router = express.Router()
```
(Die `upload`-Konfiguration (ursprünglich Zeile 117–125 in `server.js`) wird hier dupliziert
benötigt, da alle 5 Routen sie nutzen. Sie wird NICHT aus `server.js` entfernt, falls noch
andere Routen in `server.js` sie brauchen — siehe Hinweis unten.)

**Neue Exports in `routes/content.js`:**
```js
export default router
```
(Jede der 5 `app.post(...)`-Aufrufe wird zu `router.post(...)` geändert — das ist KEINE
Logik-Änderung, nur die Art, wie die Route registriert wird, damit sie in `server.js`
per `app.use(contentRouter)` eingebunden werden kann.)

**Was sich in `server.js` ändert:**
- Die 5 Routen-Blöcke werden entfernt.
- Die `upload`/`storage`-Definition (Zeile 117–125) bleibt in `server.js` stehen, falls sie
  von anderen, noch nicht verschobenen Routen benutzt wird (in diesem Fall: NICHT mehr nötig,
  da sie nur von den 5 jetzt verschobenen Routen benutzt wurde — kann entfernt werden,
  nachdem geprüft wurde, dass keine andere Stelle in `server.js` noch `upload` referenziert).
- Import + Einbindung ergänzen:
  ```js
  import contentRouter from './routes/content.js'
  // ... nach app.use(botMiddleware):
  app.use(contentRouter)
  ```

**TESTHINWEIS:**
1. Wiederhole GENAU die 5 Tests aus Schritt 5 (alle Content-Tabs).
2. Zusätzlich: Lade einen zu großen Bild-Upload (>20MB) in einem der Tabs hoch — die
   Fehlermeldung "Bild zu groß…" muss weiterhin erscheinen.
3. Wenn alles wie vorher funktioniert: Schritt abhaken.

---

## Schritt 7 — `server/routes/video.js` (Video-Routen: xAI-Grok, Slideshow, Remotion)

**Risiko:** hoch (stark vernetzte Logik mit In-Memory Job-Stores `slideshowJobs` und
`remotionJobs`, mehreren asynchronen Hintergrundprozessen und Dateisystem-Streaming).

**Was verschoben wird:**
- Zeile 36–39: Konstante `slideshowJobs` (Job-Store)
- Zeile 40–70: `remotionRenderer`-Variable, Funktion `getRemotionRenderer`, Konstante `remotionJobs`, Cleanup-`setInterval` für `remotionJobs`
- Zeile 429–593: Route `app.post('/api/generate-video', ...)` (xAI Grok)
- Zeile 598–658: Route `app.get('/api/video-status/:jobId', ...)`
- Zeile 906–1161: Funktion `runSlideshowJob`
- Zeile 1164–1223: Route `app.post('/api/generate-slideshow', ...)`
- Zeile 1227–1241: Route `app.get('/api/slideshow-music-status', ...)`
- Zeile 1244–1274: Route `app.get('/api/slideshow-status/:jobId', ...)`
- Zeile 1278–1298: Route `app.get('/api/slideshow-download/:jobId', ...)`
- Zeile 1300–1306: `setInterval` Cleanup für `slideshowJobs`
- Zeile 2035–2069: Route `app.post('/api/debug-video', ...)`
- Zeile 2090–2163: Route `app.get('/api/debug-rotation', ...)`
- Zeile 2212–2395: Route `app.post('/api/render-remotion', ...)`
- Zeile 2398–2414: Route `app.get('/api/render-remotion/status/:jobId', ...)`
- Zeile 2418–2447: Route `app.get('/api/render-remotion/download/:jobId', ...)`
- Zeile 2450–2486: Route `app.get('/api/music/list', ...)`
- Zeile 2489–2511: Route `app.get('/api/render-remotion/history', ...)`
- Zeile 2515–2530: Route `app.get('/api/music/:filename', ...)`
- Zeile 2895–2932: Route `app.get('/api/render-remotion/check', ...)`
- Zeile 2937–2955: Funktion `handleInvalidateBundle` + Routen `app.post('/api/render-remotion/invalidate-bundle', ...)` und `app.post('/api/render-remotion/invalidate-cache', ...)`

**Neue Imports in `routes/video.js`:**
```js
import express from 'express'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile)
import { FFMPEG, FFPROBE, MUSIC_DIR, TMP_DIR } from '../config/media-paths.js'
import { getLocalMusicFile, downloadImage, generateElevenLabsMusic, buildFilterComplex, readJpegDimensions, runFfmpeg } from '../utils/image-ffmpeg.js'

const router = express.Router()
```

**Hinweis zu `PORT`:** Die Route `/api/render-remotion` nutzt `PORT` (Zeile 2316,
`http://localhost:${PORT}/api/music/...`). Da `PORT` in `server.js` definiert bleibt
(siehe Schritt 8), muss es zusätzlich importiert werden. Da `PORT` aber erst nach dem
Erstellen von `app` in `server.js` steht, empfiehlt sich hier ein Reihenfolge-Kniff:
`PORT` in `server/config/media-paths.js` (Schritt 1) NICHT verschieben, sondern separat
exportieren aus `server.js` — ODER (einfacher, ohne Logik zu ändern) `PORT` als
Parameter/Property beim Router-Setup übergeben, z.B.:
```js
// server.js:
import createVideoRouter from './routes/video.js'
app.use(createVideoRouter(PORT))
```
```js
// routes/video.js:
export default function createVideoRouter(PORT) {
  const router = express.Router()
  // ... alle Routen wie gewohnt mit router.get/post ...
  return router
}
```
Das ist reines "Verpacken", keine Logik-Änderung — der Wert von `PORT` bleibt identisch.

**Neue Exports in `routes/video.js`:**
```js
export default createVideoRouter
```

**Was sich in `server.js` ändert:**
- Alle oben gelisteten Zeilenblöcke werden entfernt.
- Die dynamische Remotion-Import-Logik (`getRemotionRenderer`) zieht komplett mit um.
- Import + Einbindung ergänzen:
  ```js
  import createVideoRouter from './routes/video.js'
  // ... nach app.use(contentRouter):
  app.use(createVideoRouter(PORT))
  ```
- `PORT` selbst bleibt in `server.js` definiert (Zeile 103) — nur die Verwendung wird per
  Parameter weitergegeben.

**TESTHINWEIS:**
1. Video-Slideshow: Starte einen neuen Slideshow-Job (wie in Schritt 2/4), bis zum fertigen Download.
2. Grok-Video (falls konfiguriert): Starte eine Video-Generierung im Berichte-Tab, prüfe Statuspolling.
3. Remotion-Render: Falls im Frontend nutzbar, starte einen Remotion-Videorender mit 2-3 Bildern,
   warte auf "completed" und lade das Ergebnis herunter.
4. Öffne `.../api/render-remotion/check` — sollte JSON mit `"remotion": "installed"` (oder
   nachvollziehbarer Fehlermeldung) liefern, kein 500-Absturz.
5. Öffne `.../api/music/list` — sollte eine Liste der Musikdateien liefern.
6. Wenn ALLE Punkte funktionieren: Schritt abhaken.

---

## Schritt 8 — `server/routes/tiktok.js` (TikTok-Text-Generator, Vision-Analyse)

**Risiko:** höchstes Risiko (komplexeste, am stärksten verschachtelte Logik: Fallback-Ketten
zwischen Groq/Claude/OpenRouter, Retry-Logik, JSON-Parsing mit mehreren Fallback-Strategien,
Positions-erhaltendes Text-Merging). Deshalb als letzter Schritt.

**Was verschoben wird:**
- Zeile 2548–2553: Konstante `VISION_PROMPT`
- Zeile 2556–2617: Funktion `analyzeOneImage`
- Zeile 2619–2667: Route `app.post('/api/tiktok/analyze-images', ...)`
- Zeile 2671–2892: Route `app.post('/api/tiktok/generate-text', ...)`

**Neue Imports in `routes/tiktok.js`:**
```js
import express from 'express'
import axios from 'axios'
import { generateTikTokUserPrompt, FOSTER_HUNTINGTON_SYSTEM_PROMPT } from '../../src/config/prompts/index.js'

const router = express.Router()
```

**Neue Exports in `routes/tiktok.js`:**
```js
export default router
```

**Was sich in `server.js` ändert:**
- Die Zeilen 2548–2892 werden entfernt.
- Import + Einbindung ergänzen:
  ```js
  import tiktokRouter from './routes/tiktok.js'
  // ... nach app.use(createVideoRouter(PORT)):
  app.use(tiktokRouter)
  ```

**Was NACH diesem Schritt in `server.js` übrig bleibt (Kern-Rumpf):**
- Alle Top-Level-Imports (express, cors, multer, axios, promotion-api, bot-middleware, etc.)
- `const app = express()`, `const PORT = ...`
- `app.use(cors())`, `app.use(express.json())`, `app.use(botMiddleware)`
- Router-Einbindungen (`app.use(contentRouter)`, `app.use(createVideoRouter(PORT))`, `app.use(tiktokRouter)`, `app.use(promotionRouter)`)
- Der globale Error-Handler (Zeile 2074–2085)
- `/api/health` (Zeile 2166–2179)
- `/api/bot-cache/clear` (Zeile 2183–2186)
- `app.listen(...)` am Ende

**TESTHINWEIS:**
1. Gehe zum TikTok/Video-Text-Generator Bereich im Frontend.
2. Lade 3-5 Testbilder hoch und lasse die Bild-Analyse laufen (Vision-Beschreibungen sollten erscheinen).
3. Generiere anschließend den TikTok-Text (Hook, Body-Zeilen, CTA, Hashtags) — prüfe, dass
   die Anzahl der Textzeilen zur Bildanzahl passt.
4. Wenn das funktioniert: Schritt abhaken.

---

## Abschließender Gesamttest (nach Schritt 8)

Nachdem ALLE 8 Schritte abgeschlossen sind, einmal die komplette Webseite von vorne bis
hinten durchklicken:

1. Startseite / Homepage lädt fehlerfrei.
2. Publish-Seite: alle 5 Content-Tabs (Medien, Trips, Berichte, Plätze, Note) funktionieren.
3. Slideshow-Video-Generator funktioniert (kompletter Job bis Download).
4. Grok-Video-Generierung funktioniert (falls API-Key konfiguriert).
5. Remotion-Video-Render funktioniert (falls genutzt).
6. TikTok-Text-Generator funktioniert.
7. `/api/health` liefert weiterhin ein gültiges JSON.
8. Keine Fehler in der Browser-Konsole beim normalen Durchklicken.

---

## Checkliste

- [x] Schritt 1 — `server/config/media-paths.js` (FFMPEG/FFPROBE/MUSIC_DIR/TMP_DIR)
- [x] Schritt 2 — `server/config/music-prompts.js` (ZOOM_PAN_EFFECTS/ASPECT_SIZES/LIFESTYLE_MUSIC_PROMPTS)
- [x] Schritt 3 — `server/utils/http-helpers.js` (handleMulterError/sanitizeInput/validateApiKey/safelyParseJSON)
- [x] Schritt 4 — `server/utils/image-ffmpeg.js` (getLocalMusicFile/downloadImage/generateElevenLabsMusic/buildFilterComplex/readJpegDimensions/runFfmpeg)
- [ ] Schritt 5 — `server/services/ai-content.js` (generateWithModel)
- [ ] Schritt 6 — `server/routes/content.js` (5 Content-Generierungs-Routen)
- [ ] Schritt 7 — `server/routes/video.js` (Grok-Video, Slideshow, Remotion-Routen + Job-Stores)
- [ ] Schritt 8 — `server/routes/tiktok.js` (Vision-Analyse + TikTok-Text-Generator)
- [ ] Abschließender Gesamttest durchgeführt
