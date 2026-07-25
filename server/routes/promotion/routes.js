import express from 'express'
import fs from 'fs'
import {
  PINS_FILE,
  STARTDATUM,
  getTagnummer,
  buildStoryTag,
  TEMPLATES,
  LIFESTYLE_PINTEREST_CONFIG,
} from './config.js'
import {
  sanitizeInput,
  validateApiKey,
  analyzeImageWithVision,
  parsePinJson,
} from './utils.js'
import { generateWithKi } from './ai.js'
import { getLifestyleConfig } from '../../src/config/prompts/index.js'

const router = express.Router()

router.post('/api/promotion/generate-pin-text', async (req, res) => {
  if (!validateApiKey()) {
    return res.status(500).json({ error: 'Server-Konfigurationsfehler: API-Key fehlt' })
  }

  const title = sanitizeInput(req.body.title) || ''
  const summary = sanitizeInput(req.body.summary) || ''
  const text = (req.body.text || '').trim()
  const template = sanitizeInput(req.body.template) || 'infographic'
  const model = sanitizeInput(req.body.model) || 'llama4'
  const lifestyle = sanitizeInput(req.body.lifestyle) || 'perpetual-travelers'
  const imageUrl = (req.body.imageUrl || '').trim()
  // Für storyTag-Berechnung: Unix-Timestamp (Sekunden) des Artikels + Ort
  const articleCreatedAt = req.body.createdAt ? Number(req.body.createdAt) : null
  const articleCountry = sanitizeInput(req.body.country) || ''

  const templateConfig = TEMPLATES[template]
  if (!templateConfig) {
    return res.status(400).json({ error: `Unbekanntes Template: ${template}` })
  }

  // storyTag serverseitig berechnen (nur für mojobus-story relevant)
  const storyTagBerechnet = buildStoryTag(
    articleCountry || null,
    articleCreatedAt ? articleCreatedAt : new Date()
  )

  console.log(`[Promotion] Generiere Pin-Text: Template=${template}, Modell=${model}, Lifestyle=${lifestyle}, Titel="${title}", Bild=${imageUrl ? '✓' : '–'}, storyTag="${storyTagBerechnet}"`)

  // ── BILDANALYSE (optional, nicht blockierend) ─────────────────────────────
  let imageDescription = null
  if (imageUrl && imageUrl.startsWith('http')) {
    console.log(`[Promotion] Starte Bildanalyse für: ${imageUrl.substring(0, 80)}...`)
    imageDescription = await analyzeImageWithVision(imageUrl)
  }

  // Lifestyle-Kontext für den System-Prompt
  const lc = LIFESTYLE_PINTEREST_CONFIG[lifestyle] || LIFESTYLE_PINTEREST_CONFIG.mojobus

  const systemPrompt = `Du bist ein Pinterest-SEO-Experte für den Blog "${lc.brand}" (${lc.brandUrl}).

BRAND & LIFESTYLE:
- Brand: ${lc.brand} – ${lc.tagline}
- Zielgruppe: ${lc.audience}
- Ton: ${lc.tone}
- Fahrzeug/Kontext: ${lc.vehicle}
- Standard-Hashtags für diesen Brand: ${lc.keywords.join(', ')}
- Pin-Stil: ${lc.pinStyle}

WICHTIGE REGELN:
- VERMEIDE: ${lc.avoid}
- Verwende immer mindestens 2 Brand-spezifische Hashtags aus: ${lc.keywords.join(', ')}
- Der PIN-TITEL muss sofort klar machen worum es geht – Keyword zuerst
- Die PIN-BESCHREIBUNG soll neugierig machen und zum Klicken animieren
- Keine generischen Floskeln wie "Schau rein", "Lies mehr", "Entdecke jetzt"
- Echter Mehrwert: Was bekommt der Leser wenn er klickt?
- Zahlen und konkrete Fakten performen besser als vage Aussagen
${imageDescription ? `
BILD-KONTEXT (für altText und textOverlay bevorzugt nutzen):
Das Pin-Bild zeigt: "${imageDescription}"
→ altText: Beschreibe was auf dem Bild zu sehen ist (nicht den Artikel)
→ textOverlay: Passe den Eyecatcher an das Bildmotiv an, wenn es passt` : ''}

AUSGABE: Antworte IMMER NUR mit validem JSON. Keine Markdown-Code-Blöcke. Keine Erklärungen außerhalb des JSON.`

  const prompt = templateConfig.prompt({ title, summary, text, lifestyle: lc })

  try {
    const result = await generateWithKi(prompt, systemPrompt, model, 600, 0.8)
    const pinData = parsePinJson(result)

    if (!pinData) {
      console.error('[Promotion] KI hat kein valides JSON zurückgegeben:', result.substring(0, 200))
      return res.status(502).json({
        error: 'KI gab kein gültiges JSON zurück',
        rawText: result.substring(0, 500)
      })
    }

    console.log('[Promotion] Pin-Text erfolgreich generiert:', JSON.stringify(pinData).substring(0, 100))

    // storyTag immer serverseitig setzen (überschreibt KI-Wert falls vorhanden)
    if (template === 'mojobus-story') {
      pinData.storyTag = storyTagBerechnet
      console.log(`[Promotion] storyTag gesetzt: "${storyTagBerechnet}"`)
    }

    res.json({
      success: true,
      imageAnalyzed: !!imageDescription,
      imageDescription: imageDescription || null,
      storyTag: storyTagBerechnet,
      pinData: {
        template,
        model: model === 'claude' ? 'claude-sonnet (OpenRouter)' : 'llama-4-scout',
        ...pinData
      }
    })
  } catch (error) {
    console.error('[Promotion] Fehler bei Pin-Text Generierung:', error.response?.data || error.message)

    if (error.response?.status === 429) {
      res.status(429).json({ error: 'API-Limit erreicht. Bitte warte einen Moment.' })
    } else if (error.response?.status === 400) {
      res.status(400).json({ error: 'Ungültige Anfrage. Prüfe deine Eingaben.' })
    } else if (error.code === 'ECONNABORTED') {
      res.status(408).json({ error: 'Zeitüberschreitung. Versuche es erneut.' })
    } else {
      res.status(500).json({ error: 'Fehler bei Pin-Text Generierung. Versuche es erneut.' })
    }
  }
})

