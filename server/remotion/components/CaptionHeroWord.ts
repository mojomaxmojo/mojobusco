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
  if (!/\*\*(.+?)\*\*/.test(captionText)) return null;

  const words = captionText.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const heroWordIdx = words.findIndex((w) => /\*\*(.+?)\*\*/.test(w));
  if (heroWordIdx === -1) return null;

  const perWordFrames = slideFrames / words.length;
  const startFrame = slideStartFrame + Math.floor(heroWordIdx * perWordFrames);
  const endFrame = slideStartFrame + Math.floor((heroWordIdx + 1) * perWordFrames);

  return { startFrame, endFrame };
}
