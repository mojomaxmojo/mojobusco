import express from 'express'
import multer from 'multer'
import axios from 'axios'
import {
  getLifestyleConfig,
  generateTripPrompt,
  generateTripCaptionPrompt,
  getTripImageAnalysisPrompt,
} from '../../../src/config/prompts/index.js'
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

router.post('/api/generate-trip', (req, res, next) => {
  upload.array('images', 30)(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next)
    next()
  })
}, async (req, res) => {
  if (!validateApiKey()) {
    return res.status(500).json({ error: 'Server-Konfigurationsfehler' })
  }

  const title = sanitizeInput(req.body.title) || 'Meine Reise'
  const description = (req.body.description || '').trim()
  const model = req.body.model || 'llama4'
  const lifestyle = sanitizeInput(req.body.lifestyle) || 'mojobus'
  const gender = sanitizeInput(req.body.gender) || 'couple'
  const tripType = sanitizeInput(req.body.tripType) || ''
  const country = sanitizeInput(req.body.country) || ''
  const tripLength = sanitizeInput(req.body.tripLength) || 'medium'
  const startDate = sanitizeInput(req.body.startDate) || ''
  const endDate = sanitizeInput(req.body.endDate) || ''
  const locations = safelyParseJSON(req.body.locations) || []
  const stationDescriptions = safelyParseJSON(req.body.stationDescriptions) || []
  const images = req.files || []

  console.log(`[KI] Generiere Trip: "${title}", Bilder: ${images.length}, Stationen: ${stationDescriptions.length}, Modell: ${model}, Lifestyle: ${lifestyle}, Länge: ${tripLength}`)
  if (tripType) console.log(`[KI] Trip-Typ: ${tripType}`)
  if (country) console.log(`[KI] Land: ${country}`)

  try {
    const lifestyleConfig = getLifestyleConfig(lifestyle)

    // ===== BILDER ANALYSIEREN – Google Gemini 2.5 Flash via OpenRouter =====
    // Batching in 4er-Gruppen um Rate-Limits zu umgehen, bis zu 20 Bilder
    // Fallback auf Groq wenn OPENROUTER_API_KEY fehlt
    const MAX_IMAGES_TO_ANALYZE = 20
    const MAX_IMAGE_BYTES = 2 * 1024 * 1024  // 2MB max pro Bild (schneller, weniger RAM)
    const BATCH_SIZE = 4  // 4 Bilder pro Batch paralell
    const imagesToAnalyze = images.slice(0, MAX_IMAGES_TO_ANALYZE)
    const useGemini = !!process.env.OPENROUTER_API_KEY
    console.log(`[KI] Analysiere ${imagesToAnalyze.length} von ${images.length} Bildern via ${useGemini ? 'Gemini 2.5 Flash (OpenRouter)' : 'Groq Llama-4 (Fallback)'} – Batching (4er-Gruppen)`)

    // Einzelnes Bild analysieren: Gemini preferred, Groq als Fallback
    const analyzeOneBild = async (img, index) => {
      if (img.buffer.length > MAX_IMAGE_BYTES) {
        console.warn(`[KI] Bild ${index + 1} zu groß (${(img.buffer.length/1024/1024).toFixed(1)}MB > 2MB), überspringe`)
        return '(Bild übersprungen – zu groß)'
      }
      const base64   = img.buffer.toString('base64')
      const mimeType = img.mimetype || 'image/jpeg'
      const sizeKB   = (img.size / 1024).toFixed(0)
      const prompt   = getTripImageAnalysisPrompt(lifestyleConfig, tripLength, tripType)

      // ── Gemini 2.5 Flash via OpenRouter ─────────────────────────────────
      if (useGemini) {
        try {
          console.log(`[KI] Gemini Bild ${index + 1}/${imagesToAnalyze.length}: ${sizeKB}KB`)
          const r = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
              ]
            }],
            max_tokens: 150,
            temperature: 0.7
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 60000
          })
          return r.data.choices[0].message.content
        } catch (geminiErr) {
          const status = geminiErr.response?.status
          const msg    = geminiErr.response?.data?.error?.message || geminiErr.message
          console.warn(`[KI] Gemini Bild ${index + 1} fehlgeschlagen (HTTP ${status}): ${msg} – versuche Groq Fallback`)
          // Weiter zum Groq-Fallback
        }
      }

      // ── Groq Llama-4-Scout Fallback ─────────────────────────────────────
      try {
        console.log(`[KI] Groq Fallback Bild ${index + 1}/${imagesToAnalyze.length}: ${sizeKB}KB`)
        return await analyzeImageBase64(base64, 'image/jpeg', prompt, 120)
      } catch (groqErr) {
        const status = groqErr.response?.status
        const msg    = groqErr.response?.data?.error?.message || groqErr.message
        console.warn(`[KI] Groq Bild ${index + 1} fehlgeschlagen (HTTP ${status}): ${msg}`)
        if (status === 429) return '(Rate-Limit – bitte erneut versuchen)'
        return '(Bild nicht analysierbar)'
      }
    }

    // ── Batching: 4 Bilder parallel, dann nächste Gruppe ──
    let imageDescriptions = []
    for (let batchStart = 0; batchStart < imagesToAnalyze.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, imagesToAnalyze.length)
      const batch = imagesToAnalyze.slice(batchStart, batchEnd)
      console.log(`[KI] Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: Bilder ${batchStart + 1}-${batchEnd} (${batchEnd - batchStart} Bilder)`)

      const batchResults = await Promise.allSettled(
        batch.map((img, i) => analyzeOneBild(img, batchStart + i))
      )
      const batchDescriptions = batchResults.map(r => r.status === 'fulfilled' ? r.value : '(Fehler)')
      imageDescriptions.push(...batchDescriptions)

      // Pause zwischen Batches um Rate-Limits zu beachten
      if (batchEnd < imagesToAnalyze.length) {
        console.log(`[KI] Pause zwischen Batches...`)
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    console.log(`[KI] ${imageDescriptions.length} Bilder analysiert (${useGemini ? 'Gemini' : 'Groq'})`)

    // ===== TRIP-ZUSAMMENFASSUNG GENERIEREN =====
    const tripPrompt = generateTripPrompt({
      title,
      description,
      locations,
      text: description,
      imageDescriptions,
      lifestyleConfig,
      country,
      stations: locations,
      stationDescriptions,
      tripType,
      tripLength,
      gender
    })

    const tripMaxTokens = tripLength === 'short' ? 500 : tripLength === 'medium' ? 1400 : 2800

    console.log(`[KI] Generiere Trip-Text (${tripLength}, max ${tripMaxTokens} Tokens)...`)
    const article = await generateWithModel(tripPrompt, model, lifestyle, {
      maxTokens: tripMaxTokens,
      temperature: 0.85
    })
    console.log(`[KI] Trip-Text fertig: ${article.length} Zeichen`)

    // ===== BILD-CAPTIONS FÜR STATIONEN GENERIEREN =====
    // Jede Station bekommt einen kurzen Foster-Bildtext (20-100 Wörter)
    // Nur wenn Stationen vorhanden
    let captions = []
    if (imagesToAnalyze.length > 0) {
      console.log(`[KI] Generiere ${imagesToAnalyze.length} Bild-Captions...`)

      // Captions sequentiell generieren (nicht parallel - Groq Rate-Limits)
      // Kurze Pause zwischen den Anfragen um Rate-Limit zu vermeiden
      for (let i = 0; i < imagesToAnalyze.length; i++) {
        const station = stationDescriptions[i] || {}
        const stationLocation = station.location || locations[i] || `Station ${i + 1}`
        const userDescription = station.description || ''

        const captionPrompt = generateTripCaptionPrompt({
          imageDescription: imageDescriptions[i] || '',
          stationTitle: stationLocation,
          stationLocation,
          userDescription,
          tripTitle: title,
          lifestyleConfig,
          gender,
          stationIndex: i,
          totalStations: imagesToAnalyze.length
        })

        try {
          const caption = await generateWithModel(captionPrompt, model, lifestyle, {
            maxTokens: 120,
            temperature: 0.8
          })
          captions.push(caption.trim())
          console.log(`[KI] Caption ${i + 1}/${imagesToAnalyze.length} fertig`)
          // Kleine Pause zwischen Caption-Anfragen (Groq Rate-Limit)
          if (i < imagesToAnalyze.length - 1) {
            await new Promise(r => setTimeout(r, 300))
          }
        } catch (captionErr) {
          const capStatus = captionErr.response?.status
          console.warn(`[KI] Caption ${i + 1} fehlgeschlagen (HTTP ${capStatus}):`, captionErr.response?.data?.error?.message || captionErr.message)
          captions.push('') // Leerer String als Fallback
          // Bei Rate-Limit: länger warten
          if (capStatus === 429) {
            console.log('[KI] Caption Rate-Limit, warte 5s...')
            await new Promise(r => setTimeout(r, 5000))
          }
        }
      }

      // Für Bilder die nicht analysiert wurden (>MAX): leere Captions
      for (let i = imagesToAnalyze.length; i < images.length; i++) {
        captions.push('')
      }
    }

    console.log(`[KI] Trip fertig: ${article.length} Zeichen, ${captions.length} Captions`)

    res.json({
      article,
      captions,
      imageCount: images.length,
      analyzedCount: imagesToAnalyze.length,
      tripLength,
      lifestyle
    })

  } catch (error) {
    // Detailliertes Logging für Debugging
    const errData = error.response?.data
    const httpStatus = error.response?.status
    const errMsg = error.message || 'Unbekannter Fehler'
    console.error(`[KI] Fehler bei Trip-Generierung (HTTP ${httpStatus || 'no-response'}):`, errData || errMsg)
    if (errData) console.error('[KI] API-Antwort:', JSON.stringify(errData).slice(0, 500))

    // Sprechende Fehlermeldung ans Frontend
    let userError = 'Fehler bei Trip-Generierung. Bitte versuche es erneut.'
    if (httpStatus === 429 || errData?.error?.type === 'rate_limit_exceeded') {
      userError = 'Groq API-Limit erreicht. Bitte 30 Sekunden warten und erneut versuchen.'
    } else if (httpStatus === 413 || errMsg.includes('too large') || errMsg.includes('image_too_large')) {
      userError = 'Ein oder mehrere Bilder sind zu groß für die KI-Analyse. Bitte kleinere Bilder verwenden (max. 4MB pro Bild für Groq).'
    } else if (error.code === 'ECONNABORTED' || errMsg.includes('timeout')) {
      userError = 'Zeitüberschreitung bei der KI-Analyse. Versuche es mit weniger Bildern (max. 6).'
    } else if (errData?.error?.message) {
      userError = `KI-Fehler: ${errData.error.message}`
    } else if (errMsg && errMsg !== 'Unbekannter Fehler') {
      userError = `Fehler: ${errMsg}`
    }

    res.status(httpStatus || 500).json({ error: userError })
  }
})
export default router
