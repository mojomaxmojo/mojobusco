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

// Multiplikator für den Auto-Retry bei einer abgeschnittenen Antwort (finish_reason: length)
const MAX_RETRY_MULTIPLIER = 1.5

// ===== KI-MODELL FUNKTION =====
const generateWithModel = async (prompt, model = 'medium', lifestyle = 'mojobus', options = {}) => {
  const startTime = Date.now()
  const lifestyleConfig = getLifestyleConfig(lifestyle)

  // Defaults die pro Tab überschrieben werden können
  const baseMaxTokens = options.maxTokens || 700
  const temperature = options.temperature || 0.8
  const callTimeout = options.timeout || 60000

  const tier = normalizeTextModel(model)
  const modelConfig = getTextModel(tier)

  // Ein einzelner Modell-Aufruf mit einem konkreten Token-Budget.
  const attempt = async (maxTokens) => {
    const response = await axios.post(OPENROUTER_BASE, {
      model: modelConfig.id,
      max_tokens: maxTokens,
      temperature,
      reasoning: { effort: 'low' },
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

    const finishReason = response.data.choices?.[0]?.finish_reason
    const usage = response.data.usage
    if (finishReason === 'length') {
      console.warn(`[KI] ⚠️ Antwort abgeschnitten (finish_reason: length)! tier: ${tier}, maxTokens: ${maxTokens}, usage: ${JSON.stringify(usage)}`)
    } else {
      console.log(`[KI] finish_reason: ${finishReason}, usage: ${JSON.stringify(usage)}`)
    }
    return { content: response.data.choices[0].message.content, finishReason }
  }

  try {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY fehlt')
    }

    let result = await attempt(baseMaxTokens)

    // Auto-Retry: Bei abgeschnittener Antwort einmal mit erhöhtem Budget erneut versuchen
    if (result.finishReason === 'length') {
      const retryMaxTokens = Math.round(baseMaxTokens * MAX_RETRY_MULTIPLIER)
      console.warn(`[KI] Retry mit erhöhtem Token-Budget nach finish_reason: length (maxTokens: ${baseMaxTokens} → ${retryMaxTokens})...`)
      result = await attempt(retryMaxTokens)
    }

    return result.content

  } catch (error) {
    console.error(`[KI] Fehler mit ${tier} (${modelConfig.id}):`, error.response?.data || error.message)
    throw error
  }
}

export { generateWithModel }
