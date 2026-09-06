/**
 * internal-links.js — Stufe 1: Automatisches Einstreuen interner Links in
 * frisch generierte Berichte (/api/generate-article).
 *
 * Warum deterministisch statt KI-Weaving:
 * - Die Einbau-Anweisung müsste in die Tabu-Prompts (src/config/prompts/)
 *   oder in „WAS DER AUTOR SAGT" — beides verboten bzw. semantisch falsch.
 * - Der KI könnten naddr-URLs nur als Liste mitgegeben werden; Tippfehler
 *   oder erfundene naddrs wären praktisch unentdeckbar. Hier fließen NUR
 *   echte Einträge aus data/sitemap.json + data/articles.json ein →
 *   garantiert korrekte canonical URLs (AGENTS.md Regel 2).
 *
 * Ablauf (insertInternalLinks):
 * 1. Kandidaten laden (gleiche Datenbasis wie getLinkSuggestions in
 *    report-assistant.js)
 * 2. Kandidaten gegen den fertigen Artikel-Text scoren (Token-Überlappung
 *    in Titel/Summary/Tags + Formular-Ort/Tags als Bonus)
 * 3. Pro Kandidat die erste passende Textstelle suchen (Anker = eine im
 *    Text VORHANDENE Wortfolge aus den Titel-Tokens — liest sich natürlich)
 *    und sie in einen Markdown-Link `[Anker](URL)` verwandeln.
 * 4. Schutzgeländer (server/config/internal-links.js): max. 3 Links,
 *    ≥150 Wörter Abstand, Artikel <200 Wörter unverändert, nichts im
 *    ersten Absatz, nichts in Überschriften/Bild-/Code-/bereits
 *    verlinkten Zeilen, jeder Kandidat nur 1×, [BILD_N]-Zeilen tabu.
 *
 * Fehler sind NIEMALS fatal: Fehlende Daten-Dumps (lokal ist public/data/
 * leer — Dumps entstehen per Cron auf dem VPS) oder jede Exception führen
 * dazu, dass der Artikel UNVERÄNDERT zurückgegeben wird. Die Generierung
 * darf an dieser Stelle nie scheitern.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { INTERNAL_LINKS_CONFIG } from '../config/internal-links.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Canonical URL (AGENTS.md Regel 2): Artikel → https://mojobus.co/{naddr}
// (Muster wie report-assistant.js — Server-Seite bewusst ohne src/config-Import)
const BASE_URL = 'https://mojobus.co'

// Kandidaten-Pfade für die statischen Daten-Dumps (identisch zu
// report-assistant.js): VPS (Cron-Layout) zuerst, dann Repo-Fallback.
const DATA_CANDIDATE_DIRS = [
  process.env.DATA_DIR,
  '/home/nginx/domains/mojobus.co/public/data',
  path.join(__dirname, '..', '..', 'public', 'data')
]

/**
 * Lädt ein JSON-Array aus dem ersten existierenden data-Verzeichnis.
 * (Bewusst dupliziert statt aus report-assistant.js importiert: Der
 * Generierungs-Pfad soll NICHT von der Assistant-Import-Kette — GSC,
 * DataForSEO, assistant.db — abhängen.)
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
      console.warn(`[InternalLinks] Konnte ${fileName} nicht laden (${dir}):`, error.message)
    }
  }
  return []
}

/**
 * Zerlegt einen Text in normalisierte Tokens (identische Logik zu
 * report-assistant.js: lowercase, ohne Stopwords, ≥4 Zeichen).
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

/**
 * Entfernt Markdown-Syntax für die Tokenisierung (Link-URLs weg,
 * Anker-Texte bleiben, Bilder/Bildplatzhalter weg).
 * @param {string} markdown
 * @returns {string}
 */
