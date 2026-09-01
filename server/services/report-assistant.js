/**
 * Report-Assistant-Service: Ideen, Research, Momente, interne Links,
 * SEO-Titel-Vorschläge für den Berichte-Assistenten (/veroeffentlichen).
 *
 * Alle Funktionen sind nur lesend bzw. "ask" — nichts wird veröffentlicht.
 * Einziges persistentes Nebenprodukt: 24h-Cache-Einträge in seo_cache
 * (assistant.db).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateWithModel } from './ai-content.js'
import {
  buildResearchPrompt,
  buildIdeasPrompt,
  buildSeoTitlePrompt,
  buildTopicSuggestionsPrompt
} from '../prompts/assistant-prompts.js'
import { getCached, setCached } from './assistant-store.js'
import { findMomentsForLocation, getOpenThreadsWithIds } from './continuity-store.js'
import { getStrikingDistanceQueries, getPageMetrics, getQueriesContaining } from './gsc-client.js'
import { isDataForSEOConfigured, getKeywordData } from './dataforseo-client.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Canonical URL (AGENTS.md Regel 2): Artikel → https://mojobus.co/{naddr}
// (Muster wie scripts/generate-site-data.js — Server-Seite ohne src/config-Import)
const BASE_URL = 'https://mojobus.co'

// Kandidaten-Pfade für die statischen Daten-Dumps:
// VPS (Cron-Layout) zuerst, dann lokales public/data im Repo.
const DATA_CANDIDATE_DIRS = [
  process.env.DATA_DIR,
  '/home/nginx/domains/mojobus.co/public/data',
  path.join(__dirname, '..', '..', 'public', 'data')
]

/**
 * Lädt ein JSON-Array aus dem ersten existierenden data-Verzeichnis.
 * @param {string} fileName
 * @returns {unknown[]}
 */
function loadJsonArray(fileName) {
  for (const dir of DATA_CANDIDATE_DIRS) {
    if (!dir) continue
    try {
      const filePath = path.join(dir, fileName)
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        if (Array.isArray(data)) return data
      }
    } catch (error) {
      console.warn(`[Assistant] Konnte ${fileName} nicht laden (${dir}):`, error.message)
    }
  }
  return []
}

/**
 * Zerlegt einen Suchtext in normalisierte Tokens (lowercase, ohne Stopwords).
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  const stopWords = new Set(['und', 'oder', 'der', 'die', 'das', 'den', 'dem', 'des',
    'ein', 'eine', 'einer', 'im', 'in', 'am', 'an', 'auf', 'mit', 'für', 'von',
    'the', 'and', 'of', 'in', 'to', 'a'])
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 4 && !stopWords.has(t))
}

// ============================================================
// Research
// ============================================================

/**
 * Recherche zu einem Thema: sachliche Fakten + Quellen-URLs via OpenRouter
 * Web-Plugin (:online). Ergebnis wird 24h in seo_cache gehalten.
 * @param {string} topic
 * @returns {Promise<{ topic: string, facts: string, cached?: boolean }>}
 */
export async function researchTopic(topic) {
  const trimmed = (topic || '').trim()
  if (!trimmed) throw new Error('Thema fehlt')

  const cacheKey = `research:${trimmed.toLowerCase()}`
  const cached = getCached(cacheKey)
  if (cached && cached.facts) {
    return { ...cached, cached: true }
  }

  const prompt = buildResearchPrompt(trimmed)
  const facts = await generateWithModel(prompt, 'mini', 'mojobus', {
    plugins: [{ id: 'web' }],
    temperature: 0.3,
    maxTokens: 1200,
    timeout: 120_000
  })

  const result = { topic: trimmed, facts: facts || '' }
  setCached(cacheKey, result)
  return result
}

// ============================================================
// Ideen (GSC striking-distance + LLM Long-Tails)
// ============================================================

/**
 * Themenvorschläge: GSC striking-distance-Queries (falls konfiguriert)
 * kombiniert mit 5–10 LLM-Long-Tail-Ideen (buildIdeasPrompt, tier mini).
 * Kombiniertes Ergebnis wird 24h gecacht.
 * @param {{ location?: string }} params
 */
