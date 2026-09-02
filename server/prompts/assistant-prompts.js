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

/**
 * Themen-Vorschläge mit Suchintention („Themen mit Nachfrage“): aus einem
 * Seed-Thema + echten GSC-Anfragen werden deutsche Artikel-Themen im
 * Format „Titel | target-keyword“ erzeugt (maschinen-lesbar fürs Parsing).
 * Zahlen werden bewusst NICHT vom LLM erfunden — die Volumina kommen
 * (wenn verfügbar) aus DataForSEO/GSC und werden serverseitig angehängt.
 * @param {string} seed
 * @param {string} [gscHints] — echte GSC-Queries mit Impressions/Position
 * @returns {string}
 */
export function buildTopicSuggestionsPrompt(seed, gscHints) {
  const hintsBlock = gscHints && gscHints.trim() !== ''
    ? `\nEchte Suchanfragen mit Nachfrage (GSC, 28 Tage): ${gscHints.trim()}\n`
    : ''

  return `Du bist ein SEO-Stratege für MojoBus (mojobus.co), eine Vanlife-/Reise-Plattform mit authentischen Wohnmobil-Berichten (Camper, Stellplätze, Geheimtipps, Reisen mit Hund).

Seed-Thema: "${seed}"
${hintsBlock}
Erzeuge 5–10 konkrete deutsche Artikel-Themen rund um dieses Seed-Thema, optimiert auf Suchintention — Keywords, nach denen Camper/Vanlifer tatsächlich suchen.

Regeln:
- Jede Zeile EXAKT im Format: Titel | target-keyword
- target-keyword = das reine Such-Keyword in Kleinbuchstaben, OHNE Volumen-Angabe
- Wenn echte GSC-Anfragen vorliegen: nutze für MINDESTENS die Hälfte der
  Themen die GSC-Query-Wortfolge WÖRTLICH als target-keyword (dafür gibt es
  belegbare Volumen-Daten) und baue den Titel darum
- Decke verschiedene Suchintentionen ab: Highlights/Sehenswürdigkeiten, Strände, Geheimtipps, Rundreisen/Routen, praktische Guides (Anreise, Stellplätze, Regeln, Kosten)
- Zahlen im Titel sind ausdrücklich erlaubt („Die 7 schönsten Strände ...“)
- Keine Emojis, keine Dopplungen, keine Erklärungen
- Gib NUR die Zeilen aus, nichts sonst.`
}

/**
 * Band-Schätzung (FEATURE-BAND-SCHAETZUNG-PLAN.md): für gegebene Keywords
 * ehrliche Suchvolumen-BÄNDER aus einem festen Zahlenraster plus grobe
 * Saison-Kurve (12 Monats-Multiplikatoren) — als maschinenlesbares JSON.
 *
 * Anti-Pseudo-Präzision per Design: low/high dürfen NUR aus dem Raster
 * (BAND_GRID, siehe server/config/band-estimate.js) stammen, Spread max.
 * Faktor 3. Punkte-Volumina sind verboten; die Validierung wirft Verstöße
 * serverseitig weg (degradiert statt erfindet).
 *
 * @param {string[]} keywords — bereits normalisiert (lowercase, dedupliziert)
 * @returns {string}
 */
export function buildBandEstimatePrompt(keywords) {
  const list = (keywords || [])
    .map((k, i) => `${i + 1}. "${k}"`)
    .join('\n')

  return `Du bist ein vorsichtiger SEO-Daten-Analyst für die deutschsprachige Google-Suche (Google DE, Zielgruppe: Camper/Vanlifer, die in Deutschland, Österreich und der Schweiz suchen).

Für die folgenden Such-Keywords schätzt du MONATLICHE Suchvolumina als BAND und eine grobe SAISONALITÄT.

Keywords:
${list}

Regeln (STRIKT):
- Antworte NUR mit einem JSON-Array. Kein Text davor oder danach, keine Markdown-Codeblöcke, keine Erklärungen.
- Jedes Element hat EXAKT diese Form: {"keyword": "<Keyword wie oben>", "low": <Zahl>, "high": <Zahl>, "saison": [12 Zahlen]}
- low und high MÜSSEN exakt aus diesem Raster stammen: 20, 50, 100, 200, 300, 500, 800, 1200, 2000, 3000, 5000, 8000, 12000, 20000, 30000, 50000, 100000
- high ist maximal low × 3 — schätze nie enger, als du es belegen kannst.
- saison = 12 Multiplikatoren (Januar bis Dezember), Werte zwischen 0.3 und 3.0, Durchschnitt etwa 1.0. Bedeutung: 1.0 = durchschnittlicher Monat, 2.0 = doppelt so viel Suche wie im Durchschnitt.
- Reise-Keywords: der Planungs-Peak liegt VOR der Reisesaison (Sommerurlaub wird meist Jan–Apr gesucht). "Wetter"-Keywords peaken in Planungszeit UND Hochsaison. Überwinterungs-Keywords peaken im Sommer/Herbst (Planung des Winteraufenthalts).
- Kennst du ein Keyword nicht oder wirkt es sehr speziell: konservativ schätzen (low 20, high 50).
- NIE exakte Punktwerte erfinden. Nie behaupten, die Zahlen wären gemessen. Deine Bänder sind Schätzungen.

JSON-Array:`
}
