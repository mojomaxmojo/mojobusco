import axios from 'axios'
import { getLifestyleConfig } from '../../src/config/prompts/index.js'

// ===== KI-MODELL FUNKTION =====
const generateWithModel = async (prompt, model = 'llama4', lifestyle = 'mojobus', options = {}) => {
  const startTime = Date.now()
  const lifestyleConfig = getLifestyleConfig(lifestyle)

  // Defaults die pro Tab überschrieben werden können
  const maxTokens = options.maxTokens || 700
  const temperature = options.temperature || 0.8

  try {
    if (model === 'claude') {
      // Claude Sonnet über OpenRouter
      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY fehlt')
      }

      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'anthropic/claude-sonnet-5',
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
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://mojobus.co',
          'X-Title': 'MojoBus',
          'Content-Type': 'application/json'
        },
        timeout: 60000
      })

      const duration = Date.now() - startTime
      console.log(`[KI] Claude via OpenRouter generiert in ${duration}ms (maxTokens: ${maxTokens})`)
      return response.data.choices[0].message.content

    } else {
      // Llama 4 Scout (Groq) - Standard
      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'system',
            content: 'Du schreibst wie Foster Huntington. Erste Person. Kurze Sätze. Keine Überschriften, kein Fettdruck, keine Listen. Keine Leseransprache, keine Tipps, keine Ausrufezeichen.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature,
        top_p: 0.9
      }, {
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        timeout: 45000
      })

      const duration = Date.now() - startTime
      console.log(`[KI] Llama 4 Scout generiert in ${duration}ms (maxTokens: ${maxTokens})`)
      return response.data.choices[0].message.content
    }
  } catch (error) {
    console.error(`[KI] Fehler mit ${model}:`, error.response?.data || error.message)
    throw error
  }
}

export { generateWithModel }