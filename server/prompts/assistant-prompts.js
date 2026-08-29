/**
 * Prompt-Bausteine für den Berichte-Assistenten.
 *
 * Diese Prompts erzeugen KEINE Artikel-Texte (dafür bleiben die Prompts in
 * src/config/prompts/ zuständig — TABU, siehe AGENTS.md). Sie liefern nur:
 *  - sachliche Recherche-Fakten mit Quellenpflicht
 *  - Long-Tail-Themen-Ideen im MojoBus-Geist
 *  - sachliche SEO-Titel-Vorschläge
 */

/**
 * Recherche-Prompt: sammelt sachliche, belegbare Fakten zu einem Thema
 * inklusive Quellen-URLs. Bewusst ohne Stil-Vorgaben — die Fakten landen
 * nur als Input im Author-Input des Artikels.
 * @param {string} topic
 * @returns {string}
 */
export function buildResearchPrompt(topic) {
  return `Du bist ein sachlicher Recherche-Assistent für Reiseinhalte.

Thema: "${topic}"

Sammle FAKTEN zu diesem Thema, die für einen Vanlife-/Reisebericht relevant sein könnten (z. B. Regeln, Preise, Gegebenheiten, Anfahrt, Saison, praktische Bedingungen).

Regeln:
- Nur Fakten, die belegbar sind. Keine Stimmung, keine Literatur, keine Emojis.
- Zu jeder Faktengruppe die Quellen-URL(s) angeben.
- Wenn etwas unsicher oder regional unterschiedlich ist, das explizit sagen.
- Keine erfundenen Zahlen. Wenn du eine Zahl nicht belegen kannst, weglassen.

Antworte in diesem Format:
FAKTEN:
- <Fakt 1> [Quelle: <URL>]
- <Fakt 2> [Quelle: <URL>]
...
QUELLEN:
- <URL 1>
- <URL 2>`
}

/**
 * Ideen-Prompt: erzeugt 5–10 Long-Tail-Themen im MojoBus-Geist
 * (Ort + Stimmung). Ausdrücklich KEINE "10 Gründe"-Listicle-Formate.
 * @param {string} location
 * @param {string} [hints] — optionale Hinweise (z. B. GSC-Queries, Stimmung)
 * @returns {string}
 */
export function buildIdeasPrompt(location, hints) {
  const hintsBlock = hints && hints.trim() !== ''
    ? `\nBerücksichtige bei der Auswahl auch diese Suchbegriffe/Hinweise: ${hints.trim()}\n`
    : ''

  return `Du bist ein Redaktions-Assistent für MojoBus (mojobus.co), eine Vanlife-/Reise-Plattform mit sehr persönlichen, atmosphärischen Berichten aus dem Wohnmobil. Die Texte erzählen Stimmung und Erleben an einem konkreten Ort — keine Ratgeber, keine Listicle.

Ort: "${location || 'kein Ort angegeben — allgemein'}"
${hintsBlock}
Erzeuge 5–10 konkrete Long-Tail-Themen für einen Bericht an/über diesem Ort.

Regeln:
- Jedes Thema kombiniert den Ort mit einer konkreten Situation, Stimmung oder Erfahrung (z. B. ein besonderer Morgen, ein unerwartetes Problem, ein leiser Moment).
- VERBOTEN: "10 Gründe ...", "Die besten ...", "Top X ...", Ratgeber-Formate, SEO-Clickbait.
- Jedes Thema als eine kurze Zeile, ohne Nummerierung, ohne Erklärung.
- Gib pro Zeile zusätzlich (in Klammern) einen groben Fokus-Wortlaut, unter dem man dazu schreiben könnte.`.trim()
}

/**
 * SEO-Titel-Prompt: erzeugt einen sachlichen SEO-Seitentitel
 * (separat vom kreativen Foster-Titel des Artikels).
 * @param {{ title: string, articleText?: string }} params
 * @returns {string}
 */
export function buildSeoTitlePrompt({ title, articleText }) {
  const excerpt = (articleText || '').slice(0, 1500)

  return `Du bist ein SEO-Redakteur.

Artikel-Titel: "${title}"
${excerpt ? `Artikel-Anfang:\n${excerpt}\n` : ''}
Erzeuge EINEN sachlichen SEO-Seitentitel (Google-Suche) für diesen Artikel.

Regeln:
- Maximal 60 Zeichen.
- Enthält das Haupt-Keyword bzw. den Ort konkret und sachlich.
- Kein Clickbait, keine Ausrufezeichen, kein "| MojoBus".
- Antworte NUR mit dem Titel, ohne Anführungszeichen, ohne Erklärung.`
}
