/**
 * Bild-Metadaten: Alt-Text, Caption und manueller KI-Freitext (note).
 *
 * Diese reinen Hilfsfunktionen parsen und schreiben Metadaten, die als
 * HTML-Kommentare direkt nach einer Markdown-Bildzeile gespeichert werden:
 *
 *   ![Alt-Text hier](https://blossom.../bild.jpg)
 *   <!--caption:Kurze Bildunterschrift, wird im Artikel angezeigt-->
 *   <!--note:Zusatzkontext nur für die KI, wird nie angezeigt-->
 *
 * HTML-Kommentare werden von react-markdown standardmäßig verschluckt und
 * von anderen Nostr-Clients i.d.R. ignoriert — so bleibt der Nostr-Rohtext
 * (weiterhin reiner `content`-String) kompatibel, ohne Schema-Änderung.
 *
 * Augenmerk: `injectImageMeta` ist idempotent (wiederholtes Aufrufen mit
 * derselben URL dupliziert nichts) und `stripImageMetaComments` erzeugt den
 * reinen Text ohne Metadaten-Kommentare für Konsumenten, die HTML-Kommentare
 * nicht kennen (z.B. Wortzählung, Übersetzung, Teaser-Erzeugung).
 */

/**
 * Metadaten eines Bildes.
 * - `url`: Bild-URL (Blossom o.ä.)
 * - `alt`: Kurzer SEO-Alt-Text (aus den `[...]`-Klammern gelesen)
 * - `caption`: Sichtbare Bildunterschrift (wird im fertigen Artikel angezeigt)
 * - `note`: Manueller Freitext — nur KI-Kontext, wird nie angezeigt
 */
export interface ImageMeta {
  url: string;
  alt?: string;
  caption?: string;
  note?: string;
}

// Regex für ein Markdown-Bild mit optional direkt folgenden
// caption-/note-HTML-Kommentaren.
//
// Gruppen: 1 = alt, 2 = url, 3 = caption, 4 = note
const IMG_WITH_META_RE =
  /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)(?:\s*\n\s*<!--caption:([^>]*)-->)?(?:\s*\n\s*<!--note:([^>]*)-->)?/g;

/** Entfernt eckige Klammern, damit der Markdown-Alt-Text `![...]` nicht bricht. */
function sanitizeAlt(value: string): string {
  return value.replace(/[[\]]/g, '');
}

/** Entschärft `-->` und Zeilenumbrüche, damit ein HTML-Kommentar nicht vorzeitig endet. */
function sanitizeComment(value: string): string {
  return value.replace(/-->/g, '').replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Extrahiert alle Bilder des Markdown inklusive ihrer Metadaten.
 *
 * Ergänzt die bisherige `extractImageUrlsFromMarkdown()` (die unverändert
 * bestehen bleibt): liest `alt` aus den `[...]`-Klammern und `caption`/`note`
 * aus den optionalen HTML-Kommentaren direkt nach dem Bild.
 *
 * @param markdown - Roher Markdown-Text
 * @returns Liste der Bilder mit ihren Metadaten
 */
export function extractImagesWithMeta(markdown: string): ImageMeta[] {
  const results: ImageMeta[] = [];
  const re = new RegExp(IMG_WITH_META_RE.source, IMG_WITH_META_RE.flags);
  let match: RegExpExecArray | null;

  while ((match = re.exec(markdown)) !== null) {
    const [, alt = '', url, caption, note] = match;
    if (!url) continue;

    const meta: ImageMeta = { url };
    if (alt) meta.alt = alt;
    if (caption) meta.caption = caption.trim();
    if (note) meta.note = note.trim();
    results.push(meta);
  }

  return results;
}

/**
 * Ersetzt/ergänzt die Metadaten des ersten Bildes mit der angegebenen `url`.
 *
 * Idempotent: Ruft man es zweimal mit derselben URL auf, wird nichts
 * dupliziert, sondern der bestehende Alt-Text und die vorhandenen
 * `<!--caption:-->`/`<!--note:-->`-Kommentarzeilen werden ersetzt.
 *
 * Übergebene Felder in `meta` überschreiben den Bestand; nicht übergebene
 * Felder (undefined) bleiben unverändert. Ein leerer String entfernt die
 * jeweilige Kommentarzeile.
 *
 * @param markdown - Roher Markdown-Text
 * @param url - URL des zu bearbeitenden Bildes
 * @param meta - Zu schreibende Metadaten (nur gewünschte Felder angeben)
 * @returns Markdown mit injizierten Metadaten
 */
export function injectImageMeta(
  markdown: string,
  url: string,
  meta: Partial<ImageMeta>,
): string {
  if (!url) return markdown;

  const re = new RegExp(IMG_WITH_META_RE.source, IMG_WITH_META_RE.flags);
  let match: RegExpExecArray | null;

  while ((match = re.exec(markdown)) !== null) {
    const [full, , currentUrl, existingCaption, existingNote] = match;
    if (currentUrl !== url) continue; // erstes Bild mit dieser URL suchen

    const alt = meta.alt !== undefined ? sanitizeAlt(meta.alt) : (match[1] ?? '');
    const caption = meta.caption !== undefined ? meta.caption : existingCaption;
    const note = meta.note !== undefined ? meta.note : existingNote;

    let replacement = `![${alt}](${url})`;
    if (caption) replacement += `\n<!--caption:${sanitizeComment(caption)}-->`;
    if (note) replacement += `\n<!--note:${sanitizeComment(note)}-->`;

    return markdown.slice(0, match.index) + replacement +
      markdown.slice(match.index + full.length);
  }

  return markdown;
}

/**
 * Entfernt alle `<!--caption:-->`/`<!--note:-->`-Kommentare aus dem Markdown.
 *
 * Für die reine Text-Extraktion (z.B. Wortzählung, Übersetzung,
 * Teaser-Erzeugung), damit bestehende Konsumenten wie `createLongformTeaser.ts`
 * oder `translation.js` (die HTML-Kommentare nicht kennen) keinen Rohtext
 * mit Kommentaren verarbeiten.
 *
 * @param markdown - Roher Markdown-Text
 * @returns Markdown ohne Bild-Metadaten-Kommentare
 */
export function stripImageMetaComments(markdown: string): string {
  return markdown
    .replace(/<!--caption:[^>]*-->\s*\n?/g, '')
    .replace(/<!--note:[^>]*-->\s*\n?/g, '');
}
