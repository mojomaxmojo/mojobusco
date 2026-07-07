import express from 'express'
import multer from 'multer'
import axios from 'axios'
import {
  getLifestyleConfig,
  generateMediaPrompt,
  generateTripPrompt,
  generateTripCaptionPrompt,
  generateArticlePrompt,
  generateArticleSummaryPrompt,
  generateArticleTitlesPrompt,
  generateNotePrompt,
  generatePlacePrompt,
  getMediaImageAnalysisPrompt,
  getMediaVideoAnalysisPrompt,
  getTripImageAnalysisPrompt,
  getArticleImageAnalysisPrompt,
  getNoteImageAnalysisPrompt,
  getPlaceImageAnalysisPrompt
} from '../../src/config/prompts/index.js'
import { handleMulterError, sanitizeInput, validateApiKey, safelyParseJSON } from '../utils/http-helpers.js'
import { generateWithModel } from '../services/ai-content.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 30,
    fieldSize: 1 * 1024 * 1024
  }
})

const router = express.Router()

// ===== API FÜR MEDIEN ARTIKEL GENERIERUNG =====
// Generiert authentische Artikel im Foster Huntington Stil
// Verwendet in: Medien-Tab der Publish-Seite
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
  const model = req.body.model || 'llama4' // Modell-Auswahl
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

        const visionResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: getMediaImageAnalysisPrompt(lifestyleConfig) },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
            ]
          }],
          max_tokens: 150,
          temperature: 0.7
        }, {
          headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
          timeout: 30000
        })
        return visionResponse.data.choices[0].message.content
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
      tripType
    })

    // Artikel generieren – MEDIEN: max 150 Tokens (35-50 Wörter + Hashtags)
    const article = await generateWithModel(prompt, model, lifestyle, {
      maxTokens: 150,
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

// ===== API FÜR TRIP GENERIERUNG =====
// Tab: "Trips" in /veroeffentlichen
// Input: images (alle Station-Bilder), title, description, locations, stationDescriptions, tripType, country, tripLength, model, lifestyle, gender
// Output: { article (Zusammenfassung), captions (Bild-Texte pro Station) }
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
        const r = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
            ]
          }],
          max_tokens: 120,
          temperature: 0.7
        }, {
          headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
          timeout: 30000
        })
        return r.data.choices[0].message.content
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

