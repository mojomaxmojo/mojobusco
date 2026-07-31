import express from 'express'
import axios from 'axios'
import { VISION_PROMPT } from './config.js'
import { getVisionModels } from '../../config/ai-models.js'

const router = express.Router()

// ══════════════════════════════════════════════════════════════════════
// POST /api/tiktok/analyze-images
// Analysiert Bild-URLs via Vision-KI (zentral konfiguriert in src/config/ai-models.js)
// Body: { imageUrls: string[], existingContexts?: string[] }
// Response: { descriptions: string[] }  – eine Beschreibung pro Bild
// ══════════════════════════════════════════════════════════════════════

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions'

/** Maximale parallel laufende Vision-Requests gegen OpenRouter */
const VISION_CONCURRENCY = 3

/** Pause zwischen zwei Requests im SELBEN Slot (Rate-Limit-Schutz) */
const REQUEST_GAP_MS = 300

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

/**
 * Führt eine Sammlung von Aufgaben mit begrenzter Parallelität aus.
 * Arbeitet Promise-basiert ab, ohne externe Dependencies.
 */
function withConcurrency(limit) {
  return async function run(tasks) {
    const results = new Array(tasks.length)
    const iterator = tasks.entries()
    let running = 0

    return new Promise((resolve, reject) => {
      function next() {
        while (running < limit) {
          const { value, done } = iterator.next()
          if (done) {
            if (running === 0) resolve(results)
            return
          }
          const [idx, task] = value
          running++
          Promise.resolve(task()).then(
            (result) => {
              results[idx] = result
              running--
              next()
            },
            (err) => {
              running--
              reject(err)
            }
          )
        }
      }
      next()
    })
  }
}

// Eine Bild-URL analysieren – konfigurierte Vision-Modelle nacheinander probieren
async function analyzeOneImage(imageUrl, signal) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn('[Vision] OPENROUTER_API_KEY fehlt')
    return null
  }

  const visionModels = getVisionModels()

  for (let i = 0; i < visionModels.length; i++) {
    if (signal?.aborted) {
      console.log('[Vision] Analyse abgebrochen (Client-Disconnect)')
      return null
    }

    const modelConfig = visionModels[i]
    const isLast = i === visionModels.length - 1
    try {
      const response = await axios.post(OPENROUTER_BASE, {
        model: modelConfig.id,
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
      console.log(`[Vision] ${modelConfig.label} ✓: "${desc.substring(0, 60)}..."`)
      return desc
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message
      const nextHint = isLast ? 'kein Fallback verfügbar' : `Fallback ${visionModels[i + 1].label}`
      console.warn(`[Vision] ${modelConfig.label} fehlgeschlagen: ${msg} → ${nextHint}`)
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

  // Abort-Signal: breche laufende Vision-Requests ab, wenn der Client disconnected
  const abortController = new AbortController()
  function onClientDisconnect() {
    console.log('[Vision] Client-Verbindung geschlossen → breche Analyse ab')
    abortController.abort()
  }
  req.on('close', onClientDisconnect)
  req.on('error', onClientDisconnect)

  // Slot-basierte Verzögerung: pro Worker-Slot wird vor jedem Request kurz gewartet.
  // Das hält den Rate-Limit-Schutz bei, auch wenn mehrere Bilder parallel laufen.
  const slotDelays = new Array(VISION_CONCURRENCY).fill(0)

  const tasks = []
  for (let i = 0; i < maxImages; i++) {
    const slot = i % VISION_CONCURRENCY
    tasks.push(async () => {
      const url = imageUrls[i]
      const existing = existingContexts[i]

      // Vorhandener Kontext → ueberspringen
      if (existing && existing.trim() && existing.trim().length > 10) {
        console.log(`[Vision] Bild ${i + 1}: übersprungen (vorhandener Kontext: "${existing.substring(0, 40)}")`)
        return { idx: i, desc: existing, source: 'cache' }
      }

      // Video-URLs überspringen
      if (/\.(mp4|webm|mov|avi|mkv)(\?|#|$)/i.test(url)) {
        console.log(`[Vision] Bild ${i + 1}: Video übersprungen`)
        return { idx: i, desc: existingContexts[i] || 'Video-Clip', source: 'skip' }
      }

      // Slot-basierte Verzögerung (pro Slot nacheinander, nicht global)
      const delay = slotDelays[slot]
      slotDelays[slot] += REQUEST_GAP_MS
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      const desc = await analyzeOneImage(url, abortController.signal)
      return { idx: i, desc: desc || existingContexts[i] || '', source: desc ? 'ki' : 'fallback' }
    })
  }

  let descriptions = []
  try {
    const results = await withConcurrency(VISION_CONCURRENCY)(tasks)
    descriptions = results
      .sort((a, b) => a.idx - b.idx)
      .map(r => r.desc)
  } catch (err) {
    console.error('[Vision] Fehler während der Analyse:', err.message || err)
    // Bereits berechnete Ergebnisse zurückgeben, wenn möglich
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Vision-Analyse fehlgeschlagen' })
    }
    return
  }

  // Listener aufräumen
  req.removeListener('close', onClientDisconnect)
  req.removeListener('error', onClientDisconnect)

  const duration = Date.now() - startTime

  // Falls der Client bereits abgebrochen hat, nichts mehr zurücksenden
  if (abortController.signal.aborted) {
    if (!res.headersSent) {
      return res.status(499).json({ error: 'Client hat die Verbindung geschlossen' })
    }
    return
  }

  // Log: Zusammenfassung
  const analyzed = descriptions.filter((d, i) => d && (!existingContexts[i] || existingContexts[i].length <= 10)).length
  console.log(`[Vision] ✅ ${maxImages} Bilder analysiert in ${duration}ms (${analyzed} via KI, ${maxImages - analyzed} aus Cache)`)
  descriptions.forEach((d, i) => console.log(`[Vision] Bild ${i + 1}: "${(d || '').substring(0, 60)}"`))

  res.json({ descriptions, durationMs: duration })
})

export { analyzeOneImage }
export default router
