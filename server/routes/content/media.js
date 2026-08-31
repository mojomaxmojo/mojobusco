import express from 'express'
import multer from 'multer'
import axios from 'axios'
import {
  getLifestyleConfig,
  generateMediaPrompt,
  getMediaImageAnalysisPrompt,
  getMediaVideoAnalysisPrompt,
} from '../../../src/config/prompts/index.js'
import { handleMulterError, sanitizeInput, validateApiKey, safelyParseJSON } from '../../utils/http-helpers.js'
import { generateWithModel } from '../../services/ai-content.js'
import { analyzeImageBase64 } from './vision.js'
import { getGenerationContext } from '../../services/generation-context.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 30,
    fieldSize: 1 * 1024 * 1024
  }
})

const router = express.Router()

router.post('/api/generate-media-article', (req, res, next) => {
  upload.array('images', 10)(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next)
    next()
  })
}, async (req, res) => {
  if (!validateApiKey()) {
    return res.status(500).json({ error: 'Server-Konfigurationsfehler' })
  }

  const title = sanitizeInput(req.body.title) || 'Mein Abenteuer'
  const description = sanitizeInput(req.body.description) || ''
  const text = sanitizeInput(req.body.text) || 'Abenteuer Reise Freiheit'
  const location = sanitizeInput(req.body.location) || 'Unbekannt'
  const model = req.body.model || 'medium' // Modell-Auswahl: mini/medium/maxi
  const lifestyle = sanitizeInput(req.body.lifestyle) || 'mojobus' // Lifestyle-Typ
  const gender = sanitizeInput(req.body.gender) || 'couple' // Gender: neutral/male/female/couple
  const images = req.files

  // Zusätzliche Kontext-Felder für bessere KI-Generierung
  const mainCategory = sanitizeInput(req.body.mainCategory) || ''
  const subCategories = safelyParseJSON(req.body.subCategories) || []
  const detailedTags = safelyParseJSON(req.body.detailedTags) || []
  const additionalImageUrls = sanitizeInput(req.body.additionalImageUrls) || ''
  const manualTags = safelyParseJSON(req.body.manualTags) || []
  const country = sanitizeInput(req.body.country) || ''
  const tripType = sanitizeInput(req.body.tripType) || ''

  if (!images || images.length === 0) {
    return res.status(400).json({ error: 'Mindestens ein Bild erforderlich' })
  }

  console.log(`[KI] Generiere Media-Artikel: "${title}", Bilder: ${images.length}, Standort: ${location}, Modell: ${model}, Lifestyle: ${lifestyle}`)
  console.log(`[KI] Kontext: Kategorie=${mainCategory}, SubTags=${subCategories.length}, DetailTags=${detailedTags.length}, ManualTags=${manualTags.length}`)
  if (tripType) console.log(`[KI] Trip-Typ: ${tripType}`)

    try {
      // ===== BILD UND VIDEO ANALYSE FÜR MEDIEN ARTIKEL =====
      // Prompt: siehe src/config/prompts/media.ts
      const lifestyleConfig = getLifestyleConfig(lifestyle)
      
      // Trenne Bilder und Videos
      const imageFiles = images.filter(img => img.mimetype.startsWith('image/'))
      const videoFiles = images.filter(img => img.mimetype.startsWith('video/'))
      
      console.log(`[KI] Medien-Analyse: ${imageFiles.length} Bilder, ${videoFiles.length} Videos`)
      
      // ===== BILD ANALYSE =====
      const imageDescriptions = await Promise.all(imageFiles.map(async (img) => {
        const base64 = img.buffer.toString('base64')
        console.log(`[KI] Analysiere Bild, Größe: ${(img.size / 1024).toFixed(1)}KB`)
        const prompt = getMediaImageAnalysisPrompt(lifestyleConfig)
        return analyzeImageBase64(base64, 'image/jpeg', prompt, 150)
      }))
      
      // ===== VIDEO ANALYSE FÜR MEDIEN ARTIKEL =====
      // Verwendet OpenRouter API mit Google Gemini 2.5 Flash (kostengünstig)
      const videoDescriptions = await Promise.all(videoFiles.map(async (video) => {
        const base64 = video.buffer.toString('base64')
        console.log(`[KI] Analysiere Video, Größe: ${(video.size / 1024 / 1024).toFixed(2)}MB, Typ: ${video.mimetype}`)
        
        // OpenRouter API für Video-Analyse
        const videoResponse = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: 'google/gemini-2.5-flash',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: getMediaVideoAnalysisPrompt(lifestyleConfig) },
              { 
                type: 'video_url', 
                video_url: { 
                  url: `data:${video.mimetype};base64,${base64}` 
                } 
              }
            ]
          }],
          max_tokens: 300,
          temperature: 0.7
        }, {
          headers: { 
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000 // Videos brauchen mehr Zeit
        })
        return videoResponse.data.choices[0].message.content
      }))
      
      // Kombiniere Bild- und Video-Beschreibungen
      const allDescriptions = [...imageDescriptions, ...videoDescriptions]

    console.log(`[KI] ${allDescriptions.length} Medien analysiert (${imageDescriptions.length} Bilder, ${videoDescriptions.length} Videos)`)

    // Wetter-Kontext: Datum (Fallback heute)
    const weatherDate = typeof req.body.publishedAt === 'string' && req.body.publishedAt.trim()
      ? req.body.publishedAt.trim()
      : new Date().toISOString().slice(0, 10)
    const continuity = await getGenerationContext({ location, country, date: weatherDate })

    // ===== FOSTER HUNTINGTON STIL PROMPT =====
    // Generiert mit: generateMediaPrompt() - importiert aus src/config/prompts/media.js
    const prompt = generateMediaPrompt({
      title,
      description,
      location,
      text,
      imageDescriptions: allDescriptions,
      lifestyleConfig,
      mainCategory,
      subCategories,
      detailedTags,
      additionalImageUrls,
      manualTags,
      country,
      gender,
      tripType,
      continuity
    })

    const article = await generateWithModel(prompt, model, lifestyle, {
      useCase: 'media',
      temperature: 0.7
    })

    // Hashtags extrahieren (verbessert)
    const hashtags = article.match(/#\w+/g) || []
    const uniqueHashtags = [...new Set(hashtags.map(tag => tag.replace('#', '')))]

    console.log(`[KI] Media-Post generiert: ${article.length} Zeichen, Hashtags: ${uniqueHashtags.length}`)

    res.json({
      article,
      hashtags: uniqueHashtags.join(' '),
      model,
      lifestyle,
      imageDescriptions: allDescriptions, // Bild- und Video-Beschreibungen kombiniert
      videoDescriptions: videoDescriptions.length > 0 ? videoDescriptions : undefined // Separat für Frontend-Debugging
    })
  } catch (error) {
    console.error('[KI] Fehler bei Media-Artikel-Generierung:', error.response?.data || error.message)

    if (error.response?.status === 429) {
      res.status(429).json({ error: 'API-Limit erreicht. Bitte warte einen Moment.' })
    } else if (error.response?.status === 400) {
      res.status(400).json({ error: 'Ungültige Anfrage. Prüfe deine Eingaben.' })
    } else if (error.code === 'ECONNABORTED') {
      res.status(408).json({ error: 'Zeitüberschreitung. Versuche es erneut.' })
    } else {
      res.status(500).json({ error: 'Fehler bei Generierung. Versuche es erneut.' })
    }
  }
})
export default router
