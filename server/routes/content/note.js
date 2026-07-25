import express from 'express'
import multer from 'multer'
import {
  getLifestyleConfig,
  generateNotePrompt,
  getNoteImageAnalysisPrompt,
} from '../../src/config/prompts/index.js'
import { handleMulterError, sanitizeInput, validateApiKey, safelyParseJSON } from '../utils/http-helpers.js'
import { generateWithModel } from '../services/ai-content.js'
import { analyzeImageBase64 } from './vision.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 30,
    fieldSize: 1 * 1024 * 1024
  }
})

const router = express.Router()

router.post('/api/generate-note', (req, res, next) => {
  upload.array('images', 10)(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next)
    next()
  })
}, async (req, res) => {
  if (!validateApiKey()) {
    return res.status(500).json({ error: 'Server-Konfigurationsfehler' })
  }

  const title = sanitizeInput(req.body.title) || ''
  const description = sanitizeInput(req.body.description) || ''
  const location = sanitizeInput(req.body.location) || ''
  // text NICHT kürzen – User-Notiztext kann relevant lang sein
  const text = (req.body.text || '').trim()
  const model = req.body.model || 'llama4'
  const lifestyle = sanitizeInput(req.body.lifestyle) || 'mojobus'
  const gender = sanitizeInput(req.body.gender) || 'couple'
  const images = req.files

  // Zusätzliche Kontext-Felder
  const country = sanitizeInput(req.body.country) || ''
  const tripType = sanitizeInput(req.body.tripType) || ''

  if (!images || images.length === 0) {
    return res.status(400).json({ error: 'Mindestens ein Bild erforderlich' })
  }

  console.log(`[KI] Generiere Notiz: "${title || '(kein Titel)'}", Text: ${text.length} Zeichen, Bilder: ${images.length}, Lifestyle: ${lifestyle}, Modell: ${model}`)
  if (tripType) console.log(`[KI] Trip-Typ: ${tripType}`)

  try {
    const lifestyleConfig = getLifestyleConfig(lifestyle)
    
    // Bilder analysieren
    const imageDescriptions = await Promise.all(images.map(async (img) => {
      const base64 = img.buffer.toString('base64')
      const prompt = getNoteImageAnalysisPrompt(lifestyleConfig)
      return analyzeImageBase64(base64, 'image/jpeg', prompt, 100)
    }))

    // Foster Huntington Prompt für Notizen - importiert aus src/config/prompts/notes.js
    const prompt = generateNotePrompt({
      title,
      description,
      location,
      text,
      imageDescriptions,
      lifestyleConfig,
      country,
      gender,
      tripType
    })

    // Notizen: max 120 Tokens (20-80 Wörter + Hashtags)
    const note = await generateWithModel(prompt, model, lifestyle, {
      maxTokens: 120,
      temperature: 0.7
    })
    
    const hashtags = note.match(/#\w+/g) || []
    const uniqueHashtags = [...new Set(hashtags.map(tag => tag.replace('#', '')))]

    res.json({
      note,
      hashtags: uniqueHashtags.join(' '),
      lifestyle
    })
  } catch (error) {
    console.error('[KI] Fehler bei Notiz-Generierung:', error.response?.data || error.message)
    res.status(500).json({ error: 'Fehler bei Generierung. Versuche es erneut.' })
  }
})
export default router
