import axios from 'axios'
import { getTextModel, normalizeTextModel } from '../../../src/config/ai-models.js'

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
 * Generiert Text mit dem gewählten KI-Modell
 *
 * @param {string} prompt
 * @param {string} systemPrompt
 * @param {string} model - 'mini' | 'medium' | 'maxi'
 * @param {number} maxTokens
 * @param {number} temperature
 * @returns {Promise<string>}
 */
const generateWithKi = async (prompt, systemPrompt, model = 'medium', maxTokens = 500, temperature = 0.8) => {
  const startTime = Date.now()
  const tier = normalizeTextModel(model)
  const modelConfig = getTextModel(tier)

  try {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY fehlt')
    }

    const response = await axios.post(OPENROUTER_BASE, {
      model: modelConfig.id,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    }, {
      headers: getOpenRouterHeaders(),
      timeout: 60000
    })

    const duration = Date.now() - startTime
    console.log(`[Promotion] ${modelConfig.label} via OpenRouter generiert in ${duration}ms (tier: ${tier})`)
    return response.data.choices[0].message.content

  } catch (error) {
    console.error(`[Promotion] KI Fehler mit ${tier} (${modelConfig.id}):`, error.response?.data || error.message)
    throw error
  }
}

export { generateWithKi }
