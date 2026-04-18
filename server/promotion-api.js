/**
 * Pinterest Promotion API
 * 
 * Endpunkte:
 * - POST /api/promotion/generate-pin-text → KI-generierte Pin-Texte
 * - GET  /api/promotion/articles → Artikel-Liste für Dropdown
 * - POST /api/promotion/save-pin    → Pin speichern
 * 
 * Verwendet die gleichen KI-Modelle wie server.js:
 * - Claude Sonnet 4.6 (Anthropic)
 * - Llama 4 Scout (Groq)
 */

import express from 'express'
import axios from 'axios'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PINS_FILE = path.join(__dirname, 'promoted-pins.json')

// ── Hilfsfunktionen aus server.js duplizieren ────────────────────────────────

const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') return ''
  return input.trim().substring(0, 500)
}

const validateApiKey = () => {
  if (!process.env.GROQ_API_KEY) {
    console.error('[Promotion] GROQ_API_KEY fehlt in Umgebungsvariablen')
    return false
  }
  return true
}

const safelyParseJSON = (str) => {
  if (!str) return null
  try {
    return JSON.parse(str)
  } catch (e) {
    return null
  }
}

// ── Prompts aus src/config/prompts/ importieren ──────────────────────────────
import { getLifestyleConfig } from '../src/config/prompts/index.js'

// ═══════════════════════════════════════════════════════════
// KI-MODELL FUNKTION (kopiert aus server.js)
// ═══════════════════════════════════════════════════════════

const generateWithKi = async (prompt, systemPrompt, model = 'llama4', maxTokens = 500, temperature = 0.8) => {
  const startTime = Date.now()

  try {
    if (model === 'claude') {
      // Claude Sonnet (Anthropic)
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY fehlt')
      }

      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        timeout: 60000
      })

      const duration = Date.now() - startTime
      console.log(`[Promotion] Claude generiert in ${duration}ms`)
      return response.data.content[0].text

    } else {
      // Llama 4 Scout (Groq) - Standard
      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature,
        top_p: 0.9
      }, {
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        timeout: 45000
      })

      const duration = Date.now() - startTime
      console.log(`[Promotion] Llama 4 Scout generiert in ${duration}ms`)
      return response.data.choices[0].message.content
    }
  } catch (error) {
    console.error(`[Promotion] KI Fehler mit ${model}:`, error.response?.data || error.message)
    throw error
  }
}

// ═══════════════════════════════════════════════════════════
// PIN-JSON SICHER PARSSEN
// ═══════════════════════════════════════════════════════════

function parsePinJson(rawText) {
  try {
    // Code-Block entfernen falls vorhanden
    const jsonStr = rawText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim()
    return JSON.parse(jsonStr)
  } catch (e) {
    // Fallback: versuche JSON im Text zu finden
    const match = rawText.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {}
    }
    return null
  }
}

// ═══════════════════════════════════════════════════════════
// PINTERESEO KEYWORD-DATENBANK
// ═══════════════════════════════════════════════════════════

const KEYWORD_DATA = {
  vanlife: {
    de: ['vanlife deutschland', 'wohnmobil meer', 'camper ausbau', 'vanlife tipps', 'freiheit auf rädern', 'strand nomaden'],
    en: ['vanlife', 'van life', 'camper van', 'nomad life', 'road trip', 'off grid living']
  },
  perpetual: {
    de: ['perpetual travelers', 'leben am meer', 'offgrid leben', 'portugal auswandern', 'algarve camping'],
    en: ['perpetual travelers', 'beach nomad', 'coastal living', 'ocean nomad', 'sea life']
  },
  solar: {
    de: ['solar wohnmobil', 'solaranlage camper', 'offgrid solar', 'solar camping'],
    en: ['solar power', 'off grid solar', 'van solar setup', 'camping solar']
  },
  portugal: {
    de: ['portugal geheimtipps', 'algarve strand', 'wohnmobil portugal', 'portugal roadtrip'],
    en: ['portugal travel', 'algarve beaches', 'portugal vanlife', 'hidden beaches portugal']
  },
  diy: {
    de: ['wohnmobil ausbau', 'camper diy', 'selbstausbau', 'vanlife diy'],
    en: ['van conversion', 'camper build', 'van build', 'diy camper']
  }
}

// ═══════════════════════════════════════════════════════════
// PROMPT-GENERATOREN FÜR JEDES TEMPLATE
// ═══════════════════════════════════════════════════════════

