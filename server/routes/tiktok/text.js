import express from 'express'
import axios from 'axios'
import { generateTikTokUserPrompt, FOSTER_HUNTINGTON_SYSTEM_PROMPT } from '../../../src/config/prompts/index.js'
import { getTextModel, normalizeTextModel } from '../../../src/config/ai-models.js'

const router = express.Router()

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions'

function getOpenRouterHeaders() {
  return {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://mojobus.co',
    'X-Title': 'MojoBus',
    'Content-Type': 'application/json'
  }
}

// ═══════════════════════════════════════════════════════════
// TIKTOK TEXT GENERATOR – spezifisch für Vanlife-Videos
// ═══════════════════════════════════════════════════════════
// POST /api/tiktok/generate-text
// Body: { title, summary, text, template?, model? }
// Antwort: { hook, bodyLines[], bridge, cta, hashtags[] }
// ═══════════════════════════════════════════════════════════

router.post('/api/tiktok/generate-text', async (req, res) => {
  const {
    title,
    summary,
    text,
    template = 'story',
    model = 'medium',
    imageCount = 5,
    locations,
    imageContexts,       // neu: 1 Kontext pro Bild in sortierter Reihenfolge
    voiceoverEnabled = false,
    platform = 'tiktok',
  } = req.body

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Titel ist erforderlich' })
  }

  const tier = normalizeTextModel(model)
  const modelConfig = getTextModel(tier)

  const hasImageContexts = Array.isArray(imageContexts) && imageContexts.some(c => c && c.trim())
  console.log(`[TikTok] Generiere Text: platform=${platform}, template=${template}, tier=${tier}, model=${modelConfig.id}, title="${title.substring(0, 60)}", images=${imageCount}, voiceover=${voiceoverEnabled}, imageContexts=${hasImageContexts ? imageContexts.length : 0}`)

  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY nicht konfiguriert' })
    }

    // User-Prompt aus tiktok.js generieren (statt hartcodiertem String)
    const userPrompt = generateTikTokUserPrompt({
      title,
      summary: summary || '',
      text: text || '',
      template,
      imageCount,
      locations: locations || [],
      imageContexts: imageContexts || [],
      voiceoverMode: voiceoverEnabled === true,
      platform,
    })

    const callAi = async (mdl) => {
      const resp = await axios.post(OPENROUTER_BASE, {
        model: mdl,
        messages: [
          { role: 'system', content: FOSTER_HUNTINGTON_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 16384, // Reasoning-Modelle: Denk-Budget + JSON-Antwort
        temperature: 0.8,
        top_p: 0.9,
        // Reasoning-Budget klein halten – Foster-Texte brauchen Stil, kein Nachdenken.
        // Nicht-Reasoning-Modelle ignorieren den Parameter.
        reasoning: { effort: 'low' }
      }, {
        headers: getOpenRouterHeaders(),
        timeout: 90000 // Reasoning-Modelle brauchen länger
      })
      return resp
    }

    let response = await callAi(modelConfig.id)
    let rawText = response.data.choices?.[0]?.message?.content

    if (!rawText) {
      const reason = response.data.choices?.[0]?.finish_reason || 'unknown'
      console.error(`[TikTok] KI-Antwort leer (finish_reason: ${reason}), volle Response:`, JSON.stringify(response.data).substring(0, 500))
      return res.status(500).json({ error: `KI-Antwort leer (finish_reason: ${reason}). Bitte erneut versuchen.` })
    }
    console.log(`[TikTok] KI-Antwort erhalten (${rawText.length} Zeichen, finish_reason: ${response.data.choices?.[0]?.finish_reason}, model: ${response.data.model || modelConfig.id})`)

    // JSON aus Antwort parsen
    let result
    try {
      const jsonStr = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      result = JSON.parse(jsonStr)
    } catch {
      // Fallback: JSON im Text suchen
      const match = rawText.match(/\{[\s\S]*\}/)
      if (match) {
        try { result = JSON.parse(match[0]) } catch {}
      }
    }

    if (!result) {
      return res.status(500).json({ error: 'KI-Antwort konnte nicht geparst werden', raw: rawText.substring(0, 500) })
    }

    // ── bodyLines bereinigen: POSITIONS-ERHALTEND (1 Zeile = 1 Bild) ─────
    const rawLines = Array.isArray(result.bodyLines) ? result.bodyLines : [summary || '']

    // Satz-Splitter: "A. B. C." → ["A.", "B.", "C."]
    const splitIntoSentences = (text) => {
      if (!text || !text.trim()) return []
      const parts = text.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ"„])/)
      return parts.map(s => s.trim()).filter(Boolean)
    }

    // Pro Zeile: mehrere Sätze zu EINEM Gedanken verbinden.
    const mergeToOneThought = (line, isLast) => {
      if (!line || !line.trim()) return ''
      const trimmed = line.trim()
      if (isLast) return trimmed
      const sentences = splitIntoSentences(trimmed)
      if (sentences.length <= 1) return trimmed
      return sentences
        .map((s, i) => i < sentences.length - 1 ? s.replace(/[.!?]+$/, '') : s)
        .join(' – ')
    }

    let cleanBodyLines = rawLines.map((line, i) =>
      mergeToOneThought(line, i === rawLines.length - 1)
    )

    // Erkennung: KI hat Bild 1 für den Hook "verbraucht"
    const hookConsumedBild1 = cleanBodyLines.length === imageCount - 1
    if (hookConsumedBild1 && result.hook && result.hook.trim()) {
      console.log(`[TikTok] ⚠️ KI hat Bild 1 für Hook verbraucht (${cleanBodyLines.length} statt ${imageCount} bodyLines) → Hook als bodyLines[0] eingesetzt`)
      cleanBodyLines.unshift(result.hook.trim())
    }

    // Auf exakt imageCount Zeilen bringen
    if (cleanBodyLines.length > imageCount) {
      console.log(`[TikTok] ⚠️ ${cleanBodyLines.length} Zeilen für ${imageCount} Bilder → überzählige hinten abgeschnitten`)
      cleanBodyLines = cleanBodyLines.slice(0, imageCount)
    }
    while (cleanBodyLines.length < imageCount) {
      cleanBodyLines.push('')
    }

    console.log(`[TikTok] Generiert: hook="${(result.hook || '').substring(0, 50)}", bodyLines=${rawLines.length}→${cleanBodyLines.length}/${imageCount}${hookConsumedBild1 ? ' [Bild1-Fix]' : ''}`)
    if (rawLines.length !== cleanBodyLines.length || hookConsumedBild1) {
      console.log(`[TikTok] bodyLines final: ${cleanBodyLines.map(l => `"${l.substring(0, 35)}"`).join(' | ')}`)
    }

    // ── hookAlternatives bereinigen (A/B-Auswahl im Dashboard) ──────────
    const mainHook = (result.hook || '').trim().toLowerCase()
    const hookAlternatives = (Array.isArray(result.hookAlternatives) ? result.hookAlternatives : [])
      .map(h => (typeof h === 'string' ? h.trim() : ''))
      .filter(h => h && h.toLowerCase() !== mainHook)
      .filter((h, i, arr) => arr.findIndex(x => x.toLowerCase() === h.toLowerCase()) === i)
      .slice(0, 2)
    if (hookAlternatives.length > 0) {
      console.log(`[TikTok] Hook-Alternativen: ${hookAlternatives.map(h => `"${h.substring(0, 40)}"`).join(' | ')}`)
    }

    res.json({
      success: true,
      hook: result.hook || title,
      hookAlternatives,
      bodyLines: cleanBodyLines,
      bridge: result.bridge || 'Mehr auf mojobus.co',
      cta: result.cta || 'Link in Bio 📌',
      thumbnail: result.thumbnail || '',
      hashtags: Array.isArray(result.hashtags) ? result.hashtags : ['#vanlife', '#mojobus'],
    })

  } catch (err) {
    console.error('[TikTok] Fehler:', err.response?.data || err.message)
    res.status(500).json({ error: err.message || 'Generierung fehlgeschlagen' })
  }
})

export default router
