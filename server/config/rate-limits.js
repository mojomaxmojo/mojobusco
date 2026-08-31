/**
 * Rate-Limit-Konfiguration (Nr. 15) — Single Source of Truth.
 *
 * In-Memory Fixed-Window pro IP + Bucket (middleware/rate-limit.js).
 * Schützt die offenen, KI-/CPU-lastigen Endpunkte vor Missbrauch — die
 * Grenzen sind so gewählt, dass der normale Redaktions-Alltag (wenige
 * Generierungen/Tag) sie NIEMALS erreicht; sie stoppen nur Skripte/Bots.
 *
 * Alle MAX-Werte per Env überschreibbar (ohne Code-Anfassung), z. B. in
 * /etc/systemd/system/ai-api.env:
 *   RATE_LIMIT_GENERATE_MAX=25
 *   RATE_LIMIT_RESEARCH_MAX=20
 *
 * Bewusst NICHT gedrosselt (Legitim-Polling/Reads, teils 🔒-geschützt):
 *   - GET /api/generate-trip/:jobId      (Status-Polling während Generierung)
 *   - GET /api/media, /api/media/file/:id
 *   - 🔒 Drafts-CRUD, PUT /article/:id, POST /published (Token)
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Env-Override-Helfer: RATE_LIMIT_<NAME>_MAX, Fallback auf den Default. */
function envMax(name, fallback) {
  const raw = parseInt(process.env[name] || '', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : fallback
}

/**
 * Bucket-Definitionen.
 *  - generate: volle KI-Content-Generierung (teuerste Calls: Longform-LLM,
 *    XAI-Video, Remotion-Slideshow, Trip-Job-Start)
 *  - track:    Continuity-Extraktion (Mini-LLM je Publish)
 *  - research: OpenRouter Web-Plugin-Recherche
 *  - ideas:    LLM-Ideen (24h-Cache pro Ort)
 *  - seoTitle: Mini-LLM-Titelvorschlag
 *  - pageMetrics: GSC-API (Quota-Schutz)
 *  - light:    lokale DB/JSON-Reads + 🔒-Schreib-Endpunkte (großzügig)
 */
export const RATE_LIMITS = {
  generate:    { max: envMax('RATE_LIMIT_GENERATE_MAX', 15),      windowMs: DAY_MS },
  track:       { max: envMax('RATE_LIMIT_TRACK_MAX', 30),         windowMs: DAY_MS },
  research:    { max: envMax('RATE_LIMIT_RESEARCH_MAX', 10),      windowMs: DAY_MS },
  ideas:       { max: envMax('RATE_LIMIT_IDEAS_MAX', 10),         windowMs: DAY_MS },
  seoTitle:    { max: envMax('RATE_LIMIT_SEO_TITLE_MAX', 30),     windowMs: DAY_MS },
  pageMetrics: { max: envMax('RATE_LIMIT_PAGE_METRICS_MAX', 30),  windowMs: DAY_MS },
  light:       { max: envMax('RATE_LIMIT_LIGHT_MAX', 120),        windowMs: DAY_MS },
}
