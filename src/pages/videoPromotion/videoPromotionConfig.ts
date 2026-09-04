/**
 * videoPromotionConfig.ts – Konstanten, Typen und reine Hilfsfunktionen
 * aus VideoPromotion.tsx (1:1 verschoben, PLAN6 Schritt 1).
 */

// ── Hero-Wort-Markup ══════════════════════════════════════════
// Die KI markiert pro bodyLine ein Schlüsselwort mit **Wort** (siehe
// FEATURE-PLAN.md Schritt 5 – Hook-Wort-Zoom). Dieses Markup ist NUR für
// die Video-Caption gedacht (steuert dort den Zusatz-Zoom). Überall sonst,
// wo bodyText angezeigt, kopiert, exportiert oder gesprochen wird
// (Voiceover, TikTok-Text-Kopie, Nostr-Publish-Beschreibung, Vorschau-Karten),
// müssen die Sternchen entfernt werden.
export function stripHeroMarkup(text: string): string {
  if (!text) return text
  return text.replace(/\*\*(.+?)\*\*/g, '$1')
}

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type TikTokTemplate = 'story' | 'listicle' | 'reveal' | 'movie' | 'retention'

export interface TikTokTemplateInfo {
  id: TikTokTemplate
  label: string
  emoji: string
  desc: string
  duration: string
  /** Anzahl der benötigten Bilder/Clips */
  minImages: number
}

