/**
 * Zentrale KI-Modell-Verwaltung für MojoBus (Frontend-Version).
 *
 * Hinweis: Der ai-api-Server verwendet server/config/ai-models.js.
 * Beide Dateien müssen identisch gehalten werden, damit Frontend-Labels
 * und Server-Aufrufe zusammenpassen.
 *
 * Hier kannst du Modell-IDs anpassen, ohne in den Routen suchen zu müssen.
 * Änderungen werden nach einem neuen Build + Deploy aktiv.
 */

/** @typedef {{ id: string, provider: 'openrouter' | 'groq', label: string, supportsReasoning?: boolean, reasoning?: object | false | null, tokenBudgets?: Record<string, number | Record<string, number>> }} ModelConfig */

/** @type {Record<'mini'|'medium'|'maxi', ModelConfig>} */
export const TEXT_MODELS = {
  mini: {
    id: 'deepseek/deepseek-v4-pro-0813',
    provider: 'openrouter',
    label: 'DeepSeek V4 Pro 0813 (Mini)',
    supportsReasoning: true,
    reasoning: { effort: 'none' }, // Reasoning komplett aus
    tokenBudgets: {
      article: { short: 2500, medium: 5000, long: 7500 },
      trip: { short: 500, medium: 1400, long: 2800 },
      caption: 150,
      summary: 400,
      titles: 400,
      note: 150,
      place: 300,
      media: 200,
      default: 1000
    }
  },
  medium: {
    id: 'anthropic/claude-sonnet-5',
    provider: 'openrouter',
    label: 'Claude Sonnet 5 (Medium)',
    supportsReasoning: true,
    reasoning: { effort: 'low' },
    tokenBudgets: {
      article: { short: 2500, medium: 5000, long: 7500 },
      trip: { short: 500, medium: 1400, long: 2800 },
      caption: 150,
      summary: 400,
      titles: 400,
      note: 200,
      place: 400,
      media: 250,
      default: 1000
    }
  },
  maxi: {
    id: 'anthropic/claude-opus-5',
    provider: 'openrouter',
    label: 'Claude Opus 5 (Maxi)',
    supportsReasoning: true,
    reasoning: { effort: 'low' },
    tokenBudgets: {
      article: { short: 2500, medium: 5000, long: 7500 },
      trip: { short: 500, medium: 1400, long: 2800 },
      caption: 150,
      summary: 400,
      titles: 400,
      note: 200,
      place: 400,
      media: 250,
      default: 1000
    }
  }
}

/** @type {ModelConfig} */
export const VISION_PRIMARY_MODEL = {
  id: 'openai/gpt-4o-mini-2024-07-18',
  provider: 'openrouter',
  label: 'GPT-4o mini (2024-07-18)'
}

/** @type {ModelConfig | null} */
export const VISION_FALLBACK_MODEL = {
  id: 'google/gemini-3-flash-preview',
  provider: 'openrouter',
  label: 'Gemini 3 Flash Preview'
}

/** @type {ModelConfig | null} */
export const VISION_SECONDARY_FALLBACK_MODEL = {
  id: 'google/gemini-2.5-flash',
  provider: 'openrouter',
  label: 'Gemini 2.5 Flash'
}

/** Standard-Modellstufe für Textgenerierung */
export const DEFAULT_TEXT_MODEL = 'medium'

/** Erlaubte Werte für den Frontend-Modell-Switcher */
export const VALID_TEXT_MODELS = Object.keys(TEXT_MODELS)

/**
 * Prüft, ob ein übergebenes Modell gültig ist, und gibt einen gültigen Wert zurück.
 * @param {string} model
 * @returns {'mini'|'medium'|'maxi'}
 */
export function normalizeTextModel(model) {
  if (VALID_TEXT_MODELS.includes(model)) {
    return /** @type {'mini'|'medium'|'maxi'} */ (model)
  }
  return DEFAULT_TEXT_MODEL
}

/**
 * Liefert die OpenRouter- oder Groq-Modell-ID für eine gewählte Stufe.
 * @param {'mini'|'medium'|'maxi'} tier
 * @returns {ModelConfig}
 */
export function getTextModel(tier) {
  return TEXT_MODELS[normalizeTextModel(tier)]
}

/**
 * Liefert das Token-Budget fuer einen bestimmten Use-Case.
 * Unterstuetzt sowohl einfache Zahlen als auch Objekte mit articleLength.
 *
 * @param {'mini'|'medium'|'maxi'} tier
 * @param {string} useCase - z.B. 'article', 'summary', 'titles', 'note', 'place', 'media'
 * @param {'short'|'medium'|'long'} [articleLength='medium'] - Nur relevant fuer 'article'
 * @param {number} [fallback] - Fallback wenn kein Budget definiert
 * @returns {number}
 */
export function getMaxTokens(tier, useCase, articleLength = 'medium', fallback = 1000) {
  const config = getTextModel(tier)
  const budgets = config.tokenBudgets || {}
  const budget = budgets[useCase] ?? budgets.default ?? fallback

  if (budget && typeof budget === 'object' && !Array.isArray(budget)) {
    return budget[articleLength] ?? budget.medium ?? budget.short ?? budget.long ?? fallback
  }

  return typeof budget === 'number' ? budget : fallback
}

/**
 * Alle Vision-Modelle als Fallback-Kette.
 * @returns {ModelConfig[]}
 */
export function getVisionModels() {
  const models = [VISION_PRIMARY_MODEL]
  if (VISION_FALLBACK_MODEL) {
    models.push(VISION_FALLBACK_MODEL)
  }
  if (VISION_SECONDARY_FALLBACK_MODEL) {
    models.push(VISION_SECONDARY_FALLBACK_MODEL)
  }
  return models
}
