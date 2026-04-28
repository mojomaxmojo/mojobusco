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
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';

import { KenBurnsImage, pickDirection } from './components/KenBurnsImage';
import { ColorGradeOverlay, ColorGradeWrapper, lifestyleToGrade, type ColorGrade } from './components/ColorGradeOverlay';
import { HookTitle } from './components/HookTitle';
import { LocationBadge } from './components/LocationBadge';
import { MojoBusCTA } from './components/MojoBusCTA';
import { ProgressBar } from './components/ProgressBar';
import { AudioLayer } from './components/AudioLayer';
import { FadeIn, FadeOut } from './components/CrossFade';
import { StoryCaption } from './components/StoryCaption';
import { AutoCaptions, type CaptionStyle } from './components/Captions';
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
  captionStyle?: 'off' | CaptionStyle;
  websiteUrl?: string;
  handle?: string;
  accentColor?: string;
  motionBlurStrength?: number;

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
  secondsPerImage: number
): { totalFrames: number; hookFrames: number; ctaFrames: number; slideshowFrames: number } {
  const hookFrames      = 4 * fps;
  const ctaFrames       = 6 * fps;
  const perSlide        = Math.round(secondsPerImage * fps);
  const slideshowFrames = imageCount * perSlide;
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
  captionStyle = 'tiktok',
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

}) => {
  const { fps, durationInFrames } = useVideoConfig();

  const grade      = colorGrade || lifestyleToGrade(lifestyle);
  const images     = imageUrls.slice(0, 20);
  const imageCount = images.length;

  const { hookFrames, ctaFrames, slideshowFrames } = calculateDuration(
    imageCount, fps, secondsPerImage
  );

  const perSlide = Math.round(secondsPerImage * fps);

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

  // ── Routen-Slide: in der Mitte der Slideshow (Bild 2 oder 3) ─────────
  // Wir nehmen den mittleren Slide als Routen-Karte
  const routeSlideIndex = Math.floor(imageCount / 2);
  const routeSlideStart = hookFrames + routeSlideIndex * perSlide;

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
              <KenBurnsImage
                src={images[0]}
                direction={pickDirection(0)}
                intensity={0.08}
                motionBlurStrength={0}
              />
            </FadeOut>
          </Sequence>
        )}

        {/* SLIDESHOW — jedes Bild mit TransitionWrapper */}
        {images.map((src, i) => {
          const absoluteStart = hookFrames + i * perSlide;
          const seqDuration = i < imageCount - 1
            ? perSlide + TRANSITION_FRAMES
            : perSlide;

          // Routen-Slide: zeige RouteMapLine statt Bild (wenn showRouteMap)
          const isRouteSlide = showRouteMap && i === routeSlideIndex;

          return (
            <Sequence
              key={i}
              from={absoluteStart}
              durationInFrames={seqDuration}
            >
              {/* NEU: TransitionWrapper ersetzt CrossDissolve */}
              <TransitionWrapper
                type={transitionType}
                durationFrames={TRANSITION_FRAMES}
                imageIndex={i}
              >
                {/* FadeOut am Ende (außer letztem Bild) */}
                {i < imageCount - 1 ? (
                  <FadeOut
                    durationFrames={TRANSITION_FRAMES}
                    totalFrames={seqDuration}
                  >
                    {isRouteSlide ? (
                      /* ── Routen-Karte ── */
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
                      <KenBurnsImage
                        src={src}
                        direction={pickDirection(i + 1)}
                        intensity={0.10}
                        motionBlurStrength={0}
                      />
                    )}
                  </FadeOut>
                ) : (
                  isRouteSlide ? (
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
                    <KenBurnsImage
                      src={src}
                      direction={pickDirection(i + 1)}
                      intensity={0.10}
                      motionBlurStrength={0}
                    />
                  )
                )}
              </TransitionWrapper>

              {/* NEU: Wipe-Edge-Glow bei wipe-Transitions */}
              {(transitionType === 'wipe' || transitionType === 'auto') && (
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
              <KenBurnsImage
                src={images[imageCount - 1]}
                direction="zoom-out"
                intensity={0.03}
                motionBlurStrength={0}
              />
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
          emoji={hookEmoji}
          fromFrame={5}
          toFrame={hookFrames - 5}
          accentColor={accentColor}
        />
      </Sequence>

      {/* ══ SCHICHT 5: Location Badge ════════════════════════════════════════ */}
      {location && imageCount >= 2 && (
        <Sequence from={hookFrames + perSlide} durationInFrames={perSlide * 2}>
          <LocationBadge
            location={location}
            country={country}
            fromFrame={10}
            toFrame={perSlide * 2 - 10}
            position="bottom-left"
          />
        </Sequence>
      )}

      {/* ══ SCHICHT 6: Auto-Captions ══════════════════════════════════════════ */}
      {hasCaptions && (
        <AutoCaptions
          captions={captions}
          framesPerCaption={perSlide}
          startFrame={hookFrames}
          style={captionStyle as CaptionStyle}
          accentColor={accentColor}
          position="bottom"
        />
      )}

      {/* ══ SCHICHT 7: Summary Subtitle (Mitte, ohne Captions) ═══════════════ */}
      {summary && imageCount >= 3 && !hasCaptions && (
        <Sequence
          from={hookFrames + Math.floor(imageCount / 2) * perSlide}
          durationInFrames={perSlide}
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
        const sf = hookFrames + i * perSlide + Math.round(fps * 0.5);
        const ef = hookFrames + (i + 1) * perSlide - Math.round(fps * 0.5);
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
              size={140}
              accentColor={accentColor}
              driveIn={true}
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

      {/* ══ SCHICHT 11: Audio ════════════════════════════════════════════════ */}
      {musicUrl && (
        <AudioLayer
          src={musicUrl}
          volume={0.72}
          fadeInSec={2}
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
