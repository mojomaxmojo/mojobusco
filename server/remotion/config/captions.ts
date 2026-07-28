/**
 * Caption-Styling-Konfiguration
 *
 * Single Source of Truth für plattformspezifische Caption-Darstellung
 * im Remotion-Video-Renderer (TikTok / Reels / YouTube Longform).
 *
 * Hinweis: Diese Datei liegt bewusst im Remotion-Verzeichnis, damit der
 * serverseitige Remotion-Bundler sie auflösen kann. Sie wird nicht vom
 * Frontend-Vite-Bundle geladen.
 */

export type CaptionPlatform = 'tiktok' | 'reels' | 'youtube';

/**
 * YouTube-Longform-Richtlinien (16:9, 1920×1080):
 * - Schriftgröße klassisch (2-Zeilen)  : 42–55 px  → Default 48 px
 * - Schriftgröße dynamisch/Hormozi     : 70–110 px → Default 90 px
 * - Abstand zum unteren Rand           : 60–100 px → Default 80 px
 * - Seitenränder                       : mind. 96 px (5 % der Breite)
 * - Max. Zeilen klassisch              : 2
 * - Max. Zeichen pro Zeile             : ~42
 * - Outline/Stroke                     : 3–6 px schwarz → Default 4 px
 * - Caption-Box Höhe                   : max ~160 px
 */
export const YOUTUBE_LONGFORM_CAPTION = {
  /** Klassischer Untertitel-Stil (full-line) */
  classicFontSizePx: 48,
  /** Dynamischer Wort-für-Wort / Hormozi-Stil */
  dynamicFontSizePx: 90,
  /** Abstand vom unteren Bildrand (YouTube-UI-Safe-Area) */
  bottomMarginPx: 80,
  /** Horizontaler Seitenabstand */
  sideMarginPx: 96,
  /** Maximale Zeilenanzahl */
  maxLines: 2,
  /** Maximale Zeichen pro Zeile */
  maxCharsPerLine: 42,
  /** Schwarzer Outline-Stärke in px */
  strokeWidthPx: 3,
  /** Outline-Farbe */
  strokeColor: '#000000',
  /** Zeilenhöhe */
  lineHeight: 1.25,
  /** Maximale Höhe der Caption-Box in px */
  captionBoxMaxHeightPx: 160,
} as const;

/**
 * Vertikale Position für mobile Plattformen (9:16 Shorts).
 * Werte werden als CSS-Prozentangabe verwendet.
 */
export const SHORTS_CAPTION_BOTTOM: Record<CaptionPlatform, string> = {
  tiktok: '20%',
  reels: '25%',
  youtube: '18%',
};

/**
 * Teilt einen Caption-Text in Zeilen auf, sodass:
 *  - jede Zeile max. `maxCharsPerLine` Zeichen enthält
 *  - maximal `maxLines` Zeilen entstehen
 *  - bestehende \n im Text respektiert werden
 *
 * Überschüssiger Text wird am Ende gekürzt und mit "…" versehen.
 */
export function splitCaptionIntoLines(
  text: string,
  maxCharsPerLine: number,
  maxLines: number
): string[] {
  if (!text) return [];

  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const result: string[] = [];

  for (const rawLine of rawLines) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    let currentLine = '';

    for (const word of words) {
      const needsSpace = currentLine.length > 0;
      const projected = currentLine + (needsSpace ? ' ' : '') + word;

      if (projected.length <= maxCharsPerLine) {
        currentLine = projected;
        continue;
      }

      // Zeile voll → abschließen
      if (currentLine) {
        result.push(currentLine);
        currentLine = '';
      }

      // Einzelnes Wort länger als Limit → hart umbrechen
      if (word.length > maxCharsPerLine) {
        let remaining = word;
        while (remaining.length > maxCharsPerLine) {
          result.push(remaining.slice(0, maxCharsPerLine));
          remaining = remaining.slice(maxCharsPerLine);
          if (result.length >= maxLines) break;
        }
        currentLine = remaining;
      } else {
        currentLine = word;
      }

      if (result.length >= maxLines) break;
    }

    if (currentLine && result.length < maxLines) {
      result.push(currentLine);
    }

    if (result.length >= maxLines) break;
  }

  // Auf maxLines kürzen und ggf. mit "…" abschließen
  const trimmed = result.slice(0, maxLines);
  if (trimmed.length === maxLines) {
    const last = trimmed[trimmed.length - 1];
    if (
      result.length > maxLines ||
      (rawLines.length > maxLines && last.length >= maxCharsPerLine - 1)
    ) {
      trimmed[trimmed.length - 1] =
        last.slice(0, maxCharsPerLine - 1).trimEnd() + '…';
    }
  }

  return trimmed;
}
