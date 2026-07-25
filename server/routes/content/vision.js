import axios from 'axios'

/**
 * Analysiert ein Base64-kodiertes Bild via Groq Llama 4 Scout Vision.
 *
 * @param {string} base64
 * @param {string} mimeType
 * @param {string} analysisPrompt
 * @param {number} maxTokens
 * @returns {Promise<string>}
 */
export async function analyzeImageBase64(base64, mimeType, analysisPrompt, maxTokens = 150) {
  const visionResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: analysisPrompt },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
      ]
    }],
    max_tokens: maxTokens,
    temperature: 0.7
  }, {
    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    timeout: 30000
  })
  return visionResponse.data.choices[0].message.content
}

export default { analyzeImageBase64 }
