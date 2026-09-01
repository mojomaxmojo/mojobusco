import axios from 'axios'
import { getTextModel, normalizeTextModel } from '../../config/ai-models.js'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions'

// Multiplikator für den Auto-Retry bei abgeschnittener Antwort (finish_reason: length)
const RETRY_BUDGET_MULTIPLIER = 2

function getOpenRouterHeaders() {
  return {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://mojobus.co',
    'X-Title': 'MojoBus',
    'Content-Type': 'application/json'
  }
}

/**
 * Generiert Text mit dem gewählten KI-Modell.
 *
 * Muster identisch zu server/services/ai-content.js und routes/tiktok/text.js:
 * - Reasoning wird explizit aus ai-models.js mitgeschickt (claude-sonnet-5 ist
 *   ein Reasoning-Modell – ohne Parameter kann das Thinking das Token-Budget
 *   auffressen und das JSON mid-field abschneiden)
 * - finish_reason + usage werden geloggt (Diagnose)
 * - Bei finish_reason "length" (abgeschnittene Antwort) wird EINMAL mit
 *   doppeltem Token-Budget erneut versucht
 *
 * @param {string} prompt
 * @param {string} systemPrompt
 * @param {string} model - 'mini' | 'medium' | 'maxi'
 * @param {number} maxTokens
 * @param {number} temperature
 * @returns {Promise<{content: string|null, finishReason: string|null}>}
 */
const generateWithKi = async (prompt, systemPrompt, model = 'medium', maxTokens = 500, temperature = 0.8) => {
  const startTime = Date.now()
  const tier = normalizeTextModel(model)
  const modelConfig = getTextModel(tier)

  const attempt = async (budget) => {
    const requestBody = {
      model: modelConfig.id,
      max_tokens: budget,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    }

    // Reasoning-Steuerung aus ai-models.js (mini: effort none, medium/maxi: effort low).
    // Nicht-Reasoning-Modelle ignorieren den Parameter.
    if (modelConfig.reasoning) {
      requestBody.reasoning = modelConfig.reasoning
    }

    const response = await axios.post(OPENROUTER_BASE, requestBody, {
      headers: getOpenRouterHeaders(),
      timeout: 90000 // Reasoning-Modelle brauchen länger
    })

    const choice = response.data.choices?.[0]
    const content = choice?.message?.content ?? null
    const finishReason = choice?.finish_reason ?? null

    const duration = Date.now() - startTime
    console.log(`[Promotion] ${modelConfig.label} via OpenRouter generiert in ${duration}ms (tier: ${tier}, maxTokens: ${budget}, finish_reason: ${finishReason}, usage: ${JSON.stringify(response.data.usage ?? {})})`)

    if (!content) {
      console.warn(`[Promotion] ⚠ Antwort enthielt keinen Text (finish_reason: ${finishReason}) – maxTokens: ${budget}`)
    } else if (finishReason === 'length') {
      console.warn(`[Promotion] ⚠ Antwort abgeschnitten (finish_reason: length) – maxTokens: ${budget}`)
    }

    return { content, finishReason }
  }

  try {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY fehlt')
    }

    let result = await attempt(maxTokens)

    // Auto-Retry: Bei abgeschnittener Antwort ODER leerem Content einmal mit
    // erhöhtem Budget erneut versuchen (Muster aus ai-content.js).
    if (!result.content || result.finishReason === 'length') {
      const retryBudget = maxTokens * RETRY_BUDGET_MULTIPLIER
      console.warn(`[Promotion] Retry mit erhöhtem Token-Budget (${maxTokens} → ${retryBudget})...`)
      result = await attempt(retryBudget)
    }

    return result

  } catch (error) {
    console.error(`[Promotion] KI Fehler mit ${tier} (${modelConfig.id}):`, error.response?.data || error.message)
    throw error
  }
}

export { generateWithKi }
