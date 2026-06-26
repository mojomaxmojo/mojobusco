/**
 * MojoBusVideo — Haupt-Remotion Composition (v2.0)
 *
 * NEU in v2.0:
 *  ✅ BeatSyncLayer    — Schnitte synchron zur Musik (viral!) via useAudioData
 *  ✅ TransitionWrapper — wipe, clockWipe, fade, slide, morph, zoomRelay, glitch, pagePeel (@remotion/transitions)
 *  ✅ RouteMapLine      — Animierte Routen-Linie auf Karte (@remotion/shapes)
 *  ✅ LottieBusIcon     — Animierter MojoBus in der Endkarte (@remotion/lottie)
 *
 * Transition-Logik:
 *  Jede Sequence läuft: [startFrame ... startFrame + perSlide]
 *  Das NÄCHSTE Bild startet TRANSITION_FRAMES vor Ende des aktuellen.
 *  → Überlappung = smooth Transition ohne Lücken oder Doppelframes.
 */

import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig, Video } from 'remotion';

import { KenBurnsImage, pickDirection } from './components/KenBurnsImage';
import { ColorGradeOverlay, ColorGradeWrapper, lifestyleToGrade, type ColorGrade } from './components/ColorGradeOverlay';
import { HookTitle } from './components/HookTitle';
import { LocationBadge } from './components/LocationBadge';
import { MojoBusCTA } from './components/MojoBusCTA';
import { ProgressBar } from './components/ProgressBar';
import { AudioLayer } from './components/AudioLayer';
import { FadeIn, FadeOut } from './components/CrossFade';
import { StoryCaption } from './components/StoryCaption';
import { PerSlideCaption, type CaptionStyle } from './components/Captions';
import { LoadFonts } from './components/Fonts';

// ── NEU: 4 neue Skills ────────────────────────────────────────────────────
import {
  BeatSyncLayer,
  AudioWaveformBar,
  generateFallbackBeats,
} from './components/BeatSyncLayer';
import {
  TransitionWrapper,
  WipeEdgeGlow,
  type TransitionType,
} from './components/TransitionSlideshow';
import {
  RouteMapLine,
  pickDemoRoute,
  type RouteCoord,
} from './components/RouteMapLine';
import { LottieBusIcon } from './components/LottieBusIcon';

// ── Props Interface ────────────────────────────────────────────────────────

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

  // ── NEU: Lottie Bus in CTA ────────────────────────────────────────────
  /**
   * Animierten CSS/Lottie Bus in der Endkarte anzeigen.
   * Default: true
   */
  showLottieBus?: boolean;

}

// ── calculateDuration ─────────────────────────────────────────────────────

export function calculateDuration(
  imageCount: number,
  fps: number,
  secondsPerImage: number,
  perSlideArray?: number[],
  showRouteMap?: boolean
): { totalFrames: number; hookFrames: number; ctaFrames: number; slideshowFrames: number } {
  const hookFrames      = 5 * fps;  // 5s Hook: mehr Zeit für Stop-the-Scroll (war 4s)
  const ctaFrames       = 6 * fps;
  const totalSlideCount = showRouteMap && imageCount >= 2 ? imageCount + 1 : imageCount;
  // Wenn perSlideArray übergeben: dynamische Summe, sonst fix
  const slideshowFrames = perSlideArray && perSlideArray.length === totalSlideCount
    ? perSlideArray.reduce((sum, sec) => sum + Math.round(sec * fps), 0)
    : totalSlideCount * Math.round(secondsPerImage * fps);
  const totalFrames     = hookFrames + slideshowFrames + ctaFrames;
  return { totalFrames, hookFrames, ctaFrames, slideshowFrames };
}

// ── Haupt-Komponent ────────────────────────────────────────────────────────