function stripMarkdown(markdown) {
  return (markdown || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')   // Bilder
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Links → nur Anker-Text
    .replace(/\[BILD_\d+\][^\n]*/g, ' ')     // Platzhalter-Zeilen
    .replace(/^#{1,6}\s+/gm, ' ')            // Heading-Marker
    .replace(/[*_`>]/g, ' ')
}

/** Zählt Wörter in (bereits gestripptem) Text. */
function countWords(text) {
  return (text || '').split(/\s+/).filter(Boolean).length
}

/** Escaping für Regex-Literals (Tokens bestehen nur aus \p{L}\p{N}, aber sicher ist sicher). */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Baut einen Regex, der `phrase` als eigenständiges Wort findet (kein
 * Treffer mitten in Wörtern/Hashtags/URLs). 'u'-Flag wegen \p{L}-Lookarounds.
 * @param {string} phrase
 */
function anchorRegex(phrase) {
  return new RegExp(
    `(?<![\\p{L}\\p{N}_#/])${escapeRegExp(phrase)}(?![\\p{L}\\p{N}])`,
    'iu'
  )
}

/**
 * Lädt die Link-Kandidaten: sitemap.json liefert naddr/identifier,
 * articles.json die Metadaten (Titel, Summary, Tags) pro d-Tag.
 * @returns {Array<{title: string, url: string, identifier: string, tags: string[], tokens: string[]}>}
 */
function loadCandidates() {
  const sitemap = loadJsonArray('sitemap.json')
  const articles = loadJsonArray('articles.json')
  if (sitemap.length === 0) return []

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

  const candidates = []
  for (const entry of sitemap) {
    if (!entry?.naddr || !entry?.identifier) continue
    const meta = byIdentifier.get(entry.identifier) || {}
    const title = meta.title || entry.title || ''
    if (!title) continue
    candidates.push({
      title,
      url: `${BASE_URL}/${entry.naddr}`, // canonical: https://mojobus.co/{naddr}
      identifier: entry.identifier,
      summary: meta.summary || '',
      tags: meta.tags || [],
      tokens: tokenize(title)
    })
  }
  return candidates
}

/**
 * Scort Kandidaten gegen den Artikel-Text (+ Formular-Kontext).
 * Scoring-Muster wie getLinkSuggestions (report-assistant.js):
 * Token im Kandidaten-Titel +2, in Summary +1, in dessen Tags +2,
 * exakter Formular-Tag-Match +3.
 * @param {Array} candidates
 * @param {{ articleTokens: string[], location?: string, tags?: string[] }} ctx
 * @returns {Array<{candidate: object, score: number}>} sortiert, Score > min
 */
function scoreCandidates(candidates, { articleTokens, location, tags }) {
  const locationTokens = tokenize(location)
  const formTags = (Array.isArray(tags) ? tags : []).map(t => String(t).trim().toLowerCase()).filter(Boolean)

  const scored = []
  for (const candidate of candidates) {
    const titleLower = candidate.title.toLowerCase()
    const summaryLower = (candidate.summary || '').toLowerCase()
    let score = 0
    for (const token of articleTokens) {
      if (titleLower.includes(token)) score += 2
      if (summaryLower.includes(token)) score += 1
      if (candidate.tags.some(t => t.toLowerCase().includes(token))) score += 2
    }
    for (const locToken of locationTokens) {
      if (titleLower.includes(locToken)) score += 2
      if (candidate.tags.some(t => t.toLowerCase().includes(locToken))) score += 1
    }
    for (const formTag of formTags) {
      if (candidate.tags.some(t => t.toLowerCase() === formTag)) score += 3
    }
    if (score >= INTERNAL_LINKS_CONFIG.MIN_CANDIDATE_SCORE) {
      scored.push({ candidate, score })
    }
  }
  scored.sort((a, b) => b.score - a.score)
  return scored
}

/**
 * Findet die erste passende Anker-Stelle in einem Absatz: Erst
 * 2-Token-Phrasen (benachbart im Kandidaten-Titel), dann Einzel-Tokens
 * (längste zuerst). Liefert { index, length } des Treffers im Absatz oder null.
 * @param {string} block - Absatz-Text (mit Markdown)
 * @param {{ tokens: string[] }} candidate
 */
function findAnchor(block, candidate) {
  const minLen = INTERNAL_LINKS_CONFIG.MIN_ANCHOR_TOKEN_LENGTH
  const tokens = candidate.tokens.filter(t => t.length >= minLen)
  if (tokens.length === 0) return null

  // 1) Zwei benachbarte Titel-Tokens als Phrase
  for (let i = 0; i < tokens.length - 1; i++) {
    const phrase = `${tokens[i]} ${tokens[i + 1]}`
    const m = block.match(anchorRegex(phrase))
    if (m) return { index: m.index, length: m[0].length }
  }

  // 2) Einzel-Tokens, längste zuerst (spezifischste Anker zuerst)
  for (const token of [...tokens].sort((a, b) => b.length - a.length)) {
    const m = block.match(anchorRegex(token))
    if (m) return { index: m.index, length: m[0].length }
  }
  return null
}

/**
 * Fügt interne Links in den generierten Artikel ein.
 * @param {string} articleMarkdown - fertiger Artikel (Markdown mit [BILD_N]-Platzhaltern)
 * @param {{ title?: string, location?: string, tags?: string[] }} meta - Formular-Kontext
 * @returns {{ content: string, inserted: Array<{title: string, url: string, anchor: string}> }}
 *           content = Artikel mit (oder ohne) Links, inserted = was eingestreut wurde
 */
export function insertInternalLinks(articleMarkdown, meta = {}) {
  const unchanged = { content: articleMarkdown || '', inserted: [] }
  try {
    if (!articleMarkdown || countWords(stripMarkdown(articleMarkdown)) < INTERNAL_LINKS_CONFIG.MIN_ARTICLE_WORDS) {
      return unchanged
    }

    // Bereits vorhandene interne Links zählen mit (Sicherheitsnetz, falls
    // die KI selbst Links produziert hat) — als URL-Set, damit Dedupe greift.
    const allLinkUrls = (articleMarkdown.match(/\[[^\]]*\]\(([^)\s]+)\)/g) || [])
      .map(l => (l.match(/\]\(([^)\s]+)\)/) || [])[1] || '')
    const existingInternalUrls = new Set(
      allLinkUrls.filter(u => u.startsWith('/') || u.includes('mojobus.co'))
    )
    let linksPlaced = existingInternalUrls.size
    if (linksPlaced >= INTERNAL_LINKS_CONFIG.MAX_LINKS) {
      return unchanged
    }

    const candidates = loadCandidates()
    if (candidates.length === 0) return unchanged

    const articleTokens = [...new Set(tokenize(stripMarkdown(articleMarkdown)))]
    const scored = scoreCandidates(candidates, {
      articleTokens,
      location: meta.location,
      tags: meta.tags
    })
    if (scored.length === 0) return unchanged

    const blocks = articleMarkdown.split(/\n{2,}/)
    const inserted = []
    const usedUrls = new Set(existingInternalUrls)
    let wordsSinceLastInsert = 0
    let inFence = false

    for (let b = 0; b < blocks.length && linksPlaced < INTERNAL_LINKS_CONFIG.MAX_LINKS; b++) {
      const block = blocks[b]
      const blockWords = countWords(stripMarkdown(block))
      const isFirstBlock = b === 0

      // Code-Fences komplett überspringen (Zustand trotzdem tracken)
      if (/^```/.test(block.trim())) {
        inFence = !inFence
        wordsSinceLastInsert += blockWords
        continue
      }
      if (inFence) {
        wordsSinceLastInsert += blockWords
        continue
      }

      wordsSinceLastInsert += blockWords

      // Struktur-Zeilen & bereits verlinkte Absätze tabu
      const trimmed = block.trim()
      if (isFirstBlock && INTERNAL_LINKS_CONFIG.SKIP_FIRST_PARAGRAPH) continue
      if (!blockWords) continue
      if (/^(#{1,6}\s|!\[|\[BILD_|>|---)/.test(trimmed)) continue
      if (trimmed.includes('](')) continue
      if (trimmed.includes('[BILD_')) continue

      // Wortabstand einhalten
      if (inserted.length > 0 && wordsSinceLastInsert < INTERNAL_LINKS_CONFIG.MIN_WORD_DISTANCE) continue

      // Bester Kandidat, der in DIESEM Absatz einen natürlichen Anker findet
      for (const { candidate } of scored) {
        if (usedUrls.has(candidate.url)) continue
        const anchor = findAnchor(block, candidate)
        if (!anchor) continue

        const before = block.slice(0, anchor.index)
        const anchorText = block.slice(anchor.index, anchor.index + anchor.length)
        const after = block.slice(anchor.index + anchor.length)
        blocks[b] = `${before}[${anchorText}](${candidate.url})${after}`
        usedUrls.add(candidate.url)
        inserted.push({ title: candidate.title, url: candidate.url, anchor: anchorText })
        linksPlaced += 1
        wordsSinceLastInsert = 0
        break
      }
    }

    if (inserted.length === 0) return unchanged
    return { content: blocks.join('\n\n'), inserted }
  } catch (error) {
    // Nie fatal: Generierung darf an dieser Stelle nicht scheitern.
    console.error('[InternalLinks] Fehler — Artikel bleibt unverändert:', error.message)
    return unchanged
  }
}