export async function getIdeas({ location } = {}) {
  const loc = (location || '').trim()
  const cacheKey = `ideas:${loc.toLowerCase()}`

  const cached = getCached(cacheKey)
  if (cached && Array.isArray(cached.ideas)) {
    return { ...cached, cached: true }
  }

  // 1) GSC striking-distance (ohne GSC-Env: available: false)
  let gsc = { available: false, queries: [] }
  try {
    gsc = await getStrikingDistanceQueries({ windowDays: 28 })
  } catch (error) {
    console.warn('[Assistant] GSC-Abfrage fehlgeschlagen:', error.message)
  }

  // 2) LLM-Ideen mit GSC-Queries als Hinweis
  let ideas = []
  try {
    const hints = gsc.available && gsc.queries.length > 0
      ? gsc.queries.slice(0, 10).map(q => q.query).join(', ')
      : ''
    const raw = await generateWithModel(buildIdeasPrompt(loc, hints), 'mini', 'mojobus', {
      temperature: 0.7,
      maxTokens: 700
    })
    ideas = (raw || '')
      .split('\n')
      .map(line => line.replace(/^[\s\-*•\d.)]+/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 10)
  } catch (error) {
    console.warn('[Assistant] LLM-Ideen fehlgeschlagen:', error.message)
  }

  const result = {
    location: loc,
    gsc: gsc.available === true,
    gscQueries: gsc.queries || [],
    ideas
  }
  setCached(cacheKey, result)
  return result
}

// ============================================================
// Continuity-Suggestions (NUR-Lese-Zugriff auf continuity.db)
// ============================================================

/**
 * Passende Momente aus der Brand DNA (continuity.db): Posts am Ort
 * (+ Motive) sowie offene Fäden als Stichpunkte. Reiner Lese-Zugriff.
 * @param {{ location?: string, date?: string|number }} params
 */
export function getContinuitySuggestions({ location, date } = {}) {
  const loc = (location || '').trim()

  if (!loc) {
    return { location: '', moments: [], openThreads: [], hint: 'Kein Ort angegeben' }
  }

  // date (optional): Referenzdatum des geplanten Berichts — wir schauen
  // bis zu 90 Tage zurück. Ohne date: ganzer Verlauf.
  // continuity.db speichert published_at in SEKUNDEN.
  let sinceTs = 0
  let untilTs = Number.MAX_SAFE_INTEGER
  if (date) {
    let dateTs
    if (typeof date === 'number') {
      dateTs = date > 1e12 ? Math.floor(date / 1000) : date
    } else if (/^\d+$/.test(date)) {
      const parsed = parseInt(date, 10)
      dateTs = parsed > 1e12 ? Math.floor(parsed / 1000) : parsed
    } else {
      dateTs = Math.floor(new Date(date).getTime() / 1000)
    }
    if (dateTs && !Number.isNaN(dateTs) && dateTs > 0) {
      untilTs = dateTs
      sinceTs = dateTs - 90 * 24 * 60 * 60
    }
  }

  let moments = []
  try {
    moments = findMomentsForLocation(loc, sinceTs, 8)
      .filter(m => m.publishedAt <= untilTs)
  } catch (error) {
    console.warn('[Assistant] Continuity-Lookup fehlgeschlagen:', error.message)
  }

  // Offene Fäden MIT ID — der Moments-Block bietet pro Faden einen
  // ✓-erledigt-Klick (POST /api/assistant/threads/resolve → resolveThread)
  let openThreads = []
  try {
    openThreads = getOpenThreadsWithIds(3)
  } catch (error) {
    console.warn('[Assistant] Offene Fäden fehlgeschlagen:', error.message)
  }

  return {
    location: loc,
    moments,
    openThreads
  }
}

// ============================================================
// Link-Suggestions (eigene Artikel, canonical URLs)
// ============================================================

/**
 * Matcht eigene Artikel (aus data/sitemap.json + data/articles.json)
 * gegen Thema/Ort/Tags (Keyword- und Tag-Überlappung) und liefert
 * Vorschläge mit canonical URL https://mojobus.co/{naddr}
 * (AGENTS.md Regel 2).
 * @param {{ topic?: string, location?: string, tags?: string[] }} params
 */
