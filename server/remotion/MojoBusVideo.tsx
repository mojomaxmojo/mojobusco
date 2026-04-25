/**
 * MojoBusVideo — Haupt-Remotion Composition
 * 
 * Video-Aufbau:
 *  [0 – HOOK_FRAMES]              Hook: Erstes Foto + animierter Titel
 *  [HOOK_FRAMES – HOOK+SLIDES]    Slideshow: Fotos mit Ken Burns + Motion Blur + Transitions
 *  [HOOK+SLIDES – END]            CTA: Endkarte (6 Sekunden)
 *
 * Neue Features v2:
 *  - @remotion/google-fonts: Montserrat überall (via LoadFonts)
 *  - Motion Blur: Trail-Frames beim KenBurns Zoom
 *  - AutoCaptions: Wort-für-Wort Einblendung (TikTok-Style oder Minimal)
 */

import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';

import { KenBurnsImageWithMotionBlur, KenBurnsImage, pickDirection } from './components/KenBurnsImage';
import { ColorGradeOverlay, ColorGradeWrapper, lifestyleToGrade, type ColorGrade } from './components/ColorGradeOverlay';
import { HookTitle } from './components/HookTitle';
import { LocationBadge } from './components/LocationBadge';
import { MojoBusCTA } from './components/MojoBusCTA';
import { ProgressBar } from './components/ProgressBar';
import { AudioLayer } from './components/AudioLayer';
import { FilmGrain } from './components/FilmGrain';
import { FadeIn, FadeOut, ZoomBlur } from './components/CrossFade';
import { StoryCaption } from './components/StoryCaption';
import { AutoCaptions, SubtitleLine, captionsToTimeline, type CaptionStyle } from './components/Captions';
import { LoadFonts } from './components/Fonts';

export interface MojoBusVideoProps {
  /** Array von Bild-URLs (Blossom CDN) */
  imageUrls: string[];
  /** Titel des Posts → Hook-Titel */
  title: string;
  /** Kurze Zusammenfassung / Story-Text */
  summary?: string;
  /** Location-String für LocationBadge */
  location?: string;
  country?: string;
  /** Lifestyle bestimmt Color Grade + CTA-Text */
  lifestyle?: string;
  /** Musik-Datei URL (optional) */
  musicUrl?: string;
  /** Sekunden pro Bild in der Slideshow (3-8) */
  secondsPerImage?: number;
  /** Aspect Ratio: '16:9' | '9:16' | '1:1' */
  aspectRatio?: '16:9' | '9:16' | '1:1';
  /** Explizite Color Grade (überschreibt lifestyle-default) */
  colorGrade?: ColorGrade;
  /** Film-Grain Intensität */
  filmGrain?: 'none' | 'fine' | 'medium' | 'coarse';
  /** Caption-Texte pro Bild (manuell eingegeben) */
  captions?: string[];
  /**
   * Auto-Captions aktivieren:
   * 'off' = keine Untertitel
   * 'tiktok' = Wort-Highlight TikTok-Style
   * 'minimal' = dezenter Kasten unten
   * 'full-line' = ganze Zeile auf einmal
   */
  captionStyle?: 'off' | CaptionStyle;
  /** Website URL für CTA */
  websiteUrl?: string;
  /** Handle / Social Handle */
  handle?: string;
  /** Akzentfarbe */
  accentColor?: string;
  /**
   * Motion Blur Stärke beim KenBurns Zoom
   * 0 = aus, 1 = standard (empfohlen), 2 = stark
   */
  motionBlurStrength?: number;
}

