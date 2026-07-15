/**
 * CaptionHeroWord — reine Hilfsfunktionen für das per `**...**`-Markup
 * hervorgehobene "Hero-Wort" einer Caption-Zeile.
 *
 * Fundament für Schritt 5 (Hook-Wort-Zoom), siehe FEATURE-PLAN.md.
 * Reine String-/Zahlen-Funktionen, keine Seiteneffekte, kein Import an
 * anderer Stelle im Projekt.
 */

/**
 * Entfernt `**...**`-Markup aus einem Caption-Text.
 * z.B. "**Wüste** wartet nicht." -> "Wüste wartet nicht."
 */
export function stripHeroMarkup(text: string): string {
  if (!text) return text;
  return text.replace(/\*\*(.+?)\*\*/g, '$1');
}

/**
 * Findet das mit `**...**` markierte Wort im Caption-Text und berechnet
 * über die gleiche Wort-Timing-Logik wie `PerSlideCaption` (Wortanzahl ->
 * perWordFrames) das Frame-Fenster, in dem dieses Wort aktiv angezeigt wird.
 *
 * @param captionText     - Original-Caption-Text (mit `**...**`-Markup)
 * @param slideStartFrame - absoluter Start-Frame des Slides in der Composition
 * @param slideFrames     - Dauer des Slides in Frames
 * @returns { startFrame, endFrame } (absolute Frames) oder null, wenn kein
 *          Markup vorhanden ist
 */
export function findHeroWordWindow(
  captionText: string,
  slideStartFrame: number,
  slideFrames: number
): { startFrame: number; endFrame: number } | null {
  if (!captionText || !captionText.trim()) return null;

  // Position des Markups im ROHEN Text suchen (statt Leerzeichen-Split pro
  // Token), damit auch Mehrwort-Anker wie "**10 Meter**" erkannt werden.
  const match = /\*\*(.+?)\*\*/.exec(captionText);
  if (!match) return null;

  // Wortanzahl-Basis: bereinigter Text (wie in PerSlideCaption/Captions.tsx),
  // damit die Fenster-Berechnung exakt mit der angezeigten Caption übereinstimmt.
  const words = stripHeroMarkup(captionText).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  // Start-Wortindex: Anzahl Wörter VOR dem öffnenden Marker im Roh-Text.
  const beforeMarker = captionText.slice(0, match.index).trim();
  const heroStartIdx = beforeMarker
    ? beforeMarker.split(/\s+/).filter(Boolean).length
    : 0;

  // Anzahl Wörter INNERHALB des Markups (mind. 1) -> deckt Mehrwort-Anker ab.
  const heroContent = match[1].trim();
  const heroWordCount = Math.max(1, heroContent.split(/\s+/).filter(Boolean).length);
  const heroEndIdx = heroStartIdx + heroWordCount - 1;

  const perWordFrames = slideFrames / words.length;
  const startFrame = slideStartFrame + Math.floor(heroStartIdx * perWordFrames);
  const endFrame = slideStartFrame + Math.floor((heroEndIdx + 1) * perWordFrames);

  return { startFrame, endFrame };
}
