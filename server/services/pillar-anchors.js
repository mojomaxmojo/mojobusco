/**
 * pillar-anchors.js — AI-Anker-Vorschläge für das Pillar-Update (WP3c)
 *
 * POST /api/assistant/pillar-anchors (routes/assistant/index.js)
 *
 * Aufgabe: Für jeden fehlenden Plan-Artikel die thematisch passendste
 * Stelle im Pillar-Content bestimmen. WICHTIG (Stil-Garantie,
 * PLAN_PILLAR_LINKS.md): Die KI liefert NUR Positionen als JSON
 * ({ eventId, heading, sentence }) — sie schreibt NIEMALS Text in den
 * Artikel. Das Frontend (PillarDraftSection + suggestAnchorsFromAi)
 * validiert die Anker gegen den echten Content und fügt NUR per
 * Autor-Klick den Markdown-Link ein.
 *
 * Modell via Switcher-Tier (möglichst nicht hardcodieren — User-Vorgabe):
 * deriveModel() akzeptiert 'mini' | 'medium' | 'maxi' | 'test'
 * (GLM 5.3 flash = 'test'). Token-Budget: useCase 'anchors' aus
 * ai-models.js (beide Kopien synchron).
 */

import { generateWithModel } from './ai-content.js'
import { normalizeTextModel, getMaxTokens } from '../config/ai-models.js'

/** Max. verarbeitete Targets pro Call (Frontend sendet ohnehin ≤ 12) */
const MAX_MISSING = 12

/** normalisiert für die Server-Validierung (Spiegel zu normalizeText in
 *  src/lib/pillarLinkDraft.ts — Pipeline/Frontend-Import-Grenze) */
function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[#*_`>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Zeilen-Struktur des Contents für die Validierung extrahieren */
function collectContentIndex(content) {
  const lines = String(content || '').split('\n')
  const headings = new Set()
  const sentences = new Set()
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const heading = trimmed.match(/^#{2,4}\s+(.+)$/)
    if (heading) {
      headings.add(normalizeText(heading[1]))
    } else if (!trimmed.startsWith('![')) {
      sentences.add(normalizeText(trimmed))
    }
  }
  return { headings, sentences }
}

/** Robustes JSON-Extraktion (Code-Fences, Prosa drumherum) */
function extractJsonArray(raw) {
  const text = String(raw || '')
    .replace(/```json/gi, '```')
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

function buildPrompt(content, missing) {
  const list = missing
    .map((m, i) => `[${i}] ${m.title}${m.keyword ? ` (Keyword: ${m.keyword})` : ''}`)
    .join('\n')
  return `Du hilfst bei der internen Verlinkung eines Reise-Blogs.

Aufgabe: Für JEDEN Eintrag der FEHLENDE-LINKS-Liste die thematisch passendste Stelle im untenstehenden Artikel bestimmen.

Antworte NUR mit einem JSON-Array, kein Text, keine Erklärung:
[{"index":0,"sentence":"exakter Satz aus dem Artikel","heading":""},{"index":1,"sentence":"","heading":"exakte Überschrift aus dem Artikel"}]

Regeln:
- "index" = Nummer aus der FEHLENDE-LINKS-Liste.
- Bevorzuge "sentence" (exakter Satz/Absatz), wenn ein Absatz thematisch passt — der Link steht dann direkt dahinter.
- Nutze "heading" (exakter Überschriften-Text, ##-Ebene), wenn der Link ans Ende des Abschnitts gehört.
- Überschrift/Satz MÜSSEN wortgleich im Artikel vorkommen.
- Kein Match möglich? → Eintrag weglassen.

FEHLENDE LINKS:
${list}

ARTIKEL (Markdown):
${content}`
}

/**
 * Erzeugt validierte AI-Anker-Vorschläge.
 * @param {{ content: string, missing: Array<{eventId: string, title: string, keyword?: string}>, model?: string }} params
 * @returns {Promise<{ suggestions: Array<{eventId: string, heading?: string, sentence?: string}>, model: string, dropped: number }>}
 */
export async function suggestPillarAnchors({ content, missing, model } = {}) {
  if (!content || typeof content !== 'string' || content.trim().length < 100) {
    throw new Error('Content fehlt oder ist zu kurz')
  }
  if (!Array.isArray(missing) || missing.length === 0) {
    throw new Error('Fehlende Links (missing) fehlen')
  }
  const tier = normalizeTextModel(model || 'mini')
  const targets = missing
    .filter((m) => m && typeof m.eventId === 'string' && typeof m.title === 'string')
    .slice(0, MAX_MISSING)
  if (targets.length === 0) {
    throw new Error('Keine gültigen Einträge in missing')
  }

  const maxTokens = getMaxTokens(tier, 'anchors', 'medium', 800)
  const raw = await generateWithModel(buildPrompt(content, targets), tier, 'mojobus', {
    temperature: 0.2,
    maxTokens,
  })

  const parsed = extractJsonArray(raw)
  if (!Array.isArray(parsed)) {
    throw new Error('KI-Antwort enthielt kein JSON-Array')
  }

  const { headings, sentences } = collectContentIndex(content)
  const suggestions = []
  let dropped = 0
  for (const entry of parsed) {
    const idx = Number(entry?.index)
    const target = targets[idx]
    if (!target) {
      dropped += 1
      continue
    }
    const sentence = typeof entry?.sentence === 'string' ? entry.sentence.trim() : ''
    const heading = typeof entry?.heading === 'string' ? entry.heading.trim() : ''
    // Serverseitige Validierung: nur Anker zurückgeben, die im Content
    // wirklich existieren (Frontend validiert zusätzlich nochmal).
    if (sentence && sentences.has(normalizeText(sentence))) {
      suggestions.push({ eventId: target.eventId, sentence })
    } else if (heading && headings.has(normalizeText(heading))) {
      suggestions.push({ eventId: target.eventId, heading })
    } else {
      dropped += 1
    }
  }

  return { suggestions, model: tier, dropped }
}
