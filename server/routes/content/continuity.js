/**
 * Continuity-Tracking-Route.
 *
 * Generischer Endpunkt für alle 5 Publish-Typen (Artikel, Platz, Notiz,
 * Media, Trip). Extrahiert Motive/Entitäten/Stimmung/offene Fäden aus dem
 * veröffentlichten Text (günstiges Modell) und speichert sie über
 * continuity-store.js. Blockiert den Publish-Flow im Frontend nie: Antwort
 * ist immer { ok: true }, auch bei Extraktions-Fehlern (nur loggen).
 */

import express from 'express'
import { buildExtractionPrompt } from '../../prompts/continuity-extraction.js'
import { generateWithModel } from '../../services/ai-content.js'
import {
  savePost,
  saveMotifs,
  saveEntities,
  saveOpenThreads
} from '../../services/continuity-store.js'

const router = express.Router()

/**
 * Wandelt gängige JSON-Escape-Sequenzen um (analog zu translate.js).
 */
function unescapeJsonLikeString(value) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

/**
 * Parst die Extraktions-Antwort robust: zuerst JSON.parse, dann Regex-Suche
 * nach einem JSON-Objekt im Text, dann Feld-Extraktion per Regex. Gibt bei
 * vollständigem Fehlschlag ein leeres Ergebnis zurück (nie null/Absturz).
 */
function parseExtractionResponse(raw) {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    // weiter zu Fallbacks
  }

  const match = cleaned.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      return JSON.parse(match[0])
    } catch {
      // weiter zu Fallback 3
    }
  }

  // Fallback 3: Felder einzeln per Regex extrahieren
  const motifs = extractArrayField(cleaned, 'motifs')
  const entities = extractArrayField(cleaned, 'entities')
  const mood = extractStringField(cleaned, 'mood')
  const openThreads = extractArrayField(cleaned, 'openThreads')

  return { motifs, entities, mood, openThreads }
}

function extractArrayField(raw, fieldName) {
  const marker = new RegExp(`"${fieldName}"\\s*:\\s*\\[([^\\]]*)\\]`)
  const match = marker.exec(raw)
  if (!match) return []
  return match[1]
    .split(',')
    .map(s => unescapeJsonLikeString(s.trim().replace(/^"|"$/g, '')))
    .filter(Boolean)
}

function extractStringField(raw, fieldName) {
  const marker = new RegExp(`"${fieldName}"\\s*:\\s*"([^"]*)"`)
  const match = marker.exec(raw)
  return match ? unescapeJsonLikeString(match[1]) : ''
}

// POST /api/continuity/track
router.post('/api/continuity/track', async (req, res) => {
  const { id, type, kind, title, location, country, publishedAt, content } = req.body || {}

  // Antwort immer sofort mit ok:true, damit der Publish-Flow im Frontend
  // nie blockiert wird. Verarbeitung läuft danach im Hintergrund.
  res.json({ ok: true })

  if (!id || !type || !kind || !content || typeof content !== 'string' || content.trim().length === 0) {
    console.warn('[Continuity] Ungültiger Track-Request, überspringe:', { id, type, kind })
    return
  }

  try {
    const extractionPrompt = buildExtractionPrompt(content, title)
    const raw = await generateWithModel(extractionPrompt, 'mini', 'mojobus', {
      temperature: 0.3,
      maxTokens: 500
    })

    const extracted = parseExtractionResponse(raw || '')
    const motifs = Array.isArray(extracted.motifs) ? extracted.motifs : []
    const entities = Array.isArray(extracted.entities) ? extracted.entities : []
    const mood = typeof extracted.mood === 'string' ? extracted.mood : ''
    const openThreads = Array.isArray(extracted.openThreads) ? extracted.openThreads : []

    const publishedAtTimestamp = publishedAt
      ? (/^\d+$/.test(String(publishedAt)) ? parseInt(publishedAt, 10) : Math.floor(new Date(publishedAt).getTime() / 1000))
      : Math.floor(Date.now() / 1000)

    savePost({
      id,
      type,
      kind,
      title,
      location,
      country,
      mood,
      publishedAt: publishedAtTimestamp
    })
    saveMotifs(id, motifs)
    saveEntities(id, entities)
    saveOpenThreads(id, openThreads)

    console.log(`[Continuity] Post ${id} (${type}) gespeichert: ${motifs.length} Motive, ${entities.length} Entitäten, ${openThreads.length} offene Fäden`)
  } catch (error) {
    console.error('[Continuity] Extraktion/Speicherung fehlgeschlagen:', error.response?.data || error.message)
  }
})

export default router
