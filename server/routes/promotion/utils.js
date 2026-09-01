import axios from 'axios'
import { getVisionModels } from '../../config/ai-models.js'

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

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions'

function getOpenRouterHeaders() {
  return {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://mojobus.co',
    'X-Title': 'MojoBus',
    'Content-Type': 'application/json'
  }
}

const VISION_PROMPT_TEXT = 'Beschreibe dieses Bild in 1-2 präzisen Sätzen auf Deutsch. Nenne: Was ist zu sehen? Ort/Landschaft/Fahrzeug/Person? Stimmung/Licht? Keine Marketing-Sprache, nur sachliche Beschreibung.'

/**
 * Analysiert ein Bild via OpenRouter Vision-KI.
 * Modelle kommen aus src/config/ai-models.js.
 * Gibt eine kurze, präzise Bildbeschreibung zurück (1-2 Sätze).
 *
 * @param {string} imageUrl - Öffentliche Bild-URL
 * @returns {string|null} Bildbeschreibung oder null bei Fehler
 */
const analyzeImageWithVision = async (imageUrl) => {
  if (!imageUrl || !process.env.OPENROUTER_API_KEY) return null

  const startTime = Date.now()
  const visionModels = getVisionModels()

  for (let i = 0; i < visionModels.length; i++) {
    const modelConfig = visionModels[i]
    const isLast = i === visionModels.length - 1
    try {
      const response = await axios.post(OPENROUTER_BASE, {
        model: modelConfig.id,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl } },
              { type: 'text', text: VISION_PROMPT_TEXT }
            ]
          }
        ],
        max_tokens: 150,
        temperature: 0.3
      }, {
        headers: getOpenRouterHeaders(),
        timeout: 20000
      })

      const duration = Date.now() - startTime
      const description = response.data.choices[0].message.content?.trim()
      console.log(`[Promotion] ${modelConfig.label} Vision Bildanalyse in ${duration}ms: "${description?.substring(0, 80)}..."`)
      return description || null
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message
      const nextHint = isLast ? 'kein Fallback' : `→ ${visionModels[i + 1].label}`
      console.warn(`[Promotion] ${modelConfig.label} Bildanalyse fehlgeschlagen: ${msg} ${nextHint}`)
      if (isLast) return null
    }
  }

  return null
}

/**
 * Entfernt rohe Steuerzeichen (Zeilenumbruch/CR/Tab) INNERHALB von JSON-Strings.
 * Manche Modelle brechen lange Strings beim Pretty-Print um – strictes JSON.parse
 * lehnt rohe Control-Chars in Strings ab ("Bad control character in string literal").
 * String-Kontext wird per State-Machine korrekt verfolgt (Escapes, Anführungszeichen).
 */
function stripControlCharsInStrings(text) {
  let out = ''
  let inString = false
  let escape = false

  for (const ch of text) {
    if (inString) {
      if (escape) {
        escape = false
        out += ch
        continue
      }
      if (ch === '\\') {
        escape = true
        out += ch
        continue
      }
      if (ch === '"') {
        inString = false
        out += ch
        continue
      }
      if (ch === '\n' || ch === '\r' || ch === '\t') continue
      out += ch
      continue
    }

    if (ch === '"') inString = true
    out += ch
  }

  return out
}

function parsePinJson(rawText) {
  // Sicherheit: KI kann theoretisch null/undefined/number liefern
  if (rawText == null) return null
  if (typeof rawText !== 'string') {
    // Manche Provider packen den Text in ein Objekt
    if (typeof rawText === 'object' && rawText.content != null && typeof rawText.content === 'string') {
      rawText = rawText.content
    } else {
      return null
    }
  }

  // Code-Block entfernen falls vorhanden
  const jsonStr = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim()

  // 1. Direkt parsen
  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    console.error('[Promotion] JSON.parse Fehler:', e.message)
  }

  // 2. Reparatur: rohe Steuerzeichen innerhalb von Strings entfernen
  try {
    const repaired = JSON.parse(stripControlCharsInStrings(jsonStr))
    console.warn('[Promotion] JSON nach Steuerzeichen-Reparatur geparst')
    return repaired
  } catch {}

  // 3. Fallback: erstes balanciertes JSON-Objekt aus dem Text extrahieren.
  //    Wir zählen geschweifte Klammern, damit '{'/'}' innerhalb von Strings
  //    oder abgeschnittener Output am Ende nicht alles zerstören.
  const extracted = extractBalancedJson(rawText)
  if (extracted) {
    try {
      return JSON.parse(extracted)
    } catch {}
    try {
      const repaired = JSON.parse(stripControlCharsInStrings(extracted))
      console.warn('[Promotion] Extrahiertes JSON nach Steuerzeichen-Reparatur geparst')
      return repaired
    } catch {}
  }

  return null
}

/**
 * Extrahiert das erste balancierte JSON-Objekt aus einem String.
 * Ignoriert Code-Blöcke und Markdown.
 */
function extractBalancedJson(text) {
  let start = -1
  let depth = 0
  let inString = false
  let escape = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '{') {
      if (start === -1) start = i
      depth++
    } else if (ch === '}') {
      if (start !== -1) {
        depth--
        if (depth === 0) {
          return text.slice(start, i + 1)
        }
      }
    }
  }

  return null
}

export {
  sanitizeInput,
  validateApiKey,
  safelyParseJSON,
  analyzeImageWithVision,
  parsePinJson,
}