// ===== API FÜR BERICHT/ARTIKEL GENERIERUNG =====
// Tab: "Berichte" in /veroeffentlichen
router.post('/api/generate-article', (req, res, next) => {
  upload.array('images', 10)(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next)
    next()
  })
}, async (req, res) => {
  if (!validateApiKey()) {
    return res.status(500).json({ error: 'Server-Konfigurationsfehler' })
  }

  const title = sanitizeInput(req.body.title) || 'Mein Bericht'
  const description = sanitizeInput(req.body.description) || ''
  const location = sanitizeInput(req.body.location) || 'Unbekannt'
  // text NICHT durch sanitizeInput kürzen – der User-Text kann länger als 500 Zeichen sein
  const text = (req.body.text || '').trim()
  const model = req.body.model || 'llama4'
  const lifestyle = sanitizeInput(req.body.lifestyle) || 'mojobus'
  const gender = sanitizeInput(req.body.gender) || 'couple' // Gender: neutral/male/female/couple
  const images = req.files

  // Zusätzliche Kontext-Felder
  const category = sanitizeInput(req.body.category) || ''
  const tags = safelyParseJSON(req.body.tags) || []
  const country = sanitizeInput(req.body.country) || ''
  const articleLength = sanitizeInput(req.body.articleLength) || 'medium'
  const tripType = sanitizeInput(req.body.tripType) || ''
  // Bild-URLs aus dem MilkdownEditor-Markdown (bereits hochgeladen, öffentlich erreichbar)
  const markdownImageUrls = safelyParseJSON(req.body.markdownImageUrls) || []

  // Mindestens Titelbild ODER Markdown-Bilder erforderlich
  if ((!images || images.length === 0) && markdownImageUrls.length === 0) {
    return res.status(400).json({ error: 'Mindestens ein Bild erforderlich' })
  }

  console.log(`[KI] Generiere Bericht: "${title}", Titel-Bilder: ${images?.length || 0}, Markdown-Bilder: ${markdownImageUrls.length}, Modell: ${model}, Lifestyle: ${lifestyle}, Länge: ${articleLength}`)
  console.log(`[KI] Text-Länge: ${text.length} Zeichen`)
  if (category) console.log(`[KI] Kategorie: ${category}`)
  if (tags.length > 0) console.log(`[KI] Tags: ${tags.join(', ')}`)

  // Hilfsfunktion: Bild-URL downloaden → Base64
  const fetchImageAsBase64 = async (url) => {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 10 * 1024 * 1024 // max 10MB
    })
    return Buffer.from(response.data).toString('base64')
  }

  // Hilfsfunktion: einzelnes Bild analysieren (Base64 → Beschreibung)
  const analyzeImageBase64 = async (base64, mimeType = 'image/jpeg') => {
    const lifestyleConfig = getLifestyleConfig(lifestyle)
    const visionResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: getArticleImageAnalysisPrompt(lifestyleConfig, articleLength) },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
        ]
      }],
      max_tokens: 150,
      temperature: 0.7
    }, {
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      timeout: 30000
    })
    return visionResponse.data.choices[0].message.content
  }

  try {
    const lifestyleConfig = getLifestyleConfig(lifestyle)

    // ===== TITELBILD(ER) analysieren (hochgeladene Files) =====
    const uploadedImageDescriptions = images && images.length > 0
      ? await Promise.all(images.map(async (img) => {
          const base64 = img.buffer.toString('base64')
          const mimeType = img.mimetype || 'image/jpeg'
          console.log(`[KI] Analysiere Titelbild, Größe: ${(img.size / 1024).toFixed(1)}KB`)
          return analyzeImageBase64(base64, mimeType)
        }))
      : []

    // ===== MARKDOWN-BILDER analysieren (URLs von Blossom) =====
    // Max 5 Bilder aus dem Editor analysieren – mehr bringt wenig, kostet aber Zeit
    const markdownUrlsToAnalyze = markdownImageUrls.slice(0, 5)
    const markdownImageDescriptions = markdownUrlsToAnalyze.length > 0
      ? await Promise.allSettled(markdownUrlsToAnalyze.map(async (url, index) => {
          console.log(`[KI] Lade Markdown-Bild ${index + 1}/${markdownUrlsToAnalyze.length}: ${url.substring(0, 60)}...`)
          const base64 = await fetchImageAsBase64(url)
          // MIME-Type aus URL ableiten
          const mimeType = url.match(/\.(png)$/i) ? 'image/png'
            : url.match(/\.(webp)$/i) ? 'image/webp'
            : url.match(/\.(gif)$/i) ? 'image/gif'
            : 'image/jpeg'
          return analyzeImageBase64(base64, mimeType)
        }))
        .then(results => results
          .filter(r => r.status === 'fulfilled')
          .map(r => r.value)
        )
      : []

    if (markdownImageDescriptions.length > 0) {
      console.log(`[KI] ${markdownImageDescriptions.length} Markdown-Bilder analysiert`)
    }

    // Alle Bilder als Objekte {url, description} zusammenführen:
    // Titelbild(er) haben keine öffentliche URL (Buffer-Upload) → url: null
    // Markdown-Bilder haben eine öffentliche Blossom-URL → url: string
    const imageObjects = [
      ...uploadedImageDescriptions.map(desc => ({ url: null, description: desc })),
      ...markdownUrlsToAnalyze.map((url, i) => ({
        url,
        description: markdownImageDescriptions[i] || ''
      })).filter(obj => obj.description)
    ]
    console.log(`[KI] Gesamt ${imageObjects.length} Bilder für Prompt (${uploadedImageDescriptions.length} Titel, ${markdownImageDescriptions.length} Markdown)`)

    // Foster Huntington Prompt für Berichte - importiert aus src/config/prompts/articles.js
    const prompt = generateArticlePrompt({
      title,
      description,
      location,
      text,
      imageObjects,  // neu: [{url, description}] statt imageDescriptions[]
      lifestyleConfig,
      category,
      tags,
      country,
      articleLength,
      gender,
      tripType
    })

    // Berichte: maxTokens abhängig von articleLength
    const articleMaxTokens = articleLength === 'short' ? 500 : articleLength === 'medium' ? 1200 : 2500

    // Schritt 1: Artikel generieren
    console.log(`[KI] Generiere Artikel (${articleLength}, max ${articleMaxTokens} Tokens)...`)
    const article = await generateWithModel(prompt, model, lifestyle, {
      maxTokens: articleMaxTokens,
      temperature: 0.8
    })
    console.log(`[KI] Artikel fertig: ${article.length} Zeichen`)

    // Schritt 2: Summary + 3 Titel-Vorschläge parallel aus dem fertigen Artikel generieren
    const summaryPromptText = generateArticleSummaryPrompt({
      articleText: article,
      title,
      lifestyleConfig,
      gender
    })
    const titlesPromptText = generateArticleTitlesPrompt({
      articleText: article,
      currentTitle: title,
      lifestyleConfig,
      gender
    })

    console.log(`[KI] Generiere Summary + Titel-Vorschläge parallel...`)
    const [summaryRaw, titlesRaw] = await Promise.all([
      generateWithModel(summaryPromptText, model, lifestyle, {
        maxTokens: 80,
        temperature: 0.7
      }),
      generateWithModel(titlesPromptText, model, lifestyle, {
        maxTokens: 80,
        temperature: 0.9  // etwas mehr Variation für Titel
      })
    ])

    // Titel parsen: eine Zeile = ein Titel, max 3
    const titleSuggestions = titlesRaw
      .split('\n')
      .map(l => l.trim().replace(/^[-–•*\d.]+\s*/, '').replace(/^["']|["']$/g, ''))
      .filter(l => l.length > 2 && l.length < 80)
      .slice(0, 3)

    const summary = summaryRaw.trim().replace(/^["']|["']$/g, '')

    console.log(`[KI] Summary: "${summary.substring(0, 60)}..."`)
    console.log(`[KI] Titel-Vorschläge: ${JSON.stringify(titleSuggestions)}`)

    const hashtags = article.match(/#\w+/g) || []
    const uniqueHashtags = [...new Set(hashtags.map(tag => tag.replace('#', '')))]

    res.json({
      article,
      summary,             // Kurzfassung (1-2 Sätze) → geht ins Summary-Feld
      titleSuggestions,    // 3 Titel-Vorschläge → klickbar im Frontend
      hashtags: uniqueHashtags.join(' '),
      lifestyle,
      articleLength,
      imageObjects
    })
  } catch (error) {
    console.error('[KI] Fehler bei Bericht-Generierung:', error.response?.data || error.message)
    res.status(500).json({ error: 'Fehler bei Generierung. Versuche es erneut.' })
  }
})

// ===== API FÜR PLATZ GENERIERUNG =====
// Tab: "Plätze" in /veroeffentlichen
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

  // Hilfsfunktion: Base64 → Bildbeschreibung
  const analyzeImageBase64 = async (base64, mimeType = 'image/jpeg') => {
    const lifestyleConfig = getLifestyleConfig(lifestyle)
    const visionResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: getPlaceImageAnalysisPrompt(lifestyleConfig) },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
        ]
      }],
      max_tokens: 150,
      temperature: 0.7
    }, {
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      timeout: 30000
    })
    return visionResponse.data.choices[0].message.content
  }

  try {
    const lifestyleConfig = getLifestyleConfig(lifestyle)

    // ===== TITELBILD(ER) analysieren =====
    const uploadedImageDescriptions = hasUploadedImages
      ? await Promise.all(images.map(async (img) => {
          const base64 = img.buffer.toString('base64')
          const mimeType = img.mimetype || 'image/jpeg'
          console.log(`[KI] Analysiere Titelbild, Größe: ${(img.size / 1024).toFixed(1)}KB`)
          return analyzeImageBase64(base64, mimeType)
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
          return analyzeImageBase64(base64, mimeType)
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
          return analyzeImageBase64(base64, mimeType)
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

// ===== API FÜR NOTE GENERIERUNG =====
// Tab: "Note" in /veroeffentlichen
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
      const visionResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: getNoteImageAnalysisPrompt(lifestyleConfig) },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
          ]
        }],
        max_tokens: 100,
        temperature: 0.7
      }, {
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        timeout: 30000
      })
      return visionResponse.data.choices[0].message.content
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