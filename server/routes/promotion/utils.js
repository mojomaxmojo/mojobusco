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

export {
  sanitizeInput,
  validateApiKey,
  safelyParseJSON,
  analyzeImageWithVision,
  parsePinJson,
}