const TEMPLATES = {
  infographic: {
    name: '📊 Infografik',
    desc: 'Kosten, Budget, Statistiken',
    prompt: (data) => `Erstelle eine Pinterest-optimierte Infografik für einen Blog-Artikel mit Zahlen und Daten.

ARTIKEL-TITEL: "${data.title || ''}"
ARTIKEL-ZUSAMMENFASSUNG: "${data.summary || ''}"
ARTIKEL-TEXT: "${(data.text || '').substring(0, 600)}"

Erstelle DARAUS:
1. PIN-TITEL (50-80 Zeichen) – Hauptkeyword zuerst, aufmerksamkeitsstark
2. PIN-BESCHREIBUNG (150-300 Zeichen) – 3-5 Keywords natürlich einbauen
3. HASHTAGS (3-5) – relevant, Mischung breit+nische
4. BILD-ALT-TEXT (50-100 Zeichen) – beschreibend mit Keywords
5. TEXT-OVERLAY FÜR BILD (max 40 Zeichen) – großer fetter Text der auf das Bild kommt
6. SUB-OVERLAY (max 60 Zeichen) – kleinerer Zusatztext

ZUSÄTZLICH:
- 3 Zahlen/Fakten die in die Infografik-Boxen kommen (z.B. Kosten, Tage, Orte)

ANTWORTE NUR ALS JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "infographicData": [
    {"icon": "⛽", "label": "...", "value": "..."},
    {"icon": "🏕️", "label": "...", "value": "..."},
    {"icon": "💰", "label": "...", "value": "..."}
  ]
}`
  },

  listicle: {
    name: '📝 Top-Liste',
    desc: '"5 beste...", Rankings, Tipps',
    prompt: (data) => `Erstelle Pinterest-optimierte Top-X-Liste für einen Reise-Blog-Artikel.

ARTIKEL-TITEL: "${data.title || ''}"
ARTIKEL-ZUSAMMENFASSUNG: "${data.summary || ''}"
ARTIKEL-TEXT: "${(data.text || '').substring(0, 600)}"

Erstelle:
1. PIN-TITEL (50-80 Zeichen) – mit Zahl undKeyword, z.B. "5 geheime Strände Portugal"
2. PIN-BESCHREIBUNG (150-300 Zeichen) – spannend, Keywords enthalten
3. HASHTAGS (3-5)
4. BILD-ALT-TEXT
5. TEXT-OVERLAY (max 50 Zeichen) – z.B. "TOP 5 STRÄNDE"
6. SUB-OVERLAY (60 Zeichen) – z.B. "Geheime Spots in Portugal"

ZUSÄTZLICH: 5-7 Einträge für die Liste (jeweils max 25 Zeichen)

ANTWORTE NUR ALS JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "listItems": ["Eintrag 1", "Eintrag 2", "Eintrag 3", ...]
}`
  },

  howto: {
    name: '🔧 Anleitung',
    desc: 'Step-by-Step, How-To, DIY',
    prompt: (data) => `Erstelle Pinterest-optimierte How-To/Anleitung für einen DIY-Artikel.

ARTIKEL-TITEL: "${data.title || ''}"
ARTIKEL-ZUSAMMENFASSUNG: "${data.summary || ''}"
ARTIKEL-TEXT: "${(data.text || '').substring(0, 600)}"

Erstelle:
1. PIN-TITEL (50-80 Zeichen) – z.B. "Solar im Wohnmobil: Schritt-für-Schritt"
2. PIN-BESCHREIBUNG (150-300 Zeichen)
3. HASHTAGS (3-5)
4. BILD-ALT-TEXT
5. TEXT-OVERLAY (40 Zeichen) – z.B. "ANLEITUNG"
6. SUB-OVERLAY (60 Zeichen)

ZUSÄTZLICH: 4-6 Schritte (jeweits max 30 Zeichen)

ANTWORTE NUR ALS JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "steps": ["Schritt 1", "Schritt 2", ...]
}`
  },

  testimonial: {
    name: '⭐ Erfahrungsbericht',
    desc: 'Reviews, Erfahrungen',
    prompt: (data) => `Erstelle Pinterest-optimierten Erfahrungsbericht-Pin.

ARTIKEL-TITEL: "${data.title || ''}"
ARTIKEL-ZUSAMMENFASSUNG: "${data.summary || ''}"
ARTIKEL-TEXT: "${(data.text || '').substring(0, 600)}"

Erstelle:
1. PIN-TITEL (50-80 Zeichen)
2. PIN-BESCHREIBUNG (150-300 Zeichen)
3. HASHTAGS (3-5)
4. BILD-ALT-TEXT
5. TEXT-OVERLAY (40 Zeichen) – z.B. "UNSER ERFAHRUNG"
6. SUB-OVERLAY (60 Zeichen)

ZUSÄTZLICH: 1 Zitat oder Aussage aus dem Artikel (max 120 Zeichen)

ANTWORTE NUR ALS JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "quote": "..."
}`
  },

  quicktip: {
    name: '⚡ Quick-Tipp',
    desc: 'Schnelle Tipps, Hacks',
    prompt: (data) => `Erstelle Pinterest-optimierten Quick-Tipp-Pin.

ARTIKEL-TITEL: "${data.title || ''}"
ARTIKEL-ZUSAMMENFASSUNG: "${data.summary || ''}"
ARTIKEL-TEXT: "${(data.text || '').substring(0, 600)}"

Erstelle:
1. PIN-TITEL (50-80 Zeichen) – z.B. "Vanlife Tipp: So sparst du Sprit"
2. PIN-BESCHREIBUNG (150-300 Zeichen)
3. HASHTAGS (3-5)
4. BILD-ALT-TEXT
5. TEXT-OVERLAY (30 Zeichen) – z.B. "QUICK TIP"
6. SUB-OVERLAY (max 100 Zeichen) – der eigentliche Tipp in 1-2 Sätzen

ANTWORTE NUR ALS JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "..."
}`
  },

  beforeafter: {
    name: '✨ Vorher/Nachher',
    desc: 'Transformationen',
    prompt: (data) => `Erstelle Pinterest-optimierten Vorher/Nachher Pin.

ARTIKEL-TITEL: "${data.title || ''}"
ARTIKEL-ZUSAMMENFASSUNG: "${data.summary || ''}"
ARTIKEL-TEXT: "${(data.text || '').substring(0, 600)}"

Erstelle:
1. PIN-TITEL (50-80 Zeichen)
2. PIN-BESCHREIBUNG (150-300 Zeichen)
3. HASHTAGS (3-5)
4. BILD-ALT-TEXT
5. TEXT-OVERLAY (40 Zeichen) – z.B. "VORHER → NACHHER"
6. SUB-OVERLAY (60 Zeichen)

ZUSÄTZLICH:
- Vorher-Text (max 100 Zeichen) – Zustand vor der Veränderung
- Nachher-Text (max 100 Zeichen) – Zustand nach der Veränderung

ANTWORTE NUR ALS JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "beforeText": "...",
  "afterText": "..."
}`
  },

  route: {
    name: '🗺️ Reiseroute',
    desc: 'Roadmaps, Strecken',
    prompt: (data) => `Erstelle Pinterest-optimierten Reiseroute-Pin.

ARTIKEL-TITEL: "${data.title || ''}"
ARTIKEL-ZUSAMMENFASSUNG: "${data.summary || ''}"
ARTIKEL-TEXT: "${(data.text || '').substring(0, 600)}"

Erstelle:
1. PIN-TITEL (50-80 Zeichen) – z.B. "Unsere Route: Lissabon → Sagres"
2. PIN-BESCHREIBUNG (150-300 Zeichen)
3. HASHTAGS (3-5)
4. BILD-ALT-TEXT
5. TEXT-OVERLAY (30 Zeichen) – z.B. "OUR ROUTE"
6. SUB-OVERLAY (60 Zeichen)

ZUSÄTZLICH: 5-8 Wegpunkte der Route (jeweils max 25 Zeichen)

ANTWORTE NUR ALS JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "waypoints": ["Start: ...", "Stop 1: ...", ...]
}`
  }
}

