/**
 * Band-Schätzung — Service (FEATURE-BAND-SCHAETZUNG-PLAN.md).
 *
 * Liefert für Keywords ehrliche Suchvolumen-BÄNDER (festes Zahlenraster,
 * Spread max. ×3) plus grobe Saison-Kurve (12 Monats-Multiplikatoren) aus
 * dem konfigurierten Flash-Modell (Default: Tier „test" = GLM 5.3 Flash).
 *
 * Design-Prinzipien (Freigabe 2026-09-02):
 *  - KEINE Punktwerte: low/high müssen exakt im BAND_GRID liegen — Validierung
 *    wirft Verstöße weg, die Zeile degradiert statt eine erfundene Zahl zu
 *    zeigen (Philosophie wie Wetter-Gate: kein Treffer → null).
 *  - Saison ist nur ein Publish-Timing-Hinweis, nie ein Blocker.
 *  - Persistenter Cache: data/band-estimates.json (TTL 7 Tage, env-steuerbar),
 *    Muster wie sitemap-events.json (DATA_DIR / VPS-Public-Data-Pfad).
 *  - Tageslimit für echte Flash-Runs (Default 5/Tag, env-steuerbar) —
 *    Cache-Zugriffe zählen nicht. Service-Level-Counter (In-Memory, Fixed-
 *    Window pro Tag), weil die Band-Schätzung im topic-ideas-Flow läuft und
 *    die Middleware nicht pro Innenschritt greifen kann.
 *
 * Fehlerverhalten: FEHLER werfen hier nie die ganzen Topics weg — die Funktion
 * degradiert (Cache-Treffer bleiben, fehlende Bänder bleiben leer).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateWithModel } from './ai-content.js'
import { getTextModel } from '../config/ai-models.js'
import { buildBandEstimatePrompt } from '../prompts/assistant-prompts.js'
import {
  BAND_GRID,
  BAND_MAX_SPREAD,
  BAND_STUFEN,
  SAISON_MIN,
  SAISON_MAX,
  SAISON_PEAK_ABOVE,
  SAISON_TROUGH_BELOW,
  PUBLISH_WEEKS_BEFORE,
  MONATE,
  BAND_CONFIG
} from '../config/band-estimate.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const STORE_FILENAME = 'band-estimates.json'

// Kandidaten-Pfade für den Band-Cache — gleiche Rangfolge wie in
// report-assistant.js (VPS-Data-Verzeichnis zuerst, dann Repo):
const DATA_CANDIDATE_DIRS = [
  process.env.DATA_DIR,
  '/home/nginx/domains/mojobus.co/public/data',
  path.join(__dirname, '..', '..', 'public', 'data')
].filter(Boolean)

function emptyStore() {
  return { version: 1, updated_at: null, entries: {} }
}

/**
 * Findet das erste existierende Data-Verzeichnis; existiert keins, wird das
 * lokale public/data angelegt (letzter Fallback). → null, wenn gar nichts geht.
 */
function resolveStoreDir() {
  for (const dir of DATA_CANDIDATE_DIRS) {
    try {
      if (fs.existsSync(dir)) return dir
    } catch {
      // existsSync-Fehler → nächster Kandidat
    }
  }
  const fallback = DATA_CANDIDATE_DIRS[DATA_CANDIDATE_DIRS.length - 1]
  if (!fallback) return null
  try {
    fs.mkdirSync(fallback, { recursive: true })
    return fallback
  } catch (error) {
    console.warn('[BandSchätzung] Kein beschreibbares Data-Verzeichnis:', error.message)
    return null
  }
}

function loadBandStore() {
  const dir = resolveStoreDir()
  if (!dir) return { dir: null, store: emptyStore() }
  try {
    const filePath = path.join(dir, STORE_FILENAME)
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      if (parsed && typeof parsed === 'object' && parsed.entries && typeof parsed.entries === 'object') {
        return { dir, store: { ...emptyStore(), ...parsed } }
      }
    }
  } catch (error) {
    console.warn('[BandSchätzung] Cache beschädigt, wird neu aufgebaut:', error.message)
  }
  return { dir, store: emptyStore() }
}

