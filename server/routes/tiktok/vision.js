import express from 'express'
import axios from 'axios'
import { VISION_PROMPT } from './config.js'

const router = express.Router()

// ══════════════════════════════════════════════════════════════════════
// POST /api/tiktok/analyze-images
// Analysiert Bild-URLs via Vision-KI (Qwen 2.5 VL → Gemini 2.5 Flash)
// Body: { imageUrls: string[], existingContexts?: string[] }
// Response: { descriptions: string[] }  – eine Beschreibung pro Bild
// ══════════════════════════════════════════════════════════════════════

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions'

function getOpenRouterHeaders() {
  return {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://mojobus.co',
    'X-Title': 'MojoBus',
    'Content-Type': 'application/json'
  }
}

function normalizeDesc(rawDesc) {
  return (rawDesc || '').trim().replace(/\s*\n+\s*/g, ' ')
}

// Eine Bild-URL analysieren – Qwen zuerst, dann Gemini Fallback
async function analyzeOneImage(imageUrl) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn('[Vision] OPENROUTER_API_KEY fehlt')
    return null
  }

  // ── Versuch 1: Qwen 2.5 VL 72B via OpenRouter ─────────────────────────
  try {
    const response = await axios.post(OPENROUTER_BASE, {
      model: 'qwen/qwen2.5-vl-72b-instruct',
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
      headers: getOpenRouterHeaders(),
      timeout: 25000
    })
    const desc = normalizeDesc(response.data.choices[0].message.content)
    console.log(`[Vision] Qwen ✓: "${desc.substring(0, 60)}..."`)
    return desc
  } catch (err) {
    console.warn(`[Vision] Qwen fehlgeschlagen: ${err.response?.data?.error?.message || err.message} → Gemini Fallback`)
  }

  // ── Versuch 2: Gemini 2.5 Flash via OpenRouter ───────────────────────
  try {
    const response = await axios.post(OPENROUTER_BASE, {
      model: 'google/gemini-2.5-flash',
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
      headers: getOpenRouterHeaders(),
      timeout: 25000
    })
    const desc = normalizeDesc(response.data.choices[0].message.content)
    console.log(`[Vision] Gemini ✓: "${desc.substring(0, 60)}..."`)
    return desc
  } catch (err) {
    console.warn(`[Vision] Gemini fehlgeschlagen: ${err.response?.data?.error?.message || err.message}`)
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

  // Bilder sequenziell analysieren (nicht parallel) – verhindert Rate-Limits bei vielen Bildern
  // 300ms Pause zwischen den Requests reicht fuer OpenRouter (1000 req/min Limit)
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

    // 300ms Pause zwischen Requests – OpenRouter Rate-Limit-Schutz
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