// ═══════════════════════════════════════════════════════════
// API ROUTEN
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/promotion/generate-pin-text
 * 
 * Generiert Pinterest-optimierte Texte für einen bestimmten Template-Typ
 * 
 * Body:
 * - title: string (Artikel-Titel)
 * - summary: string (Zusammenfassung)
 * - text: string (Artikel-Text)
 * - template: string (Template-ID aus TEMPLATES)
 * - model: string ('llama4' | 'claude')
 * - lifestyle: string (Lifestyle-Key, z.B. 'perpetual-travelers')
 */
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

  const templateConfig = TEMPLATES[template]
  if (!templateConfig) {
    return res.status(400).json({ error: `Unbekanntes Template: ${template}` })
  }

  console.log(`[Promotion] Generiere Pin-Text: Template=${template}, Modell=${model}, Titel="${title}"`)

  const systemPrompt = `Du bist ein Pinterest-SEO-Experte für Reise- und Vanlife-Blogs. Du erstellst optimierte Pins die viral gehen und Klicks generieren. Antworte IMMER NUR mit validem JSON. Keinerlei Erklärungen außerhalb des JSON. Keine Markdown-Code-Blöcke. Keine zusätzlichen Kommentare.`

  const prompt = templateConfig.prompt({ title, summary, text })

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

    res.json({
      success: true,
      pinData: {
        template,
        model: model === 'claude' ? 'claude-sonnet-4-20250514' : 'llama-4-scout',
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
