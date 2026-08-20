/**
 * Prompt-Builder für die Kontinuitäts-Extraktion.
 *
 * Weist ein günstiges Modell an, aus einem veröffentlichten Text NUR JSON
 * mit Motiven, Entitäten, Stimmung und offenen Fäden zu extrahieren.
 * Reine String-Funktion, keine Seiteneffekte.
 */

/**
 * Baut den Extraktions-Prompt.
 * @param {string} publishedText Der veröffentlichte Fließtext.
 * @param {string} [title] Optionaler Titel des Posts.
 * @returns {string}
 */
export function buildExtractionPrompt(publishedText, title) {
  return `Analysiere den folgenden veröffentlichten Reise-/Vanlife-Text und extrahiere NUR ein JSON-Objekt, keinen weiteren Text, keine Erklärung.

Titel: ${title || '(kein Titel)'}

Text:
"""
${publishedText}
"""

Gib exakt dieses JSON-Format zurück (Felder auf Deutsch, Werte kurz und prägnant):
{
  "motifs": ["Motiv1", "Motiv2"],
  "entities": ["Entität1", "Entität2"],
  "mood": "kurze Stimmungsbeschreibung",
  "openThreads": ["offener Faden 1", "offener Faden 2"]
}

Regeln:
- "motifs": wiederkehrende Themen/Bilder im Text (z.B. "Nebel", "Kaffee", "Reparatur"), max. 5.
- "entities": konkrete Dinge/Orte/Namen, die im Text vorkommen (z.B. "Wasserpumpe", "Strand von Sagres"), max. 5.
- "mood": ein bis drei Worte zur Grundstimmung (z.B. "ruhig, zufrieden").
- "openThreads": unerledigte oder angedeutete Handlungsstränge, die später aufgegriffen werden könnten (z.B. "Pumpe macht Geräusche"), max. 3. Leeres Array wenn nichts offen ist.
- Antworte AUSSCHLIESSLICH mit dem JSON-Objekt, ohne Markdown-Codeblock, ohne zusätzlichen Text.`
}