/** Berechnet Gesamt-Frames für das Video */
export function calculateDuration(
  imageCount: number,
  fps: number,
  secondsPerImage: number
): { totalFrames: number; hookFrames: number; ctaFrames: number; slideshowFrames: number } {
  const hookFrames = 4 * fps;
  const ctaFrames = 6 * fps;
  const perSlide = Math.round(secondsPerImage * fps);
  const slideshowFrames = imageCount * perSlide;
  const totalFrames = hookFrames + slideshowFrames + ctaFrames;
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

  const grade = colorGrade || lifestyleToGrade(lifestyle);
  const images = imageUrls.slice(0, 20);
  const imageCount = images.length;

  const { hookFrames, ctaFrames, slideshowFrames } = calculateDuration(
    imageCount, fps, secondsPerImage
  );

  const perSlide = Math.round(secondsPerImage * fps);
  const TRANSITION_FRAMES = Math.min(12, Math.round(fps * 0.4));

  // ── Lifestyle-spezifisches Emoji für Hook ────────────────────────────────
  const hookEmoji = {
    mojobus: '🚌', vanlife: '🚐', rvlife: '🏕️',
    beachlife: '🌊', wohnmobil: '🏠', 'perpetual-travelers': '🌍',
  }[lifestyle] ?? '🌍';

  // ── Auto-Captions: Timeline aus captions-Array bauen ───────────────────
  const hasCaptions = captionStyle !== 'off' && captions.length > 0;

  return (
    <AbsoluteFill style={{ background: '#000' }}>

      {/* ══════════════════════════════════════════════════════
          SCHICHT 0: Fonts laden (Montserrat via @remotion/google-fonts)
      ══════════════════════════════════════════════════════ */}
      <LoadFonts />

      {/* ══════════════════════════════════════════════════════
          SCHICHT 1: Bilder — Ken Burns mit Motion Blur + Color Grade
      ══════════════════════════════════════════════════════ */}
      <ColorGradeWrapper grade={grade}>

        {/* HOOK — erstes Bild */}
        {images[0] && (
          <Sequence from={0} durationInFrames={hookFrames + TRANSITION_FRAMES}>
            <FadeOut durationFrames={TRANSITION_FRAMES} totalFrames={hookFrames + TRANSITION_FRAMES}>
              <KenBurnsImageWithMotionBlur
                src={images[0]}
                direction={pickDirection(0)}
                intensity={0.12}
                motionBlurStrength={motionBlurStrength}
              />
            </FadeOut>
          </Sequence>
        )}

        {/* SLIDESHOW */}
        {images.map((src, i) => {
          const startFrame = hookFrames + i * perSlide;
          const isLast = i === imageCount - 1;
          const endFrame = startFrame + perSlide + (isLast ? 0 : TRANSITION_FRAMES);

          return (
            <Sequence key={i} from={startFrame} durationInFrames={endFrame - startFrame}>
              <ZoomBlur durationFrames={TRANSITION_FRAMES}>
                {!isLast ? (
                  <FadeOut durationFrames={TRANSITION_FRAMES} totalFrames={endFrame - startFrame}>
                    <KenBurnsImageWithMotionBlur
                      src={src}
                      direction={pickDirection(i + 1)}
                      intensity={0.13}
                      motionBlurStrength={motionBlurStrength}
                    />
                  </FadeOut>
                ) : (
                  <KenBurnsImageWithMotionBlur
                    src={src}
                    direction={pickDirection(i + 1)}
                    intensity={0.13}
                    motionBlurStrength={motionBlurStrength}
                  />
                )}
              </ZoomBlur>
            </Sequence>
          );
        })}

        {/* CTA Hintergrund */}
        {images[imageCount - 1] && (
          <Sequence from={hookFrames + slideshowFrames} durationInFrames={ctaFrames}>
            <FadeIn durationFrames={15}>
              <KenBurnsImage
                src={images[imageCount - 1]}
                direction="zoom-out"
                intensity={0.04}
                motionBlurStrength={0}
              />
            </FadeIn>
          </Sequence>
        )}

      </ColorGradeWrapper>

      {/* ══════════════════════════════════════════════════════
          SCHICHT 2: Color Grade Overlay
      ══════════════════════════════════════════════════════ */}
      <ColorGradeOverlay grade={grade} />

      {/* ══════════════════════════════════════════════════════
          SCHICHT 3: Film Grain
      ══════════════════════════════════════════════════════ */}
      {filmGrain !== 'none' && <FilmGrain intensity={filmGrain} opacity={0.05} />}

      {/* ══════════════════════════════════════════════════════
          SCHICHT 4: Hook Titel — Montserrat Black, erste 4s
      ══════════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════════
          SCHICHT 5: Location Badge (2. Slide)
      ══════════════════════════════════════════════════════ */}
      {location && (
        <Sequence from={hookFrames + perSlide} durationInFrames={perSlide * 2}>
          <LocationBadge
            location={location}
            country={country}
            fromFrame={8}
            toFrame={perSlide * 2 - 8}
            position="bottom-left"
          />
        </Sequence>
      )}

      {/* ══════════════════════════════════════════════════════
          SCHICHT 6: Auto-Captions — Wort-für-Wort Einblendung
          85% schauen ohne Ton → immer aktivieren wenn captions vorhanden!
      ══════════════════════════════════════════════════════ */}
      {hasCaptions && (
        <AutoCaptions
          captions={captions}
          framesPerCaption={perSlide}
          startFrame={hookFrames}
          style={captionStyle === 'off' ? 'minimal' : captionStyle as CaptionStyle}
          accentColor={accentColor}
          position="bottom"
        />
      )}

      {/* ══════════════════════════════════════════════════════
          SCHICHT 7: Summary Subtitle (Mitte des Videos)
          Eingeblendet wenn keine Captions aktiv
      ══════════════════════════════════════════════════════ */}
      {summary && imageCount >= 3 && !hasCaptions && (
        <Sequence
          from={hookFrames + Math.floor(imageCount / 2) * perSlide}
          durationInFrames={perSlide}
        >
          <StoryCaption
            text={summary.slice(0, 80)}
            fromFrame={8}
            toFrame={perSlide - 8}
            position="bottom"
            style="subtitle"
            accentColor={accentColor}
          />
        </Sequence>
      )}

      {/* ══════════════════════════════════════════════════════
          SCHICHT 8: Manuelle StoryCaption-Overlays (nur wenn kein AutoCaption)
          → bei AutoCaptions zeigen wir nur die AutoCaptions
      ══════════════════════════════════════════════════════ */}
      {!hasCaptions && captions.map((caption, i) => {
        if (!caption) return null;
        const startFrame = hookFrames + i * perSlide + Math.round(fps * 0.5);
        const endFrame = hookFrames + (i + 1) * perSlide - Math.round(fps * 0.5);
        return (
          <StoryCaption
            key={`caption-${i}`}
            text={caption}
            fromFrame={startFrame}
            toFrame={endFrame}
            position="bottom"
            style="minimal"
            accentColor={accentColor}
          />
        );
      })}

      {/* ══════════════════════════════════════════════════════
          SCHICHT 9: CTA Endkarte — Montserrat, Lifestyle-spezifisch
      ══════════════════════════════════════════════════════ */}
      <Sequence from={hookFrames + slideshowFrames} durationInFrames={ctaFrames}>
        <MojoBusCTA
          lifestyle={lifestyle}
          websiteUrl={websiteUrl}
          handle={handle}
          accentColor={accentColor}
        />
      </Sequence>

      {/* ══════════════════════════════════════════════════════
          SCHICHT 10: Progress Bar (Retention)
      ══════════════════════════════════════════════════════ */}
      <ProgressBar
        color={accentColor}
        height={3}
        position="top"
        startFrame={hookFrames}
        endFrame={hookFrames + slideshowFrames}
      />

      {/* ══════════════════════════════════════════════════════
          SCHICHT 11: Audio mit Fade-In/Out
      ══════════════════════════════════════════════════════ */}
      {musicUrl && (
        <AudioLayer
          src={musicUrl}
          volume={0.68}
          fadeInFrames={fps * 2}
          fadeOutFrames={fps * 3}
        />
      )}

    </AbsoluteFill>
  );
};
