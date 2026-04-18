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
    prompt: (data) => `Erstelle eine Pinterest-optimierte Infografik für "${data.lifestyle?.brand || 'MojoBus'}".

ARTIKEL-TITEL: "${data.title || ''}"
ZUSAMMENFASSUNG: "${data.summary || ''}"
TEXT-AUSZUG: "${(data.text || '').substring(0, 800)}"

AUFGABE – erstelle aus dem Artikel-Inhalt:
1. PIN-TITEL (50-80 Zeichen) – Hauptkeyword zuerst, konkrete Zahl wenn möglich (z.B. "Mojobus: 3 Monate Portugal – was es kostet")
2. PIN-BESCHREIBUNG (200-350 Zeichen) – konkret, neugierig machend, mit echten Details aus dem Artikel
3. HASHTAGS (5-7) – 2-3 Brand-Tags + 2-3 Themen-Tags + 1-2 Orts-Tags
4. BILD-ALT-TEXT (60-100 Zeichen)
5. TEXT-OVERLAY (max 35 Zeichen) – GROSSBUCHSTABEN, knalliger Eyecatcher
6. SUB-OVERLAY (max 55 Zeichen) – konkretisiert den Overlay
7. INFOGRAFIK-DATEN: 3-4 Fakten/Zahlen aus dem Artikel (Icon + kurzes Label + konkreter Wert)

WICHTIG: Extrahiere echte Zahlen und Fakten aus dem Artikel-Text. Erfinde keine Zahlen.

JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#mojobus", "#buslife", "..."],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "infographicData": [
    {"icon": "⛽", "label": "Sprit", "value": "320€"},
    {"icon": "🏕️", "label": "Camping", "value": "0€ wild"},
    {"icon": "💰", "label": "Gesamt", "value": "950€/Mo"}
  ]
}`
  },

  listicle: {
    name: '📝 Top-Liste',
    desc: '"5 beste...", Rankings, Tipps',
    prompt: (data) => `Erstelle Pinterest-optimierte Top-Liste für "${data.lifestyle?.brand || 'MojoBus'}".

ARTIKEL-TITEL: "${data.title || ''}"
ZUSAMMENFASSUNG: "${data.summary || ''}"
TEXT-AUSZUG: "${(data.text || '').substring(0, 800)}"

AUFGABE:
1. PIN-TITEL (50-80 Zeichen) – mit konkreter Zahl, z.B. "5 geheime Stellplätze Portugal die kaum jemand kennt"
2. PIN-BESCHREIBUNG (200-350 Zeichen) – was bekommt der Leser? Konkret benennen.
3. HASHTAGS (5-7)
4. BILD-ALT-TEXT (60-100 Zeichen)
5. TEXT-OVERLAY (max 45 Zeichen) – z.B. "TOP 7 STELLPLÄTZE"
6. SUB-OVERLAY (max 55 Zeichen) – z.B. "Portugal – Algarve bis Porto"
7. LISTE: 5-7 konkrete Einträge direkt aus dem Artikel (max 30 Zeichen je Eintrag)

JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#mojobus", "#buslife", "..."],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "listItems": ["Praia da Bordeira", "Sagres Fischerstrand", "..."]
}`
  },

  howto: {
    name: '🔧 Anleitung',
    desc: 'Step-by-Step, How-To, DIY',
    prompt: (data) => `Erstelle Pinterest-optimierte Schritt-für-Schritt-Anleitung für "${data.lifestyle?.brand || 'MojoBus'}".

ARTIKEL-TITEL: "${data.title || ''}"
ZUSAMMENFASSUNG: "${data.summary || ''}"
TEXT-AUSZUG: "${(data.text || '').substring(0, 800)}"

AUFGABE:
1. PIN-TITEL (50-80 Zeichen) – z.B. "Mojobus Solar: In 5 Schritten zur Autarkie"
2. PIN-BESCHREIBUNG (200-350 Zeichen) – Was lernt man? Für wen ist es?
3. HASHTAGS (5-7)
4. BILD-ALT-TEXT (60-100 Zeichen)
5. TEXT-OVERLAY (max 35 Zeichen) – z.B. "SO GEHT ES"
6. SUB-OVERLAY (max 55 Zeichen) – z.B. "Schritt-für-Schritt Anleitung"
7. SCHRITTE: 4-5 knappe Schritte aus dem Artikel (max 35 Zeichen je Schritt)

JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#mojobus", "#busausbau", "..."],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "steps": ["1. Verbrauch berechnen", "2. Panels montieren", "..."]
}`
  },

  testimonial: {
    name: '⭐ Erfahrungsbericht',
    desc: 'Echte Erlebnisse, Zitate',
    prompt: (data) => `Erstelle Pinterest-optimierten Erfahrungsbericht-Pin für "${data.lifestyle?.brand || 'MojoBus'}".

ARTIKEL-TITEL: "${data.title || ''}"
ZUSAMMENFASSUNG: "${data.summary || ''}"
TEXT-AUSZUG: "${(data.text || '').substring(0, 800)}"

AUFGABE:
1. PIN-TITEL (50-80 Zeichen) – persönlich, ehrlich, neugierig machend
2. PIN-BESCHREIBUNG (200-350 Zeichen) – als wäre es eine persönliche Empfehlung, nicht Werbung
3. HASHTAGS (5-7)
4. BILD-ALT-TEXT (60-100 Zeichen)
5. TEXT-OVERLAY (max 35 Zeichen) – z.B. "UNSER FAZIT" oder "NACH 3 MONATEN"
6. SUB-OVERLAY (max 55 Zeichen)
7. ZITAT: Ein prägnanter Satz aus dem Artikel-Inhalt (max 130 Zeichen) – ehrlich, keine Werbefloskel

JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#mojobus", "#buslife", "..."],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "quote": "..."
}`
  },

  quicktip: {
    name: '⚡ Quick-Tipp',
    desc: 'Schnelle Tipps, Hacks',
    prompt: (data) => `Erstelle Pinterest-optimierten Quick-Tipp für "${data.lifestyle?.brand || 'MojoBus'}".

ARTIKEL-TITEL: "${data.title || ''}"
ZUSAMMENFASSUNG: "${data.summary || ''}"
TEXT-AUSZUG: "${(data.text || '').substring(0, 800)}"

AUFGABE:
1. PIN-TITEL (50-80 Zeichen) – z.B. "Mojobus Tipp: Wildcamp-Spots finden ohne App"
2. PIN-BESCHREIBUNG (200-350 Zeichen) – der Tipp selbst ausformuliert + warum er wichtig ist
3. HASHTAGS (5-7)
4. BILD-ALT-TEXT (60-100 Zeichen)
5. TEXT-OVERLAY (max 25 Zeichen) – z.B. "TIPP" oder "HACK"
6. SUB-OVERLAY (max 120 Zeichen) – DER eigentliche Tipp in 1-2 kurzen Sätzen, direkt umsetzbar

JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#mojobus", "#buslifetipp", "..."],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "..."
}`
  },

  beforeafter: {
    name: '✨ Vorher/Nachher',
    desc: 'Transformationen, Umbauten',
    prompt: (data) => `Erstelle Pinterest-optimierten Vorher/Nachher-Pin für "${data.lifestyle?.brand || 'MojoBus'}".

ARTIKEL-TITEL: "${data.title || ''}"
ZUSAMMENFASSUNG: "${data.summary || ''}"
TEXT-AUSZUG: "${(data.text || '').substring(0, 800)}"

AUFGABE:
1. PIN-TITEL (50-80 Zeichen) – die Transformation benennen, z.B. "Mojobus Ausbau: Von leer zu fertig in 3 Monaten"
2. PIN-BESCHREIBUNG (200-350 Zeichen) – was hat sich verändert? Was hat es gebracht?
3. HASHTAGS (5-7)
4. BILD-ALT-TEXT (60-100 Zeichen)
5. TEXT-OVERLAY (max 35 Zeichen) – z.B. "VORHER → NACHHER"
6. SUB-OVERLAY (max 55 Zeichen)
7. VORHER-TEXT (max 110 Zeichen) – konkreter Ausgangszustand
8. NACHHER-TEXT (max 110 Zeichen) – konkretes Ergebnis, möglichst mit Zahl/Fakt

JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#mojobus", "#busausbau", "..."],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "beforeText": "...",
  "afterText": "..."
}`
  },

  route: {
    name: '🗺️ Reiseroute',
    desc: 'Roadmaps, Touren, Strecken',
    prompt: (data) => `Erstelle Pinterest-optimierten Reiserouten-Pin für "${data.lifestyle?.brand || 'MojoBus'}".

ARTIKEL-TITEL: "${data.title || ''}"
ZUSAMMENFASSUNG: "${data.summary || ''}"
TEXT-AUSZUG: "${(data.text || '').substring(0, 800)}"

AUFGABE:
1. PIN-TITEL (50-80 Zeichen) – z.B. "Mojobus Route: Lissabon bis Sagres in 10 Tagen"
2. PIN-BESCHREIBUNG (200-350 Zeichen) – Route beschreiben, Highlights nennen, Länge/Dauer
3. HASHTAGS (5-7) – Orts-Tags nicht vergessen
4. BILD-ALT-TEXT (60-100 Zeichen)
5. TEXT-OVERLAY (max 30 Zeichen) – z.B. "UNSERE ROUTE"
6. SUB-OVERLAY (max 55 Zeichen) – z.B. "10 Tage · 650 km · Algarve"
7. WEGPUNKTE: 5-8 konkrete Orte aus dem Artikel (max 28 Zeichen je Wegpunkt)

JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#mojobus", "#portugal", "..."],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "waypoints": ["Start: Lissabon", "Stop 1: Setúbal", "..."]
}`
  },

  'mojobus-story': {
    name: '🚌 MojoBus Story',
    desc: 'Authentischer Story-Pin, minimaler Text',
    prompt: (data) => `Erstelle Pinterest-optimierten Story-Pin für den MojoBus – authentisch, kein Marketing-Speak.

ARTIKEL-TITEL: "${data.title || ''}"
ZUSAMMENFASSUNG: "${data.summary || ''}"
TEXT-AUSZUG: "${(data.text || '').substring(0, 1000)}"

BRAND: MojoBus – 10m US-Oldtimer-Bus, Mojo & Susanne, dauerhaft unterwegs, kein Urlaub – das ist das Leben.
TON: Ehrlich. Knapp. Keine Ausrufezeichen. Keine Klischees. Keine Motivation-Poster-Sprüche.

AUFGABE:
1. PIN-TITEL (40-70 Zeichen) – eine echte Beobachtung oder Situation, keine Headline
2. PIN-BESCHREIBUNG (150-280 Zeichen) – im MojoBus-Stil: kurz, konkret, ehrlich. Keine Fragen ans Publikum. Kein "Stell dir vor..."
3. HASHTAGS (5-8) – immer #mojobus #buslife, dazu thematisch passende
4. BILD-ALT-TEXT (50-80 Zeichen)
5. STORY-ZEILE (max 45 Zeichen) – ein kurzer, echter Satz der das Bild beschreibt. Keine GROSSBUCHSTABEN nötig.
6. STORY-SUB (max 80 Zeichen) – zweiter Satz der die Geschichte weiterführt. Kann mit "." enden.
7. STORY-TAG (max 20 Zeichen) – z.B. "mojobus.co" oder "Tag 847" oder der Ort

JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#mojobus", "#buslife", "..."],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "storyTag": "..."
}`
  }
}

