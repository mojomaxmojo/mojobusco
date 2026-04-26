/**
 * MojoBusVideo — Haupt-Remotion Composition
 *
 * Fix: Hackeln durch falsche Sequence-Überlappung + CSS blur() entfernt
 *
 * Transition-Logik:
 *  Jede Sequence läuft: [startFrame ... startFrame + perSlide]
 *  Das NÄCHSTE Bild startet TRANSITION_FRAMES vor Ende des aktuellen.
 *  → Überlappung = smooth Cross-Dissolve ohne Lücken oder Doppelframes.
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
import { FilmGrain } from './components/FilmGrain';
import { FadeIn, FadeOut, CrossDissolve } from './components/CrossFade';
import { StoryCaption } from './components/StoryCaption';
import { AutoCaptions, type CaptionStyle } from './components/Captions';
import { LoadFonts } from './components/Fonts';

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
  filmGrain?: 'none' | 'fine' | 'medium' | 'coarse';
  captions?: string[];
  captionStyle?: 'off' | CaptionStyle;
  websiteUrl?: string;
  handle?: string;
  accentColor?: string;
  motionBlurStrength?: number;
}

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
  filmGrain = 'fine',
  captions = [],
  captionStyle = 'tiktok',
  websiteUrl = 'mojobus.co',
  handle = '@mojobus',
  accentColor = '#F59E0B',
  motionBlurStrength = 1,
}) => {
  const { fps } = useVideoConfig();

  const grade      = colorGrade || lifestyleToGrade(lifestyle);
  const images     = imageUrls.slice(0, 20);
  const imageCount = images.length;

  const { hookFrames, ctaFrames, slideshowFrames } = calculateDuration(
    imageCount, fps, secondsPerImage
  );

  const perSlide = Math.round(secondsPerImage * fps);

  // Transition: 20 Frames (0.67s bei 30fps) — sanftes Cross-Dissolve
  // Nicht zu kurz (< 12 = hakelig) nicht zu lang (> 30 = träge)
  const TRANSITION_FRAMES = Math.round(fps * 0.67); // ~20 Frames @ 30fps

  const hookEmoji = ({
    mojobus: '🚌', vanlife: '🚐', rvlife: '🏕️',
    beachlife: '🌊', wohnmobil: '🏠', 'perpetual-travelers': '🌍',
  } as Record<string, string>)[lifestyle] ?? '🌍';

  const hasCaptions = captionStyle !== 'off' && captions.length > 0;

  return (
    <AbsoluteFill style={{ background: '#000' }}>

      {/* Fonts */}
      <LoadFonts />

      {/* ══ SCHICHT 1: Bilder mit Ken Burns ══════════════════════════════ */}
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

        {/* SLIDESHOW — jedes Bild überlappt mit dem nächsten via CrossDissolve */}
        {images.map((src, i) => {
          const absoluteStart = hookFrames + i * perSlide;
          // Jede Sequence läuft perSlide + TRANSITION_FRAMES lang
          // damit die Überlappung mit dem nächsten Bild sauber ist
          const seqDuration = i < imageCount - 1
            ? perSlide + TRANSITION_FRAMES
            : perSlide; // letztes Bild: kein Overlap nötig

          return (
            <Sequence
              key={i}
              from={absoluteStart}
              durationInFrames={seqDuration}
            >
              {/* Einblenden am Anfang */}
              <CrossDissolve durationFrames={TRANSITION_FRAMES}>
                {/* Ausblenden am Ende (außer letztem Bild) */}
                {i < imageCount - 1 ? (
                  <FadeOut
                    durationFrames={TRANSITION_FRAMES}
                    totalFrames={seqDuration}
                  >
                    <KenBurnsImage
                      src={src}
                      direction={pickDirection(i + 1)}
                      intensity={0.10}
                      motionBlurStrength={0}
                    />
                  </FadeOut>
                ) : (
                  <KenBurnsImage
                    src={src}
                    direction={pickDirection(i + 1)}
                    intensity={0.10}
                    motionBlurStrength={0}
                  />
                )}
              </CrossDissolve>
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

      {/* ══ SCHICHT 2: Color Grade Overlay ═══════════════════════════════ */}
      <ColorGradeOverlay grade={grade} />

      {/* ══ SCHICHT 3: Film Grain ═════════════════════════════════════════ */}
      {filmGrain !== 'none' && <FilmGrain intensity={filmGrain} opacity={0.04} />}

      {/* ══ SCHICHT 4: Hook Titel (erste 4s) ═════════════════════════════ */}
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

      {/* ══ SCHICHT 5: Location Badge ═════════════════════════════════════ */}
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

      {/* ══ SCHICHT 6: Auto-Captions ══════════════════════════════════════ */}
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

      {/* ══ SCHICHT 7: Summary Subtitle (Mitte, ohne Captions) ═══════════ */}
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

      {/* ══ SCHICHT 8: Manuelle Captions (wenn kein AutoCaption) ═════════ */}
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

      {/* ══ SCHICHT 9: CTA Endkarte ═══════════════════════════════════════ */}
      <Sequence from={hookFrames + slideshowFrames} durationInFrames={ctaFrames}>
        <MojoBusCTA
          lifestyle={lifestyle}
          websiteUrl={websiteUrl}
          handle={handle}
          accentColor={accentColor}
        />
      </Sequence>

      {/* ══ SCHICHT 10: Progress Bar ══════════════════════════════════════ */}
      <ProgressBar
        color={accentColor}
        height={3}
        position="top"
        startFrame={hookFrames}
        endFrame={hookFrames + slideshowFrames}
      />

      {/* ══ SCHICHT 11: Audio — volume als Funktion (kein Hackeln) ════════ */}
      {musicUrl && (
        <AudioLayer
          src={musicUrl}
          volume={0.72}
          fadeInSec={2}
          fadeOutSec={3}
        />
      )}

    </AbsoluteFill>
  );
};
