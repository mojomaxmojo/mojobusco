/**
 * Band-Schätzung — Konfiguration (Single Source of Truth, Server-Seite).
 *
 * Statt exakter Suchvolumina (Pseudo-Präzision eines LLM) liefert die
 * Band-Schätzung ehrliche Zahlen-BÄNDER aus einem festen Raster plus grobe
 * Saison-Kurve (12 Monats-Multiplikatoren). Die Zahlen sind NUR aus dem
 * Raster gültig — damit kann das Modell nicht präziser tun, als es ist.
 *
 * Modell: konfigurierbar über ai-models.js — Default „test" =
 * GLM 5.3 Flash (OpenRouter). Siehe Freigabe 2026-09-02.
 *
 * Alle Werte per Env überschreibbar (ohne Code-Anfassung), z. B. in
 * /etc/systemd/system/ai-api.env:
 *   BAND_ESTIMATE_ENABLED=0        (Feature komplett aus — dann nur GSC/DFS)
 *   BAND_MODEL_TIER=mini           (anderes Tier aus ai-models.js)
 *   BAND_CACHE_TTL_DAYS=14         (TTL der band-estimates.json-Einträge)
 *   BAND_MAX_RUNS_PER_DAY=10       (echte Flash-Runs/Tag; Cache-Zugriffe frei)
 *   BAND_MAX_KEYWORDS_PER_RUN=60
 *
 * Plan: FEATURE-BAND-SCHAETZUNG-PLAN.md
 */

import { VALID_TEXT_MODELS } from './ai-models.js'

const DAY_MS = 24 * 60 * 60 * 1000

function envValue(name, fallback) {
  const raw = (process.env[name] || '').trim()
  return raw !== '' ? raw : fallback
}

function envInt(name, fallback, { min = 1, max = 100000 } = {}) {
  const raw = parseInt(process.env[name] || '', 10)
  return Number.isFinite(raw) && raw >= min && raw <= max ? raw : fallback
}

function envFloat(name, fallback, { min, max } = {}) {
  const raw = parseFloat(process.env[name] || '')
  return Number.isFinite(raw) && raw >= min && raw <= max ? raw : fallback
}

/**
 * Zahlen-Raster: Nur diese Werte sind gültige Band-Grenzen („low"/„high").
 * Verhindert Pseudo-Präzision wie „1.347/Monat" — Freigabe-Punkt 1.
 */
export const BAND_GRID = [
  20, 50, 100, 200, 300, 500, 800, 1200, 2000, 3000,
  5000, 8000, 12000, 20000, 30000, 50000, 100000
]

/**
 * Maximale Unschärfe: high ≤ low × BAND_MAX_SPREAD.
 * Engere Bänder wären vorgetäuschte Genauigkeit, weitere wäre vage.
 */
export const BAND_MAX_SPREAD = 3

/** Stufen-Grenzen (Freigabe-Punkt 1): Stufe wird aus der Band-Mitte abgeleitet. */
export const BAND_STUFEN = [
  { key: 'N', label: 'Nische', from: 20, to: 300 },
  { key: 'M', label: 'Mittel', from: 300, to: 2000 },
  { key: 'G', label: 'Groß', from: 2000, to: 10000 },
  { key: 'R', label: 'Riese', from: 10000, to: Infinity },
]

/** Saison-Regeln (Freigabe-Punkt 2): 12 Monats-Multiplikatoren, Mittel ≈ 1,0. */
export const SAISON_MIN = 0.3
export const SAISON_MAX = 3.0
export const SAISON_PEAK_ABOVE = 1.2   // Faktor ≥ 1,2 zählt als Peak-Monat
export const SAISON_TROUGH_BELOW = 0.8 // Faktor ≤ 0,8 zählt als Tief-Monat

/** Publish-Fenster (Freigabe-Punkt 2): 6–8 Wochen vor Peak-Beginn. */
export const PUBLISH_WEEKS_BEFORE = [6, 8]

/** Deutsche Monatskürzel (Index 0 = Januar). */
export const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

/**
 * Token-Overlap-Fallback (Freigabe 2026-09-02 „JA"): Flash echo't Keywords
 * teils gekürzt/variiert („benagil höhle" statt „benagil höhle armação de
 * pera") — dann matcht der Bestwert über Token-Überlappung, Muster
 * matchGscQuery (report-assistant.js). 0,5 = die Hälfte der Echo-Tokens
 * (Länge > 2) muss im Request stecken. Exakter normKey-Match hat Vorrang.
 */
export const BAND_TOKEN_MATCH_THRESHOLD = envFloat('BAND_TOKEN_MATCH_THRESHOLD', 0.5, { min: 0.3, max: 0.9 })

/** Env-gestützte Laufzeit-Konfiguration. */
export const BAND_CONFIG = {
  enabled: process.env.BAND_ESTIMATE_ENABLED !== '0',
  modelTier: VALID_TEXT_MODELS.includes(envValue('BAND_MODEL_TIER', 'test'))
    ? envValue('BAND_MODEL_TIER', 'test')
    : 'test', // „test" = GLM 5.3 Flash (ai-models.js)
  promptVersion: 'band-v1',
  cacheTtlMs: envInt('BAND_CACHE_TTL_DAYS', 7, { min: 1, max: 90 }) * DAY_MS,
  maxRunsPerDay: envInt('BAND_MAX_RUNS_PER_DAY', 5, { min: 1, max: 100 }),
  maxKeywordsPerRun: envInt('BAND_MAX_KEYWORDS_PER_RUN', 40, { min: 1, max: 200 }),
  temperature: 0.2,
  maxTokens: 2500,
  timeout: 90_000,
}
