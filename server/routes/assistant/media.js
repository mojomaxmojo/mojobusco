/**
 * Media-Library-Routen (Berichte-Assistent).
 *
 * Lokale Bild-Bibliothek auf dem VPS (zusätzlich zu Blossom, das im Editor
 * Primärweg bleibt):
 *   GET  /api/media            — Liste (id, public_url, alt_text, tags, Datum)
 *   POST /api/media/upload 🔒  — multer → MEDIA_DIR, Eintrag in media-Tabelle
 *   PUT  /api/media/:id 🔒     — alt_text/tags pflegen
 *   GET  /api/media/file/:id   — Fallback-Auslieferung via Express
 *   POST /api/media/analyze-alt { url } — Alt-Text-Vorschlag via Vision-KI
 *
 * Konfiguration (.env):
 *   MEDIA_DIR         — Default: /home/nginx/domains/mojobus.co/public/images/articles
 *   MEDIA_PUBLIC_BASE — Default: https://mojobus.co/images/articles
 */

import express from 'express'
import multer from 'multer'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { requireAssistantToken } from './index.js'
import { handleMulterError } from '../../utils/http-helpers.js'
import { saveMediaItem, listMediaItems, getMediaItem, updateMediaItem } from '../../services/assistant-store.js'
import { analyzeImageBase64 } from '../content/vision.js'
import { getLifestyleConfig, getArticleImageAnalysisPrompt } from '../../../src/config/prompts/index.js'

const MEDIA_DIR = process.env.MEDIA_DIR || '/home/nginx/domains/mojobus.co/public/images/articles'
const MEDIA_PUBLIC_BASE = process.env.MEDIA_PUBLIC_BASE || 'https://mojobus.co/images/articles'

const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp'
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      fs.mkdirSync(MEDIA_DIR, { recursive: true })
      cb(null, MEDIA_DIR)
    } catch (error) {
      cb(error)
    }
  },
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME[file.mimetype] || 'jpg'
    const datum = new Date().toISOString().slice(0, 10)
    const hash = crypto.randomBytes(4).toString('hex')
    cb(null, `artikel-${datum}-${hash}.${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME[file.mimetype]) return cb(null, true)
    cb(new Error('Nur Bilder (JPEG, PNG, GIF, WebP) sind erlaubt'))
  }
})

const router = express.Router()

// GET /api/media — Liste
router.get('/api/media', (_req, res) => {
  try {
    res.json({ media: listMediaItems() })
  } catch (error) {
    console.error('[Media] Liste fehlgeschlagen:', error.message)
    res.status(500).json({ error: 'Media-Liste fehlgeschlagen', details: error.message })
  }
})

// POST /api/media/upload 🔒 — Bild hochladen (Feldname: image)
router.post('/api/media/upload', requireAssistantToken, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next)
    next()
  })
}, (req, res) => {
  try {
    const file = req.file
    if (!file) {
      return res.status(400).json({ error: 'Kein Bild hochgeladen (Feld: image)' })
    }

    const item = saveMediaItem({
      filename: file.filename,
      public_url: `${MEDIA_PUBLIC_BASE}/${file.filename}`,
      mime_type: file.mimetype,
      size_bytes: file.size
    })

    console.log(`[Media] Upload gespeichert: ${file.filename} (${(file.size / 1024).toFixed(1)}KB) → ${item.public_url}`)
    res.json({ ok: true, media: item })
  } catch (error) {
    console.error('[Media] Upload fehlgeschlagen:', error.message)
    res.status(500).json({ error: 'Upload fehlgeschlagen', details: error.message })
  }
})

// PUT /api/media/:id 🔒 — alt_text/tags pflegen
router.put('/api/media/:id', requireAssistantToken, (req, res) => {
  try {
    const body = req.body || {}
    let tags = body.tags
    if (typeof tags === 'string') {
      tags = tags.split(',').map(t => t.trim()).filter(Boolean)
    }
    const updated = updateMediaItem(req.params.id, {
      alt_text: body.alt_text,
      tags
    })
    if (!updated) {
      return res.status(404).json({ error: 'Media-Eintrag nicht gefunden' })
    }
    res.json({ ok: true, media: updated })
  } catch (error) {
    console.error('[Media] Update fehlgeschlagen:', error.message)
    res.status(500).json({ error: 'Media-Eintrag konnte nicht aktualisiert werden', details: error.message })
  }
})

// GET /api/media/file/:id — Fallback-Auslieferung via Express
// (falls MEDIA_DIR nicht im Nginx-Webroot liegt)
router.get('/api/media/file/:id', (req, res) => {
  try {
    const item = getMediaItem(req.params.id)
    if (!item || !item.filename) {
      return res.status(404).json({ error: 'Media-Eintrag nicht gefunden' })
    }
    const filePath = path.join(MEDIA_DIR, item.filename)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Datei nicht gefunden' })
    }
    res.setHeader('Content-Type', item.mime_type || 'application/octet-stream')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    fs.createReadStream(filePath).pipe(res)
  } catch (error) {
    console.error('[Media] Auslieferung fehlgeschlagen:', error.message)
    res.status(500).json({ error: 'Datei konnte nicht ausgeliefert werden', details: error.message })
  }
})

// POST /api/media/analyze-alt { url } — Alt-Text-Vorschlag via Vision-KI
// Nutzt den bestehenden getArticleImageAnalysisPrompt + analyzeImageBase64.
router.post('/api/media/analyze-alt', async (req, res) => {
  try {
    const { url } = req.body || {}
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return res.status(400).json({ error: 'URL fehlt' })
    }

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15_000,
      maxContentLength: 10 * 1024 * 1024
    })
    const base64 = Buffer.from(response.data).toString('base64')
    const mimeType = response.headers['content-type'] || 'image/jpeg'

    const lifestyleConfig = getLifestyleConfig('mojobus')
    const prompt = getArticleImageAnalysisPrompt(lifestyleConfig, 'medium')
    const description = await analyzeImageBase64(base64, mimeType, prompt, 150)

    res.json({ url, alt: (description || '').trim() })
  } catch (error) {
    console.error('[Media] Alt-Analyse fehlgeschlagen:', error.response?.data || error.message)
    res.status(500).json({ error: 'Alt-Text-Analyse fehlgeschlagen', details: error.message })
  }
})

export default router
