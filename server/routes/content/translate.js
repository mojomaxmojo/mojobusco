import express from 'express'
import {
  generateTranslationPrompt,
  TRANSLATION_SYSTEM_PROMPT,
} from '../../../src/config/prompts/translation.js'
import { generateWithModel } from '../../services/ai-content.js'

const router = express.Router()

// POST /api/translate-content
// Erzeugt im Hintergrund eine englische (EN) Version eines deutschsprachigen
// Inhalts (Artikel/Platz/Trip/Note). Isolierter Endpunkt – bestehende Routen
// bleiben unangetastet.
router.post('/api/translate-content', async (req, res) => {
  const { title, summary, content, type } = req.body || {}

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'Inhalt (content) ist erforderlich.' })
  }

  // maxTokens dynamisch, analog zu server/routes/content/article.js (Zeile 144)
  const maxTokens = Math.min(4000, Math.ceil(content.length / 3))

  console.log(`[Translate] Starte DE→EN-Übersetzung (type: ${type || 'unbekannt'}, Zeichen: ${content.length}, maxTokens: ${maxTokens})`)

  try {
    const prompt = `${TRANSLATION_SYSTEM_PROMPT}\n\n${generateTranslationPrompt({
      title,
      summary,
      content,
      targetLang: 'en',
      sourceLang: 'de',
    })}`

    const raw = await generateWithModel(prompt, 'medium', 'mojobus', {
      maxTokens,
      temperature: 0.3,
    })
    console.log(`[Translate] KI-Antwort erhalten (${raw.length} Zeichen)`)

    // JSON aus der Antwort parsen (Muster wie in server/routes/tiktok/text.js Zeilen 98–108)
    let result
    try {
      const jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      result = JSON.parse(jsonStr)
    } catch {
      // Fallback: JSON im Text suchen
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        try { result = JSON.parse(match[0]) } catch {}
      }
    }

    if (!result || typeof result.content !== 'string') {
      console.error('[Translate] KI-Antwort konnte nicht geparst werden:', raw.substring(0, 500))
      return res.status(500).json({ error: 'KI-Antwort konnte nicht geparst werden', raw: raw.substring(0, 500) })
    }

    res.json({
      success: true,
      title: typeof result.title === 'string' && result.title ? result.title : (title || ''),
      summary: typeof result.summary === 'string' && result.summary ? result.summary : (summary || ''),
      content: result.content,
    })
  } catch (error) {
    console.error('[Translate] Fehler bei Übersetzung:', error.response?.data || error.message)
    res.status(500).json({ error: 'Fehler bei Übersetzung. Versuche es erneut.' })
  }
})

export default router
