/**
 * effectPresets.ts – Effekt-Voreinstellungen für TikTok-Videos
 *
 * Definiert die 3 Presets „Energetic“, „Cinematic“ und „Cozy Vanlife“,
 * die in Schritt 6 (Effekt-Presets im UI) als 1-Klick-Kombinationen
 * aus Farblook, Übergang, Caption-Stil, Stickern und SFX verwendet werden.
 *
 * Reine Daten – keine Seiteneffekte, keine Imports in bestehende Dateien.
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
    desc: 'Schnelle Schnitte, Teal-Orange, Karaoke-Captions, Sticker, SFX',
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
    desc: 'Filmisch, Moody-Farblook, Fade-Übergänge, Full-Line-Captions',
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
    desc: 'Warme Farben, automatische Übergänge, Full-Line-Captions, Lagerfeuer-Atmo',
    colorGrade: 'warm',
    transitionType: 'auto',
    captionStyle: 'full-line',
    stickersEnabled: false,
    sfxEnabled: false,
    ambientType: 'fire',
  },
];
