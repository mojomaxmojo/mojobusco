/**
 * slideLayouts.js — Photo-Dump/Split-Screen Layout Logik
 *
 * Wird sowohl vom Remotion-Bundler (TSX) als auch von Node (render.js)
 * importiert. Deshalb als reines JS-Modul mit JSDoc-Typen.
 */

/** @typedef {'single'|'split-2-v'|'split-2-h'|'split-3'|'split-4'} SlideLayout */

/** @type {Record<SlideLayout, number>} */
export const LAYOUT_IMAGE_COUNTS = {
  single: 1,
  'split-2-v': 2,
  'split-2-h': 2,
  'split-3': 3,
  'split-4': 4,
};

/** @type {SlideLayout[]} */
export const SLIDE_LAYOUT_ORDER = [
  'single',
  'split-2-v',
  'split-2-h',
  'split-3',
  'split-4',
];

/** @type {Record<SlideLayout, string>} */
export const LAYOUT_LABELS = {
  single: 'Single',
  'split-2-v': '2 nebeneinander',
  'split-2-h': '2 übereinander',
  'split-3': 'Mosaik (3)',
  'split-4': '4 Quadrate',
};

/** @type {Record<SlideLayout, string>} */
export const LAYOUT_EMOJIS = {
  single: '🖼️',
  'split-2-v': '◫',
  'split-2-h': '⫯',
  'split-3': '▦',
  'split-4': '▣',
};

/**
 * Gruppiert Bilder anhand der gewünschten Layouts.
 * Nicht zugewiesene Layouts werden als 'single' behandelt.
 * Wenn für ein Layout nicht genug Bilder übrig sind, fällt auf 'single' zurück.
 *
 * @param {string[]} imageUrls
 * @param {SlideLayout[]} [layouts=[]]
 * @returns {{ layout: SlideLayout; imageIndices: number[] }[]}
 */
export function groupImagesIntoSlides(imageUrls, layouts = []) {
  if (!imageUrls || imageUrls.length === 0) return [];

  const groups = [];
  let imgIdx = 0;
  let layoutIdx = 0;

  while (imgIdx < imageUrls.length) {
    const requested = layouts[layoutIdx] || 'single';
    const requestedCount = LAYOUT_IMAGE_COUNTS[requested] ?? 1;
    const remaining = imageUrls.length - imgIdx;

    // Nicht genug Bilder für das gewünschte Layout -> single verwenden
    const layout = requestedCount <= remaining ? requested : 'single';
    const count = LAYOUT_IMAGE_COUNTS[layout] ?? 1;

    const imageIndices = [];
    for (let i = 0; i < count && imgIdx < imageUrls.length; i++) {
      imageIndices.push(imgIdx);
      imgIdx++;
    }

    if (imageIndices.length > 0) {
      groups.push({ layout, imageIndices });
    }

    layoutIdx++;
  }

  return groups;
}

/**
 * Berechnet den Slide-Index an dem die Routen-Karte eingefügt werden soll,
 * basierend auf der Hälfte der konsumierten Bilder (wie bisher, aber
 * layout-aware).
 *
 * @param {{ layout: SlideLayout; imageIndices: number[] }[]} groups
 * @returns {number}
 */
export function findRouteSlideIndex(groups) {
  if (!groups || groups.length === 0) return 0;
  const totalImages = groups.reduce((sum, g) => sum + g.imageIndices.length, 0);
  const target = totalImages / 2;
  let consumed = 0;
  for (let i = 0; i < groups.length; i++) {
    consumed += groups[i].imageIndices.length;
    if (consumed >= target) return i + 1; // Route-Slide NACH diesem Slide
  }
  return Math.floor(groups.length / 2);
}

/**
 * Hilfsfunktion für Server: reduziert ein bild-indiziertes Array auf ein
 * slide-indiziertes Array, indem der Wert des ersten Bildes pro Slide genommen wird.
 *
 * @template T
 * @param {T[]} arr
 * @param {{ imageIndices: number[] }[]} groups
 * @returns {T[]}
 */
export function reduceToSlides(arr, groups) {
  if (!arr || !groups) return [];
  return groups.map((g) => arr[g.imageIndices[0]]);
}

/**
 * Kombiniert mehrere Texte pro Slide zu einem String (für Captions/Voiceover).
 * Leere Einträge werden ignoriert.
 *
 * @param {string[]} arr
 * @param {{ imageIndices: number[] }[]} groups
 * @returns {string[]}
 */
export function combineSlideTexts(arr, groups) {
  if (!arr || !groups) return [];
  return groups.map((g) =>
    g.imageIndices.map((idx) => arr[idx] || '').filter(Boolean).join(' ')
  );
}
