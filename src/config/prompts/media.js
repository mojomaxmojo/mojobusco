/**
 * KI-Prompt für Medien-Artikel (MediaUploadForm)
 * Tab: "Medien" in /veroeffentlichen
 *
 * Foster Huntington Stil für alle Lifestyles
 *
 * Medien-Posts sind die kürzesten und visuellsten.
 * 2-5 Sätze. Nicht mehr. Das Bild erzählt die Geschichte.
 * Der Text ist das was das Bild nicht zeigt.
 */

import { fosterHuntingtonStyle, getGenderPromptAddition } from './lifestyles.js'

/**
 * Generiert den Foster Huntington Prompt für Medien-Artikel
 */
export const generateMediaPrompt = (params) => {
  const {
    title,
    description,
    location,
    text,
    imageDescriptions,
    lifestyleConfig,
    mainCategory,
    subCategories,
    detailedTags,
    additionalImageUrls,
    manualTags,
    country,
    gender = 'neutral',
    tripType = ''
  } = params

  // Gender-Prompt-Zusatz holen
  const genderAddition = getGenderPromptAddition(gender)

  // Trip-Type Block
  const tripTypeBlock = tripType
    ? `\nART DER REISE: ${tripType.toUpperCase()}. Schreibe so dass der Text nach ${tripType} klingt – nicht nach Roadtrip wenn es kein Auto-Trip ist.\n`
    : ''

  // Kontext kompakt – nur was relevant ist
  let contextLines = [
    tripType && `Art der Reise: ${tripType}`,
    mainCategory && `Kategorie: ${mainCategory}`,
    subCategories && subCategories.length > 0 && `Themen: ${subCategories.join(', ')}`,
    country && `Region: ${country}`,
    location && `Ort: ${location}${country ? ', ' + country : ''}`,
    additionalImageUrls && `Weitere Bilder vorhanden: ja`
  ].filter(Boolean).join('\n')

  // Alle Tags zusammenführen für Hashtags
  let allTags = [
    ...(lifestyleConfig.keywords || []),
    ...(detailedTags || []),
    ...(manualTags || [])
  ].filter(Boolean)

  return `STRIKTE LÄNGENVORGABE: 2-5 Sätze. 35-50 Wörter. NICHT MEHR. Zähle nach. Alles über 60 Wörter ist FALSCH.

STRIKTE FORMATVORGABE: NUR Fließtext. KEINE Überschriften (#). KEIN Fettdruck (**). KEINE Listen. KEINE Trennlinien (---). Nur Sätze und Absätze.

Du schreibst wie Foster Huntington. Einen Medien-Post für die ${lifestyleConfig.community}.
${genderAddition}
${tripTypeBlock}

Ein Medien-Post ist ein Foto mit 2-5 Sätzen. Das Foto erzählt die Geschichte. Dein Text erzählt was das Foto NICHT zeigt: einen Gedanken, ein Geräusch, was davor oder danach passiert ist.

SO KLINGT DAS – GENAU DIESE LÄNGE:
---
"${lifestyleConfig.example1}"
---
"${lifestyleConfig.example2}"
---
→ Das ist die richtige Länge. Nicht länger. Nicht kürzer.

ABSOLUT VERBOTEN:
- Überschriften (# Text), Fettdruck (**Text**), Listen, Trennlinien (---)
- Leseransprache: "Kennst du das?", "Was meint ihr?", "Stell dir vor..."
- Tipps: "Mein Tipp:", "Ihr solltet...", "Wenn du... dann..."
- Labeln: "Das ist Freiheit", "So fühlt sich Leben an", "Das sagt mir mehr über..."
- Fragen an den Leser: "Was siehst du?", "Oder?"
- Motivations-Sätze: "Einfach machen", "Das Leben beginnt..."
- Klischee-Adjektive: atemberaubend, traumhaft, wunderschön, idyllisch, magisch, perfekt, episch
- Instagram-Sprache: vibes, blessed, grateful, aesthetic
- Das Bild beschreiben: "Hier sieht man...", "Auf dem Foto ist..."
- Ausrufezeichen. Nie.
- Mehr als 5 Sätze.

FOSTER'S STIMME:
- Erste Person. Immer "Ich". Nie "du", nie "man".
- Kurze Sätze. Manche ohne Verb.
- Präsens. Im Moment.
- Kein Intro. Direkt rein.
- Humor so leise dass man ihn fast überhört.

THEMA: "${title}"${description ? `\n"${description}"` : ''}
${contextLines}

BILD-KONTEXT (nicht nacherzählen):
${imageDescriptions.map((desc, i) => `${i + 1}. ${desc}`).join('\n')}

${text ? `AUTOREN-INPUT (HÖCHSTE PRIORITÄT):\n"${text}"` : ''}

REGELN:
- Beschreibe NICHT was auf dem Bild ist. Der Leser sieht es.
- Erfinde NICHTS. Keine Zahlen, keine Fakten die nicht im Input sind.
- Kein Aufbau. Mitten rein, aufhören wenn es reicht.

HASHTAGS: 4-6 am Ende.${allTags.length > 0 ? ` #${allTags.slice(0, 6).join(' #')}` : ` #${lifestyleConfig.keywords[0]}`}
SPRACHE: Deutsch. Knapp.

DENK DRAN: 2-5 Sätze. 35-50 Wörter. Dann Hashtags. Fertig.`
}

/**
 * Bild-Analyse-Prompt für Medien-Tab
 *
 * Sachlich. Kurz. Fakten.
 * Das ist ein Tool-Prompt, kein Text-Output.
 * Foster-Stil wird nur im finalen Medien-Prompt angewendet.
 */
export const getMediaImageAnalysisPrompt = (lifestyleConfig) => {
  return `Beschreibe dieses Bild sachlich für einen ${lifestyleConfig.vehicle}-Post.

NENNE (nur was sichtbar ist):
- Was: Objekte, Personen, Tiere, Fahrzeuge
- Wo: Setting, Umgebung, erkennbare Region
- Wann: Tageszeit, Wetter, Licht (wenn erkennbar)
- Details: Besonderes das auffällt

FORMAT: 2-3 sachliche Sätze. Präzise.
NUR beschreiben was du SIEHST.

VERBOTEN:
- Bewertende Adjektive: "schön", "toll", "perfekt", "idyllisch"
- Vermutungen: "scheint", "könnte", "wahrscheinlich"
- Interpretationen: "genießt", "fühlt sich frei"

BEISPIEL:
"Strand bei Dämmerung. Mojobus am Wasser, Tür offen. Zwei Personen und ein Hund davor. Bewölkt, windig."}`
}

/**
 * Video-Analyse-Prompt für Medien-Tab
 *
 * Analysiert Videos und extrahiert Szenenbeschreibungen für Content-Generierung.
 * Sachlich. Kurz. Fakten. Keine Interpretation.
 * Verwendet OpenRouter API mit Google Gemini 2.5 Flash (kostengünstig).
 */
export const getMediaVideoAnalysisPrompt = (lifestyleConfig) => {
  return `Analysiere dieses Video sachlich für einen ${lifestyleConfig.vehicle}-Post.

