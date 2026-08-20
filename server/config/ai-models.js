/**
 * Zentrale KI-Modell-Verwaltung für MojoBus (Server-Version).
 *
 * Hinweis: Das Frontend verwendet src/config/ai-models.js.
 * Beide Dateien müssen identisch gehalten werden, damit Frontend-Labels
 * und Server-Aufrufe zusammenpassen.
 *
 * Hier kannst du Modell-IDs anpassen, ohne in den Routen suchen zu müssen.
 * Änderungen werden nach Neustart des ai-api-Services aktiv.
 */

/** @typedef {{ id: string, provider: 'openrouter' | 'groq', label: string, supportsReasoning?: boolean, reasoning?: object | false | null }} ModelConfig */

/** @type {Record<'mini'|'medium'|'maxi', ModelConfig>} */
export const TEXT_MODELS = {
  mini: {
    id: 'deepseek/deepseek-v4-pro-0813',
    provider: 'openrouter',
    label: 'deepseek-v4-pro-0813',
    supportsReasoning: true,
    reasoning: { effort: 'none' } // Reasoning komplett aus
  },
  medium: {
    id: 'qwen/qwen3.8-max',
    provider: 'openrouter',
    label: 'qwen3.8-max',
    supportsReasoning: true,
    reasoning: { effort: 'low' } // Reasoning ist fuer dieses Modell Pflicht
  },
  maxi: {
    id: 'anthropic/claude-sonnet-5',
    provider: 'openrouter',
    label: 'Claude Sonnet 5 (Maxi)',
    supportsReasoning: true,
    reasoning: { effort: 'low' }
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