export const MojoBusVideo: React.FC<MojoBusVideoProps> = ({
  imageUrls,
  title,
  summary,
  location,
  country,
  lifestyle = 'mojobus',
  musicUrl,
  secondsPerImage = 5,
  colorGrade,
  captions = [],
  captionStyle = 'full-line',
  websiteUrl = 'mojobus.co',
  handle = '@mojobus',
  accentColor = '#F59E0B',
  motionBlurStrength = 1,

  // Beat-Sync
  beatSyncStrength = 0.6,
  beatThreshold = 0.60,
  showWaveformBar = false,

  // Transitions
  transitionType = 'auto',

  // Route
  showRouteMap = false,
  routeCoords,
  mapImageUrl,

  // Lottie Bus
  showLottieBus = true,

  // Voiceover
  voiceoverUrl,
  perSlideArray,
  voiceoverVolume = 1.0,
  // Ambient
  ambientUrl,

  // Kapitel-Marker
  hookCaption,
  ctaText,

}) => {
  const { fps, durationInFrames } = useVideoConfig();

  const grade      = colorGrade || lifestyleToGrade(lifestyle);
  const images     = imageUrls.slice(0, 20);
  const imageCount = images.length;

  // ── Slides: inkl. extra Routen-Slide wenn showRouteMap ────────────────
  // Der Routen-Slide wird als EXTRA Slide eingefügt, ersetzt KEIN Bild
  const hasRouteMap = showRouteMap && images.length >= 2;
  const routeSlideIndex = Math.floor(imageCount / 2);
  const totalSlideCount = hasRouteMap ? imageCount + 1 : imageCount;

  // Dynamische perSlide: perSlideArray vom Server (inkl. RouteMap), sonst fix
  const slidesSec = perSlideArray && perSlideArray.length === totalSlideCount
    ? perSlideArray
    : new Array(totalSlideCount).fill(secondsPerImage);
  const slidesFrames = slidesSec.map(s => Math.round(s * fps));

  const hookFrames = 5 * fps;  // 5s Hook (muss mit calculateDuration übereinstimmen)
  const ctaFrames  = 6 * fps;

  // routeDurFrames aus slidesFrames (enthält bereits RouteMap-Eintrag an routeSlideIndex)
  const routeDurFrames = hasRouteMap
    ? (slidesFrames[routeSlideIndex] || Math.round(secondsPerImage * fps))
    : 0;

  // Flat slide sequence: [image0, image1, ..., routeMap, imageN, ...]
  // slidesFrames hat totalSlideCount Einträge (inkl. RouteMap an routeSlideIndex)
  // Für Bilder: Index < routeSlideIndex → slidesFrames[i], Index >= routeSlideIndex → slidesFrames[i+1]
  const slideDefs: { type: 'image' | 'route'; imageIdx: number; frames: number }[] = [];
  for (let i = 0; i < images.length; i++) {
    if (hasRouteMap && i === routeSlideIndex) {
      slideDefs.push({ type: 'route', imageIdx: -1, frames: slidesFrames[routeSlideIndex] });
    }
    const framesIdx = hasRouteMap && i >= routeSlideIndex ? i + 1 : i;
    slideDefs.push({ type: 'image', imageIdx: i, frames: slidesFrames[framesIdx] || perSlide });
  }

  const totalSlides = slideDefs.length;
  const slideshowFrames = slideDefs.reduce((sum, s) => sum + s.frames, 0); // inkl. RouteMap

  const slideStartFrame = (idx: number) =>
    hookFrames + slideDefs.slice(0, idx).reduce((sum, s) => sum + s.frames, 0);

  // perSlide für Legacy
  const perSlide = Math.round((perSlideArray?.[0] || secondsPerImage) * fps);

  // ── Video-Erkennung ────────────────────────────────────────────────────
  const isVideo = (url: string) => /\.(mp4|webm|mov|avi|mkv)(\?|#|$)/i.test(url);

  // ── MediaRenderer: wählt je nach URL-Typ KenBurnsImage oder Video ──────
  const MediaRenderer: React.FC<{ src: string; index: number }> = ({ src, index }) => {
    if (isVideo(src)) {
      return (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Video
            src={src}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </AbsoluteFill>
      );
    }
    return (
      <KenBurnsImage
        src={src}
        direction={pickDirection(index)}
        intensity={0.10}
        motionBlurStrength={0}
      />
    );
  };

  // Transition: 20 Frames (0.67s bei 30fps) — sanftes Überblenden
  const TRANSITION_FRAMES = Math.round(fps * 0.67); // ~20 Frames @ 30fps

  const hookEmoji = ({
    mojobus: '🚌', vanlife: '🚐', rvlife: '🏕️',
    beachlife: '🌊', wohnmobil: '🏠', 'perpetual-travelers': '🌍',
  } as Record<string, string>)[lifestyle] ?? '🌍';

  const hasCaptions = captionStyle !== 'off' && captions.length > 0;

  // ── Beat-Sync: Fallback-Beats vorberechnen ────────────────────────────
  const fallbackBeats = generateFallbackBeats(
    durationInFrames,
    fps,
    secondsPerImage,
    imageCount,
    hookFrames
  );

  // ── Routen-Koordinaten ────────────────────────────────────────────────
  const effectiveRouteCoords = routeCoords && routeCoords.length >= 2
    ? routeCoords
    : pickDemoRoute(country);

  return (
    <AbsoluteFill style={{ background: '#000' }}>

      {/* Fonts */}
      <LoadFonts />

      {/* ══ SCHICHT 1: Bilder mit Ken Burns + Transitions ══════════════════ */}
      <ColorGradeWrapper grade={grade}>

        {/* HOOK — erstes Bild, blendet am Ende aus */}
        {images[0] && (
          <Sequence from={0} durationInFrames={hookFrames + TRANSITION_FRAMES}>
            <FadeOut
              durationFrames={TRANSITION_FRAMES}
              totalFrames={hookFrames + TRANSITION_FRAMES}
            >
              <MediaRenderer src={images[0]} index={0} />
            </FadeOut>
          </Sequence>
        )}

        {/* SLIDESHOW — alle Slides (Bilder + ggf. Routen-Karte dazwischen) */}
        {slideDefs.map((def, i) => {
          const isLastSlide = i === totalSlides - 1;
          const isRoute = def.type === 'route';
          const absoluteStart = slideStartFrame(i);
          const thisSlideFrames = def.frames;
          const seqDuration = isLastSlide ? thisSlideFrames : thisSlideFrames + TRANSITION_FRAMES;
          const nextDef = !isLastSlide ? slideDefs[i + 1] : undefined;

          return (
            <Sequence key={`slide-${i}`} from={absoluteStart} durationInFrames={seqDuration}>
              {isRoute ? (
                <RouteMapLine
                  coords={effectiveRouteCoords}
                  mapImageUrl={mapImageUrl}
                  color="#FFFFFF"
                  accentColor={accentColor}
                  strokeWidth={4}
                  animType="both"
                  showLabels={true}
                  showBusMarker={true}
                  overlayOpacity={mapImageUrl ? 0.4 : 0}
                />
              ) : (
                <FadeOut
                  durationFrames={TRANSITION_FRAMES}
                  totalFrames={seqDuration}
                >
                  <MediaRenderer src={images[def.imageIdx]} index={def.imageIdx + 1} />
                </FadeOut>
              )}
              {/* Wipe-Edge-Glow nur bei wipe/auto und nicht auf Route */}
              {!isRoute && (transitionType === 'wipe' || transitionType === 'auto') && (
                <WipeEdgeGlow
                  durationFrames={TRANSITION_FRAMES}
                  color={accentColor}
                  direction={i % 2 === 0 ? 'left' : 'right'}
                />
              )}
            </Sequence>
          );
        })}

        {/* CTA Hintergrund — letztes Bild, sehr langsamer Zoom */}
        {images[imageCount - 1] && (
          <Sequence from={hookFrames + slideshowFrames} durationInFrames={ctaFrames}>
            <FadeIn durationFrames={20}>
              <MediaRenderer src={images[imageCount - 1]} index={imageCount + 1} />
            </FadeIn>
          </Sequence>
        )}

      </ColorGradeWrapper>

      {/* ══ SCHICHT 2: Color Grade Overlay ══════════════════════════════════ */}
      <ColorGradeOverlay grade={grade} />

      {/* ══ SCHICHT 4: Hook Titel (erste 4s) ════════════════════════════════ */}
      <Sequence from={0} durationInFrames={hookFrames}>
        <HookTitle
          title={title}
          subtitle={location || lifestyle.toUpperCase()}
          caption={hookCaption}
          emoji={hookEmoji}
          fromFrame={5}
          toFrame={hookFrames - 5}
          accentColor={accentColor}
        />
      </Sequence>

      {/* ══ SCHICHT 5: Location Badge ════════════════════════════════════════ */}
      {location && imageCount >= 2 && (
        <Sequence from={slideStartFrame(1)} durationInFrames={slideDefs.slice(1, 3).reduce((a, b) => a + b.frames, 0) || perSlide * 2}>
          <LocationBadge
            location={location}
            country={country}
            fromFrame={10}
            toFrame={(slidesFrames[1] + slidesFrames[2] || perSlide * 2) - 10}
            position="bottom-left"
          />
        </Sequence>
      )}

      // ── Auto-Captions ══════════════════════════════════════════
      {/* ══ SCHICHT 6: Per-Slide Captions (dynamisch, synchron) ════════════════ */}
      {hasCaptions && (
        <PerSlideCaption
          captions={(() => {
            const c = [...captions];
            if (showRouteMap) c.splice(routeSlideIndex, 0, '');
            return c;
          })()}
          slidesStartFrame={hookFrames}
          slidesFrames={slideDefs.map(d => d.frames)}
          style={captionStyle as 'tiktok' | 'chunked' | 'full-line'}
          accentColor={accentColor}
        />
      )}

      {/* ══ SCHICHT 7: Summary Subtitle (Mitte, ohne Captions) ═══════════════ */}
      {summary && imageCount >= 3 && !hasCaptions && (
        <Sequence
          from={slideStartFrame(Math.floor(imageCount / 2))}
          durationInFrames={slidesFrames[Math.floor(imageCount / 2)] || perSlide}
        >
          <StoryCaption
            text={summary.slice(0, 80)}
            fromFrame={10}
            toFrame={perSlide - 10}
            position="bottom"
            style="subtitle"
            accentColor={accentColor}
          />
        </Sequence>
      )}

      {/* ══ SCHICHT 8: Manuelle Captions (wenn kein AutoCaption) ═════════════ */}
      {!hasCaptions && captions.map((caption, i) => {
        if (!caption) return null;
        const slideDef = slideDefs[i];
        if (!slideDef || slideDef.type === 'route') return null; // Route-Slide überspringen
        const sf = slideStartFrame(i) + Math.round(fps * 0.5);
        const ef = slideStartFrame(i) + (slideDef.frames) - Math.round(fps * 0.5);
        return (
          <StoryCaption
            key={`cap-${i}`}
            text={caption}
            fromFrame={sf}
            toFrame={ef}
            position="bottom"
            style="minimal"
            accentColor={accentColor}
          />
        );
      })}

      {/* ══ SCHICHT 9: CTA Endkarte ══════════════════════════════════════════ */}
      <Sequence from={hookFrames + slideshowFrames} durationInFrames={ctaFrames}>
        <MojoBusCTA
          lifestyle={lifestyle}
          websiteUrl={websiteUrl}
          handle={handle}
          accentColor={accentColor}
          ctaText={ctaText}
        />
      </Sequence>

      {/* ══ NEU SCHICHT 9b: Lottie Bus in CTA ═══════════════════════════════ */}
      {showLottieBus && (
        <Sequence
          from={hookFrames + slideshowFrames + Math.round(fps * 0.3)}
          durationInFrames={ctaFrames}
        >
          <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <LottieBusIcon
              size={175}
              accentColor={accentColor}
              driveIn={true}
              driveInPath="curve-down"
              position="bottom-center"
            />
          </AbsoluteFill>
        </Sequence>
      )}

      {/* ══ SCHICHT 10: Progress Bar ══════════════════════════════════════════ */}
      <ProgressBar
        color={accentColor}
        height={3}
        position="top"
        startFrame={hookFrames}
        endFrame={hookFrames + slideshowFrames}
      />

      {/* ══ NEU SCHICHT 10b: Waveform Bar (optional) ═════════════════════════ */}
      {showWaveformBar && musicUrl && (
        <Sequence from={hookFrames} durationInFrames={slideshowFrames}>
          <AudioWaveformBar
            musicUrl={musicUrl}
            accentColor={accentColor}
            numberOfBars={48}
            position="bottom"
            height={40}
            opacity={0.45}
          />
        </Sequence>
      )}

      {/* ══ SCHICHT 11: Audio (Musik) ════════════════════════════════════════ */}
      {musicUrl && (
        <AudioLayer
          src={musicUrl}
          volume={0.49}
          fadeInSec={2}
          fadeOutSec={3}
        />
      )}

      {/* ══ SCHICHT 11b: Audio (Voiceover) – startet mit Slideshow, nicht Hook ═══
           Voiceover enthält nur Body-Sätze (kein Hook-Text).
           startFrom=hookFrames: Audio startet synchron mit Slide 0 der Slideshow.
           Hook-Slide (0-4s): kein Voiceover, nur HookTitle-Text auf dem Screen. */}
      {voiceoverUrl && (
        <Sequence from={hookFrames}>
          <AudioLayer
            src={voiceoverUrl}
            volume={voiceoverVolume}
            fadeInSec={0.1}
            fadeOutSec={0.5}
          />
        </Sequence>
      )}

      {/* ══ SCHICHT 11c: Audio (Ambient/Atmo) – leise im Hintergrund ════ */}
      {ambientUrl && (
        <AudioLayer
          src={ambientUrl}
          volume={0.20}
          fadeInSec={3}
          fadeOutSec={3}
        />
      )}

      {/* ══ NEU SCHICHT 12: Beat-Sync Flash Effekt ═══════════════════════════ */}
      {beatSyncStrength > 0 && (
        <Sequence from={hookFrames} durationInFrames={slideshowFrames}>
          <BeatSyncLayer
            musicUrl={musicUrl}
            beatThreshold={beatThreshold}
            accentColor={accentColor}
            flashOpacity={0.15}
            strength={beatSyncStrength}
            fallbackBeats={fallbackBeats}
          />
        </Sequence>
      )}

    </AbsoluteFill>
  );
};
