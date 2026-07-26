import axios from 'axios'
import { getVisionModels } from '../../../src/config/ai-models.js'

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
 * Analysiert ein Base64-kodiertes Bild via OpenRouter Vision-KI.
 * Die Modelle kommen aus src/config/ai-models.js.
 *
 * @param {string} base64
 * @param {string} mimeType
 * @param {string} analysisPrompt
 * @param {number} maxTokens
 * @returns {Promise<string>}
 */
export async function analyzeImageBase64(base64, mimeType, analysisPrompt, maxTokens = 150) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY nicht konfiguriert')
  }

  const dataUrl = `data:${mimeType};base64,${base64}`
  const visionModels = getVisionModels()

  for (let i = 0; i < visionModels.length; i++) {
    const modelConfig = visionModels[i]
    const isLast = i === visionModels.length - 1
    try {
      const visionResponse = await axios.post(OPENROUTER_BASE, {
        model: modelConfig.id,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: analysisPrompt },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }],
        max_tokens: maxTokens,
        temperature: 0.7
      }, {
        headers: getOpenRouterHeaders(),
        timeout: 30000
      })
      return visionResponse.data.choices[0].message.content
    } catch (err) {
      const status = err.response?.status
      const msg = err.response?.data?.error?.message || err.message
      const nextHint = isLast ? 'kein Fallback verfügbar' : `→ ${visionModels[i + 1].label}`
      const level = isLast ? 'error' : 'warn'
      console[level](`[Vision] ${modelConfig.label} fehlgeschlagen (HTTP ${status}): ${msg} ${nextHint}`)
      if (isLast) throw err
    }
  }

  throw new Error('Kein Vision-Modell verfügbar')
}

export default { analyzeImageBase64 }
