/**
 * KI-Prompt für Notizen (NoteForm)
 * Tab: "Note" in /veroeffentlichen
 *
 * Foster Huntington Stil für alle Lifestyles
 *
 * Eine Notiz ist das Kürzeste was Foster schreibt.
 * Kürzer als ein Medien-Post. Ein Satz. Vielleicht drei.
 * Ein Gedanke der nicht warten kann. Ein Moment der vorbeigeht
 * wenn man ihn nicht jetzt festhält.
 *
 * Keine Struktur. Kein Aufbau. Kein Versuch etwas daraus zu machen.
 * Es ist was es ist.
 */

import { fosterHuntingtonStyle, getGenderPromptAddition } from './lifestyles.js'

/**
 * Generiert den Foster Huntington Prompt für Notizen
 *
 * Server übergibt: { title, description, location, text, imageDescriptions, lifestyleConfig, country }
 */
export const generateNotePrompt = (params) => {
  const {
    title,
    description,
    location,
    text,
    imageDescriptions,
    lifestyleConfig,
    country,
    gender = 'neutral',
    tripType = ''
  } = params

  // Gender-Prompt-Zusatz holen
  const genderAddition = getGenderPromptAddition(gender)

  // Kontext kompakt zusammenbauen
  let contextLines = [
    tripType && `Art der Reise: ${tripType}`,
    country && `Region: ${country}`,
    location && `Ort: ${location}${country ? ', ' + country : ''}`
  ].filter(Boolean).join('\n')

  // Input-Stärke einschätzen
  const hasText = text && text.length > 10
  let inputGuidance = ''

  if (hasText) {
    inputGuidance = `
    DER AUTOR HAT ETWAS GESCHRIEBEN. Das ist dein Fundament.
    Forme es in Foster's Stimme. Kürze es. Destilliere den Kern.
    Aber erfinde nichts dazu.`
  } else {
    inputGuidance = `
    WENIG TEXT-INPUT. Das ist okay.
    Schreibe aus dem Bild heraus. Ein Gedanke. Nicht mehr.
    Bleib vage wo dir Infos fehlen.`
  }

  // Trip-Type Block (wenn gesetzt)
  const tripTypeBlock = tripType
    ? `\nART DER REISE: ${tripType.toUpperCase()}. Schreibe so dass der Text nach ${tripType} klingt – nicht nach Roadtrip oder Vanlife wenn das nicht zutrifft.\n`
    : ''

  return `Du schreibst wie Foster Huntington. Eine Notiz für die ${lifestyleConfig.community}.
${genderAddition}
${tripTypeBlock}
DAS WICHTIGSTE: Eine Notiz ist KEIN Artikel. Kein Medien-Post. Kein Bericht.
Es ist ein Gedanke. Ein Fragment. Wie eine Nachricht an dich selbst.
1-5 Sätze. Meistens weniger.

SO KLINGT DAS:
---
"${lifestyleConfig.example1}"
---
"${lifestyleConfig.example2}"
---

FOSTER'S STIMME:
${fosterHuntingtonStyle.writingStyle.map(s => `- ${s}`).join('\n')}

FOSTER'S RHYTHMUS:
${fosterHuntingtonStyle.rhythm.map(r => `- ${r}`).join('\n')}

WAS FOSTER NIE TUN WÜRDE:
${fosterHuntingtonStyle.avoid.map(a => `- ${a}`).join('\n')}
- Das Bild beschreiben: "Hier sieht man...", "Auf dem Foto..."
- Den Leser ansprechen: "Kennst du das?", "Was meint ihr?"
- Kontext erklären: "Heute war ich...", "Ich wollte kurz teilen..."
- Ausrufezeichen. Nie.

THEMA: "${title}"${description ? `\n"${description}"` : ''}

${contextLines}

WAS AUF DEM BILD ZU SEHEN IST (als Kontext, nicht nacherzählen):
${imageDescriptions.map((desc, i) => `${i + 1}. ${desc}`).join('\n')}

${text ? `WAS DER AUTOR SAGT (HÖCHSTE PRIORITÄT):\n"${text}"` : ''}
${inputGuidance}

REGELN:
- Erfinde NICHTS. Keine Zahlen, keine Fakten die nicht im Input sind.
- Beschreibe nicht das Bild. Der Leser sieht es.
- Kein Intro. Kein Fazit. Kein Aufbau.
- Beginne mitten drin. Höre auf wenn es reicht.

LÄNGE: 20-80 Wörter. Eher kürzer. Eine Notiz quatscht nicht.
HASHTAGS: 3-5 am Ende. #${lifestyleConfig.keywords[0]}
SPRACHE: Deutsch. Knapp. Fragmentarisch.

Ein Gedanke. Schreib ihn auf. Fertig.`
}

/**
 * Bild-Analyse-Prompt für Note-Tab
 *
 * Sachlich. Minimal. Fakten.
 */
export const getNoteImageAnalysisPrompt = (lifestyleConfig) => {
  return `Beschreibe dieses Bild sachlich für eine ${lifestyleConfig.vehicle}-Notiz.

NENNE (nur was sichtbar ist):
- Was: Objekte, Personen, Tiere, Fahrzeuge
- Wo: Setting, Umgebung
- Wann: Tageszeit, Wetter (wenn erkennbar)

FORMAT: 1-2 sachliche Sätze. Kompakt.
NUR beschreiben was du SIEHST.

VERBOTEN:
- Bewertende Adjektive: "schön", "toll", "perfekt", "idyllisch"
- Vermutungen: "scheint", "könnte", "wahrscheinlich"
- Interpretationen: "genießt", "fühlt sich frei"

BEISPIEL:
"Strand, Dämmerung. Mojobus am Wasser, Tür offen. Zwei Personen davor. Bewölkt, windig."}`
}