export function getLinkSuggestions({ topic, location, tags } = {}) {
  const sitemap = loadJsonArray('sitemap.json')
  const articles = loadJsonArray('articles.json')

  if (sitemap.length === 0) {
    return { suggestions: [], note: 'Keine Artikel-Daten gefunden (data/sitemap.json)' }
  }

  // identifier (dTag) -> Artikeldaten aus articles.json (Tags, Summary)
  const byIdentifier = new Map()
  for (const article of articles) {
    const tagList = Array.isArray(article.tags) ? article.tags : []
    const dTag = tagList.find(t => t[0] === 'd')?.[1]
    if (!dTag) continue
    byIdentifier.set(dTag, {
      title: tagList.find(t => t[0] === 'title')?.[1] || '',
      summary: tagList.find(t => t[0] === 'summary')?.[1] || '',
      tags: tagList.filter(t => t[0] === 't' && t[1]).map(t => t[1])
    })
  }

  const tokens = [...new Set([
    ...tokenize(topic),
    ...tokenize(location)
  ])]
  const inputTags = (Array.isArray(tags) ? tags : [])
    .map(t => String(t).trim().toLowerCase())
    .filter(Boolean)

  const scored = []
  for (const entry of sitemap) {
    if (!entry?.naddr || !entry?.identifier) continue
    const meta = byIdentifier.get(entry.identifier) || {}
    const title = meta.title || entry.title || ''
    const summary = meta.summary || ''
    const articleTags = meta.tags || []
    const tagLower = articleTags.map(t => t.toLowerCase())

    let score = 0
    for (const token of tokens) {
      if (title.toLowerCase().includes(token)) score += 2
      if (summary.toLowerCase().includes(token)) score += 1
      if (tagLower.some(t => t.includes(token))) score += 2
    }
    for (const inputTag of inputTags) {
      if (tagLower.includes(inputTag)) score += 3
    }

    if (score > 0) {
      scored.push({ score, entry, title, articleTags })
    }
  }

  scored.sort((a, b) => b.score - a.score)

  const suggestions = scored
    .slice(0, 8)
    .map(s => ({
      title: s.title || s.entry.identifier,
      url: `${BASE_URL}/${s.entry.naddr}`,   // canonical: https://mojobus.co/{naddr}
      identifier: s.entry.identifier,
      tags: s.articleTags,
      score: s.score
    }))

  return { suggestions, count: suggestions.length }
}

// ============================================================
// SEO-Titel-Vorschlag
// ============================================================

/**
 * Sachlicher SEO-Seitentitel-Vorschlag (tier mini, buildSeoTitlePrompt) —
 * separat vom kreativen Artikel-Titel.
 * @param {{ title: string, articleText?: string }} params
 * @returns {Promise<{ title: string, seoTitle: string }>}
 */
