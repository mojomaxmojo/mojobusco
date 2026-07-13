/**
 * CaptionHeroWord.ts – Helfer-Funktionen für Hook-Wort-Zoom
 *
 * Ermöglicht das Erkennen und Verarbeiten von **Schlüsselwort**-Markierungen
 * in Caption-Texten, die von der KI generiert wurden.
 *
 * Reine Funktionen – keine Seiteneffekte, keine Imports in bestehende Dateien.
 */

/**
 * Entfernt **...**-Markup aus einem Caption-Text.
 *
 * @param text – Roh-Text mit optionalem **Markup**
 * @returns Sauberer Text ohne Sternchen
 *
 * @example
 * stripHeroMarkup('**Wüste** wartet nicht.') // 'Wüste wartet nicht.'
 */
export function stripHeroMarkup(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1');
}

/**
 * Findet das mit **...** markierte Wort in einem Caption-Text und berechnet
 * das Frame-Fenster, in dem es angezeigt wird.
 *
 * Verwendet die gleiche Wort-Timing-Logik wie PerSlideCaption:
 *   perWordFrames = slideFrames / wordCount
 *   wordStart = slideStartFrame + wordIndex * perWordFrames
 *   wordEnd = slideStartFrame + (wordIndex + 1) * perWordFrames
 *
 * @param captionText – Caption-Text mit optionalem **Markup**
 * @param slideStartFrame – Erster Frame dieses Slides im Video
 * @param slideFrames – Gesamt-Frame-Anzahl dieses Slides
 * @returns Frame-Fenster des hervorgehobenen Wortes, oder null wenn kein Markup
 *
 * @example
 * findHeroWordWindow('**Wüste** wartet nicht.', 100, 60)
 * // { startFrame: 100, endFrame: 120 } (Wort 0 von 3: 60/3 = 20 Frames pro Wort)
 */
export function findHeroWordWindow(
  captionText: string,
  slideStartFrame: number,
  slideFrames: number,
): { startFrame: number; endFrame: number } | null {
  // Prüfen, ob Markup vorhanden ist
  const markupMatch = captionText.match(/\*\*(.+?)\*\*/);
  if (!markupMatch) return null;

  const heroWord = markupMatch[1]; // Das Wort ohne Sternchen
  if (!heroWord) return null;

  // Alle Wörter finden (inkl. Markup für Positionsbestimmung)
  const words = captionText.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  // Wort-Index des markierten Worts bestimmen
  // Suche nach dem Wort mit **...**-Markup
  let heroIndex = -1;
  for (let i = 0; i < words.length; i++) {
    if (words[i].includes(`**${heroWord}**`)) {
      heroIndex = i;
      break;
    }
  }

  if (heroIndex === -1) return null;

  // Gleiche Timing-Logik wie PerSlideCaption
  const perWordFrames = slideFrames / words.length;
  const startFrame = Math.round(slideStartFrame + heroIndex * perWordFrames);
  const endFrame = Math.round(slideStartFrame + (heroIndex + 1) * perWordFrames);

  return { startFrame, endFrame };
}