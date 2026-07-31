import axios from 'axios'
import { getLifestyleConfig } from '../../src/config/prompts/index.js'
import { getTextModel, normalizeTextModel } from '../config/ai-models.js'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions'

function getOpenRouterHeaders() {
  return {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://mojobus.co',
    'X-Title': 'MojoBus',
    'Content-Type': 'application/json'
  }
}

// ===== KI-MODELL FUNKTION =====
const generateWithModel = async (prompt, model = 'medium', lifestyle = 'mojobus', options = {}) => {
  const startTime = Date.now()
  const lifestyleConfig = getLifestyleConfig(lifestyle)

  // Defaults die pro Tab überschrieben werden können
  const maxTokens = options.maxTokens || 700
  const temperature = options.temperature || 0.8
  const callTimeout = options.timeout || 60000

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
        {
          role: 'system',
          content: `Du schreibst wie Foster Huntington. Erste Person. Kurze Sätze. Keine Überschriften, kein Fettdruck, keine Listen. Keine Leseransprache, keine Tipps, keine Ausrufezeichen.`
        },
        { role: 'user', content: prompt }
      ]
    }, {
      headers: getOpenRouterHeaders(),
      timeout: callTimeout
    })

    const duration = Date.now() - startTime
    console.log(`[KI] ${modelConfig.label} via OpenRouter generiert in ${duration}ms (tier: ${tier}, maxTokens: ${maxTokens})`)
    return response.data.choices[0].message.content

  } catch (error) {
    console.error(`[KI] Fehler mit ${tier} (${modelConfig.id}):`, error.response?.data || error.message)
    throw error
  }
}

export { generateWithModel }
