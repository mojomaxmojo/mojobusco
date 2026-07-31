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

/** @typedef {{ id: string, provider: 'openrouter' | 'groq', label: string }} ModelConfig */

/** @type {Record<'mini'|'medium'|'maxi', ModelConfig>} */
export const TEXT_MODELS = {
  mini: {
    id: 'anthropic/claude-sonnet-5',
    provider: 'openrouter',
    label: 'Claude Sonnet 5 (Mini)'
  },
  medium: {
    id: 'anthropic/claude-sonnet-5',
    provider: 'openrouter',
    label: 'Claude Sonnet 5 (Medium)'
  },
  maxi: {
    id: 'anthropic/claude-sonnet-5',
    provider: 'openrouter',
    label: 'Claude Sonnet 5 (Maxi)'
  }
}

/** @type {ModelConfig} */
export const VISION_PRIMARY_MODEL = {
  id: 'google/gemini-2.5-flash',
  provider: 'openrouter',
  label: 'Gemini 2.5 Flash'
}

/** @type {ModelConfig | null} */
export const VISION_FALLBACK_MODEL = {
  id: 'qwen/qwen2.5-vl-72b-instruct',
  provider: 'openrouter',
  label: 'Qwen 2.5 VL 72B'
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
  return models
}
