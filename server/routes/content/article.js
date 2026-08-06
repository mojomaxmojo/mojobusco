import express from 'express'
import multer from 'multer'
import axios from 'axios'
import {
  getLifestyleConfig,
  generateArticlePrompt,
  generateArticleSummaryPrompt,
  generateArticleTitlesPrompt,
  getArticleImageAnalysisPrompt,
  computePlacementZones,
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
  const model = req.body.model || 'medium'
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
  // Bild-Metadaten pro Markdown-Bild ({alt, caption, note}), parallel zu markdownImageUrls
  const markdownImageMeta = safelyParseJSON(req.body.markdownImageMeta) || []

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


  try {
    const lifestyleConfig = getLifestyleConfig(lifestyle)

    // ===== TITELBILD(ER) analysieren (hochgeladene Files) =====
    const uploadedImageDescriptions = images && images.length > 0
      ? await Promise.all(images.map(async (img) => {
          const base64 = img.buffer.toString('base64')
          const mimeType = img.mimetype || 'image/jpeg'
          console.log(`[KI] Analysiere Titelbild, Größe: ${(img.size / 1024).toFixed(1)}KB`)
          const prompt = getArticleImageAnalysisPrompt(lifestyleConfig, articleLength)
          return analyzeImageBase64(base64, mimeType, prompt, 150)
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
          const prompt = getArticleImageAnalysisPrompt(lifestyleConfig, articleLength)
          return analyzeImageBase64(base64, mimeType, prompt, 150)
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
        description: markdownImageDescriptions[i] || '',
        alt: markdownImageMeta[i]?.alt,
        caption: markdownImageMeta[i]?.caption,
        note: markdownImageMeta[i]?.note
      })).filter(obj => obj.description)
    ]
    console.log(`[KI] Gesamt ${imageObjects.length} Bilder für Prompt (${uploadedImageDescriptions.length} Titel, ${markdownImageDescriptions.length} Markdown)`)

    // Berichte: maxTokens abhängig von articleLength
    const articleMaxTokens = articleLength === 'short' ? 500 : articleLength === 'medium' ? 1200 : 2500

    // Wortzahl-Schätzung aus articleMaxTokens (≈ 0.75 Wörter pro Token) für die gleichmäßige Bildverteilung
    const totalWords = Math.round(articleMaxTokens * 0.75)
    const placementZones = computePlacementZones(totalWords, imageObjects.length)

    // Foster Huntington Prompt für Berichte - importiert aus src/config/prompts/articles.js
    const prompt = generateArticlePrompt({
      title,
      description,
      location,
      text,
      imageObjects,  // neu: [{url, description}] statt imageDescriptions[]
      placementZones,
      lifestyleConfig,
      category,
      tags,
      country,
      articleLength,
      gender,
      tripType
    })

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
export default router
