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
  // reasoningOverride: explizite Reasoning-Einstellung fuer diesen Versuch
  // (z.B. { enabled: false } beim finalen Fallback fuer Reasoning-Modelle).
  const attempt = async (maxTokens, reasoningOverride) => {
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
    if (reasoningOverride !== undefined ? reasoningOverride : reasoning) {
      requestBody.reasoning = reasoningOverride !== undefined ? reasoningOverride : reasoning
    }
    // Optionaler Plugins-Passthrough (z.B. [{ id: 'web' }] für :online-Suche)
    if (options.plugins) requestBody.plugins = options.plugins

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
    // Content-Reasoning-Anteil aus dem Usage (wenn vorhanden)
    const reasoningTokens = response.data.usage?.completion_tokens_details?.reasoning_tokens || 0
    return { content, finishReason, reasoningTokens }
  }

  // Mindest-Budget fuer Modelle mit aktivem Reasoning: Reasoning verbraucht
  // Tokens vor dem eigentlichen Content, ein zu kleines max_tokens fuehrt zu
  // content: null (alles geht fuer Thinking drauf).
  const REASONING_MIN_TOKENS = 1500

  // Hartes Limit fuer Reasoning-Tokens im Fallback: Damit bleibt auch bei
  // Modellen mit Pflicht-Reasoning garantiert Budget fuer den eigentlichen
  // Content uebrig.
  const REASONING_CAP = 512

  try {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY fehlt')
    }

    // Bei Reasoning-Modellen Budget mindestens auf das Reasoning-Minimum anheben
    const effectiveBaseTokens = reasoning
      ? Math.max(baseMaxTokens, REASONING_MIN_TOKENS)
      : baseMaxTokens

    let result = await attempt(effectiveBaseTokens)

    // Hat das Reasoning das komplette Budget verschlungen? Dann hilft eine
    // Budget-Erhoehung nicht (das Thinking skaliert mit dem Budget) und wir
    // springen direkt zum gedeckelten Reasoning.
    const reasoningAteBudget = reasoning &&
      result.reasoningTokens > 0 &&
      !result.content &&
      result.finishReason === 'length'

    if (reasoningAteBudget) {
      console.warn(`[KI] Reasoning hat komplettes Budget verbraucht (${result.reasoningTokens} Tokens), direkt Retry mit gedeckeltem Reasoning (reasoning.max_tokens: ${REASONING_CAP})...`)
      try {
        result = await attempt(effectiveBaseTokens, { max_tokens: REASONING_CAP })
      } catch (capError) {
        // Manche Endpoints erlauben kein reasoning.max_tokens -> Versuch mit
        // komplett deaktiviertem Reasoning. Scheitert auch das (z.B. "Reasoning
        // is mandatory"), brechen wir sauber mit dem Original-Fehler ab.
        console.warn(`[KI] reasoning.max_tokens nicht unterstuetzt, Retry mit deaktiviertem Reasoning...`)
        try {
          result = await attempt(effectiveBaseTokens, { enabled: false })
        } catch (disableError) {
          throw capError
        }
      }
    }

    // Auto-Retry: Bei abgeschnittener Antwort ODER leerem Content einmal mit
    // erhoehtem Budget erneut versuchen (ausser Reasoning hat alles gefressen,
    // dann wurde oben schon mit gedeckeltem Reasoning wiederholt).
    if ((result.finishReason === 'length' || !result.content) && !reasoningAteBudget) {
      const retryMaxTokens = Math.round(effectiveBaseTokens * MAX_RETRY_MULTIPLIER)
      console.warn(`[KI] Retry mit erhoehtem Token-Budget (maxTokens: ${effectiveBaseTokens} -> ${retryMaxTokens})...`)
      result = await attempt(retryMaxTokens)
    }

    // Letzter Fallback (falls der erste Direkt-Fallback nicht griff): Reasoning
    // hart deckeln, damit garantiert Content-Tokens uebrig bleiben. Grund:
    // Manche Endpoints (z.B. glm-5.3-flash) haben PFLICHT-Reasoning
    // ("Reasoning is mandatory") und skalieren das Thinking mit dem Budget -
    // dort frisst das Reasoning sonst ALLE Tokens.
    if (!result.content && reasoning) {
      console.warn(`[KI] Finaler Retry mit gedeckeltem Reasoning (maxTokens: ${effectiveBaseTokens}, reasoning.max_tokens: ${REASONING_CAP})...`)
      try {
        result = await attempt(effectiveBaseTokens, { max_tokens: REASONING_CAP })
      } catch (capError) {
        console.warn(`[KI] reasoning.max_tokens nicht unterstuetzt, Retry mit deaktiviertem Reasoning...`)
        try {
          result = await attempt(effectiveBaseTokens, { enabled: false })
        } catch (disableError) {
          throw capError
        }
      }
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
