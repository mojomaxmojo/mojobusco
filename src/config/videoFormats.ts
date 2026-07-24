/**
 * Video-Formate & Longform-Konfiguration
 *
 * Single Source of Truth für das Format-System in VideoPromotion.tsx.
 * Neue Konfigurationen hier ablegen – niemals hartcodierte Werte im UI.
 */

export type VideoFormat = 'shorts' | 'longform'

export interface FormatConfig {
  id: VideoFormat
  label: string
  emoji: string
  desc: string
  aspectRatio: '9:16' | '16:9'
  platform: 'tiktok' | 'reels' | 'youtube'
  resolution: string
  targetDurationMin: number
  targetDurationMax: number
  defaultDurationMin: number
  /** Dauer-Vorlagen in Minuten (Longform) oder Sekunden (Shorts) */
  durationOptions: number[]
  /** Einheit für die Anzeige: 's' | 'min' */
  durationUnit: 's' | 'min'
}

export const VIDEO_FORMATS: Record<VideoFormat, FormatConfig> = {
  shorts: {
    id: 'shorts',
    label: 'Shorts',
    emoji: '🎵',
    desc: 'TikTok / Reels / YouTube Shorts',
    aspectRatio: '9:16',
    platform: 'tiktok',
    resolution: '1080×1920',
    targetDurationMin: 0.25, // 15s
    targetDurationMax: 1,    // 60s
    defaultDurationMin: 0.5, // 30s
    durationOptions: [15, 30, 45, 60],
    durationUnit: 's',
  },
  longform: {
    id: 'longform',
    label: 'YouTube Longform',
    emoji: '▶️',
    desc: 'Klassisches 16:9 Video für YouTube',
    aspectRatio: '16:9',
    platform: 'youtube',
    resolution: '1920×1080',
    targetDurationMin: 1,
    targetDurationMax: 10,
    defaultDurationMin: 3,
    durationOptions: [1, 2, 3, 5, 7, 10],
    durationUnit: 'min',
  },
}

/** Kapitel-Marker Konfiguration */
export interface ChapterConfig {
  enabled: boolean
  maxTitleLength: number
}

export const DEFAULT_CHAPTER_CONFIG: ChapterConfig = {
  enabled: true,
  maxTitleLength: 60,
}

/** Longform-spezifische Defaults */
export interface LongformDefaults {
  captionStyle: 'full-line' | 'chunked'
  beatSyncStrength: number
  transitionType: string
  showWaveformBar: boolean
  stickersEnabled: boolean
  cinematicEffects: boolean
  colorGrade: string
}

export const LONGFORM_DEFAULTS: LongformDefaults = {
  captionStyle: 'full-line',
  beatSyncStrength: 0.3,
  transitionType: 'fade',
  showWaveformBar: false,
  stickersEnabled: false,
  cinematicEffects: true,
  colorGrade: 'cinematic',
}

/** Berechnet secondsPerImage aus Ziel-Länge, Hook-Dauer, CTA-Dauer und Bild-Anzahl */
export function calculateSecondsPerImage(
  targetDurationMin: number,
  imageCount: number,
  hookSeconds: number,
  ctaSeconds = 6
): number {
  if (imageCount <= 0) return 5
  const targetSeconds = targetDurationMin * 60
  const availableSeconds = Math.max(0, targetSeconds - hookSeconds - ctaSeconds)
  return Math.max(2, Number((availableSeconds / imageCount).toFixed(2)))
}

/** Liefert die Dauer in Sekunden für ein Format */
export function getTargetDurationSeconds(
  format: VideoFormat,
  value: number
): number {
  return format === 'shorts' ? value : value * 60
}
