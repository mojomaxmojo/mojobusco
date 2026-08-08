import express from 'express'
import {
  generateTranslationPrompt,
  TRANSLATION_SYSTEM_PROMPT,
} from '../../../src/config/prompts/translation.js'
import { generateWithModel } from '../../services/ai-content.js'

const router = express.Router()

/**
 * Wandelt gängige JSON-Escape-Sequenzen (\n, \t, \\, \") in ihre echten
 * Zeichen um. Wird auf Feldwerte angewendet, die per extractField() aus
 * nicht-striktem "JSON" extrahiert wurden (dort bleiben Escapes sonst
 * als literale Backslash-Zeichen im String stehen).
 */
function unescapeJsonLikeString(value) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

/**
 * Extrahiert ein Feld ("title"/"summary"/"content") robust aus einer rohen
 * KI-Antwort, auch wenn der Wert selbst ungeschützte Anführungszeichen enthält
 * (z.B. `"warm" January`), die reguläres JSON.parse zum Scheitern bringen.
 *
 * Nutzt die feste Feldreihenfolge aus dem Prompt (title → summary → content):
 * der Wert reicht vom öffnenden Quote nach dem Feldnamen bis zum letzten
 * Quote vor dem nächsten Feld (bzw. vor dem abschließenden "}" beim letzten
 * Feld).
 */
function extractField(raw, fieldName, nextFieldName) {
  const startMarker = new RegExp(`"${fieldName}"\\s*:\\s*"`)
  const startMatch = startMarker.exec(raw)
  if (!startMatch) return null

  const valueStart = startMatch.index + startMatch[0].length
  let valueEnd

  if (nextFieldName) {
    const nextMarker = new RegExp(`"\\s*,\\s*"${nextFieldName}"\\s*:`)
    const nextMatch = nextMarker.exec(raw.slice(valueStart))
    // Das schließende Quote des aktuellen Werts ist das erste Zeichen des Matches
    valueEnd = nextMatch ? valueStart + nextMatch.index : raw.length
  } else {
    // Letztes Feld: bis zum letzten Quote vor dem abschließenden "}"
    const closing = raw.lastIndexOf('}')
    const searchEnd = closing >= 0 ? closing : raw.length
    const lastQuote = raw.lastIndexOf('"', searchEnd)
    valueEnd = lastQuote > valueStart ? lastQuote : raw.length
  }

  if (valueEnd <= valueStart) return null
  return unescapeJsonLikeString(raw.slice(valueStart, valueEnd))
}

/**
 * Parst die Übersetzungs-Antwort der KI. Versucht zuerst striktes JSON.parse
 * (Idealfall, wenn die KI sauber escaped hat). Schlägt das fehl (z.B. wegen
 * ungeschützter Anführungszeichen im Fließtext), wird jedes Feld einzeln
 * anhand der bekannten Feldreihenfolge extrahiert – ohne dass der Rohtext
 * dafür valides JSON sein muss.
 */
function parseTranslationResponse(raw) {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  // 1. Versuch: striktes JSON.parse
  try {
    return JSON.parse(cleaned)
  } catch {
    // weiter zu Fallbacks
  }

  // 2. Versuch: JSON-Objekt im Text suchen und parsen
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      return JSON.parse(match[0])
    } catch {
      // weiter zu Fallback 3
    }
  }

  // 3. Versuch: Felder einzeln anhand fester Reihenfolge extrahieren.
  // Robust gegen ungeschützte Anführungszeichen innerhalb der Werte.
  const title = extractField(cleaned, 'title', 'summary')
  const summary = extractField(cleaned, 'summary', 'content')
  const content = extractField(cleaned, 'content', null)

  if (content) {
    return {
      title: title || '',
      summary: summary || '',
      content,
    }
  }

  return null
}

// POST /api/translate-content
// Erzeugt im Hintergrund eine englische (EN) Version eines deutschsprachigen
// Inhalts (Artikel/Platz/Trip/Note). Isolierter Endpunkt – bestehende Routen
// bleiben unangetastet.
router.post('/api/translate-content', async (req, res) => {
  const { title, summary, content, type } = req.body || {}

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'Inhalt (content) ist erforderlich.' })
  }

  // maxTokens dynamisch, mit echtem Sicherheitspuffer statt knapper Schätzung.
  // Beobachteter Praxiswert (Log 08.08.): 5047 Zeichen DE-Input brauchten
  // tatsächlich 2178 Completion-Tokens für die EN-Antwort (Verhältnis ~2,32
  // Zeichen/Token) – bei einem völlig normalen 600-Wörter-Artikel mit 6 Bildern,
  // kein Ausreißer. Reine Verhältnis-Divisoren (/3, /2.5) lagen beide unter dem
  // tatsächlichen Bedarf und lösten finish_reason: length aus.
  // Neue Formel: /1.8 (statt /2.5) für ~30% Headroom über dem beobachteten
  // Bedarf + fester Puffer von 400 Tokens für title/summary sowie den
  // zusätzlichen Escaping-Overhead (\") aus der Prompt-Regel. Cap von 4000 auf
  // 8000 angehoben, damit auch lange Artikel (article.js: bis 7500 Tokens
  // Ausgangstext) nicht erneut knapp werden.
  const maxTokens = Math.max(500, Math.min(8000, Math.ceil(content.length / 1.8) + 400))

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
    const result = parseTranslationResponse(raw)

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