BESCHREIBE (nur was sichtbar ist):
- Szenen: Welche Orte, Settings, Umgebungen werden gezeigt
- Aktionen: Was passiert, Bewegungen, Aktivitäten
- Objekte: Fahrzeuge, Ausrüstung, markante Gegenstände
- Personen/Tiere: Anzahl, Aktivitäten (sachlich)
- Atmosphäre: Wetter, Licht, Tageszeit (wenn erkennbar)
- Details: Besonderheiten, Ausrüstung, Marken (nur wenn klar erkennbar)

FORMAT: 3-5 kurze Sätze. Präzise. Chronologisch.
NUR beschreiben was du SIEHST.

VERBOTEN:
- Bewertende Adjektive: "schön", "toll", "perfekt", "idyllisch", "atemberaubend"
- Vermutungen: "scheint", "könnte", "wahrscheinlich", "vielleicht"
- Interpretationen: "genießt", "fühlt sich frei", "wirkt entspannt"
- Gefühle/Emotionen zuschreiben
- Marketing-Sprache: "einzigartig", "magisch", "unvergesslich"

BEISPIEL:
"Morgens, Küste. Mojobus steht auf Schotter, Tür offen. Zwei Personen bereiten Kaffee auf Campingkocher vor. Hund läuft am Wasser. Bewölkt, windig. Nachmittags: Mojobus auf Feldweg geparkt, Person liest außerhalb im Liegestuhl. Abends: Lagerfeuer, Sterne sichtbar."}`
}
