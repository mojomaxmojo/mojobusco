import type { ColorGrade } from './components/ColorGradeOverlay';
import type { GammaFade } from './components/KenBurnsImage';
import type { TransitionType } from './components/TransitionSlideshow';
import type { RouteCoord } from './components/RouteMapLine';
import type { CaptionStyle } from './components/Captions';
import type { SlideLayout } from './slideLayouts';

export type { SlideLayout } from './slideLayouts';

export interface MojoBusVideoProps {
  imageUrls: string[];
  title: string;
  summary?: string;
  location?: string;
  country?: string;
  lifestyle?: string;
  musicUrl?: string;
  secondsPerImage?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  colorGrade?: ColorGrade;
  captions?: string[];
  captionStyle?: 'off' | 'tiktok' | 'chunked' | 'full-line' | 'minimal';
  /** Ziel-Plattform – steuert Caption-Position (safe zone) */
  platform?: 'tiktok' | 'reels' | 'youtube';
  websiteUrl?: string;
  handle?: string;
  accentColor?: string;
  motionBlurStrength?: number;

  // ── NEU: Voiceover (Piper TTS) ───────────────────────────────────────
// ── NEU: Voiceover (concat) + dynamische Slides ────────────────────────────
  /** URL der getakteten voiceover_sync.mp3 (alle Segmente concat) */
  voiceoverUrl?: string;
  /** Dynamische Slide-Dauern (Sekunden pro Bild, min = secondsPerImage) */
  perSlideArray?: number[];
  /** Lautstärke des Voiceover 0-1 (Default: 1.0) */
  voiceoverVolume?: number;
  /** URL der generierten Atmo-Spur (wav) – Meer, Regen, Wind etc. */
  ambientUrl?: string;

  // ── NEU: Kapitel-Marker (Hook + CTA Captions) ─────────────────────────
  /** Hook-Caption – wird unter dem Titel im Hook-Bereich eingeblendet */
  hookCaption?: string;
  /** CTA-Text – wird auf der Endkarte eingeblendet */
  ctaText?: string;

  // ── NEU: Beat-Sync ────────────────────────────────────────────────────
  /** Beat-Sync Stärke 0–1 (0 = aus, 1 = standard). Default: 0.6 */
  beatSyncStrength?: number;
  /** Beat-Threshold für Audio-Erkennung (0–1). Default: 0.60 */
  beatThreshold?: number;
  /** Waveform-Bar anzeigen (unten). Default: false */
  showWaveformBar?: boolean;

  // ── NEU: Beat-Sync Velocity Punch ───────────────────────────────────────
  /** Beat-synchroner Scale-Punch (Velocity-Edit-Look). Default: false */
  beatVelocityPunch?: boolean;

  // ── NEU: Transitions ─────────────────────────────────────────────────
  /** Transitions-Typ zwischen Bildern. Default: 'auto' */
  transitionType?: TransitionType;

  // ── NEU: Routen-Karte ────────────────────────────────────────────────
  /**
   * Wenn true: zeigt eine Routen-Slide in der Mitte der Slideshow.
   * Default: false
   */
  showRouteMap?: boolean;
  /**
   * Routen-Koordinaten (Prozent des Video-Frames).
   * Wenn nicht angegeben: wird aus 'country' automatisch gewählt.
   */
  routeCoords?: RouteCoord[];
  /** URL eines Karten-Hintergrundbildes für die Routen-Slide */
  mapImageUrl?: string;

  // ── NEU: Lottie Bus in CTA + Hook ─────────────────────────────────────
  /**
   * Animierten CSS/Lottie Bus in der Endkarte + Hook anzeigen.
   * Default: true
   */
  showLottieBus?: boolean;
  /** Echtes Lottie-JSON (After Effects / Bodymovin). Default: null */
  lottieData?: object | null;
  /** Beat-Puls auf dem Lottie/SVG-Bus aktivieren. Default: true */
  lottieBeatPulse?: boolean;
  /** Skalierung des Beat-Pulses (1.12 = 12% größer). Default: 1.12 */
  lottieBeatPulseScale?: number;
  /** Dauer des Pulses in Frames. Default: 8 */
  lottieBeatPulseDuration?: number;
  /** Intensität des Pulses 0–1. Default: 0.85 */
  lottieBeatPulseIntensity?: number;

  // ── NEU: Cinematic Effects (Plattform-Matrix) ─────────────────────────
  /**
   * Zoom-Punch, WhipPan, FlashCut, LightLeak, Letterbox, Match-Cut-Zoom.
   * Welche Effekte aktiv sind entscheidet die Plattform-Matrix
   * (PLATFORM_EFFECTS in CinematicEffects.tsx). Default: true
   */
  cinematicEffects?: boolean;

  /** Original-Ton des Videos im Haupt-Slide freigeben (Musik/Atmo ducken) */
  keepOriginalAudio?: boolean;

  /** Animierte Sticker/Emoji-Pops an Cut-Punkten (Beta). Default: false */
  stickersEnabled?: boolean;

  /** Sound-SFX (Whoosh/Ding/Impact) auf Cut-Punkten (Beta). Default: false */
  sfxEnabled?: boolean;
  /** URLs der generierten SFX-WAV-Dateien, keyed nach Typ (whoosh/ding/impact) */
  sfxUrls?: Record<string, string>;

  /**
   * Speed-Ramping bei Video-Clips (Beta): erste Hälfte des Slides läuft
   * langsamer (Slow-Mo-Intro), zweite Hälfte schneller (Punch-Out).
   * Nur wirksam auf Video-Slides, Bild-Slides bleiben unberührt. Default: false
   */
  speedRampEnabled?: boolean;

  // ── NEU: Photo-Dump / Split-Screen Layouts ────────────────────────────
  /**
   * Layout pro Slide. 'single' = klassisch (1 Bild pro Slide),
   * 'split-2-v'/'split-2-h' = 2 Bilder nebeneinander/übereinander,
   * 'split-3' = Mosaik mit 3 Bildern, 'split-4' = 4 Quadrate.
   * Fehlende Einträge werden als 'single' behandelt. Default: alle 'single'.
   */
  slideLayouts?: SlideLayout[];

  // ── NEU: Hook Intro Audio ─────────────────────────────────────────────
  /** URL einer kurzen Sting-Datei (z. B. Motorstart). Spielt ab Frame 0. */
  introStingUrl?: string;
  /** Lautstärke des Stings (0–1). Default: 0.8 */
  introStingVolume?: number;
  /** URL einer Intro-Musik-Spur (Bed). Läuft während des Hooks. */
  introBedUrl?: string;
  /** Lautstärke des Beds (0–1). Default: 0.5 */
  introBedVolume?: number;
  /** Fade-Out-Dauer des Beds am Hook-Ende in Sekunden. Default: 0.3 */
  introBedFadeOutSec?: number;

}