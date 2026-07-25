# PLAN.md — Schrittweiser Refactoring-Plan für `server/`

**Ziel:** Große Dateien aus `server/` in kleine, thematische Module aufteilen, ohne Logik zu ändern.\
**Regeln:** Nur Code verschieben, keine Umbenennungen, keine Verbesserungen.

**Ausgangslage (Dateien > 500 Zeilen):**
- `server/routes/video.js` — 1.429 Zeilen
- `server/routes/content.js` — 924 Zeilen
- `server/promotion-api.js` — 800 Zeilen
- `server/bot-middleware.js` — 691 Zeilen
- `server/remotion/render.js` — 632 Zeilen
- `server/remotion/MojoBusVideo.tsx` — 526 Zeilen

**Risikoreihenfolge:** Konstanten/Konfiguration zuerst, dann unabhängige Hilfsfunktionen, dann vernetzte Routen, zuletzt Remotion-Komponenten.

---

## Zielstruktur (Übersicht)

```
server/
├── server.js                       # mountet nur noch Module
├── routes/
│   ├── content/
│   │   ├── index.js                # baut content-Router zusammen
│   │   ├── vision.js               # geteilte Vision-Analyse
│   │   ├── media.js                # /api/generate-media-article
│   │   ├── trip.js                 # /api/generate-trip
│   │   ├── article.js              # /api/generate-article
│   │   ├── place.js                # /api/generate-place
│   │   └── note.js                 # /api/generate-note
│   ├── video/
│   │   ├── index.js                # baut video-Router zusammen
│   │   ├── helpers.js              # kleine Hilfsfunktionen
│   │   ├── legacy-slideshow.js     # /api/generate-slideshow (FFmpeg)
│   │   ├── xai.js                  # /api/generate-video, /api/video-status
│   │   ├── transcode.js            # /api/transcode-video
│   │   ├── music.js                # /api/music/*
│   │   └── remotion.js             # /api/render-remotion/*
│   ├── tiktok/
│   │   ├── index.js                # baut tiktok-Router zusammen
│   │   ├── vision.js               # /api/tiktok/analyze-images
│   │   ├── text.js                 # /api/tiktok/generate-text
│   │   └── upload.js               # /api/tiktok/upload-media
│   └── promotion/
│       ├── index.js                # baut promotion-Router zusammen
│       ├── config.js               # Konstanten + TEMPLATES
│       ├── utils.js                # Helper + Vision-Analyse
│       ├── ai.js                   # generateWithKi
│       └── routes.js               # /api/promotion/* Endpunkte
├── bot/
│   ├── config.js                   # BOT_USER_AGENTS, STATIC_PAGE_META ...
│   ├── utils.js                    # isBot, parseNostrPath ...
│   ├── relay.js                    # fetchNostrEvent
│   ├── html.js                     # buildBotHtml
│   └── middleware.js               # botMiddleware, Cache-Stats
└── remotion/
    ├── render/
    │   ├── core.js                 # renderMojoBusVideo (verkleinert)
    │   ├── thumbnail.js            # renderMojoBusThumbnail
    │   └── utils.js                # Hilfsfunktionen aus render.js
    └── flows/
        ├── ShortsLayer.tsx          # TikTok/Reels-spezifische Layer
        ├── LongformLayer.tsx        # YouTube-spezifische Layer
        └── MojoBusVideo.tsx        # verkleinerte Hauptkomponente
```

---

## Schritt 1 — `server/bot/config.js` (Konstanten/Konfig)

**Neuer Dateiname:** `server/bot/config.js`

**Verschieben aus `server/bot-middleware.js`:**
- Zeilen 41–44: Konstanten `SITE_URL`, `SITE_NAME`, `SITE_LOGO`, `DEFAULT_OG_IMAGE`
- Zeilen 47–50: Konstante `BOT_RELAYS`
- Zeilen 54: Konstante `RELAY_TIMEOUT`
- Zeilen 58–59: Konstanten `responseCache` (Map) und `CACHE_TTL`
- Zeilen 67–192: Konstante `BOT_USER_AGENTS` (Array)
- Zeilen 494–537: Konstante `STATIC_PAGE_META`

**Exports in `server/bot/config.js`:**
```js
export { SITE_URL, SITE_NAME, SITE_LOGO, DEFAULT_OG_IMAGE };
export { BOT_RELAYS, RELAY_TIMEOUT };
export { responseCache, CACHE_TTL };
export { BOT_USER_AGENTS };
export { STATIC_PAGE_META };
```

**Änderung in `server/bot-middleware.js`:**
- Ersetze obige Konstanten durch:
```js
import {
  SITE_URL, SITE_NAME, SITE_LOGO, DEFAULT_OG_IMAGE,
  BOT_RELAYS, RELAY_TIMEOUT,
  responseCache, CACHE_TTL,
  BOT_USER_AGENTS, STATIC_PAGE_META
} from './config.js'
```

**Änderung in `server.js`:**
- Keine Änderung — `bot-middleware.js` wird weiterhin importiert.

**Testhinweis:**
1. Öffne `https://mojobus.co/api/health`.
2. Prüfe, ob `botMiddleware: { status: 'active', cache: {...} }` noch vorhanden ist.
3. Rufe einen Artikel-Link (z. B. `https://mojobus.co/naddr1...`) mit einem Bot-User-Agent auf (z. B. via `curl -A "googlebot"`) und prüfe, ob `<title>` und OG-Tags korrekt im HTML stehen.

---

## Schritt 2 — `server/routes/promotion/config.js` (Konstanten/Konfig)

**Neuer Dateiname:** `server/routes/promotion/config.js`

**Verschieben aus `server/promotion-api.js`:**
- Zeilen 22: Konstante `PINS_FILE`
- Zeilen 28: Konstante `STARTDATUM`
- Zeilen 35–48: Funktion `getTagnummer(datum)`
- Zeilen 50–65: Funktion `buildStoryTag(ort, datum)`
- Zeilen 233–258: Konstante `KEYWORD_DATA`
- Zeilen 260–513: Konstante `TEMPLATES`
- Zeilen 515–643: Konstante `LIFESTYLE_PINTEREST_CONFIG`

**Exports in `server/routes/promotion/config.js`:**
```js
export { PINS_FILE };
export { STARTDATUM, getTagnummer, buildStoryTag };
export { KEYWORD_DATA, TEMPLATES, LIFESTYLE_PINTEREST_CONFIG };
```

**Änderung in `server/promotion-api.js`:**
- Ersetze obige Konstanten/Funktionen durch:
```js
import {
  PINS_FILE,
  STARTDATUM, getTagnummer, buildStoryTag,
  KEYWORD_DATA, TEMPLATES, LIFESTYLE_PINTEREST_CONFIG
} from './config.js'
```

