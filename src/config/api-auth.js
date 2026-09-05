/**
 * api-auth.js – Single Source of Truth für den KI-Routen-Schutz (NIP-98).
 *
 * Wird von BEIDEN Welten importiert:
 *   - Server:  server/middleware/nostr-auth.js + server/server.js
 *     (Server importiert bereits ../src/config/prompts/ – gleiches Muster)
 *   - Frontend: src/lib/apiAuth.ts (authedFetch entscheidet anhand dieser
 *     Listen, welche Requests ein NIP-98-Auth-Event bekommen)
 *
 * Bewusst .js statt .ts: Der Node-Server (ai-api) importiert die Datei
 * ohne Build-Schritt, das Frontend via Vite (Muster wie prompts/lifestyles.js).
 *
 * Autoren-Allowlist lebt weiterhin ausschließlich in src/config/authors.json
 * (AGENTS.md Regel 1) – der Server liest sie zur Laufzeit.
 *
 * Rollout: Der Server erzwingt den Schutz nur, wenn in ai-api.env
 *   AI_AUTH_REQUIRED=1
 * steht (siehe .env.example / docs/CONTEXT_DEPLOY.md). Ohne Flag läuft
 * alles ungeschützt weiter – so kann das Frontend VOR dem scharfen
 * Schalten deployed werden, ohne dass Autoren 401er bekommen.
 */

/** NIP-98: HTTP-Auth-Event-Kind (https://github.com/nostr-protocol/nips/blob/master/98.md) */
export const NIP98_KIND = 27235

/**
 * Max. Alter des Auth-Events in Sekunden (Server-Prüfung: |now - created_at|).
 * NIP-98 schlägt 60s vor – wir erlauben 300s, damit das Frontend das
 * signierte Event 240s wiederverwenden kann (kein Signier-Popup pro Request
 * bei Extension-Logins).
 */
export const NIP98_MAX_AGE_SECONDS = 300

/** Cache-TTL im Frontend (muss < NIP98_MAX_AGE_SECONDS bleiben). */
export const AUTH_CACHE_TTL_SECONDS = 240

/**
 * Geschützte API-Prefixe – nur Max & Susanne (authors.json) dürfen.
 * Match: path === prefix ODER path.startsWith(prefix + '/')
 * (daher deckt '/api/generate-trip' auch '/api/generate-trip/:jobId' ab).
 *
 * NICHT geschützt (bewusst offen):
 *   /api/health, /api/prerender-resolve, /api/bot-cache/clear,
 *   /api/music/* – harmlose Reads bzw. für Crawler/Deploy nötig.
 */
export const PROTECTED_API_PREFIXES = [
  // Content-Generierung (OpenRouter/Anthropic/Grok – Kosten!)
  '/api/generate-article',
  '/api/generate-place',
  '/api/generate-note',
  '/api/generate-media-article',
  '/api/generate-trip', // auch Status-Polling + Cancel
  '/api/generate-video',
  '/api/generate-slideshow',
  '/api/translate-content',
  '/api/continuity/track',
  '/api/debug-video',

  // TikTok-System (Vision-KI + Text-Generierung + Upload)
  '/api/tiktok/generate-text',
  '/api/tiktok/analyze-images',
  '/api/tiktok/upload-media',
  // GET /api/tiktok/uploads/:filename bleibt offen: Auslieferung des
  // Upload-Files (nach 1h automatisch gelöscht), u.a. als <img src> im Einsatz.

  // Remotion-Render (CPU-schwer)
  '/api/render-remotion', // auch status/history/check/invalidate-bundle
  '/api/transcode-video',
  '/api/video-status',
  '/api/slideshow-status',
  '/api/slideshow-music-status',

  // Berichte-Assistent (KI + GSC/DataForSEO-Credits) inkl. 🔒-Schreibrouten
  '/api/assistant',

  // Media-Library (Upload/Alt-Text-Pflege); GET-Liste + File-Auslieferung
  // sind über PUBLIC_API_EXCEPTIONS offen.
  '/api/media',

  // Pinterest-Promotion (KI-Texte + Pins-CRUD)
  '/api/promotion',
]

/**
 * Öffentliche Ausnahmen INNERHALB geschützter Prefixe.
 * Grund: Downloads/Thumbnails werden teils als <a href>/<img src> verwendet,
 * wo kein Authorization-Header mitgegeben werden kann. Sicherheit über
 * unerratbare Random-JobIds + Auto-Löschung nach 1h.
 * Match: req.method === method && req.path.startsWith(prefix)
 */
export const PUBLIC_API_EXCEPTIONS = [
  { method: 'GET', prefix: '/api/render-remotion/download/' },
  { method: 'GET', prefix: '/api/render-remotion/thumbnail/' },
  { method: 'GET', prefix: '/api/transcode-video/download/' },
  { method: 'GET', prefix: '/api/media/file/' },
  { method: 'GET', prefix: '/api/media' }, // Bibliotheks-Liste (read-only)
]
