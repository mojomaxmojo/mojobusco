/**
 * Slide-Layout Konfiguration für Photo-Dump / Split-Screen Effekte.
 * Single Source of Truth für Labels, die im Frontend (VideoPromotion,
 * RemotionVideoBlock) angezeigt werden.
 *
 * Laufzeit-Counts und Gruppier-Logik für den Server/Remotion befinden sich in
 * server/remotion/slideLayouts.js.
 */

export type SlideLayout =
  | 'single'
  | 'split-2-v'
  | 'split-2-h'
  | 'split-3'
  | 'split-4';

export const SLIDE_LAYOUT_ORDER: SlideLayout[] = [
  'single',
  'split-2-v',
  'split-2-h',
  'split-3',
  'split-4',
];

export const LAYOUT_LABELS: Record<SlideLayout, string> = {
  single: '1 Bild',
  'split-2-v': '2 Bilder nebeneinander',
  'split-2-h': '2 Bilder übereinander',
  'split-3': 'Mosaik (3 Bilder)',
  'split-4': '4 Quadrate',
};

export const LAYOUT_SHORT_LABELS: Record<SlideLayout, string> = {
  single: '1',
  'split-2-v': '2↔',
  'split-2-h': '2↕',
  'split-3': '3▦',
  'split-4': '4▣',
};

export const LAYOUT_IMAGE_COUNTS: Record<SlideLayout, number> = {
  single: 1,
  'split-2-v': 2,
  'split-2-h': 2,
  'split-3': 3,
  'split-4': 4,
};

export const DEFAULT_SLIDE_LAYOUT: SlideLayout = 'single';
