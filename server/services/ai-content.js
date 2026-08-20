import axios from 'axios'
import { getLifestyleConfig } from '../../src/config/prompts/index.js'
import { getTextModel, normalizeTextModel, getMaxTokens } from '../config/ai-models.js'

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

  const tier = normalizeTextModel(model)
  const modelConfig = getTextModel(tier)

  // Defaults die pro Tab überschrieben werden können
  const useCase = options.useCase || 'default'
  const articleLength = options.articleLength || options.variant || 'medium'
  const baseMaxTokens = options.maxTokens || getMaxTokens(tier, useCase, articleLength, 700)
  const temperature = options.temperature || 0.8
  const callTimeout = options.timeout || 60000

  // Reasoning-Steuerung:
  // 1. Option aus dem Aufruf hat hoechste Prioritaet
  // 2. Sonst: Konfiguration aus ai-models.js (ModelConfig.reasoning)
  // 3. false / null / undefined => KEIN reasoning-Feld senden
  const modelReasoning = modelConfig.reasoning
  const reasoning = options.reasoning !== undefined
    ? options.reasoning
    : (modelReasoning !== false && modelReasoning !== null && modelReasoning !== undefined
        ? modelReasoning
        : undefined)

  // Ein einzelner Modell-Aufruf mit einem konkreten Token-Budget.
  const attempt = async (maxTokens) => {
    const requestBody = {
      model: modelConfig.id,
      max_tokens: maxTokens,
      temperature,
      messages: [
        {
          role: 'system',
          content: `Du schreibst wie Foster Huntington. Erste Person. Kurze Saetze. Keine Ueberschriften, kein Fettdruck, keine Listen. Keine Leseransprache, keine Tipps, keine Ausrufezeichen.`
        },
        { role: 'user', content: prompt }
      ]
    }
    if (reasoning) {
      requestBody.reasoning = reasoning
    }

    const response = await axios.post(OPENROUTER_BASE, requestBody, {
      headers: getOpenRouterHeaders(),
      timeout: callTimeout
    })

    const duration = Date.now() - startTime
    const content = response.data.choices?.[0]?.message?.content
    console.log(`[KI] ${modelConfig.label} via OpenRouter generiert in ${duration}ms (tier: ${tier}, maxTokens: ${maxTokens}, content: ${content ? 'yes' : 'NULL'})`)

    const finishReason = response.data.choices?.[0]?.finish_reason
    const usage = response.data.usage
    if (!content) {
      console.warn(`[KI] ⚠ Antwort enthielt keinen Text (content: null)! tier: ${tier}, maxTokens: ${maxTokens}, finish_reason: ${finishReason}, usage: ${JSON.stringify(usage)}`)
    } else if (finishReason === 'length') {
      console.warn(`[KI] ⚠ Antwort abgeschnitten (finish_reason: length)! tier: ${tier}, maxTokens: ${maxTokens}, usage: ${JSON.stringify(usage)}`)
    } else {
      console.log(`[KI] finish_reason: ${finishReason}, usage: ${JSON.stringify(usage)}`)
    }
    return { content, finishReason }
  }

  try {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY fehlt')
    }

    let result = await attempt(baseMaxTokens)

    // Auto-Retry: Bei abgeschnittener Antwort ODER leerem Content einmal mit
    // erhoehtem Budget erneut versuchen.
    if (result.finishReason === 'length' || !result.content) {
      const retryMaxTokens = Math.round(baseMaxTokens * MAX_RETRY_MULTIPLIER)
      console.warn(`[KI] Retry mit erhoehtem Token-Budget (maxTokens: ${baseMaxTokens} -> ${retryMaxTokens})...`)
      result = await attempt(retryMaxTokens)
    }

    if (!result.content) {
      throw new Error(`KI-Antwort enthielt keinen Text (content: null). Model: ${modelConfig.id}, tier: ${tier}. Wahrscheinlich wurden alle Tokens fuer Reasoning verwendet.`)
    }

    return result.content

  } catch (error) {
    console.error(`[KI] Fehler mit ${tier} (${modelConfig.id}):`, error.response?.data || error.message)
    throw error
  }
}

export { generateWithModel }
