import express from 'express'
import axios from 'axios'
import { generateTikTokUserPrompt, FOSTER_HUNTINGTON_SYSTEM_PROMPT } from '../../src/config/prompts/index.js'

const router = express.Router()

// ═══════════════════════════════════════════════════════════
// TIKTOK TEXT GENERATOR – spezifisch für Vanlife-Videos
// ═══════════════════════════════════════════════════════════
// POST /api/tiktok/generate-text
// Body: { title, summary, text, template?, model? }
// Antwort: { hook, bodyLines[], bridge, cta, hashtags[] }
// ═══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════
// POST /api/tiktok/analyze-images
// Analysiert Bild-URLs via Vision-KI (Groq → OpenRouter Fallback)
// Body: { imageUrls: string[], existingContexts?: string[] }
// Response: { descriptions: string[] }  – eine Beschreibung pro Bild
// ══════════════════════════════════════════════════════════════════════

// Vision-Prompt: sachlich, kurz, für Foster-Stil nutzbar
const VISION_PROMPT = `Beschreibe dieses Bild sachlich in 1-2 kurzen Sätzen.
Was ist das Hauptmotiv? (Tier, Pflanze, Landschaft, Mensch, Objekt, Fahrzeug)
Was fällt sofort auf? Farbe, Licht, Stimmung, Besonderheit.
Kein Urteil, keine Bewertung. Nur was sichtbar ist.
Beispiel: "Braune Gottesanbeterin auf einem Kaktus. Makro-Aufnahme, warmes Seitenlicht."
Antwort: NUR die Beschreibung, kein Intro, kein "Das Bild zeigt".`

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

// ── System-Prompt aus src/config/prompts/tiktok.js ─────────────────────

