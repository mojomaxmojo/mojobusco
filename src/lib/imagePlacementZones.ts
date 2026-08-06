/**
 * Zonen-Verteilungs-Hilfsfunktion für die gleichmäßige Bildplatzierung
 * im generierten KI-Artikel.
 *
 * Reine, framework-freie Funktion ohne Seiteneffekte und ohne Browser-APIs.
 * Berechnet für jedes Bild ein Wortfenster (Start–Ende) innerhalb eines
 * Artikels fester Wortzahl, damit die KI die Bilder grob gleichmäßig über den
 * Text verteilt statt sie frei zu platzieren (bzw. gesammelt am Ende zu lassen).
 */

/**
 * Ein Wortfenster, in dem ein bestimmtes Bild platziert werden soll.
 * - `imageIndex`: 0-basiertes Bild-Index
 * - `wordStart`: erstes erlaubtes Wort (0-basiert im fortlaufenden Text)
 * - `wordEnd`: letztes erlaubtes Wort
 */
export interface PlacementZone {
  imageIndex: number;
  wordStart: number;
  wordEnd: number;
}

/** Klemmt einen Wert auf das Intervall [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Berechnet die Wortfenster für eine gleichmäßige Bildverteilung.
 *
 * Zielintervall = `totalWords / (imageCount + 1)`. Die Zone für Bild `i`
 * (0-basiert) ist `[interval * (i+1) * 0.7, interval * (i+1) * 1.3]`
 * (±30% Toleranz um den Idealpunkt, damit die KI Spielraum für einen guten
 * Szenen-Fit hat), geclamped auf `[0, totalWords]`.
 *
 * @param totalWords - Geschätzte Gesamtwortzahl des Artikels
 * @param imageCount - Anzahl der zu verteilenden Bilder
 * @returns Liste der Platzierungs-Zonen (leer, wenn `imageCount <= 0` o. `totalWords <= 0`)
 */
export function computePlacementZones(
  totalWords: number,
  imageCount: number,
): PlacementZone[] {
  if (imageCount <= 0 || totalWords <= 0) {
    return [];
  }

  const interval = totalWords / (imageCount + 1);
  const zones: PlacementZone[] = [];

  for (let i = 0; i < imageCount; i++) {
    const ideal = interval * (i + 1);
    const wordStart = clamp(ideal * 0.7, 0, totalWords);
    const wordEnd = clamp(ideal * 1.3, 0, totalWords);

    zones.push({ imageIndex: i, wordStart, wordEnd });
  }

  return zones;
}
