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

/**
 * Analysiert ein Bild via Groq Llama 4 Scout Vision
 * Gibt eine kurze, präzise Bildbeschreibung zurück (1-2 Sätze)
 * Kosten: ~$0.0002 pro Bild
 * 
 * @param {string} imageUrl - Öffentliche Bild-URL
 * @returns {string|null} Bildbeschreibung oder null bei Fehler
 */
const analyzeImageWithVision = async (imageUrl) => {
  if (!imageUrl || !process.env.GROQ_API_KEY) return null

  const startTime = Date.now()
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      timeout: 20000
    })

    const duration = Date.now() - startTime
    const description = response.data.choices[0].message.content?.trim()
    console.log(`[Promotion] Bildanalyse in ${duration}ms: "${description?.substring(0, 80)}..."`)
    return description || null

  } catch (error) {
    console.warn('[Promotion] Bildanalyse fehlgeschlagen (nicht kritisch):', error.response?.data?.error?.message || error.message)
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