**Änderung in `server.js`:**
- Keine Änderung — `promotion-api.js` wird weiterhin importiert.

**Testhinweis:**
1. Gehe im Browser zur Pinterest-Promotion-Seite.
2. Wähle einen Artikel und das Template „MojoBus Story" aus.
3. Prüfe, ob `storyTag` mit „Tag XXXX“ generiert wird.
4. Wähle ein anderes Template (z. B. „Infografik") und prüfe, ob `pinData` weiterhin JSON mit `pinTitle`, `pinDescription`, `hashtags` enthält.

---

## Schritt 3 — `server/routes/tiktok/config.js` (Konstanten/Konfig)

**Neuer Dateiname:** `server/routes/tiktok/config.js`

**Verschieben aus `server/routes/tiktok.js`:**
- Zeilen 23–30: Konstante `VISION_PROMPT`

**Exports in `server/routes/tiktok/config.js`:**
```js
export { VISION_PROMPT };
```

**Änderung in `server/routes/tiktok.js`:**
- Ersetze die Konstante durch:
```js
import { VISION_PROMPT } from './config.js'
```

**Änderung in `server.js`:**
- Keine Änderung — `tiktok.js` wird weiterhin importiert.

**Testhinweis:**
1. Öffne im Browser die Video-Generator-Seite.
2. Lade 3–4 Bilder hoch.
3. Klicke auf „Bilder analysieren".
4. Prüfe, ob für jedes Bild eine kurze Beschreibung zurückkommt (z. B. in den Bild-Tooltips).

---

## Schritt 4 — `server/bot/utils.js` (unabhängige Hilfsfunktionen)

**Neuer Dateiname:** `server/bot/utils.js`

**Verschieben aus `server/bot-middleware.js`:**
- Zeilen 203–207: Funktion `isBot(userAgent)`
- Zeilen 214–222: Funktion `escapeHtml(str)`
- Zeilen 230–235: Funktion `truncate(str, maxLen)`
- Zeilen 242–261: Funktion `extractImageFromEvent(event)`
- Zeilen 268–288: Funktion `extractEventMetadata(event)`
- Zeilen 463–487: Funktion `parseNostrPath(pathname)`

**Exports in `server/bot/utils.js`:**
```js
export { isBot, escapeHtml, truncate, extractImageFromEvent, extractEventMetadata, parseNostrPath };
```

**Änderung in `server/bot-middleware.js`:**
- Ersetze obige Funktionen durch:
```js
import { isBot, escapeHtml, truncate, extractImageFromEvent, extractEventMetadata, parseNostrPath } from './utils.js'
```

**Änderung in `server.js`:**
- Keine Änderung.

**Testhinweis:**
1. Öffne `https://mojobus.co/api/health`.
2. Poste auf `https://mojobus.co/api/bot-cache/clear` — sollte weiterhin funktionieren.
3. Rufe eine Nostr-Route mit Bot-User-Agent auf und prüfe, ob Title/Beschreibung korrekt escaped sind (keine `<`/`>` sichtbar).

---

## Schritt 5 — `server/routes/promotion/utils.js` (unabhängige Hilfsfunktionen)

**Neuer Dateiname:** `server/routes/promotion/utils.js`

**Verschieben aus `server/promotion-api.js`:**
- Zeilen 66–69: Konstante/Funktion `sanitizeInput`
- Zeilen 71–77: Konstante/Funktion `validateApiKey`
- Zeilen 79–87: Konstante/Funktion `safelyParseJSON`
- Zeilen 103–140: Funktion `analyzeImageWithVision(imageUrl)`
- Zeilen 209–222: Funktion `parsePinJson(rawText)`

**Exports in `server/routes/promotion/utils.js`:**
```js
export { sanitizeInput, validateApiKey, safelyParseJSON, analyzeImageWithVision, parsePinJson };
```

**Änderung in `server/promotion-api.js`:**
- Ersetze obige Funktionen durch:
```js
import { sanitizeInput, validateApiKey, safelyParseJSON, analyzeImageWithVision, parsePinJson } from './utils.js'
```

**Änderung in `server.js`:**
- Keine Änderung.

**Testhinweis:**
1. Generiere einen Pin-Text mit einem Bild-URL.
2. Prüfe im Response, ob `imageAnalyzed: true` und `imageDescription` gefüllt ist.
3. Teste die Fehlerbehandlung: Sende einen sehr langen Titel (>500 Zeichen) — er sollte weiterhin auf 500 Zeichen gekürzt werden.

---

## Schritt 6 — `server/routes/promotion/ai.js` (KI-Modell-Funktion)

**Neuer Dateiname:** `server/routes/promotion/ai.js`

**Verschieben aus `server/promotion-api.js`:**
- Zeilen 147–207: Funktion `generateWithKi(prompt, systemPrompt, model, maxTokens, temperature)`

**Exports in `server/routes/promotion/ai.js`:**
```js
export { generateWithKi };
```

**Änderung in `server/promotion-api.js`:**
- Ersetze die Funktion durch:
```js
import { generateWithKi } from './ai.js'
```

**Änderung in `server.js`:**
- Keine Änderung.

**Testhinweis:**
1. Generiere einen Pin-Text mit Modell „llama4".
2. Wiederhole mit Modell „claude".
3. Prüfe im Response-JSON `pinData.model`, dass das verwendete Modell angegeben wird.

---

## Schritt 7 — `server/routes/tiktok/vision.js` (Bildanalyse-Funktion)

**Neuer Dateiname:** `server/routes/tiktok/vision.js`

**Verschieben aus `server/routes/tiktok.js`:**
- Zeilen 31–93: Funktion `analyzeOneImage(imageUrl, preferredModel)`
- Zeilen 94–141: Route `router.post('/api/tiktok/analyze-images', ...)`

**Inhalt in `server/routes/tiktok/vision.js`:**
- Importe aus `tiktok.js`: `express`, `axios`
- Import: `VISION_PROMPT` aus `./config.js`
- Erstelle `const router = express.Router()`
- Kopiere `analyzeOneImage`
- Kopiere den Endpunkt `/api/tiktok/analyze-images`
- `export default router`

**Exports in `server/routes/tiktok/vision.js`:**
```js
export { analyzeOneImage };
export default router;
```

**Änderung in `server/routes/tiktok.js`:**
- Entferne `analyzeOneImage` und `/api/tiktok/analyze-images`.
- Zusätzlich importieren:
```js
import visionRouter from './vision.js'
```
- Füge vor `export default router` hinzu:
```js
router.use(visionRouter)
```
ODER baue `server/routes/tiktok/index.js` in Schritt 8.

**Änderung in `server.js`:**
- Keine Änderung.

**Testhinweis:**
1. Öffne die Video-Generator-Seite.
2. Lade 5 Bilder hoch.
3. Klicke auf „Bilder analysieren".
4. Alle 5 Bilder sollten eine Beschreibung erhalten (ggf. leerer String bei Fehler).

---

## Schritt 8 — `server/routes/tiktok/text.js` (Text-Generierung)

**Neuer Dateiname:** `server/routes/tiktok/text.js`

**Verschieben aus `server/routes/tiktok.js`:**
- Zeilen 146–368: Route `router.post('/api/tiktok/generate-text', ...)`

**Inhalt in `server/routes/tiktok/text.js`:**
- Importe aus `tiktok.js`: `express`, `axios`
- Importe aus Prompt-Datei: `generateTikTokUserPrompt`, `FOSTER_HUNTINGTON_SYSTEM_PROMPT` aus `'../../src/config/prompts/index.js'`
- Erstelle `const router = express.Router()`
- Kopiere den Endpunkt `/api/tiktok/generate-text`
- `export default router`

**Änderung in `server/routes/tiktok.js`:**
- Entferne den Endpunkt `/api/tiktok/generate-text`.
- Importiere stattdessen:
```js
import textRouter from './text.js'
import visionRouter from './vision.js'
```
- Füge vor `export default router` hinzu:
```js
router.use(textRouter)
router.use(visionRouter)
```

**Exports in `server/routes/tiktok.js`:**
```js
export default router
```

**Änderung in `server.js`:**
- Keine Änderung.

**Testhinweis:**
1. Öffne die Video-Generator-Seite.
2. Gib einen Titel ein und wähle ein Template (z. B. „story").
3. Klicke auf „KI-Text generieren".
4. Prüfe, ob `hook`, `bodyLines`, `bridge`, `cta` und `hashtags` zurückkommen.

---

## Schritt 9 — `server/routes/content/vision.js` (geteilte Vision-Analyse)

**Neuer Dateiname:** `server/routes/content/vision.js`

**Verschieben aus `server/routes/content.js`:**
- Erstelle eine Hilfsfunktion `analyzeImageBase64(base64, mimeType, analysisPrompt, maxTokens)`.
Diese kapselt den wiederkehrenden Groq-Vision-Call aus `content.js` (z. B. Zeilen 90–105, 290–305, 508–523, 718–732, 874–888), der in fast allen Routen identisch ist.

**Konkret:**
- Kopiere den axios-Call aus einer der Routen (z. B. Zeilen 90–105 für Media-Artikel).
- Ersetze `getMediaImageAnalysisPrompt(lifestyleConfig)` durch einen Parameter `analysisPrompt`.
- Ersetze `max_tokens: 150` durch einen Parameter `maxTokens` (Default 150).

**Exports in `server/routes/content/vision.js`:**
```js
export async function analyzeImageBase64(base64, mimeType, analysisPrompt, maxTokens = 150) { ... }
export default { analyzeImageBase64 }
```

**Änderung in `server/routes/content.js`:**
- Füge import hinzu:
```js
import { analyzeImageBase64 } from './vision.js'
```
- Ersetze in jeder Route den direkten axios-Post durch `await analyzeImageBase64(base64, mimeType, promptText, maxTokens)`.

**Änderung in `server.js`:**
- Keine Änderung — `content.js` bleibt einziger Import.

**Testhinweis:**
1. Gehe zur Seite „Veröffentlichen" → Tab „Medien".
2. Lade 2 Bilder hoch und generiere einen Artikel.
3. Prüfe, ob `imageDescriptions` im Response gefüllt ist.
4. Wiederhole für „Trips", „Berichte", „Plätze", „Notizen".

---

## Schritt 10 — `server/bot/relay.js` (Nostr-Relay-Abfrage)

**Neuer Dateiname:** `server/bot/relay.js`

**Verschieben aus `server/bot-middleware.js`:**
- Zeilen 298–333: Funktion `fetchNostrEvent({ kind, pubkey, identifier, eventId })`

**Inhalt in `server/bot/relay.js`:**
- Importe: `SimplePool` aus `nostr-tools`, `WebSocket` aus `ws` (Setze `global.WebSocket = WebSocket`)
- Import: `BOT_RELAYS`, `RELAY_TIMEOUT` aus `./config.js`
- Kopiere `fetchNostrEvent`

**Exports in `server/bot/relay.js`:**
```js
export { fetchNostrEvent };
```

**Änderung in `server/bot-middleware.js`:**
- Entferne den Import von `SimplePool` und `WebSocket` (wenn nicht mehr anders gebraucht).
- Entferne `fetchNostrEvent`.
- Füge import hinzu:
```js
import { fetchNostrEvent } from './relay.js'
```

**Änderung in `server.js`:**
- Keine Änderung.

**Testhinweis:**
1. Rufe mit Bot-User-Agent einen Longform-Artikel auf: `curl -A "googlebot" https://mojobus.co/naddr1...`
2. Prüfe, ob `og:title` und `og:description` den Artikel-Inhalt zeigen (nicht generische Homepage).

---

## Schritt 11 — `server/bot/html.js` (HTML-Template)

**Neuer Dateiname:** `server/bot/html.js`

**Verschieben aus `server/bot-middleware.js`:**
- Zeilen 340–451: Funktion `buildBotHtml(meta)`

**Inhalt in `server/bot/html.js`:**
- Importe: `escapeHtml`, `SITE_URL`, `SITE_NAME`, `SITE_LOGO`, `DEFAULT_OG_IMAGE` aus `./config.js`
- Kopiere `buildBotHtml`

**Exports in `server/bot/html.js`:**
```js
export { buildBotHtml };
```

**Änderung in `server/bot-middleware.js`:**
- Entferne `buildBotHtml`.
- Füge import hinzu:
```js
import { buildBotHtml } from './html.js'
```

**Änderung in `server.js`:**
- Keine Änderung.

**Testhinweis:**
1. Rufe `https://mojobus.co/api/health` auf.
2. Prüfe, ob Cache-Statistik weiterhin angezeigt wird.
3. Rufe Homepage mit Bot-Agent auf: `curl -A "twitterbot" https://mojobus.co/`.
4. Prüfe, ob `<title>MojoBus — Perpetual Travelers` und `<meta property="og:image"` im HTML enthalten sind.

---

## Schritt 12 — `server/bot/middleware.js` (Hauptdatei ersetzen / verkleinern)

**Neuer Dateiname:** `server/bot/middleware.js`

**Verschieben aus `server/bot-middleware.js`:**
- Zeilen 552–669: Hauptfunktion `botMiddleware`
- Zeilen 672–681: Funktion `getBotCacheStats`
- Zeilen 684–689: Funktion `clearBotCache`

**Inhalt in `server/bot/middleware.js`:**
- Importe aus `./config.js`: `responseCache`, `CACHE_TTL`, `STATIC_PAGE_META`, `SITE_URL`
- Importe aus `./utils.js`: `isBot`, `parseNostrPath`
- Import aus `./relay.js`: `fetchNostrEvent`
- Import aus `./html.js`: `buildBotHtml`
- Import aus `./utils.js`: `extractEventMetadata`
- Kopiere `botMiddleware`, `getBotCacheStats`, `clearBotCache`

**Exports in `server/bot/middleware.js`:**
```js
export { botMiddleware, getBotCacheStats, clearBotCache };
export default botMiddleware;
```

**Änderung in `server.js`:**
- Ändere Import:
```js
import { botMiddleware, getBotCacheStats, clearBotCache } from './bot/middleware.js'
```
- Entferne Import `bot-middleware.js`.
- Lösche nach erfolgreichem Test die alte Datei `server/bot-middleware.js`.

**Testhinweis:**
1. Öffne `https://mojobus.co/api/health`.
2. `botMiddleware.status` muss weiterhin `active` sein.
3. Rufe `https://mojobus.co/api/bot-cache/clear` → Response `ok: true`.

---

## Schritt 13 — `server/routes/promotion/routes.js` (Router-Endpunkte)

**Neuer Dateiname:** `server/routes/promotion/routes.js`

**Verschieben aus `server/promotion-api.js`:**
- Zeilen 608–723: Route `POST /api/promotion/generate-pin-text`
- Zeilen 725–741: Route `GET /api/promotion/pins`
- Zeilen 744–775: Route `POST /api/promotion/pins`
- Zeilen 778–797: Route `DELETE /api/promotion/pins/:pinId`

**Inhalt in `server/routes/promotion/routes.js`:**
- Importe: `express`, `fs`
- Import aus `./config.js`: `PINS_FILE`, `TEMPLATES`, `LIFESTYLE_PINTEREST_CONFIG`, `STARTDATUM`, `getTagnummer`, `buildStoryTag`
- Import aus `./utils.js`: `sanitizeInput`, `validateApiKey`, `analyzeImageWithVision`, `parsePinJson`
- Import aus `./ai.js`: `generateWithKi`
- Erstelle `const router = express.Router()`
- Kopiere alle vier Endpunkte
- `export default router`

**Änderung in `server/promotion-api.js`:**
- Entferne alle vier Endpunkte.
- Füge import hinzu:
```js
import promotionRoutes from './routes.js'
```
- Füge hinzu:
```js
router.use(promotionRoutes)
```
- Datei reduziert sich auf Importe + `export default router`.

**Änderung in `server.js`:**
- Keine Änderung.

**Testhinweis:**
1. Gehe zur Pinterest-Promotion-Seite.
2. Generiere einen Pin, speichere ihn.
3. Lade die Pin-Liste neu — der gespeicherte Pin muss erscheinen.
4. Lösche den Pin — er muss aus der Liste verschwinden.

---

## Schritt 14 — `server/routes/promotion/index.js` (Zusammenbau)

**Neuer Dateiname:** `server/routes/promotion/index.js`

**Inhalt:**
```js
import express from 'express'
import promotionRoutes from './routes.js'

const router = express.Router()
router.use(promotionRoutes)

export default router
```

**Änderung in `server/promotion-api.js`:**
- Ersetze den Inhalt komplett durch den Inhalt der neuen `index.js`.
- Alternative: Nach Schritt 13 enthält `promotion-api.js` nur noch Importe + `router.use(promotionRoutes)`.

**Änderung in `server.js`:**
- Ändere Import:
```js
import promotionRouter from './routes/promotion/index.js'
```
- Entferne Import `promotion-api.js`.
- Lösche nach erfolgreichem Test die alte Datei `server/promotion-api.js`.

**Testhinweis:**
1. Wiederhole Test aus Schritt 13.
2. Prüfe, dass keine `promotion-api.js` mehr existiert.

---

## Schritt 15 — `server/routes/tiktok/upload.js` (Upload-Route umziehen)

**Neuer Dateiname:** `server/routes/tiktok/upload.js`

**Verschieben aus `server/routes/tiktokUpload.js`:**
- Die komplette Datei `server/routes/tiktokUpload.js` inklusive:
  - Konstante `MIME_MAP`
  - Multer-Konfiguration
  - Route `POST /api/tiktok/upload-media`
  - Route `GET /api/tiktok/uploads/:filename`
  - Funktion `cleanupExpiredTikTokUploads`
  - `setInterval`

**Inhalt in `server/routes/tiktok/upload.js`:**
- Kopiere den Inhalt von `server/routes/tiktokUpload.js` 1:1.
- `export default router`

**Änderung in `server/routes/tiktok/index.js`:**
- Neu erstellte Datei fasst alles zusammen:
```js
import express from 'express'
import textRouter from './text.js'
import visionRouter from './vision.js'
import uploadRouter from './upload.js'

const router = express.Router()
router.use(textRouter)
router.use(visionRouter)
router.use(uploadRouter)

export default router
```

**Änderung in `server/routes/tiktok.js`:**
- Ersetze Inhalt durch `index.js`-Inhalt oder lösche Datei und benenne `index.js` um.

**Änderung in `server.js`:**
- Entferne `import tiktokUploadRouter from './routes/tiktokUpload.js'`.
- Entferne `app.use(tiktokUploadRouter)`.
- Ändere Import:
```js
import tiktokRouter from './routes/tiktok/index.js'
```
- Lösche nach erfolgreichem Test `server/routes/tiktok.js` und `server/routes/tiktokUpload.js`.

**Testhinweis:**
1. Öffne Video-Generator → Schritt „Inhalt".
2. Lade ein Bild oder Video hoch.
3. Warte auf die Upload-URL (`/api/tiktok/uploads/...`).
4. Das Bild/Video muss im Frontend als Vorschau sichtbar sein.

---

## Schritt 16 — `server/routes/content/media.js` (Media-Artikel-Route)

**Neuer Dateiname:** `server/routes/content/media.js`

**Verschieben aus `server/routes/content.js`:**
- Zeilen 38–198: Route `POST /api/generate-media-article`

**Inhalt in `server/routes/content/media.js`:**
- Importe aus `content.js`: `express`, `multer`, `axios`
- Import aus `../../src/config/prompts/index.js`: `getLifestyleConfig`, `generateMediaPrompt`, `getMediaImageAnalysisPrompt`, `getMediaVideoAnalysisPrompt`
- Import aus `../utils/http-helpers.js`: `handleMulterError`, `sanitizeInput`, `validateApiKey`, `safelyParseJSON`
- Import aus `../services/ai-content.js`: `generateWithModel`
- Import aus `./vision.js`: `analyzeImageBase64`
- Erstelle `const router = express.Router()`
- Kopiere die Multer-Config und den Endpunkt
- `export default router`

**Änderung in `server/routes/content.js`:**
- Entferne Route `POST /api/generate-media-article`.
- Füge import hinzu:
```js
import mediaRouter from './media.js'
```
- Füge vor `export default router` hinzu:
```js
router.use(mediaRouter)
```

**Änderung in `server.js`:**
- Keine Änderung.

**Testhinweis:**
1. Gehe zu „Veröffentlichen" → Tab „Medien".
2. Lade 2 Bilder oder ein Video hoch.
3. Klicke auf „KI-Text generieren".
4. Es sollte ein kurzer Artikel mit Hashtags zurückkommen.

---

## Schritt 17 — `server/routes/content/trip.js` (Trip-Route)

**Neuer Dateiname:** `server/routes/content/trip.js`

**Verschieben aus `server/routes/content.js`:**
- Zeilen 204–452: Route `POST /api/generate-trip`

**Inhalt in `server/routes/content/trip.js`:**
- Importe wie in `content.js` plus `./vision.js` für `analyzeImageBase64`.
- Kopiere den Endpunkt.
- `export default router`

**Änderung in `server/routes/content.js`:**
- Entferne Route.
- Importiere `tripRouter` und füge `router.use(tripRouter)` hinzu.

**Testhinweis:**
1. Gehe zu „Veröffentlichen" → Tab „Trips".
2. Lade mehrere Stationsbilder hoch.
3. Generiere Trip.
4. Prüfe, ob `article` und `captions[]` im Response sind.

---

## Schritt 18 — `server/routes/content/article.js` (Bericht-Route)

**Neuer Dateiname:** `server/routes/content/article.js`

**Verschieben aus `server/routes/content.js`:**
- Zeilen 456–656: Route `POST /api/generate-article`

**Inhalt in `server/routes/content/article.js`:**
- Importe wie in `content.js` plus `./vision.js`.
- Kopiere den Endpunkt.
- `export default router`

**Änderung in `server/routes/content.js`:**
- Entferne Route.
- Importiere `articleRouter` und füge `router.use(articleRouter)` hinzu.

**Testhinweis:**
1. Gehe zu „Veröffentlichen" → Tab „Berichte".
2. Lade ein Titelbild hoch und gib Text ein.
3. Generiere Bericht.
4. Prüfe, ob `article`, `summary` und `titleSuggestions` im Response sind.

---

## Schritt 19 — `server/routes/content/place.js` (Platz-Route)

**Neuer Dateiname:** `server/routes/content/place.js`

**Verschieben aus `server/routes/content.js`:**
- Zeilen 660–833: Route `POST /api/generate-place`

**Inhalt:** analog zu Schritt 18/19.

**Testhinweis:**
1. Gehe zu „Veröffentlichen" → Tab „Plätze".
2. Lade Bilder hoch.
3. Generiere Platz-Beschreibung.
4. Prüfe, ob `description` und `hashtags` im Response sind.

---

## Schritt 20 — `server/routes/content/note.js` (Notiz-Route)

**Neuer Dateiname:** `server/routes/content/note.js`

**Verschieben aus `server/routes/content.js`:**
- Zeilen 837–923: Route `POST /api/generate-note`

**Inhalt:** analog zu Schritt 18/19.

**Testhinweis:**
1. Gehe zu „Veröffentlichen" → Tab „Note".
2. Lade ein Bild hoch.
3. Generiere Notiz.
4. Prüfe, ob `note` und `hashtags` im Response sind.

---

## Schritt 21 — `server/routes/content/index.js` (Content-Router zusammenbauen)

**Neuer Dateiname:** `server/routes/content/index.js`

**Inhalt:**
```js
import express from 'express'
import mediaRouter from './media.js'
import tripRouter from './trip.js'
import articleRouter from './article.js'
import placeRouter from './place.js'
import noteRouter from './note.js'

const router = express.Router()
router.use(mediaRouter)
router.use(tripRouter)
router.use(articleRouter)
router.use(placeRouter)
router.use(noteRouter)

export default router
```

**Änderung in `server/routes/content.js`:**
- Ersetze Inhalt durch `index.js`-Inhalt oder lösche Datei und benenne `index.js` um.

**Änderung in `server.js`:**
- Ändere Import:
```js
import contentRouter from './routes/content/index.js'
```
- Lösche nach erfolgreichem Test `server/routes/content.js`.

**Testhinweis:**
1. Teste alle 5 Tabs aus Schritt 16–20 erneut.
2. Alle API-Endpunkte (`/api/generate-media-article`, `/api/generate-trip`, `/api/generate-article`, `/api/generate-place`, `/api/generate-note`) müssen weiterhin funktionieren.

---

## Schritt 22 — `server/routes/video/helpers.js` (kleine Hilfsfunktionen)

**Neuer Dateiname:** `server/routes/video/helpers.js`

**Verschieben aus `server/routes/video.js`:**
- Zeilen 906–916: Funktion `resolveIntroUrl(filename, subfolder)`
- Optional: Die `lifestyleMap` (Zeilen 109–117) als Konstante `XAI_LIFESTYLE_MAP`.

**Inhalt in `server/routes/video/helpers.js`:**
- Importe: `path`, `fs`
- Import aus `../config/media-paths.js`: `MUSIC_DIR`
- Kopiere `lifestyleMap` und `resolveIntroUrl`

**Exports:**
```js
export { XAI_LIFESTYLE_MAP, resolveIntroUrl };
```

**Änderung in `server/routes/video.js`:**
- Ersetze `lifestyleMap` und `resolveIntroUrl` durch Import.

**Testhinweis:**
1. Starte einen Remotion-Render mit Intro-Sting/Bed.
2. Sting/Bed müssen während des Hooks hörbar sein.

---

## Schritt 23 — `server/routes/video/xai.js` (xAI Video-Routen)

**Neuer Dateiname:** `server/routes/video/xai.js`

**Verschieben aus `server/routes/video.js`:**
- Zeilen 53–223: Route `POST /api/generate-video`
- Zeilen 225–288: Route `GET /api/video-status/:jobId`
- Zeilen 676–710: Route `POST /api/debug-video` (optional, zum Testen)

**Inhalt in `server/routes/video/xai.js`:**
- Importe: `express`, `axios`
- Import aus `./helpers.js`: `XAI_LIFESTYLE_MAP`
- Erstelle `const router = express.Router()`
- Kopiere die drei Endpunkte
- `export default router`

**Änderung in `server/routes/video.js`:**
- Entferne die drei Endpunkte.
- Importiere `xaiRouter` und füge `router.use(xaiRouter)` hinzu.

**Testhinweis:**
1. Rufe `POST /api/generate-video` mit Titel/Bild-URL auf (benötigt `XAI_API_KEY`).
2. Response muss `jobId`, `status: 'pending'` und `prompt` enthalten.
3. Rufe `GET /api/video-status/:jobId` auf — Status muss zurückkommen.

---

## Schritt 24 — `server/routes/video/legacy-slideshow.js` (FFmpeg Slideshow)

**Neuer Dateiname:** `server/routes/video/legacy-slideshow.js`

**Verschieben aus `server/routes/video.js`:**
- Zeilen 295–536: Funktion `runSlideshowJob(jobId, params)`
- Zeilen 538–593: Route `POST /api/generate-slideshow`
- Zeilen 596–610: Route `GET /api/slideshow-music-status`
- Zeilen 612–642: Route `GET /api/slideshow-status/:jobId`
- Zeilen 644–665: Route `GET /api/slideshow-download/:jobId`

**Inhalt in `server/routes/video/legacy-slideshow.js`:**
- Importe: `express`, `multer`, `axios`, `fs`, `path`, `crypto`, `child_process`, `util`
- Importe aus `../config/media-paths.js`: `FFMPEG`, `FFPROBE`, `MUSIC_DIR`, `TMP_DIR`
- Importe aus `../utils/image-ffmpeg.js`: `getLocalMusicFile`, `downloadImage`, `generateElevenLabsMusic`, `buildFilterComplex`, `readJpegDimensions`, `runFfmpeg`
- Erstelle Router
- Kopiere `runSlideshowJob` und alle vier Endpunkte
- Füge `setInterval` für Cleanup hinzu
- `export default router`

**Änderung in `server/routes/video.js`:**
- Entferne Funktion und Endpunkte.
- Entferne Import `buildFilterComplex`, `readJpegDimensions`, `generateElevenLabsMusic` falls nur für Slideshow verwendet (prüfen!).
- Importiere `legacySlideshowRouter` und füge `router.use(legacySlideshowRouter)` hinzu.

**Testhinweis:**
1. Gehe zu „Veröffentlichen" → „Medien" → „Videos erstellen".
2. Wähle mehrere Bilder und lokalen Musikmodus.
3. Starte Slideshow.
4. Polling zeigt `progress` von 0 bis 100, Download-URL erscheint.

---

## Schritt 25 — `server/routes/video/transcode.js` (Video-Transcoding)

**Neuer Dateiname:** `server/routes/video/transcode.js`

**Verschieben aus `server/routes/video.js`:**
- Zeilen 1196–1360: Konstante `transcodeJobs`, Funktion `runTranscodeJob` (inline in den Endpunkten), Endpunkte `/api/transcode-video`, `/api/transcode-video/status/:jobId`, `/api/transcode-video/download/:jobId`

**Inhalt in `server/routes/video/transcode.js`:**
- Importe: `express`, `multer`, `fs`, `path`, `crypto`, `child_process`, `util`
- Importe aus `../config/media-paths.js`: `FFMPEG`, `FFPROBE`, `TMP_DIR`
- Erstelle Router
- Kopiere `transcodeJobs`, Endpunkte
- `export default router`

**Änderung in `server/routes/video.js`:**
- Entferne Transcoding-Endpunkte.
- Importiere `transcodeRouter` und füge `router.use(transcodeRouter)` hinzu.

**Testhinweis:**
1. Gehe zu „Veröffentlichen" → „Medien" → „Videos erstellen".
2. Lade eine große MP4-Datei hoch.
3. Starte Transcoding.
4. Prüfe, ob der Fortschritt steigt und der Download am Ende funktioniert.

---

## Schritt 26 — `server/routes/video/music.js` (Musik-API)

**Neuer Dateiname:** `server/routes/video/music.js`

**Verschieben aus `server/routes/video.js`:**
- Zeilen 1100–1143: Route `GET /api/music/list`
- Zeilen 1171–1190: Route `GET /api/music/*`

**Inhalt in `server/routes/video/music.js`:**
- Importe: `express`, `path`, `fs`
- Import aus `../config/media-paths.js`: `MUSIC_DIR`
- Erstelle Router
- Kopiere beide Endpunkte
- `export default router`

**Änderung in `server/routes/video.js`:**
- Entferne Musik-Endpunkte.
- Importiere `musicRouter` und füge `router.use(musicRouter)` hinzu.

**Testhinweis:**
1. Öffne Video-Generator → Schritt „Musik".
2. Musik-Liste sollte weiterhin Tracks anzeigen.
3. Vorschau eines Tracks muss abspielbar sein.

---

## Schritt 27 — `server/routes/video/remotion.js` (Remotion-Routen)

**Neuer Dateiname:** `server/routes/video/remotion.js`

**Verschieben aus `server/routes/video.js`:**
- Zeilen 39–51: `remotionJobs` Cleanup-Interval und Map
- Zeilen 783–1015: Route `POST /api/render-remotion`
- Zeilen 1017–1035: Route `GET /api/render-remotion/status/:jobId`
- Zeilen 1037–1073: Route `GET /api/render-remotion/download/:jobId`
- Zeilen 1075–1098: Route `GET /api/render-remotion/thumbnail/:jobId`
- Zeilen 1145–1167: Route `GET /api/render-remotion/history`
- Zeilen 1362–1408: Route `GET /api/render-remotion/check`
- Zeilen 1410–1426: Funktionen `handleInvalidateBundle` und Endpunkte `POST /api/render-remotion/invalidate-bundle`, `POST /api/render-remotion/invalidate-cache`

**Inhalt in `server/routes/video/remotion.js`:**
- Importe: `express`, `fs`, `path`, `crypto`
- Import aus `../config/media-paths.js`: `MUSIC_DIR`
- Import aus `./helpers.js`: `resolveIntroUrl`
- Erstelle Router
- Kopiere `remotionJobs` Map + Cleanup
- Kopiere `getRemotionRenderer()` (Zeilen 21–36 falls nicht schon geteilt)
- Kopiere alle Remotion-Endpunkte
- `export default router`

**Änderung in `server/routes/video.js`:**
- Entferne alle Remotion-Endpunkte und `getRemotionRenderer` und `remotionJobs`.
- Importiere `remotionRouter` und füge `router.use(remotionRouter)` hinzu.

**Testhinweis:**
1. Öffne Video-Generator.
2. Lade 5 Bilder, wähle Format 9:16 oder 16:9.
3. Starte Render.
4. Polling zeigt `progress` von 0 bis 100.
5. Download funktioniert.

---

## Schritt 28 — `server/routes/video/index.js` (Video-Router zusammenbauen)

**Neuer Dateiname:** `server/routes/video/index.js`

**Inhalt:**
```js
import express from 'express'
import xaiRouter from './xai.js'
import legacySlideshowRouter from './legacy-slideshow.js'
import transcodeRouter from './transcode.js'
import musicRouter from './music.js'
import remotionRouter from './remotion.js'

export default function createVideoRouter(PORT) {
  const router = express.Router()

  router.use(xaiRouter)
  router.use(legacySlideshowRouter)
  router.use(transcodeRouter)
  router.use(musicRouter)
  router.use(remotionRouter)

  return router
}
```

**Änderung in `server/routes/video.js`:**
- Ersetze Inhalt durch `index.js`-Inhalt oder löschen und `index.js` als Hauptdatei verwenden.

**Änderung in `server.js`:**
- Keine Änderung — `createVideoRouter(PORT)` wird weiterhin genutzt.

**Testhinweis:**
1. Teste Remotion-Render, Slideshow und Musik-Liste erneut.
2. `GET /api/render-remotion/check` muss weiterhin Status liefern.

---

## Schritt 29 — `server/remotion/render/utils.js` (Hilfsfunktionen)

**Neuer Dateiname:** `server/remotion/render/utils.js`

**Verschieben aus `server/remotion/render.js`:**
- Zeilen 607–632: Funktionen `cleanupRender(outputPath)` und `cleanupOldRenders(maxAgeMs)`

**Inhalt in `server/remotion/render/utils.js`:**
- Importe: `fs`, `path`
- Import aus `../constants.js`: `OUTPUT_DIR`, `IMAGES_DIR`
- Kopiere beide Funktionen

**Exports:**
```js
export { cleanupRender, cleanupOldRenders };
```

**Änderung in `server/remotion/render.js`:**
- Entferne beide Funktionen.
- Füge import hinzu:
```js
import { cleanupRender, cleanupOldRenders } from './utils.js'
```

**Testhinweis:**
1. Starte mehrere Remotion-Renders.
2. Nach 24 Stunden sollte `cleanupOldRenders` alte Dateien löschen.
3. Kurzfristig: Prüfe manuell im `/tmp/remotion-renders`-Ordner, ob Dateien entsprechend dem Alter aufgeräumt werden.

---

## Schritt 30 — `server/remotion/render/thumbnail.js` (Thumbnail-Render)

**Neuer Dateiname:** `server/remotion/render/thumbnail.js`

**Verschieben aus `server/remotion/render.js`:**
- Zeilen 528–603: Funktion `renderMojoBusThumbnail(params)`

**Inhalt in `server/remotion/render/thumbnail.js`:**
- Importe wie in `render.js`: `renderStill`, `selectComposition` aus `@remotion/renderer`, `path`, `fs`, etc.
- Kopiere die Funktion

**Exports:**
```js
export { renderMojoBusThumbnail };
```

**Änderung in `server/remotion/render.js`:**
- Entferne `renderMojoBusThumbnail`.
- Entferne `renderStill` aus Importen (wenn nur für Thumbnail verwendet).
- Füge import hinzu:
```js
import { renderMojoBusThumbnail } from './thumbnail.js'
```

**Testhinweis:**
1. Starte einen Remotion-Render mit `generateThumbnail: true`.
2. thumbnailUrl (`/api/render-remotion/thumbnail/:jobId`) muss ein JPG liefern.

---

## Schritt 31 — `server/remotion/render/core.js` (Hauptrender-Funktion)

**Neuer Dateiname:** `server/remotion/render/core.js`

**Verschieben aus `server/remotion/render.js`:**
- Zeilen 42–526: Funktion `renderMojoBusVideo(params)`

**Inhalt in `server/remotion/render/core.js`:**
- Importe wie in `render.js`, außer `renderStill`
- Kopiere `renderMojoBusVideo`

**Exports:**
```js
export { renderMojoBusVideo };
```

**Änderung in `server/remotion/render.js`:**
- Entferne `renderMojoBusVideo`.
- Datei reduziert sich auf Importe, `invalidateBundleCache`-Re-Export und ggf. kleine Wrapper.

**Testhinweis:**
1. Starte Remotion-Render mit 9:16 und 16:9.
2. Beide Formate müssen erfolgreich rendern und Download liefern.

---

## Schritt 32 — `server/remotion/render/index.js` (Render-Modul zusammenbauen)

**Neuer Dateiname:** `server/remotion/render/index.js`

**Inhalt:**
```js
export { renderMojoBusVideo } from './core.js'
export { renderMojoBusThumbnail } from './thumbnail.js'
export { cleanupRender, cleanupOldRenders } from './utils.js'
export { invalidateBundleCache } from '../bundle.js'
```

**Änderung in `server/routes/video/remotion.js`:**
- Ändere Import:
```js
import { renderMojoBusVideo, renderMojoBusThumbnail, invalidateBundleCache } from '../remotion/render/index.js'
```
- Ersetze `renderer.renderMojoBusVideo(...)` durch `renderMojoBusVideo(...)` und `renderer.renderMojoBusThumbnail(...)` durch `renderMojoBusThumbnail(...)`.

**Änderung in `server/remotion/render.js`:**
- Ersetze Inhalt durch `index.js` oder lösche Datei und benenne `index.js` um.

**Änderung in `server/routes/video.js` (falls noch vorhanden):**
- Keine Änderung.

**Testhinweis:**
1. Lösche Datei `server/remotion/render.js`.
2. Starte Remotion-Render mit Thumbnail.
3. Beide Downloads müssen funktionieren.

---

## Schritt 33 — `server/remotion/flows/ShortsLayer.tsx` (Shorts-spezifische Layer)

**Neuer Dateiname:** `server/remotion/flows/ShortsLayer.tsx`

**Verschieben aus `server/remotion/MojoBusVideo.tsx`:**
- Alles, was spezifisch für 9:16 / TikTok / Reels ist:
  - Beat-Sync Layer (`BeatSyncLayer`)
  - AudioWaveformBar
  - BeatVelocityPunch
  - LottieBusIcon in Hook/CTA (Shorts-Animation)
  - `PerSlideCaption` mit Shorts-Stil

**Inhalt in `server/remotion/flows/ShortsLayer.tsx`:**
- Kopiere relevante Imports aus `MojoBusVideo.tsx`.
- Erstelle Komponente `ShortsLayer`, die die Shorts-spezifischen Overlays zurückgibt.

**Exports:**
```js
export { ShortsLayer };
```

**Änderung in `server/remotion/MojoBusVideo.tsx`:**
- Entferne Shorts-spezifische Layer und ersetze sie durch `<ShortsLayer ... />`.

**Testhinweis:**
1. Rendere ein Video im Format 9:16 mit aktiviertem Beat-Sync.
2. Prüfe, ob Flash-Effekte auf Beats und Waveform-Bar sichtbar sind.

---

## Schritt 34 — `server/remotion/flows/LongformLayer.tsx` (YouTube-spezifische Layer)

**Neuer Dateiname:** `server/remotion/flows/LongformLayer.tsx`

**Verschieben aus `server/remotion/MojoBusVideo.tsx`:**
- Alles, was spezifisch für 16:9 / YouTube ist:
  - `CinematicLetterbox` (Letterbox 8%)
  - Größerer Hook-Text (wenn in `HookTitle` nicht schon parametrisiert)
  - `PerSlideCaption` mit YouTube-Stil

**Inhalt in `server/remotion/flows/LongformLayer.tsx`:**
- Kopiere relevante Imports.
- Erstelle Komponente `LongformLayer`.

**Exports:**
```js
export { LongformLayer };
```

**Änderung in `server/remotion/MojoBusVideo.tsx`:**
- Entferne Longform-spezifische Layer und ersetze sie durch `<LongformLayer ... />`.

**Testhinweis:**
1. Rendere ein Video im Format 16:9.
2. Prüfe, ob schwarze Letterbox-Balken oben/unten sichtbar sind.
3. Captions sollen klassische YouTube-Outline-Schrift haben.

---

## Schritt 35 — `server/remotion/MojoBusVideo.tsx` verkleinern

**Neuer Dateiname:** ( gleich, modifiziert )

**Nach den Schritten 33+34 bleibt in `MojoBusVideo.tsx`:**
- Imports
- Berechnung von `buildSlidePlan`, `buildCutEffectsPlan`, etc.
- Gemeinsame Schichten: Fonts, SlideshowLayer, HookTitle, LocationBadge, ProgressBar, AudioStack, CTA
- Bedingtes Rendering:
```tsx
{aspectRatio === '9:16' || aspectRatio === '1:1' ? (
  <ShortsLayer ... />
) : (
  <LongformLayer ... />
)}
```

**Ziel:** Datei < 500 Zeilen.

**Testhinweis:**
1. Rendere 9:16-, 1:1- und 16:9-Videos.
2. Alle drei Endformate müssen identisch zur alten Version aussehen.
3. Prüfe Thumbnail-Render weiterhin.

---

# Checkliste zum Abhaken

- [ ] **Vorbereitung**
  - [ ] Alle betroffenen Dateien gesichert (Git-Commit vor Refactoring).
  - [ ] Lokaler Testserver oder Staging-VPS bereit.

- [x] **Phase 1: Konstanten & Konfiguration**
  - [x] Schritt 1: `server/bot/config.js` erstellt und importiert.
  - [x] Schritt 2: `server/routes/promotion/config.js` erstellt und importiert.
  - [x] Schritt 3: `server/routes/tiktok/config.js` erstellt und importiert.

- [x] **Phase 2: Unabhängige Hilfsfunktionen**
  - [x] Schritt 4: `server/bot/utils.js` erstellt.
  - [x] Schritt 5: `server/routes/promotion/utils.js` erstellt.
  - [x] Schritt 6: `server/routes/promotion/ai.js` erstellt.
  - [x] Schritt 7: `server/routes/tiktok/vision.js` erstellt.
  - [x] Schritt 8: `server/routes/tiktok/text.js` erstellt.
  - [ x] Schritt 9: `server/routes/content/vision.js` erstellt.

- [x ] **Phase 3: Bot-Middleware**
  - [ x] Schritt 10: `server/bot/relay.js` erstellt.
  - [ x] Schritt 11: `server/bot/html.js` erstellt.
  - [ x] Schritt 12: `server/bot/middleware.js` erstellt, `server/bot-middleware.js` gelöscht.

- [ ] **Phase 4: Promotion-Routen**
  - [ ] Schritt 13: `server/routes/promotion/routes.js` erstellt.
  - [ ] Schritt 14: `server/routes/promotion/index.js` erstellt, `server/promotion-api.js` gelöscht.

- [ ] **Phase 5: TikTok-Routen**
  - [ ] Schritt 15: `server/routes/tiktok/upload.js` erstellt, `server/routes/tiktokUpload.js` gelöscht.
  - [ ] `server/routes/tiktok/index.js` erstellt, `server/routes/tiktok.js` gelöscht.

- [ ] **Phase 6: Content-Routen**
  - [ ] Schritt 16: `server/routes/content/media.js` erstellt.
  - [ ] Schritt 17: `server/routes/content/trip.js` erstellt.
  - [ ] Schritt 18: `server/routes/content/article.js` erstellt.
  - [ ] Schritt 19: `server/routes/content/place.js` erstellt.
  - [ ] Schritt 20: `server/routes/content/note.js` erstellt.
  - [ ] Schritt 21: `server/routes/content/index.js` erstellt, `server/routes/content.js` gelöscht.

- [ ] **Phase 7: Video-Routen**
  - [ ] Schritt 22: `server/routes/video/helpers.js` erstellt.
  - [ ] Schritt 23: `server/routes/video/xai.js` erstellt.
  - [ ] Schritt 24: `server/routes/video/legacy-slideshow.js` erstellt.
  - [ ] Schritt 25: `server/routes/video/transcode.js` erstellt.
  - [ ] Schritt 26: `server/routes/video/music.js` erstellt.
  - [ ] Schritt 27: `server/routes/video/remotion.js` erstellt.
  - [ ] Schritt 28: `server/routes/video/index.js` erstellt, `server/routes/video.js` gelöscht.

- [ ] **Phase 8: Remotion-Render**
  - [ ] Schritt 29: `server/remotion/render/utils.js` erstellt.
  - [ ] Schritt 30: `server/remotion/render/thumbnail.js` erstellt.
  - [ ] Schritt 31: `server/remotion/render/core.js` erstellt.
  - [ ] Schritt 32: `server/remotion/render/index.js` erstellt, `server/remotion/render.js` gelöscht.

- [ ] **Phase 9: Remotion-Flows**
  - [ ] Schritt 33: `server/remotion/flows/ShortsLayer.tsx` erstellt.
  - [ ] Schritt 34: `server/remotion/flows/LongformLayer.tsx` erstellt.
  - [ ] Schritt 35: `server/remotion/MojoBusVideo.tsx` < 500 Zeilen.

- [ ] **Abschluss**
  - [ ] `server.js` importiert nur noch `bot/middleware.js`, `routes/content/index.js`, `routes/video/index.js`, `routes/tiktok/index.js`, `routes/promotion/index.js`.
  - [ ] Alle alten Dateien gelöscht.
  - [ ] `npm run build` (bzw. `build_project`) fehlerfrei.
  - [ ] `systemctl restart ai-api` auf VPS.
  - [ ] End-to-End-Test: Video-Generator 9:16, 16:9, Thumbnail, alle Content-Tabs, Bot-Cache-Clear.

---

**Hinweis:** Dieser Plan verschiebt nur Code. Er erstellt keine neue Logik, benennt keine Funktionen um und ändert keine Verhalten. Alle API-Endpunkte und URLs bleiben identisch, damit das Frontend nicht angepasst werden muss.
