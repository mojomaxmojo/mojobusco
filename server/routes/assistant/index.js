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
import crypto from 'crypto'
import {
  researchTopic,
  getIdeas,
  getContinuitySuggestions,
  getLinkSuggestions,
  suggestSeoTitle
} from '../../services/report-assistant.js'
import {
  saveArticle,
  listArticles,
  getArticle,
  deleteArticle,
  updateArticleFields,
  markPublished
} from '../../services/assistant-store.js'
import { runPublishPipeline } from '../../services/publish-pipeline.js'

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

// ============================================================
// TOKEN-SCHUTZ (Schreib-Routen)
// ============================================================

/**
 * Prüft `Authorization: Bearer <ASSISTANT_API_TOKEN>` (timing-safe).
 * Ohne gültigen Token: 401.
 */
function requireAssistantToken(req, res, next) {
  const expected = process.env.ASSISTANT_API_TOKEN
  if (!expected) {
    console.error('[Assistant] ASSISTANT_API_TOKEN nicht konfiguriert — Schreib-Routen gesperrt')
    return res.status(500).json({ error: 'ASSISTANT_API_TOKEN nicht konfiguriert' })
  }

  const authHeader = req.headers.authorization || ''
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b)

  if (!valid) {
    return res.status(401).json({ error: 'Ungültiger oder fehlender Token' })
  }
  next()
}

// ============================================================
// GESCHÜTZTE ROUTEN (Drafts, Artikel-Felder, Published)
// ============================================================

// POST /api/assistant/drafts 🔒 — Entwurf speichern/aktualisieren (status=draft)
router.post('/api/assistant/drafts', requireAssistantToken, (req, res) => {
  try {
    const body = req.body || {}
    const article = saveArticle({ ...body, status: 'draft' })
    res.json({ ok: true, article })
  } catch (error) {
    console.error('[Assistant] Draft-Speicherung fehlgeschlagen:', error.message)
    res.status(500).json({ error: 'Entwurf konnte nicht gespeichert werden', details: error.message })
  }
})

// GET /api/assistant/drafts 🔒 — Übersicht (Titel, Status, updated_at)
router.get('/api/assistant/drafts', requireAssistantToken, (req, res) => {
  try {
    const drafts = listArticles('draft')
    res.json({ drafts })
  } catch (error) {
    console.error('[Assistant] Draft-Liste fehlgeschlagen:', error.message)
    res.status(500).json({ error: 'Entwürfe konnten nicht geladen werden', details: error.message })
  }
})

// GET /api/assistant/drafts/:id 🔒 — Entwurf laden
router.get('/api/assistant/drafts/:id', requireAssistantToken, (req, res) => {
  try {
    const article = getArticle(req.params.id)
    if (!article) {
      return res.status(404).json({ error: 'Entwurf nicht gefunden' })
    }
    res.json({ article })
  } catch (error) {
    console.error('[Assistant] Draft-Laden fehlgeschlagen:', error.message)
    res.status(500).json({ error: 'Entwurf konnte nicht geladen werden', details: error.message })
  }
})

// DELETE /api/assistant/drafts/:id 🔒 — Entwurf löschen
router.delete('/api/assistant/drafts/:id', requireAssistantToken, (req, res) => {
  try {
    const deleted = deleteArticle(req.params.id)
    if (!deleted) {
      return res.status(404).json({ error: 'Entwurf nicht gefunden' })
    }
    res.json({ ok: true })
  } catch (error) {
    console.error('[Assistant] Draft-Löschen fehlgeschlagen:', error.message)
    res.status(500).json({ error: 'Entwurf konnte nicht gelöscht werden', details: error.message })
  }
})

// PUT /api/assistant/article/:id 🔒 — Felder ändern (seo_title, meta_description, slug, …)
router.put('/api/assistant/article/:id', requireAssistantToken, (req, res) => {
  try {
    const updated = updateArticleFields(req.params.id, req.body || {})
    if (!updated) {
      return res.status(404).json({ error: 'Artikel nicht gefunden' })
    }
    res.json({ ok: true, article: updated })
  } catch (error) {
    console.error('[Assistant] Artikel-Update fehlgeschlagen:', error.message)
    res.status(500).json({ error: 'Artikel konnte nicht aktualisiert werden', details: error.message })
  }
})

// POST /api/assistant/published 🔒 { article_id?, d_tag, url }
// Markiert Status 'published' + startet Pipeline + IndexNow im Hintergrund.
// NUR für bereits browserseitig auf Nostr veröffentlichte Artikel gedacht —
// kein automatischer Pfad kann einen Draft veröffentlichen.
router.post('/api/assistant/published', requireAssistantToken, (req, res) => {
  try {
    const { article_id, d_tag, url } = req.body || {}
    if (!d_tag || !url) {
      return res.status(400).json({ error: 'd_tag und url erforderlich' })
    }

    let publishedArticle = null
    if (article_id) {
      publishedArticle = markPublished(article_id, { dTag: d_tag, url })
      if (!publishedArticle) {
        console.warn(`[Assistant] Artikel ${article_id} nicht gefunden — nur Pipeline-Start`)
      }
    }

    // Antwort sofort — Pipeline läuft danach im Hintergrund (dauert 1–2 Min)
    res.json({ ok: true, article: publishedArticle })

    runPublishPipeline({ dTag: d_tag, url })
      .then(() => console.log(`[Assistant] Pipeline abgeschlossen für ${url}`))
      .catch(error => console.error('[Assistant] Pipeline-Fehler:', error.message))
  } catch (error) {
    console.error('[Assistant] published fehlgeschlagen:', error.message)
    res.status(500).json({ error: 'Veröffentlichung konnte nicht verarbeitet werden', details: error.message })
  }
})

export default router