function saveBandStore(dir, store) {
  if (!dir) return
  try {
    const filePath = path.join(dir, STORE_FILENAME)
    const tmpPath = `${filePath}.tmp`
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8')
    fs.renameSync(tmpPath, filePath)
  } catch (error) {
    console.warn('[BandSchätzung] Cache konnte nicht geschrieben werden:', error.message)
  }
}

// ============================================================
// Tageslimit für echte Flash-Runs (In-Memory, Fixed-Window/Tag)
// ============================================================

let bandRunCounter = { day: '', count: 0 }

/** Reserviert einen Flash-Run-Slot. false = Tageslimit erreicht. */
function claimRunSlot() {
  const today = new Date().toISOString().slice(0, 10)
  if (bandRunCounter.day !== today) {
    bandRunCounter = { day: today, count: 0 }
  }
  if (bandRunCounter.count >= BAND_CONFIG.maxRunsPerDay) return false
  bandRunCounter.count += 1
  return true
}

// ============================================================
// Validierung: Raster, Spread, Stufe, Saison
// ============================================================

/** Zieht aus der LLM-Antwort das JSON-Array (robust gegen Codeblöcke/Text). */
function extractJsonArray(raw) {
  if (!raw) return null
  let text = String(raw).trim()
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** 12 Werte → clampen, Mittelwert ≈ 1,0 normalisieren, auf 2 Stellen runden. */
function normalizeSaison(raw) {
  const vals = (Array.isArray(raw) ? raw : []).map(v => Number(v))
  if (vals.length !== 12 || vals.some(v => !Number.isFinite(v))) return null
  const clamp = v => Math.min(SAISON_MAX, Math.max(SAISON_MIN, v))
  let out = vals.map(clamp)
  // Zwei Durchläufe: Normalisierung kann Werte wieder über die Grenzen
  // schieben — danach akzeptieren wir die kleine Restabweichung.
  for (let pass = 0; pass < 2; pass++) {
    const mean = out.reduce((a, b) => a + b, 0) / 12
    if (mean <= 0) return null
    out = out.map(v => clamp(v / mean))
  }
  return out.map(v => Math.round(v * 100) / 100)
}

/** Stufe aus der Band-Mitte (BAND_STUFEN-Grenzen, Freigabe-Punkt 1). */
function deriveStufe(low, high) {
  const mid = (low + high) / 2
  const stufe = BAND_STUFEN.find(s => mid >= s.from && mid < s.to) || BAND_STUFEN[BAND_STUFEN.length - 1]
  return { key: stufe.key, label: stufe.label }
}

/** Aufsteigende Monat-Indizes → zusammenhängende Gruppen (lineare Monate). */
function groupContiguous(indices) {
  const groups = []
  let current = []
  for (const idx of indices) {
    if (current.length === 0 || idx === current[current.length - 1] + 1) {
      current.push(idx)
    } else {
      groups.push(current)
      current = [idx]
    }
  }
  if (current.length > 0) groups.push(current)
  return groups
}

function formatMonthRange(indices) {
  if (!indices || indices.length === 0) return null
  const first = MONATE[indices[0]]
  const last = MONATE[indices[indices.length - 1]]
  return first === last ? first : `${first}–${last}`
}

function deriveTrough(saison) {
  const below = saison
    .map((v, i) => (v <= SAISON_TROUGH_BELOW ? i : -1))
    .filter(i => i >= 0)
  if (below.length === 0) return null
  const groups = groupContiguous(below)
  const longest = groups.reduce((a, b) => (b.length > a.length ? b : a))
  return formatMonthRange(longest)
}

/**
 * Publish-Fenster (Freigabe-Punkt 2): 6–8 Wochen vor Peak-Beginn —
 * die Trip-Planung läuft der Saison voraus. Nur Monat-Namen (Jahr egal).
 */
function derivePublishWindow(peakIndices) {
  if (!peakIndices || peakIndices.length === 0) return null
  const peakStartIdx = peakIndices[0]
  const peakStartMs = Date.UTC(2026, peakStartIdx, 1) // Kalenderjahr egal
  const [weeksMax, weeksMin] = PUBLISH_WEEKS_BEFORE
  const from = new Date(peakStartMs - weeksMax * 7 * 24 * 60 * 60 * 1000)
  const to = new Date(peakStartMs - weeksMin * 7 * 24 * 60 * 60 * 1000)
  const fromM = MONATE[from.getUTCMonth()]
  const toM = MONATE[to.getUTCMonth()]
  return fromM === toM ? fromM : `${fromM}–${toM}`
}

/**
 * Normalisierungs-Key für das Keyword-Matching: lowercase, Diakritika
 * entfernt (ä/ã/ê → a), Whitespace kollabiert. Flash echo't Keywords
 * manchmal in Variante („armacao de pera …" statt „armação de pêra …") —
 * ohne Normalisierung fliegt das Band sonst zu Unrecht weg (Incident
 * 2026-09-02: 1. Topic ohne Band trotz gültiger Antwort).
 */
function normKey(kw) {
  return String(kw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Validiert EIN LLM-Element gegen Raster/Spread/Stufe/Saison.
 * requestedMap: normKey → original angefragtes Keyword. Das Echo matcht
 * über normKey; GESPEICHERT wird immer das Original (Cache-Key-Konsistenz).
 * Rückgabe: fertiger Band-Eintrag oder null (Verstoß → Zeile degradiert).
 */
function validateBandItem(item, requestedMap, nowIso) {
  if (!item || typeof item !== 'object') return null
  const echoed = String(item.keyword || '').trim().toLowerCase()
  const original = echoed ? requestedMap.get(normKey(echoed)) : null
  if (!original) return null

  const low = Number(item.low)
  const high = Number(item.high)
  // Raster-Pflicht (kein „1.347") + Spread-Limit ×3 + sinnvolle Ordnung
  if (!BAND_GRID.includes(low) || !BAND_GRID.includes(high)) return null
  if (!(low <= high && high <= low * BAND_MAX_SPREAD)) return null

  const saison = normalizeSaison(item.saison)
  if (!saison) return null

  const aboveIdx = saison.map((v, i) => (v >= SAISON_PEAK_ABOVE ? i : -1)).filter(i => i >= 0)
  const peakGroups = groupContiguous(aboveIdx)
  const peakIndices = peakGroups.length > 0
    ? peakGroups.reduce((a, b) => (b.length > a.length ? b : a))
    : [saison.indexOf(Math.max(...saison))]

  const stufe = deriveStufe(low, high)
  return {
    keyword: original, // Original (mit Diakritika) — nicht das Echo
    low,
    high,
    stufe: stufe.key,
    stufe_label: stufe.label,
    saison,
    saison_peak: formatMonthRange(peakIndices),
    saison_tief: deriveTrough(saison),
    publish_fenster: derivePublishWindow(peakIndices),
    source: 'flash-band',
    model_tier: BAND_CONFIG.modelTier,
    prompt_version: BAND_CONFIG.promptVersion,
    created_at: nowIso,
  }
}

// ============================================================
// Öffentliche API
// ============================================================

export function isBandEstimateEnabled() {
  return BAND_CONFIG.enabled === true
}

export function getBandModelLabel() {
  return getTextModel(BAND_CONFIG.modelTier)?.label || BAND_CONFIG.modelTier
}

/**
 * Holt Band-Schätzungen für die gegebenen Keywords (Cache-first).
 *
 * @param {string[]} keywords — Rohe Keywords (werden normalisiert/dedupliziert)
 * @returns {Promise<{ map: Map<string, object>, ran: boolean, skipped: string|null, cachedCount: number }>}
 *   map: keyword → Band-Eintrag (low, high, stufe, saison, saison_peak,
 *        saison_tief, publish_fenster, source, model_tier, prompt_version)
 */
export async function getBandEstimates(keywords) {
  const clean = [...new Set((keywords || [])
    .map(k => String(k || '').trim().toLowerCase())
    .filter(Boolean))]

  const { dir, store } = loadBandStore()
  const now = Date.now()
  const nowIso = new Date().toISOString()
  const map = new Map()
  let cachedCount = 0
  const missing = []

  for (const kw of clean) {
    const entry = store.entries[kw]
    const ts = entry && typeof entry.created_at === 'string' ? Date.parse(entry.created_at) : NaN
    if (Number.isFinite(ts) && now - ts < BAND_CONFIG.cacheTtlMs) {
      map.set(kw, { ...entry })
      cachedCount += 1
    } else {
      missing.push(kw)
    }
  }

  if (missing.length === 0) {
    return { map, ran: false, skipped: null, cachedCount }
  }

  // Gedeckelt: Überschuss bleibt OHNE Band (degradiert statt Blocker)
  const toEstimate = missing.slice(0, BAND_CONFIG.maxKeywordsPerRun)

  if (!claimRunSlot()) {
    return { map, ran: false, skipped: 'rate-limit', cachedCount }
  }

  // normKey → Original-Keyword: Flash echo't Keywords teils in Variante
  // (Diakritika/Wortstellung); gespeichert wird immer das Original.
  const requestedMap = new Map(toEstimate.map(kw => [normKey(kw), kw]))
  let accepted = 0
  try {
    const prompt = buildBandEstimatePrompt(toEstimate)
    const raw = await generateWithModel(prompt, BAND_CONFIG.modelTier, 'mojobus', {
      temperature: BAND_CONFIG.temperature,
      maxTokens: BAND_CONFIG.maxTokens,
      timeout: BAND_CONFIG.timeout
    })
    accepted = collectValidBands(raw, requestedMap, map, nowIso)

    // Plan §9: genau 1 Retry, wenn der erste Versuch nichts Valides lieferte
    if (accepted === 0) {
      const rawRetry = await generateWithModel(prompt, BAND_CONFIG.modelTier, 'mojobus', {
        temperature: BAND_CONFIG.temperature,
        maxTokens: BAND_CONFIG.maxTokens,
        timeout: BAND_CONFIG.timeout
      })
      accepted = collectValidBands(rawRetry, requestedMap, map, nowIso)
    }
  } catch (error) {
    console.warn('[BandSchätzung] Flash-Aufruf fehlgeschlagen:', error.message)
    return { map, ran: true, skipped: 'error', cachedCount }
  }

  // Diagnose: welche angefragten Keywords KEIN Band bekamen (weil Flash sie
  // weggelassen/ungültig geschätzt hat) — sichtbar im Log, nicht in der UI
  const ohneBand = [...requestedMap.values()].filter(kw => !map.has(kw))
  console.log(`[BandSchätzung] ${accepted} Bänder akzeptiert, ${ohneBand.length} ohne Band${ohneBand.length > 0 ? `: ${ohneBand.join(' | ')}` : ''}`)

  // Nur tatsächlich neue Einträge persistieren (Cache-Treffer stehen schon drin)
  if (accepted > 0) {
    for (const kw of toEstimate) {
      const entry = map.get(kw)
      if (entry) store.entries[kw] = entry
    }
    store.updated_at = nowIso
    saveBandStore(dir, store)
  }

  return { map, ran: true, skipped: null, cachedCount }
}

/** Validiert die LLM-Antwort und legt gültige Bänder in die Map. */
function collectValidBands(raw, requestedMap, map, nowIso) {
  const items = extractJsonArray(raw)
  if (!items) return 0
  let accepted = 0
  for (const item of items) {
    const entry = validateBandItem(item, requestedMap, nowIso)
    if (entry && !map.has(entry.keyword)) {
      map.set(entry.keyword, entry)
      accepted += 1
    }
  }
  if (accepted === 0) {
    console.warn('[BandSchätzung] Antwort enthielt kein gültiges Band (Raster/Spread/Saison-Verstöße)')
  }
  return accepted
}