export interface RenderStatus {
  jobId: string
  status: 'queued' | 'rendering' | 'completed' | 'failed' | 'rendering-thumbnail'
  progress: number
  fileSizeMB: number | null
  videoDurationSec: number | null
  thumbnailUrl: string | null
  error: string | null
  loudness?: {
    normalized: boolean
    targetI?: number
    targetTP?: number
    measuredI?: number
    measuredTP?: number
    reason?: string
  } | null
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

export const TEMPLATES: TikTokTemplateInfo[] = [
  {
    id: 'story',
    label: 'Story',
    emoji: '🌅',
    desc: 'Ken-Burns Diashow – minimaler Text, maximale Atmosphäre',
    duration: '15-25s',
    minImages: 3,
  },
  {
    id: 'retention',
    label: 'Retention',
    emoji: '🔁',
    desc: 'Hook öffnet, Ende schließt – Loop-fähig, für kaltes TikTok-Publikum',
    duration: '15-30s',
    minImages: 3,
  },
  {
    id: 'listicle',
    label: 'Listicle',
    emoji: '📋',
    desc: 'Liste mit 3-5 Punkten – Tipps, Fakten, Learnings',
    duration: '25-35s',
    minImages: 3,
  },
  {
    id: 'reveal',
    label: 'Reveal',
    emoji: '🔥',
    desc: 'Nostr/Wohnmobil-Erklärung – "Warum dieser Blog anders ist"',
    duration: '20-30s',
    minImages: 3,
  },
  {
    id: 'movie',
    label: 'Direkt-Video',
    emoji: '🎬',
    desc: 'Vorhandenes Video + Captions + Overlays',
    duration: '15-30s',
    minImages: 1,
  },
]

/** Verfügbare Stimmen (Edge TTS primär + Piper Fallback)
 *
 * Seraphina (Multilingual) ist Standard – klingt am natürlichsten.
 * Hinweis: Multilingual-Stimmen können bei Fremdwörtern/Anglizismen
 * gelegentlich "denglisch" klingen bzw. Umlaute anders betonen – die
 * klassischen Stimmen darunter sind Alternativen, falls das stört.
 */
export const VOICES = [
  // Edge TTS – "Multilingual"-Stimmen (beste, natürlichste Klangqualität)
  { id: 'de-DE-SeraphinaMultilingualNeural', label: 'Seraphina ⭐',   desc: 'Edge · Weiblich, beste Qualität', engine: 'edge' },
  { id: 'de-DE-FlorianMultilingualNeural',   label: 'Florian',       desc: 'Edge · Männlich, sehr natürlich', engine: 'edge' },
  // Edge TTS – klassische, rein deutsche Stimmen (Alternative bei Denglisch-Problemen)
  { id: 'de-DE-KatjaNeural',                 label: 'Katja',         desc: 'Edge · Weiblich, klar & rein Deutsch', engine: 'edge' },
  { id: 'de-DE-ConradNeural',                label: 'Conrad',        desc: 'Edge · Männlich, tief & rein Deutsch', engine: 'edge' },
  { id: 'de-DE-AmalaNeural',                 label: 'Amala',         desc: 'Edge · Weiblich, freundlich',  engine: 'edge' },
  { id: 'de-DE-KillianNeural',               label: 'Killian',       desc: 'Edge · Männlich, jung',        engine: 'edge' },
  { id: 'de-DE-GiselaNeural',                label: 'Gisela',        desc: 'Edge · Weiblich, sanft',        engine: 'edge' },
  { id: 'de-DE-BerndNeural',                 label: 'Bernd',         desc: 'Edge · Männlich, ruhig',        engine: 'edge' },
  { id: 'de-DE-ElkeNeural',                  label: 'Elke',          desc: 'Edge · Weiblich, warm',         engine: 'edge' },
  { id: 'de-DE-RalfNeural',                  label: 'Ralf',          desc: 'Edge · Männlich, sachlich',     engine: 'edge' },
  { id: 'de-DE-TanjaNeural',                 label: 'Tanja',         desc: 'Edge · Weiblich, energisch',    engine: 'edge' },
  // Piper TTS (Fallback) – lokal auf VPS
  { id: 'de_DE-thorsten-medium',             label: 'Thorsten',      desc: 'Piper · Männlich',            engine: 'piper' },
  { id: 'de_DE-ramona-low',                  label: 'Ramona',        desc: 'Piper · Weiblich',            engine: 'piper' },
]

/** Musik-Optionen – werden dynamisch vom Server geladen */
export const STATIC_MUSIC_OPTIONS = [
  { value: '__random__', label: '🎲 Zufällig' },
  { value: '__none__', label: '🔇 Keine Musik' },
]

/** Atmo-Geräusche (via FFmpeg lavfi generiert) */
export const AMBIENT_OPTIONS = [
  { value: '__none__', label: '🔇 Kein Atmo' },
  { value: 'ocean', label: '🌊 Meeresrauschen' },
  { value: 'rain', label: '☔ Regen' },
  { value: 'wind', label: '🌬️ Wind' },
  { value: 'fire', label: '🔥 Lagerfeuer' },
  { value: 'forest', label: '🌲 Vogelgezwitscher' },
]

/** Übergangs-Optionen */
export const TRANSITION_OPTIONS = [
  { value: 'auto', label: '🔄 Auto' },
  { value: 'fade', label: '🎭 Fade' },
  { value: 'wipe', label: '🧹 Wipe' },
  { value: 'slide', label: '➡️ Slide' },
  { value: 'glitch', label: '📺 Glitch' },
  { value: 'irisWipe', label: '👁️ Iris' },
  { value: 'starWipe', label: '⭐ Star' },
  { value: 'heartWipe', label: '❤️ Heart' },
  { value: 'scalePopIn', label: '💥 Pop-In' },
  { value: 'bounceScale', label: '⚡ Bounce' },
  { value: 'diagonalWipe', label: '↗️ Diagonal' },
  { value: 'cardFlip', label: '🃏 Flip' },
]

/** Farblook-Optionen (Color-Grade-Presets) */
export const COLOR_GRADE_OPTIONS = [
  { value: 'auto', label: '🎨 Auto' },
  { value: 'golden', label: '✨ Golden' },
  { value: 'warm', label: '🔥 Warm' },
  { value: 'moody', label: '🌙 Moody' },
  { value: 'blue', label: '🌊 Blue' },
  { value: 'teal-orange', label: '🎬 Teal-Orange' },
  { value: 'vintage', label: '📻 Vintage' },
  { value: 'vhs', label: '📺 VHS' },
  { value: 'glitch', label: '🌀 Glitch' },
  { value: 'duotone', label: '🎭 Duotone' },
]

// ── Hilfsfunktion: Markdown bereinigen ════════════════════════════
export const cleanMarkdown = (content: string): string =>
  content
    .replace(/\[BILD_\d+\]/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

// Prüfe ob ein Event Video-URLs enthält
export const hasVideoUrls = (event: any): boolean => {
  if (!event?.tags) return false
  return event.tags.some((t: string[]) =>
    (t[0] === 'url' || t[0] === 'r') &&
    /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(t[1])
  )
}