// ═══════════════════════════════════════════════════════════
// LIFESTYLE → PINTEREST KONTEXT
// ═══════════════════════════════════════════════════════════

const LIFESTYLE_PINTEREST_CONFIG = {
  mojobus: {
    brand: 'MojoBus',
    brandUrl: 'mojobus.co',
    icon: '🚌',
    tagline: 'Leben auf Rädern im 10m US-Oldtimer-Bus',
    audience: 'Buslife, Oldtimer-Fans, Dauernomaden, DIY-Enthusiasten',
    tone: 'authentisch, ehrlich, keine Instagram-Klischees, kurz und präzise',
    keywords: ['#mojobus', '#buslife', '#oldtimerbus', '#dauerhaftunterwegs', '#busausbau', '#mojobusleben'],
    vehicle: 'Mojobus (10m US-Oldtimer-Bus)',
    avoid: 'Van, Camper, traumhaft, atemberaubend, Ausrufezeichen, "lebe deinen Traum"',
    pinStyle: 'Prägnant. Keine Floskeln. Echte Zahlen, echte Orte, echte Situationen.'
  },
  'perpetual-travelers': {
    brand: 'Perpetual Travelers',
    brandUrl: 'mojobus.co',
    icon: '🌊',
    tagline: 'Dauerhaft unterwegs – kein Urlaub, das ist das Leben',
    audience: 'Digitale Nomaden, Langzeit-Reisende, Freiheits-Suchende',
    tone: 'minimalistisch, ehrlich, tiefgründig, kein Urlaubsfeeling',
    keywords: ['#perpetualtravelers', '#dauernomade', '#ortlos', '#nomadenleben', '#unterwegssein'],
    vehicle: 'Bus / Fahrzeug / Unterkunft je nach Kontext',
    avoid: 'Urlaub, Ferien, Auszeit, Sabbatical, "endlich mal raus"',
    pinStyle: 'Ruhig. Kein Hype. Der Pin wirkt durch Ehrlichkeit, nicht durch Lärm.'
  },
  vanlife: {
    brand: 'Vanlife',
    brandUrl: 'mojobus.co',
    icon: '🚐',
    tagline: 'Leben im Van – Freiheit auf vier Rädern',
    audience: 'Vanlife-Community, Weekend-Warriors, Road-Tripper',
    tone: 'abenteuerlich, inspirierend, praktisch',
    keywords: ['#vanlife', '#vanlifegermany', '#vanlifeeurope', '#mobilesleben', '#aufreise'],
    vehicle: 'Van / Kastenwagen',
    avoid: 'Bus, Wohnmobil (außer direkt gemeint)',
    pinStyle: 'Inspirierend aber bodenständig. Echte Tipps statt Traumbilder.'
  },
  wohnmobil: {
    brand: 'Wohnmobil-Leben',
    brandUrl: 'mojobus.co',
    icon: '🏕️',
    tagline: 'Wohnmobil-Reisen – komfortabel und frei',
    audience: 'Wohnmobil-Fahrer, Camping-Fans, 50+ Reisende',
    tone: 'praktisch, erfahren, hilfreich, bodenständig',
    keywords: ['#wohnmobil', '#wohnmobilreise', '#camper', '#stellplatz', '#wohnmobileuropa'],
    vehicle: 'Wohnmobil / Reisemobil',
    avoid: 'Van (außer direkt gemeint), jugendliche Slang-Begriffe',
    pinStyle: 'Hilfreiche Tipps. Konkrete Infos. Erfahrungswissen statt Hype.'
  },
  rvlife: {
    brand: 'RV Life',
    brandUrl: 'mojobus.co',
    icon: '🚗',
    tagline: 'RV Life – Full-Time on the Road',
    audience: 'RV-Community, Full-Timer, US-Style Road-Tripper',
    tone: 'abenteuerlich, praktisch, englisch-deutsch gemischt ok',
    keywords: ['#rvlife', '#fulltimerv', '#rvliving', '#roadtrip', '#rveurope'],
    vehicle: 'RV / Reisemobil',
    avoid: 'Zu viel Deutsch-Slang wenn Zielgruppe international',
    pinStyle: 'Energetisch aber informativ. Zahlen und Fakten kommen gut an.'
  },
  beachlife: {
    brand: 'Beach Life',
    brandUrl: 'mojobus.co',
    icon: '🏖️',
    tagline: 'Leben am Meer – Sand, Salz und Freiheit',
    audience: 'Strand-Liebhaber, Surfer, Küsten-Nomaden, Portugal/Algarve-Fans',
    tone: 'entspannt, sensorisch, ehrlich-schön',
    keywords: ['#beachlife', '#küstenleben', '#strandleben', '#algarve', '#meerliebe'],
    vehicle: 'Strand / Küste / Meer',
    avoid: 'Kitsch, "Traumstrand", "Paradies"',
    pinStyle: 'Atmosphärisch. Bilder die man riechen kann. Salz, Wind, Licht.'
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

  console.log(`[Promotion] Generiere Pin-Text: Template=${template}, Modell=${model}, Lifestyle=${lifestyle}, Titel="${title}"`)

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
