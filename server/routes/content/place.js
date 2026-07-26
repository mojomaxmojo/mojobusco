import express from 'express'
import multer from 'multer'
import axios from 'axios'
import {
  getLifestyleConfig,
  generatePlacePrompt,
  getPlaceImageAnalysisPrompt,
} from '../../../src/config/prompts/index.js'
import { handleMulterError, sanitizeInput, validateApiKey, safelyParseJSON } from '../../utils/http-helpers.js'
import { generateWithModel } from '../../services/ai-content.js'
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

router.post('/api/generate-place', (req, res, next) => {
  upload.array('images', 10)(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next)
    next()
  })
}, async (req, res) => {
  if (!validateApiKey()) {
    return res.status(500).json({ error: 'Server-Konfigurationsfehler' })
  }

  const title = sanitizeInput(req.body.title) || 'Mein Platz'
  // description NICHT kürzen – MilkdownEditor kann langen Text enthalten
  const description = (req.body.description || '').trim()
  const location = sanitizeInput(req.body.location) || 'Unbekannt'
  const gps_lat = sanitizeInput(req.body.gps_lat) || ''
  const gps_lon = sanitizeInput(req.body.gps_lon) || ''
  const model = req.body.model || 'llama4'
  const lifestyle = sanitizeInput(req.body.lifestyle) || 'mojobus'
  const gender = sanitizeInput(req.body.gender) || 'couple'
  const images = req.files

  // Kontext-Felder
  const category = sanitizeInput(req.body.category) || ''
  const facilities = safelyParseJSON(req.body.facilities) || []
  const bestFor = safelyParseJSON(req.body.bestFor) || []
  const country = sanitizeInput(req.body.country) || ''
  const rating = sanitizeInput(req.body.rating) || ''
  const price = sanitizeInput(req.body.price) || ''
  const tripType = sanitizeInput(req.body.tripType) || ''
  // Zusätzliche Bild-URLs: hochgeladene Zusatzbilder + Markdown-Bilder aus description
  const additionalImageUrls = safelyParseJSON(req.body.additionalImageUrls) || []
  const markdownImageUrls = safelyParseJSON(req.body.markdownImageUrls) || []

  // Mindestens Titelbild ODER andere Bilder erforderlich
  const hasUploadedImages = images && images.length > 0
  const hasExtraImages = additionalImageUrls.length > 0 || markdownImageUrls.length > 0
  if (!hasUploadedImages && !hasExtraImages) {
    return res.status(400).json({ error: 'Mindestens ein Bild erforderlich' })
  }

  console.log(`[KI] Generiere Platz-Beschreibung: "${title}", Titel-Bilder: ${images?.length || 0}, Zusatz-Bilder: ${additionalImageUrls.length}, Markdown-Bilder: ${markdownImageUrls.length}, GPS: ${gps_lat},${gps_lon}, Lifestyle: ${lifestyle}, Modell: ${model}`)
  if (rating) console.log(`[KI] Bewertung: ${rating} Sterne`)
  if (price) console.log(`[KI] Preis: ${price}`)

  // Hilfsfunktion: URL → Base64
  const fetchImageAsBase64 = async (url) => {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 10 * 1024 * 1024
    })
    return Buffer.from(response.data).toString('base64')
  }


  try {
    const lifestyleConfig = getLifestyleConfig(lifestyle)

    // ===== TITELBILD(ER) analysieren =====
    const uploadedImageDescriptions = hasUploadedImages
      ? await Promise.all(images.map(async (img) => {
          const base64 = img.buffer.toString('base64')
          const mimeType = img.mimetype || 'image/jpeg'
          console.log(`[KI] Analysiere Titelbild, Größe: ${(img.size / 1024).toFixed(1)}KB`)
          const prompt = getPlaceImageAnalysisPrompt(lifestyleConfig)
          return analyzeImageBase64(base64, mimeType, prompt, 150)
        }))
      : []

    // ===== ZUSATZBILDER analysieren (hochgeladene URLs) =====
    // Max 3 Zusatzbilder – Platz-Beschreibung ist kurz, mehr Bilder bringen wenig
    const additionalUrlsToAnalyze = additionalImageUrls.slice(0, 3)
    const additionalImageDescriptions = additionalUrlsToAnalyze.length > 0
      ? await Promise.allSettled(additionalUrlsToAnalyze.map(async (url, index) => {
          console.log(`[KI] Lade Zusatzbild ${index + 1}/${additionalUrlsToAnalyze.length}: ${url.substring(0, 60)}...`)
          const base64 = await fetchImageAsBase64(url)
          const mimeType = url.match(/\.(png)$/i) ? 'image/png'
            : url.match(/\.(webp)$/i) ? 'image/webp'
            : 'image/jpeg'
          const prompt = getPlaceImageAnalysisPrompt(lifestyleConfig)
          return analyzeImageBase64(base64, mimeType, prompt, 150)
        }))
        .then(results => results.filter(r => r.status === 'fulfilled').map(r => r.value))
      : []

    // ===== MARKDOWN-BILDER aus description analysieren =====
    // Max 3 Markdown-Bilder – zusammen mit Zusatzbildern max 6 Bilder total
    const remainingSlots = Math.max(0, 3 - additionalImageDescriptions.length)
    const markdownUrlsToAnalyze = markdownImageUrls.slice(0, remainingSlots)
    const markdownImageDescriptions = markdownUrlsToAnalyze.length > 0
      ? await Promise.allSettled(markdownUrlsToAnalyze.map(async (url, index) => {
          console.log(`[KI] Lade Markdown-Bild ${index + 1}/${markdownUrlsToAnalyze.length}: ${url.substring(0, 60)}...`)
          const base64 = await fetchImageAsBase64(url)
          const mimeType = url.match(/\.(png)$/i) ? 'image/png'
            : url.match(/\.(webp)$/i) ? 'image/webp'
            : 'image/jpeg'
          const prompt = getPlaceImageAnalysisPrompt(lifestyleConfig)
          return analyzeImageBase64(base64, mimeType, prompt, 150)
        }))
        .then(results => results.filter(r => r.status === 'fulfilled').map(r => r.value))
      : []

    // Alle Bilder als Objekte {url, description} zusammenführen
    // Titelbild hat keine öffentliche URL → url: null
    // Zusatz- und Markdown-Bilder haben öffentliche URLs
    const imageObjects = [
      ...uploadedImageDescriptions.map(desc => ({ url: null, description: desc })),
      ...additionalUrlsToAnalyze.map((url, i) => ({
        url,
        description: additionalImageDescriptions[i] || ''
      })).filter(obj => obj.description),
      ...markdownUrlsToAnalyze.map((url, i) => ({
        url,
        description: markdownImageDescriptions[i] || ''
      })).filter(obj => obj.description)
    ]
    console.log(`[KI] Gesamt ${imageObjects.length} Bilder für Platz-Prompt`)

    // Foster Huntington Prompt für Plätze - importiert aus src/config/prompts/place.js
    const prompt = generatePlacePrompt({
      title,
      description,
      location,
      gps_lat,
      gps_lon,
      imageObjects,  // neu: [{url, description}] statt imageDescriptions[]
      lifestyleConfig,
      category,
      facilities,
      bestFor,
      country,
      rating,
      price,
      gender,
      tripType
    })

    // Plätze: max 300 Tokens (80-150 Wörter + Hashtags)
    const description_text = await generateWithModel(prompt, model, lifestyle, {
      maxTokens: 300,
      temperature: 0.75
    })

    const hashtags = description_text.match(/#\w+/g) || []
    const uniqueHashtags = [...new Set(hashtags.map(tag => tag.replace('#', '')))]

    res.json({
      description: description_text,
      hashtags: uniqueHashtags.join(' '),
      lifestyle,
      imageObjects // [{url, description}] – Frontend ersetzt [BILD_N] mit den URLs
    })
  } catch (error) {
    console.error('[KI] Fehler bei Platz-Generierung:', error.response?.data || error.message)
    res.status(500).json({ error: 'Fehler bei Generierung. Versuche es erneut.' })
  }
})
export default router
