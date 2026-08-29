/**
 * Assistant-Routen für den Berichte-Assistenten (/veroeffentlichen).
 *
 * Teil 1 — offene (nur lesende/generierende) Routen:
 *   GET  /api/assistant/ideas?location=
 *   POST /api/assistant/research           { topic }
 *   GET  /api/assistant/continuity-suggestions?location=&date=
 *   GET  /api/assistant/link-suggestions?topic=&location=&tags=
 *   POST /api/assistant/seo-title          { title, articleText }
 *
 * Teil 2 (Schritt 3) — token-geschützte Schreib-Routen: Drafts-CRUD,
 * PUT /article/:id, POST /published (Pipeline-Trigger).
 *
 * Muster wie routes/content/continuity.js.
 */

import express from 'express'
import {
  researchTopic,
  getIdeas,
  getContinuitySuggestions,
  getLinkSuggestions,
  suggestSeoTitle
} from '../../services/report-assistant.js'

const router = express.Router()

// ============================================================
// OFFENE ROUTEN (nur lesend / ask)
// ============================================================

// GET /api/assistant/ideas?location=
router.get('/api/assistant/ideas', async (req, res) => {
  try {
    const location = typeof req.query.location === 'string' ? req.query.location : ''
    const result = await getIdeas({ location })
    res.json(result)
  } catch (error) {
    console.error('[Assistant] ideas fehlgeschlagen:', error.response?.data || error.message)
    res.status(500).json({ error: 'Ideen-Generierung fehlgeschlagen', details: error.message })
  }
})

// POST /api/assistant/research { topic }
router.post('/api/assistant/research', async (req, res) => {
  try {
    const { topic } = req.body || {}
    if (!topic || typeof topic !== 'string' || topic.trim() === '') {
      return res.status(400).json({ error: 'Thema fehlt' })
    }
    const result = await researchTopic(topic)
    res.json(result)
  } catch (error) {
    console.error('[Assistant] research fehlgeschlagen:', error.response?.data || error.message)
    res.status(500).json({ error: 'Recherche fehlgeschlagen', details: error.message })
  }
})

// GET /api/assistant/continuity-suggestions?location=&date=
router.get('/api/assistant/continuity-suggestions', (req, res) => {
  try {
    const location = typeof req.query.location === 'string' ? req.query.location : ''
    const date = typeof req.query.date === 'string' ? req.query.date : ''
    res.json(getContinuitySuggestions({ location, date }))
  } catch (error) {
    console.error('[Assistant] continuity-suggestions fehlgeschlagen:', error.message)
    res.status(500).json({ error: 'Continuity-Suggestions fehlgeschlagen', details: error.message })
  }
})

// GET /api/assistant/link-suggestions?topic=&location=&tags=
router.get('/api/assistant/link-suggestions', (req, res) => {
  try {
    const topic = typeof req.query.topic === 'string' ? req.query.topic : ''
    const location = typeof req.query.location === 'string' ? req.query.location : ''
    const tagsRaw = typeof req.query.tags === 'string' ? req.query.tags : ''
    const tags = tagsRaw
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
    res.json(getLinkSuggestions({ topic, location, tags }))
  } catch (error) {
    console.error('[Assistant] link-suggestions fehlgeschlagen:', error.message)
    res.status(500).json({ error: 'Link-Suggestions fehlgeschlagen', details: error.message })
  }
})

// POST /api/assistant/seo-title { title, articleText }
router.post('/api/assistant/seo-title', async (req, res) => {
  try {
    const { title, articleText } = req.body || {}
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'Titel fehlt' })
    }
    const result = await suggestSeoTitle({
      title,
      articleText: typeof articleText === 'string' ? articleText : ''
    })
    res.json(result)
  } catch (error) {
    console.error('[Assistant] seo-title fehlgeschlagen:', error.response?.data || error.message)
    res.status(500).json({ error: 'SEO-Titel-Vorschlag fehlgeschlagen', details: error.message })
  }
})

export default router
