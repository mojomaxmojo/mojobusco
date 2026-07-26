import axios from 'axios'

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
 * Reihenfolge: 1. Qwen 2.5 VL 72B, 2. Gemini 2.5 Flash.
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

  // ── Versuch 1: Qwen 2.5 VL 72B via OpenRouter ─────────────────────────
  try {
    const visionResponse = await axios.post(OPENROUTER_BASE, {
      model: 'qwen/qwen2.5-vl-72b-instruct',
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
  } catch (qwenErr) {
    const status = qwenErr.response?.status
    const msg = qwenErr.response?.data?.error?.message || qwenErr.message
    console.warn(`[Vision] Qwen fehlgeschlagen (HTTP ${status}): ${msg} → Gemini Fallback`)
  }

  // ── Versuch 2: Gemini 2.5 Flash via OpenRouter ────────────────────────
  try {
    const visionResponse = await axios.post(OPENROUTER_BASE, {
      model: 'google/gemini-2.5-flash',
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
  } catch (geminiErr) {
    const status = geminiErr.response?.status
    const msg = geminiErr.response?.data?.error?.message || geminiErr.message
    console.error(`[Vision] Gemini fehlgeschlagen (HTTP ${status}): ${msg}`)
    throw geminiErr
  }
}

export default { analyzeImageBase64 }