/**
 * GET /api/promotion/pins
 * Liest alle gespeicherten Pins
 */
router.get('/api/promotion/pins', (req, res) => {
  try {
    if (!fs.existsSync(PINS_FILE)) {
      return res.json({ success: true, pins: [] })
    }
    const data = fs.readFileSync(PINS_FILE, 'utf-8')
    const pins = JSON.parse(data)
    res.json({ success: true, pins: pins.reverse() }) // Neueste zuerst
  } catch (error) {
    res.json({ success: true, pins: [] })
  }
})

/**
 * POST /api/promotion/pins
 * Speichert einen neuen Pin
 * 
 * Body: { articleTitle, pinData, imageUrl, pinterestUrl, status, createdAt }
 */
router.post('/api/promotion/pins', (req, res) => {
  try {
    let pins = []
    if (fs.existsSync(PINS_FILE)) {
      const data = fs.readFileSync(PINS_FILE, 'utf-8')
      pins = JSON.parse(data)
    }

    const newPin = {
      id: `pin_${Date.now()}`,
      ...req.body,
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    pins.push(newPin)

    // Max 200 Pins behalten
    if (pins.length > 200) pins = pins.slice(-200)

    fs.writeFileSync(PINS_FILE, JSON.stringify(pins, null, 2))

    console.log(`[Promotion] Pin gespeichert: ${newPin.id}`)
    res.json({ success: true, pin: newPin })
  } catch (error) {
    console.error('[Promotion] Fehler beim Speichern:', error)
    res.status(500).json({ error: 'Fehler beim Speichern des Pins' })
  }
})

/**
 * DELETE /api/promotion/pins/:id
 * Löscht einen Pin
 */
router.delete('/api/promotion/pins/:pinId', (req, res) => {
  try {
    if (!fs.existsSync(PINS_FILE)) {
      return res.status(404).json({ error: 'Pin nicht gefunden' })
    }

    const data = fs.readFileSync(PINS_FILE, 'utf-8')
    let pins = JSON.parse(data)
    const filtered = pins.filter(p => p.id !== req.params.pinId)

    if (filtered.length === pins.length) {
      return res.status(404).json({ error: 'Pin nicht gefunden' })
    }

    fs.writeFileSync(PINS_FILE, JSON.stringify(filtered, null, 2))
    console.log(`[Promotion] Pin gelöscht: ${req.params.pinId}`)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Löschen' })
  }
})

export default router
