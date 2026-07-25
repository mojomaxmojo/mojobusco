import express from 'express'
import axios from 'axios'
import { VISION_PROMPT } from './config.js'

const router = express.Router()

// ══════════════════════════════════════════════════════════════════════
// POST /api/tiktok/analyze-images
// Analysiert Bild-URLs via Vision-KI (Groq → OpenRouter Fallback)
// Body: { imageUrls: string[], existingContexts?: string[] }
// Response: { descriptions: string[] }  – eine Beschreibung pro Bild
// ══════════════════════════════════════════════════════════════════════

// Eine Bild-URL analysieren – Groq Vision zuerst, dann OpenRouter Fallback
async function analyzeOneImage(imageUrl, preferredModel = 'groq') {
  // ── Versuch 1: Groq (Llama 4 Scout Vision) – kostenlos ──────────────
  if (preferredModel !== 'claude' && process.env.GROQ_API_KEY) {
    try {
      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: VISION_PROMPT },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }],
        max_tokens: 120,
        temperature: 0.2,
      }, {
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        timeout: 20000
      })
      // Zeilenumbrüche entfernen: mehrzeilige Beschreibungen zerschießen
      // die "Bild N: ..."-Struktur im Text-Prompt
      const desc = response.data.choices[0].message.content.trim().replace(/\s*\n+\s*/g, ' ')
      console.log(`[Vision] Groq ✓: "${desc.substring(0, 60)}..."`)
      return desc
    } catch (err) {
      console.warn(`[Vision] Groq fehlgeschlagen: ${err.response?.data?.error?.message || err.message} → Claude Fallback`)
    }
  }

  // ── Versuch 2: Claude Sonnet via OpenRouter – Fallback ───────────────
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'anthropic/claude-sonnet-5',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: VISION_PROMPT },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }],
        max_tokens: 120,
        temperature: 0.2,
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://mojobus.co',
          'X-Title': 'MojoBus',
          'Content-Type': 'application/json'
        },
        timeout: 25000
      })
      const desc = response.data.choices[0].message.content.trim().replace(/\s*\n+\s*/g, ' ')
      console.log(`[Vision] Claude ✓: "${desc.substring(0, 60)}..."`)
      return desc
    } catch (err) {
      console.warn(`[Vision] Claude fehlgeschlagen: ${err.response?.data?.error?.message || err.message}`)
    }
  }

  return null // kein Vision verfügbar
}

router.post('/api/tiktok/analyze-images', async (req, res) => {
  const { imageUrls, existingContexts = [] } = req.body

  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return res.status(400).json({ error: 'imageUrls fehlt oder leer' })
  }

  const maxImages = Math.min(imageUrls.length, 20)
  console.log(`[Vision] Analysiere ${maxImages} Bilder...`)
  const startTime = Date.now()

  // Bilder sequenziell analysieren (nicht parallel) – verhindert Groq Rate-Limit bei vielen Bildern
  // 300ms Pause zwischen den Requests reicht fuer Groq (1000 req/min Limit)
  const descriptions = []
  for (let i = 0; i < maxImages; i++) {
    const url = imageUrls[i]
    const existing = existingContexts[i]

    // Vorhandener Kontext → ueberspringen
    if (existing && existing.trim() && existing.trim().length > 10) {
      console.log(`[Vision] Bild ${i + 1}: übersprungen (vorhandener Kontext: "${existing.substring(0, 40)}")`)
      descriptions.push(existing)
      continue
    }

    // Video-URLs überspringen
    if (/\.(mp4|webm|mov|avi|mkv)(\?|#|$)/i.test(url)) {
      console.log(`[Vision] Bild ${i + 1}: Video übersprungen`)
      descriptions.push(existingContexts[i] || 'Video-Clip')
      continue
    }

    const desc = await analyzeOneImage(url)
    descriptions.push(desc || existingContexts[i] || '')

    // 300ms Pause zwischen Requests – Groq Rate-Limit-Schutz
    if (i < maxImages - 1) {
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }
  const duration = Date.now() - startTime

  // Log: Zusammenfassung
  const analyzed = descriptions.filter((d, i) => d && (!existingContexts[i] || existingContexts[i].length <= 10)).length
  console.log(`[Vision] ✅ ${maxImages} Bilder analysiert in ${duration}ms (${analyzed} via KI, ${maxImages - analyzed} aus Cache)`)
  descriptions.forEach((d, i) => console.log(`[Vision] Bild ${i + 1}: "${(d || '').substring(0, 60)}"`))

  res.json({ descriptions, durationMs: duration })
})

export { analyzeOneImage }
export default router
