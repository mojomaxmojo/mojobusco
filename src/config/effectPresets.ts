/**
 * Effekt-Presets für /promotion/tiktok
 *
 * Reine Daten – keine Seiteneffekte, kein Import an anderer Stelle.
 * Fundament für Schritt 6 (Effekt-Presets im UI), siehe FEATURE-PLAN.md.
 */

export type EffectPresetId = 'energetic' | 'cinematic' | 'cozy';

export interface EffectPreset {
  id: EffectPresetId;
  label: string;
  emoji: string;
  desc: string;
  colorGrade: string;
  transitionType: string;
  captionStyle: 'chunked' | 'full-line';
  stickersEnabled: boolean;
  sfxEnabled: boolean;
  ambientType?: string;
}

export const EFFECT_PRESETS: EffectPreset[] = [
  {
    id: 'energetic',
    label: 'Energetic',
    emoji: '🔥',
    desc: 'Schnell, laut, viral – Teal-Orange, Wipe-Übergänge, Karaoke-Captions, Sticker & SFX an.',
    colorGrade: 'teal-orange',
    transitionType: 'wipe',
    captionStyle: 'chunked',
    stickersEnabled: true,
    sfxEnabled: true,
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    emoji: '🎬',
    desc: 'Ruhig, edel, moody – sanfte Fades, volle Zeilen-Captions, keine Sticker/SFX.',
    colorGrade: 'moody',
    transitionType: 'fade',
    captionStyle: 'full-line',
    stickersEnabled: false,
    sfxEnabled: false,
  },
  {
    id: 'cozy',
    label: 'Cozy Vanlife',
    emoji: '🏕️',
    desc: 'Warm, gemütlich, Lagerfeuer-Stimmung – warme Farben, automatische Übergänge.',
    colorGrade: 'warm',
    transitionType: 'auto',
    captionStyle: 'full-line',
    stickersEnabled: false,
    sfxEnabled: false,
    ambientType: 'fire',
  },
];
