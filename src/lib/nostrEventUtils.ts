/**
 * Nostr Event Utilities
 *
 * Zentrale Helfer-Funktionen zum Extrahieren von Metadaten aus Nostr-Events.
 * Konsolidiert aus: PromotionDashboard.tsx, ContentSelector.tsx
 */

/**
 * Extrahiert alle Bild-URLs aus einem Nostr-Event.
 * Durchsucht image-Tags, Markdown-Bilder, HTML-img-Tags und direkte Bild-URLs im Content.
 */
/**
 * Prüft, ob eine URL auf eine Videodatei verweist.
 */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|avi|mkv)(\?|#|$)/i.test(url);
}

export function extractImagesFromEvent(event: { tags?: string[][]; content?: string }): string[] {
  const images: string[] = [];

  // image-Tags
  event.tags?.forEach((t: string[]) => {
    if (t[0] === 'image' && t[1]) {
      if (!images.includes(t[1])) images.push(t[1]);
    }
  });

  // Bilder aus Content
  if (event.content) {
    // Markdown-Bilder: ![alt](url)
    const mdMatches = event.content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g);
    if (mdMatches) {
      mdMatches.forEach((match: string) => {
        const urlMatch = match.match(/\((https?:\/\/[^\s)]+)\)/);
        if (urlMatch && !images.includes(urlMatch[1])) images.push(urlMatch[1]);
      });
    }

    // HTML-img-Tags: <img src="url">
    const htmlMatches = event.content.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi);
    if (htmlMatches) {
      htmlMatches.forEach((match: string) => {
        const urlMatch = match.match(/src=["'](https?:\/\/[^"']+)["']/i);
        if (urlMatch && !images.includes(urlMatch[1])) images.push(urlMatch[1]);
      });
    }

    // Direkte Bild- & Video-URLs (jpg, jpeg, png, gif, webp, mp4, webm, mov, avi, mkv)
    const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|avi|mkv))/gi;
    const directMatches = event.content.match(urlRegex);
    if (directMatches) {
      directMatches.forEach((url: string) => {
        if (!images.includes(url)) images.push(url);
      });
    }
  }

  return images;
}

/**
 * Extrahiert den Titel aus dem Content eines Nostr-Events.
 * Sucht nach # Überschrift (Markdown), <h1> (HTML) oder der ersten Zeile.
 */
export function extractTitle(content: string): string {
  if (!content) return '';

  // Markdown-Überschrift: # Titel
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();

  // HTML-Überschrift: <h1>Titel</h1>
  const h1HtmlMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1HtmlMatch) return h1HtmlMatch[1].replace(/<[^>]+>/g, '').trim();

  // Erste Zeile als Fallback (max 80 Zeichen)
  const firstLine = content.split('\n')[0]?.trim();
  if (firstLine && firstLine.length < 100 && !firstLine.startsWith('<')) {
    return firstLine.substring(0, 80);
  }

  return '';
}

/**
 * Extrahiert eine Kurzzusammenfassung aus dem Content.
 * Entfernt HTML-Tags, Markdown-Formatierung, Hashtags und Bilder.
 * Gibt den ersten Absatz zurück (max 200 Zeichen).
 */
export function extractSummary(content: string): string {
  if (!content) return '';

  let cleaned = content
    .replace(/<[^>]+>/g, '')           // HTML-Tags entfernen
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **fett** → fett
    .replace(/^(#+\s+)/gm, '')         // # Überschriften entfernen
    .replace(/!\[.*?\]\(.*?\)/g, '')   // ![Bild](url) entfernen
    .replace(/^\*\*[^:]+:\*\*\s*.*$/gm, '') // **Label:** Text entfernen
    .replace(/^## .+$/gm, '')          // ## Unterüberschrift entfernen
    .trim();

  const firstParagraph = cleaned.split('\n\n')[0]?.trim() || cleaned;
  if (firstParagraph.length > 200) return firstParagraph.substring(0, 197) + '...';
  return firstParagraph;
}