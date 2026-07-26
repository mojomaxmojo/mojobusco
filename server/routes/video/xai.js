import express from 'express'
import axios from 'axios'
import { XAI_LIFESTYLE_MAP } from './helpers.js'

const router = express.Router()

  router.post('/api/generate-video', async (req, res) => {
    const xaiKey = process.env.XAI_API_KEY
    if (!xaiKey) {
      console.error('[Video] XAI_API_KEY fehlt in Umgebungsvariablen')
      return res.status(500).json({ error: 'XAI_API_KEY nicht konfiguriert auf dem Server.' })
    }

    const {
      imageUrl,           // Titelbild-URL → Start-Frame (Image-to-Video)
      referenceImageUrls, // Array von Bild-URLs → Reference-to-Video (mehrere Bilder)
      title,
      summary,
      location,
      country,
      lifestyle,
      tags,
      duration = '10',
      aspectRatio = '16:9',
      mode = 'auto'       // 'auto' | 'image-to-video' | 'reference-to-video' | 'text-to-video'
    } = req.body

    // Dauer validieren: 5–15s
    const resolvedDuration = Math.min(15, Math.max(5, parseInt(String(duration)) || 10))

    // ── Video-Modus bestimmen ──────────────────────────────────────────────
    // reference-to-video: mehrere Referenzbilder → Grok "kennt" die Charaktere
    // image-to-video:     1 Bild als Start-Frame
    // text-to-video:      nur Prompt, kein Bild
    const hasReferenceImages = Array.isArray(referenceImageUrls) && referenceImageUrls.length > 0
    const hasImageUrl = !!imageUrl

    let resolvedMode
    if (mode === 'reference-to-video' && hasReferenceImages) {
      resolvedMode = 'reference-to-video'
    } else if (mode === 'image-to-video' && hasImageUrl) {
      resolvedMode = 'image-to-video'
    } else if (mode === 'text-to-video') {
      resolvedMode = 'text-to-video'
    } else {
      // Auto-Erkennung
      if (hasReferenceImages) {
        resolvedMode = 'reference-to-video'
      } else if (hasImageUrl) {
        resolvedMode = 'image-to-video'
      } else {
        resolvedMode = 'text-to-video'
      }
    }


    const locationText = location ? `, ${location}` : ''
    const countryText = country ? `, ${country}` : ''
    const titleText = title ? `. ${title}` : ''
    const summaryText = summary ? ` ${summary.slice(0, 150)}` : ''
    const tagsText = Array.isArray(tags) && tags.length > 0 ? `. ${tags.slice(0, 5).join(', ')}` : ''

    // Bei reference-to-video: Bilder als <IMAGE_1>, <IMAGE_2> etc. referenzieren
    let referenceNote = ''
    if (resolvedMode === 'reference-to-video' && hasReferenceImages) {
      const imageRefs = referenceImageUrls.map((_, i) => `<IMAGE_${i + 1}>`).join(', ')
      referenceNote = ` Featuring the people and scenes from ${imageRefs}.`
    }

    const videoPrompt = [
      'Cinematic travel video,',
      lifestyleText,
      locationText,
      countryText,
      titleText,
      summaryText,
      referenceNote,
      '. Smooth camera movement, golden hour light, authentic atmosphere',
      tagsText,
      '. High quality, cinematic 720p'
    ].join('').replace(/\s+/g, ' ').trim()

    console.log(`[Video] Starte grok-imagine-video: "${title || 'Kein Titel'}", ${resolvedDuration}s, ${aspectRatio}, Modus: ${resolvedMode}`)
    console.log(`[Video] Prompt: ${videoPrompt.slice(0, 150)}...`)

    // ── xAI API Payload aufbauen ───────────────────────────────────────────
    const xaiPayload = {
      model: 'grok-imagine-video',
      prompt: videoPrompt,
      duration: resolvedDuration,
      aspect_ratio: aspectRatio,
      resolution: '720p'
    }

    // Modus-spezifische Parameter hinzufügen
    if (resolvedMode === 'image-to-video' && hasImageUrl) {
      xaiPayload.image = { url: imageUrl }
    } else if (resolvedMode === 'reference-to-video' && hasReferenceImages) {
      xaiPayload.reference_images = referenceImageUrls.map(url => ({ url }))
    }

    console.log('[Video] xAI Payload:', JSON.stringify({ ...xaiPayload, prompt: xaiPayload.prompt.slice(0, 80) + '...' }))

    try {
      // Schritt 1: Job bei xAI einreichen → bekommt request_id zurück
      const submitRes = await axios.post('https://api.x.ai/v1/videos/generations', xaiPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${xaiKey}`
        },
        timeout: 30000
      })

      const job = submitRes.data
      console.log('[Video] xAI Job-Antwort:', JSON.stringify(job))

      // request_id zurückgeben – Frontend pollt dann /api/video-status/:id
      res.json({
        jobId: job.request_id,
        requestId: job.request_id,
        status: 'pending',
        prompt: videoPrompt,
        mode: resolvedMode,
        sentParams: { duration: resolvedDuration, aspectRatio, resolution: '720p' }
      })

    } catch (error) {
      const rawData = error.response?.data
      const httpStatus = error.response?.status

      console.error('[Video] HTTP Status:', httpStatus)
      console.error('[Video] xAI Antwort (raw):', JSON.stringify(rawData, null, 2))
      console.error('[Video] Axios Fehler:', error.message)

      let errMsg = error.message
      if (rawData) {
        if (typeof rawData === 'string') {
          errMsg = rawData
        } else if (typeof rawData.error === 'string') {
          errMsg = rawData.error
        } else if (rawData.error?.message) {
          errMsg = rawData.error.message
        } else if (typeof rawData.message === 'string') {
          errMsg = rawData.message
        } else {
          errMsg = JSON.stringify(rawData)
        }
      }

      if (httpStatus === 401) {
        res.status(401).json({ error: 'XAI_API_KEY ungültig oder abgelaufen.', detail: errMsg })
      } else if (httpStatus === 402) {
        res.status(402).json({ error: 'Nicht genug Guthaben im xAI Account.', detail: errMsg })
      } else if (httpStatus === 429) {
        res.status(429).json({ error: 'xAI API-Limit erreicht. Bitte kurz warten.', detail: errMsg })
      } else if (httpStatus === 422 || httpStatus === 400) {
        res.status(422).json({ error: `Ungültige Parameter für xAI: ${errMsg}`, detail: errMsg })
      } else {
        res.status(500).json({ error: `Video-Job fehlgeschlagen (HTTP ${httpStatus || 'no-response'}): ${errMsg}` })
      }
    }
  })

  // ===== VIDEO STATUS POLLING (xAI) =====
  // Frontend pollt alle 8 Sekunden bis status === 'done', 'expired' oder 'failed'
  // xAI Status-Werte: 'pending' | 'done' | 'expired' | 'failed'
  router.get('/api/video-status/:jobId', async (req, res) => {
    const xaiKey = process.env.XAI_API_KEY
    if (!xaiKey) {
      return res.status(500).json({ error: 'XAI_API_KEY nicht konfiguriert.' })
    }

    const { jobId } = req.params
    if (!jobId) {
      return res.status(400).json({ error: 'Ungültige Job-ID.' })
    }

    try {
      const pollRes = await axios.get(`https://api.x.ai/v1/videos/${jobId}`, {
        headers: { 'Authorization': `Bearer ${xaiKey}` },
        timeout: 15000
      })

      const data = pollRes.data
      console.log(`[Video] xAI Status für ${jobId}: ${data.status}`)

      if (data.status === 'done' && data.video?.url) {
        res.json({
          status: 'completed',
          videoUrl: data.video.url,
          duration: data.video.duration,
          model: data.model,
          jobId
        })
      } else if (data.status === 'failed') {
        res.json({
          status: 'failed',
          error: data.error || 'Video-Generierung fehlgeschlagen.',
          jobId
        })
      } else if (data.status === 'expired') {
        res.json({
          status: 'failed',
          error: 'xAI Video-Request abgelaufen (expired). Bitte neu starten.',
          jobId
        })
      } else {
        // Status: 'pending' — noch in Bearbeitung
        res.json({
          status: data.status || 'processing',
          jobId
        })
      }

    } catch (error) {
      const rawData = error.response?.data
      const httpStatus = error.response?.status
      let errMsg = error.message
      if (rawData) {
        errMsg = typeof rawData === 'string' ? rawData
          : rawData.error?.message || rawData.error || rawData.message
          || JSON.stringify(rawData)
      }
      console.error(`[Video] Polling-Fehler für ${jobId} (HTTP ${httpStatus}):`, errMsg)
      res.status(500).json({ error: `Status-Abfrage fehlgeschlagen: ${errMsg}` })
    }
  })
  router.post('/api/debug-video', async (req, res) => {
    const xaiKey = process.env.XAI_API_KEY
    if (!xaiKey) return res.status(500).json({ error: 'XAI_API_KEY fehlt' })

    try {
      const payload = {
        model: 'grok-imagine-video',
        prompt: 'Cinematic travel video, vintage bus road trip, smooth camera movement, golden light, 720p',
        duration: 5,
        aspect_ratio: '16:9',
        resolution: '720p'
      }
      if (req.body.imageUrl) {
        payload.image = { url: req.body.imageUrl }
      }
      const response = await axios.post('https://api.x.ai/v1/videos/generations', payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${xaiKey}`
        },
        timeout: 30000
      })
      console.log('[Debug] xAI Erfolg:', JSON.stringify(response.data))
      res.json({ ok: true, data: response.data })
    } catch (error) {
      const rawData = error.response?.data
      console.error('[Debug] xAI Fehler raw:', JSON.stringify(rawData))
      res.status(error.response?.status || 500).json({
        ok: false,
        httpStatus: error.response?.status,
        rawResponse: rawData,
        axiosMessage: error.message
      })
    }
  })

export default router
