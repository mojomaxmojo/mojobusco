import axios from 'axios'

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

/**
 * Analysiert ein Bild via OpenRouter Vision-KI.
 * Reihenfolge: 1. Qwen 2.5 VL 72B, 2. Gemini 2.5 Flash.
 * Gibt eine kurze, präzise Bildbeschreibung zurück (1-2 Sätze).
 *
 * @param {string} imageUrl - Öffentliche Bild-URL
 * @returns {string|null} Bildbeschreibung oder null bei Fehler
 */
const analyzeImageWithVision = async (imageUrl) => {
  if (!imageUrl || !process.env.OPENROUTER_API_KEY) return null

  const startTime = Date.now()

  // ── Versuch 1: Qwen 2.5 VL 72B via OpenRouter ─────────────────────────
  try {
    const response = await axios.post(OPENROUTER_BASE, {
      model: 'qwen/qwen2.5-vl-72b-instruct',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            },
            {
              type: 'text',
              text: 'Beschreibe dieses Bild in 1-2 präzisen Sätzen auf Deutsch. Nenne: Was ist zu sehen? Ort/Landschaft/Fahrzeug/Person? Stimmung/Licht? Keine Marketing-Sprache, nur sachliche Beschreibung.'
            }
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
    console.log(`[Promotion] Qwen Vision Bildanalyse in ${duration}ms: "${description?.substring(0, 80)}..."`)
    return description || null
  } catch (qwenErr) {
    console.warn('[Promotion] Qwen Bildanalyse fehlgeschlagen:', qwenErr.response?.data?.error?.message || qwenErr.message)
  }

  // ── Versuch 2: Gemini 2.5 Flash via OpenRouter ───────────────────────
  try {
    const response = await axios.post(OPENROUTER_BASE, {
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            },
            {
              type: 'text',
              text: 'Beschreibe dieses Bild in 1-2 präzisen Sätzen auf Deutsch. Nenne: Was ist zu sehen? Ort/Landschaft/Fahrzeug/Person? Stimmung/Licht? Keine Marketing-Sprache, nur sachliche Beschreibung.'
            }
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
    console.log(`[Promotion] Gemini Vision Bildanalyse in ${duration}ms: "${description?.substring(0, 80)}..."`)
    return description || null
  } catch (geminiErr) {
    console.warn('[Promotion] Gemini Bildanalyse fehlgeschlagen (nicht kritisch):', geminiErr.response?.data?.error?.message || geminiErr.message)
    return null // Fehler ist nicht kritisch – Pin-Text wird ohne Bildanalyse generiert
  }
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
