import axios from 'axios'

/**
 * Generiert Text mit dem gewählten KI-Modell
 *
 * @param {string} prompt
 * @param {string} systemPrompt
 * @param {string} model - 'llama4' | 'claude'
 * @param {number} maxTokens
 * @param {number} temperature
 * @returns {Promise<string>}
 */
const generateWithKi = async (prompt, systemPrompt, model = 'llama4', maxTokens = 500, temperature = 0.8) => {
  const startTime = Date.now()

  try {
    if (model === 'claude') {
      // Claude Sonnet über OpenRouter
      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY fehlt')
      }

      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: '~anthropic/claude-sonnet-latest',
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
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
      console.log(`[Promotion] Claude via OpenRouter generiert in ${duration}ms`)
      return response.data.choices[0].message.content

    } else {
      // Llama 4 Scout (Groq) - Standard
      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
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
      console.log(`[Promotion] Llama 4 Scout generiert in ${duration}ms`)
      return response.data.choices[0].message.content
    }
  } catch (error) {
    console.error(`[Promotion] KI Fehler mit ${model}:`, error.response?.data || error.message)
    throw error
  }
}

export { generateWithKi }