router.post('/api/tiktok/generate-text', async (req, res) => {
  const {
    title,
    summary,
    text,
    template = 'story',
    model = 'claude',
    imageCount = 5,
    locations,
    imageContexts,       // neu: 1 Kontext pro Bild in sortierter Reihenfolge
    voiceoverEnabled = false,
    platform = 'tiktok',
  } = req.body

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Titel ist erforderlich' })
  }

  const hasImageContexts = Array.isArray(imageContexts) && imageContexts.some(c => c && c.trim())
  console.log(`[TikTok] Generiere Text: platform=${platform}, template=${template}, model=${model}, title="${title.substring(0, 60)}", images=${imageCount}, voiceover=${voiceoverEnabled}, imageContexts=${hasImageContexts ? imageContexts.length : 0}`)

  try {
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

    let apiKey, apiUrl, apiModel

    if (model === 'claude' && process.env.OPENROUTER_API_KEY) {
      apiKey = process.env.OPENROUTER_API_KEY
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions'
      apiModel = 'anthropic/claude-sonnet-5'
    } else if (process.env.GROQ_API_KEY) {
      apiKey = process.env.GROQ_API_KEY
      apiUrl = 'https://api.groq.com/openai/v1/chat/completions'
      apiModel = 'meta-llama/llama-4-scout-17b-16e-instruct'
    } else {
      return res.status(500).json({ error: 'Kein KI-API-Key konfiguriert (GROQ_API_KEY oder OPENROUTER_API_KEY)' })
    }

    // ── KI-Call mit Retry-Kette ──────────────────────────────────────────
    //
    // Problem (03.07.2026): OpenRouter löst 'anthropic/claude-sonnet-5'
    // inzwischen auf ein REASONING-Modell auf (claude-sonnet-5). Das Modell
    // verbraucht das komplette max_tokens-Budget fürs interne Nachdenken
    // (reasoning_details), content bleibt null, finish_reason='length'.
    //
    // Fix:
    // 1. max_tokens 4096 → 16384 (Reasoning + Antwort passen beide rein)
    // 2. reasoning.effort='low' – begrenzt das Denk-Budget (OpenRouter-Param,
    //    wird von Nicht-Reasoning-Modellen ignoriert)
    // 3. Wenn content trotzdem leer → automatischer Fallback auf Groq
    const callAi = async (url, mdl, key, isOpenRouter) => {
      const resp = await axios.post(url, {
        model: mdl,
        messages: [
          { role: 'system', content: FOSTER_HUNTINGTON_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 16384, // Reasoning-Modelle: Denk-Budget + JSON-Antwort
        temperature: 0.8,
        top_p: 0.9,
        // Reasoning-Budget klein halten – Foster-Texte brauchen Stil, kein Nachdenken.
        // Nicht-Reasoning-Modelle und Groq ignorieren den Parameter.
        ...(isOpenRouter ? { reasoning: { effort: 'low' } } : {})
      }, {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          ...(isOpenRouter ? { 'HTTP-Referer': 'https://mojobus.co', 'X-Title': 'MojoBus' } : {})
        },
        timeout: 90000 // Reasoning-Modelle brauchen länger (war 45s → Log zeigte 44s Antwortzeit)
      })
      return resp
    }

    let response = await callAi(apiUrl, apiModel, apiKey, model === 'claude')
    let rawText = response.data.choices?.[0]?.message?.content

    // ── Fallback: Claude leer/abgeschnitten → Groq (Llama 4 Scout) ────────
    if (!rawText && model === 'claude' && process.env.GROQ_API_KEY) {
      const reason = response.data.choices?.[0]?.finish_reason || 'unknown'
      console.warn(`[TikTok] ⚠️ Claude-Antwort leer (finish_reason: ${reason}, model: ${response.data.model || apiModel}) → Groq-Fallback`)
      try {
        response = await callAi(
          'https://api.groq.com/openai/v1/chat/completions',
          'meta-llama/llama-4-scout-17b-16e-instruct',
          process.env.GROQ_API_KEY,
          false
        )
        rawText = response.data.choices?.[0]?.message?.content
      } catch (fbErr) {
        console.error(`[TikTok] Groq-Fallback fehlgeschlagen: ${fbErr.message}`)
      }
    }

    if (!rawText) {
      const reason = response.data.choices?.[0]?.finish_reason || 'unknown'
      console.error(`[TikTok] KI-Antwort leer (finish_reason: ${reason}), volle Response:`, JSON.stringify(response.data).substring(0, 500))
      return res.status(500).json({ error: `KI-Antwort leer (finish_reason: ${reason}). Bitte erneut versuchen.` })
    }
    console.log(`[TikTok] KI-Antwort erhalten (${rawText.length} Zeichen, finish_reason: ${response.data.choices?.[0]?.finish_reason}, model: ${response.data.model || apiModel})`)

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
    //
    // ⚠️ ALTER ANSATZ (Bug, 03.07.2026 behoben): flatten → split → slice.
    // Alle Zeilen wurden in Einzelsätze zerlegt und flach gesammelt.
    // Sobald EINE Zeile 2 Sätze enthielt, verschoben sich ALLE folgenden
    // Zeilen um 1 gegenüber ihren Bildern → Bild-Text-Zuordnung zerstört.
    //
    // NEUER ANSATZ: Die Zeilen-Position ist heilig (Zeile i = Bild i).
    // 1. Pro Zeile: mehrere Sätze → zu EINEM Gedanken verbinden (" – ")
    //    AUSNAHME: letzte Zeile bleibt intakt (Foster-Fragment erlaubt)
    // 2. Zu viele Zeilen → hinten abschneiden (Mapping der ersten N bleibt)
    // 3. Zu wenige → hinten mit '' auffüllen (Stille-Slides)
    const rawLines = Array.isArray(result.bodyLines) ? result.bodyLines : [summary || '']

    // Satz-Splitter: "A. B. C." → ["A.", "B.", "C."]
    const splitIntoSentences = (text) => {
      if (!text || !text.trim()) return []
      // Split nur wenn nach dem Satzzeichen ein Großbuchstabe/Anführungszeichen folgt
      // (schützt Abkürzungen wie "ca. 5km")
      const parts = text.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ"„])/)
      return parts.map(s => s.trim()).filter(Boolean)
    }

    // Pro Zeile: mehrere Sätze zu EINEM Gedanken verbinden.
    // "Motor aus. Stille." → "Motor aus – Stille." (Position bleibt, TTS-tauglich)
    const mergeToOneThought = (line, isLast) => {
      if (!line || !line.trim()) return ''
      const trimmed = line.trim()
      if (isLast) return trimmed // Foster-Fragment in der letzten Zeile erlaubt
      const sentences = splitIntoSentences(trimmed)
      if (sentences.length <= 1) return trimmed
      // Satzzeichen der inneren Sätze entfernen, mit Gedankenstrich verbinden
      return sentences
        .map((s, i) => i < sentences.length - 1 ? s.replace(/[.!?]+$/, '') : s)
        .join(' – ')
    }

    let cleanBodyLines = rawLines.map((line, i) =>
      mergeToOneThought(line, i === rawLines.length - 1)
    )

    // ── Erkennung: KI hat Bild 1 für den Hook "verbraucht" ──────────────
    // Symptom: genau 1 Zeile zu wenig → Hook als bodyLines[0] einsetzen
    const hookConsumedBild1 = cleanBodyLines.length === imageCount - 1
    if (hookConsumedBild1 && result.hook && result.hook.trim()) {
      console.log(`[TikTok] ⚠️ KI hat Bild 1 für Hook verbraucht (${cleanBodyLines.length} statt ${imageCount} bodyLines) → Hook als bodyLines[0] eingesetzt`)
      cleanBodyLines.unshift(result.hook.trim())
    }

    // Auf exakt imageCount Zeilen bringen (Position der ersten N bleibt!)
    if (cleanBodyLines.length > imageCount) {
      console.log(`[TikTok] ⚠️ ${cleanBodyLines.length} Zeilen für ${imageCount} Bilder → überzählige hinten abgeschnitten`)
      cleanBodyLines = cleanBodyLines.slice(0, imageCount)
    }
    while (cleanBodyLines.length < imageCount) {
      cleanBodyLines.push('') // Stille-Slide
    }

    console.log(`[TikTok] Generiert: hook="${(result.hook || '').substring(0, 50)}", bodyLines=${rawLines.length}→${cleanBodyLines.length}/${imageCount}${hookConsumedBild1 ? ' [Bild1-Fix]' : ''}`)
    if (rawLines.length !== cleanBodyLines.length || hookConsumedBild1) {
      console.log(`[TikTok] bodyLines final: ${cleanBodyLines.map(l => `"${l.substring(0, 35)}"`).join(' | ')}`)
    }

    // ── hookAlternatives bereinigen (A/B-Auswahl im Dashboard) ──────────
    // Erwartung: genau 2 Alternativen mit anderen Mechaniken als der Haupt-Hook.
    // Robust gegen KI-Fehler: Duplikate des Haupt-Hooks + Leereintraege raus,
    // auf max 2 kuerzen. Fehlen sie komplett → leeres Array (UI blendet aus).
    const mainHook = (result.hook || '').trim().toLowerCase()
    const hookAlternatives = (Array.isArray(result.hookAlternatives) ? result.hookAlternatives : [])
      .map(h => (typeof h === 'string' ? h.trim() : ''))
      .filter(h => h && h.toLowerCase() !== mainHook)
      .filter((h, i, arr) => arr.findIndex(x => x.toLowerCase() === h.toLowerCase()) === i) // Duplikate raus
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