export async function suggestSeoTitle({ title, articleText } = {}) {
  const t = (title || '').trim()
  if (!t) throw new Error('Titel fehlt')

  const raw = await generateWithModel(buildSeoTitlePrompt({ title: t, articleText }), 'mini', 'mojobus', {
    temperature: 0.4,
    maxTokens: 80
  })

  const seoTitle = (raw || '')
    .split('\n')[0]
    .trim()
    .replace(/^["'„“]+|["'“”]+$/g, '')
    .slice(0, 70)

  return { title: t, seoTitle }
}

// ============================================================
// GSC Seiten-Ranking (per kanonischer URL)
// ============================================================

/**
 * „Wie rankt dieser Bericht?“ — Klicks/Impressionen/Ø-Position + Top-
 * Suchanfragen für EINE kanonische Artikel-URL (GSC, Standard 28-Tage-
 * Fenster). Erfolgreiche Ergebnisse 24h gecacht (seo_cache); Fehler/
 * available:false werden NICHT gecacht (z. B. fehlende Env → erneuter
 * Versuch nach Konfiguration).
 * @param {{ url: string, windowDays?: number }} params
 * @returns {Promise<{ available: boolean, url?: string, windowDays?: number,
 *   totals?: object, queries?: Array, cached?: boolean }>}
 */
export async function getPagePerformance({ url, windowDays = 28 } = {}) {
  const trimmed = (url || '').trim()
  if (!trimmed) throw new Error('URL fehlt')

  const cacheKey = `gsc-page:${trimmed.toLowerCase()}:${windowDays}`
  const cached = getCached(cacheKey)
  if (cached && typeof cached === 'object' && 'available' in cached) {
    return { ...cached, cached: true }
  }

  const result = await getPageMetrics({ url: trimmed, windowDays })
  if (result.available) {
    setCached(cacheKey, result)
  }
  return result
}

// ============================================================
// Themen mit Nachfrage (Seed → GSC + LLM + optional DataForSEO)
// ============================================================

/** LLM-Zeilen parsen: „Titel | target-keyword“ (Fallback: ganze Zeile als Titel). */
function parseTopicLines(raw) {
  return (raw || '')
    .split('\n')
    .map(line => line.trim().replace(/^[-–•*\d.)]+\s*/, ''))
    .filter(Boolean)
    .slice(0, 12)
    .map(line => {
      const parts = line.split('|')
      if (parts.length >= 2) {
        return {
          title: parts[0].trim().replace(/^["'„“]+|["'“”]+$/g, ''),
          keyword: parts[1].trim().toLowerCase().replace(/^["'„“]+|["'“”]+$/g, ''),
        }
      }
      return { title: line.replace(/^["'„“]+|["'“”]+$/g, ''), keyword: null }
    })
    .filter(t => t.title.length > 3)
}

/**
 * Fuzzy-GSC-Match: LLM-Keywords werden oft umgestellt („schönste strände
 * algarve“ vs. GSC-Query „algarve strände“) — Match über Wortüberlappung
 * (≥ 50 % der Keyword-Tokens müssen in der Query vorkommen).
 */
function matchGscQuery(keyword, gscQueries) {
  const tokens = (keyword || '').split(/\s+/).filter(t => t.length > 2)
  if (tokens.length === 0 || !Array.isArray(gscQueries)) return null
  let best = null
  let bestScore = 0
  for (const q of gscQueries) {
    const qTokens = new Set((q.query || '').toLowerCase().split(/\s+/).filter(t => t.length > 2))
    let overlap = 0
    for (const t of tokens) {
      if (qTokens.has(t)) overlap += 1
    }
    const score = overlap / tokens.length
    if (score > bestScore) {
      bestScore = score
      best = q
    }
  }
  return bestScore >= 0.5 ? best : null
}

/**
 * „Themen mit Nachfrage“: Aus einem Seed-Thema (z. B. „Algarve“) deutsche
 * Artikel-Themen mit ECHTEN Nachfrage-Daten:
 *   1) GSC contains-Query → alle Suchanfragen mit dem Seed (Impressionen =
 *      echte Nachfrage, wo mojobus.co sichtbar ist)
 *   2) Mini-LLM → deutsche Themen „Titel | target-keyword“
 *   3) DataForSEO → echte Monatsvolumina + Saisonalität-Peak — NUR auf
 *      expliziten Wunsch (useDfs = Checkbox im Frontend, Standard AUS):
 *      verbraucht Credits. Env-Keys müssen zusätzlich gesetzt sein.
 * Cache: 7 Tage (env: ASSISTANT_TOPICS_CACHE_DAYS) — Suchvolumina ändern
 * sich monatsweise, nicht täglich; schützt auch DFS-Credits. Mit
 * `refresh: true` wird der Cache umgangen (manuelle Frisch-Anfrage).
 * @param {{ seed: string, windowDays?: number, refresh?: boolean, useDfs?: boolean }} params
 */
export async function getTopicSuggestions({ seed, windowDays = 28, refresh = false, useDfs = false } = {}) {
  const trimmed = (seed || '').trim()
  if (!trimmed) throw new Error('Seed fehlt')

  const dfsConfigured = isDataForSEOConfigured()
  const dfsActive = dfsConfigured && Boolean(useDfs)
  const cacheKey = `topics:${trimmed.toLowerCase()}:${windowDays}:${dfsActive ? 'dfs' : 'nodfs'}`
  const ttlDays = Math.max(1, parseInt(process.env.ASSISTANT_TOPICS_CACHE_DAYS || '7', 10) || 7)
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000
  const cached = refresh ? null : getCached(cacheKey, ttlMs)
  if (cached && typeof cached === 'object' && Array.isArray(cached.topics)) {
    return { ...cached, cached: true }
  }

  // 1) GSC: echte Nachfrage-Queries mit dem Seed
  let gsc = { available: false, queries: [] }
  try {
    gsc = await getQueriesContaining({ seed: trimmed, windowDays })
  } catch (error) {
    console.warn('[Assistant] GSC-contains-Abfrage fehlgeschlagen:', error.message)
  }

  // 2) LLM: deutsche Themen „Titel | keyword“ (ohne erfundene Volumina!)
  const hints = gsc.available && gsc.queries.length > 0
    ? gsc.queries
        .slice(0, 15)
        .map(q => `${q.query} (${q.impressions} Impressionen, Ø-Pos ${q.position})`)
        .join('; ')
    : ''
  let topics = []
  try {
    const raw = await generateWithModel(
      buildTopicSuggestionsPrompt(trimmed, hints),
      'mini',
      'mojobus',
      { temperature: 0.5, maxTokens: 800 }
    )
    topics = parseTopicLines(raw)
  } catch (error) {
    console.warn('[Assistant] Themen-LLM fehlgeschlagen:', error.message)
  }
  if (topics.length === 0) {
    topics = [{ title: trimmed, keyword: null }]
  }

  // 3) DataForSEO: echte Monatsvolumina + Peak — NUR wenn der User die
  // Checkbox aktiviert hat (Standard AUS) UND die Env-Keys gesetzt sind
  let dfs = false
  let volumes = null
  if (dfsActive) {
    try {
      const keywords = [...new Set([
        ...topics.map(t => t.keyword).filter(Boolean),
        ...gsc.queries.map(q => q.query),
      ])].slice(0, 200)
      volumes = await getKeywordData(keywords)
      dfs = true
    } catch (error) {
      console.warn('[Assistant] DataForSEO fehlgeschlagen:', error.message)
    }
  }

  // 4) Anreichern + sortieren (stärkste Nachfrage zuerst).
  // Matching-Logik: (a) exaktes DFS-Volumen für das Topic-Keyword, (b) sonst
  // GSC-Query per Fuzzy-Match (Wortumstellung) und deren DFS-Volumen — der
  // Head-Term („algarve strände“) hat bei Google Daten, der Long-Tail
  // („schönste strände algarve“) oft nicht.
  const enriched = topics.map(t => {
    const kw = (t.keyword || '').toLowerCase()
    const exactV = volumes ? volumes.get(kw) : undefined
    // WICHTIG: Hier bezieht sich `gsc` auf die äußere Funktions-Variable
    // (Z. ~444) — deshalb heißen die inneren Daten ABSICHTLICH gscData
    // (ein inneres `const gsc` würde ab Blockanfang in die TDZ gehen und
    // diese Zeile crashen — exakt der Bug, der hier gefixt wurde).
    const gq = kw
      ? (gsc.queries.find(q => q.query.toLowerCase() === kw) || matchGscQuery(kw, gsc.queries))
      : null
    const gqV = gq && volumes ? volumes.get(gq.query.toLowerCase()) : undefined
    const volume = exactV?.volume ?? gqV?.volume ?? null
    const competition = exactV?.competition ?? gqV?.competition ?? null
    const cpc = exactV?.cpc ?? gqV?.cpc ?? null
    const peakMonth = exactV?.peakMonth ?? gqV?.peakMonth ?? null
    const gscData = gq
      ? { impressions: gq.impressions, clicks: gq.clicks, position: gq.position }
      : undefined
    return {
      ...t,
      volume,
      competition,
      cpc,
      peakMonth,
      matchedQuery: gq ? gq.query : null,
      gsc: gscData,
      hasData: volume !== null && volume !== undefined ? true : Boolean(gscData),
    }
  }).sort((a, b) =>
    (b.volume ?? b.gsc?.impressions ?? 0) - (a.volume ?? a.gsc?.impressions ?? 0)
  )

  const result = {
    seed: trimmed,
    dfs,
    dfsConfigured,
    topics: enriched,
    note: gsc.available
      ? null
      : 'GSC liefert erst Daten für Queries mit bestehender Sichtbarkeit — neue Themen ohne Zahlen sind trotzdem verwertbar.'
  }
  setCached(cacheKey, result)
  return result
}
