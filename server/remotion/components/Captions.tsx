/**
 * Captions.tsx — @remotion/captions Integration
 *
 * 85% der Social-Media-Videos werden OHNE TON geschaut.
 * → Untertitel = massiv mehr Engagement.
 *
 * Drei Ebenen:
 * 1. ManualCaptions  — Einfache Texte pro Bild (immer verfügbar)
 * 2. AutoCaptions    — Wort-für-Wort Einblendung aus Caption-Array (immer verfügbar)
 * 3. RemotionCaptions — @remotion/captions mit Word-Level-Timing (braucht Package)
 *
 * WICHTIG: Auto-Captions laufen ohne @remotion/captions.
 * Wenn du echte Whisper-Transkription willst → Package installieren.
 */

import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_FAMILY, FONT_FAMILY_REGULAR, FONT_WEIGHT, TEXT_STYLES } from './Fonts';
import { stripHeroMarkup } from './CaptionHeroWord';
import {
  splitCaptionIntoLines,
  YOUTUBE_LONGFORM_CAPTION,
  SHORTS_CAPTION_BOTTOM,
} from '../config/captions';

// ── Typen ─────────────────────────────────────────────────────────────────

export interface CaptionWord {
  text: string;
  /** Start-Zeit in Sekunden */
  startInSeconds: number;
  /** End-Zeit in Sekunden */
  endInSeconds: number;
}

export type CaptionStyle = 'word-highlight' | 'full-line' | 'tiktok' | 'minimal' | 'chunked';

interface AutoCaptionsProps {
  /** Array von Caption-Texten (einer pro Bild oder freier Text) */
  captions: string[];
  /** Frames pro Caption */
  framesPerCaption: number;
  /** Start-Frame */
  startFrame: number;
  /** Style */
  style?: CaptionStyle;
  /** Akzentfarbe für Highlighting */
  accentColor?: string;
  /** Position */
  position?: 'bottom' | 'center' | 'top';
}

interface WordHighlightCaptionsProps {
  /** Wort-Liste mit Timing (aus Whisper oder manuell) */
  words: CaptionWord[];
  style?: CaptionStyle;
  accentColor?: string;
  position?: 'bottom' | 'center';
  /** Max Wörter pro Zeile */
  wordsPerLine?: number;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────

/**
 * Erzeugt einen gleichmäßigen Schatten-Outline aus mehreren text-shadow
 * Offsets. Sauberer als WebkitTextStroke, weil die Füllung der Schrift
 * nicht verfälscht wird.
 */
function textShadowOutline(width: number, color = '#000000'): string {
  const shadows: string[] = [];
  for (let x = -width; x <= width; x++) {
    for (let y = -width; y <= width; y++) {
      if (x !== 0 || y !== 0) {
        shadows.push(`${x}px ${y}px 0 ${color}`);
      }
    }
  }
  return shadows.join(', ');
}

/**
 * Berechnet den Bounce-Scale für ein aktives Wort.
 * Am Anfang der Wort-Periode poppt das Wort rein (0.85 → 1.10 → 1.0),
 * danach bleibt es bei 1.0.
 */
function getWordBounceScale(
  localFrame: number,
  wordFrames: number,
  activeScale = 1.08
): number {
  if (wordFrames <= 0) return 1;
  const punchFrames = Math.min(wordFrames * 0.45, 8);
  const t = Math.max(0, Math.min(1, localFrame / punchFrames));

  // Ease-Out-Back: 0 → 1 mit leichtem Überschwingen
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const eased = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);

  // Map: 0.85 → activeScale → 1.0
  const minScale = 0.85;
  if (t >= 1) return 1;
  return minScale + (activeScale - minScale) * eased;
}

/** Text in Wörter aufteilen mit gleichmäßigem Timing */
export function textToTimedWords(
  text: string,
  startSec: number,
  endSec: number
): CaptionWord[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const duration = endSec - startSec;
  const perWord = duration / words.length;
  return words.map((word, i) => ({
    text: word,
    startInSeconds: startSec + i * perWord,
    endInSeconds: startSec + (i + 1) * perWord,
  }));
}

/** Captions-Array in Wort-Timeline umwandeln */
export function captionsToTimeline(
  captions: string[],
  framesPerCaption: number,
  startFrame: number,
  fps: number
): CaptionWord[] {
  const words: CaptionWord[] = [];
  captions.forEach((caption, idx) => {
    const captionStartSec = (startFrame + idx * framesPerCaption) / fps;
    const captionEndSec = (startFrame + (idx + 1) * framesPerCaption) / fps;
    words.push(...textToTimedWords(caption, captionStartSec, captionEndSec));
  });
  return words;
}

// ── TikTok-Style Caption (ein Wort groß, highlightet) ─────────────────────

const TikTokWord: React.FC<{
  word: string;
  isActive: boolean;
  isNext: boolean;
  accentColor: string;
  bounceScale?: number;
}> = ({ word, isActive, isNext, accentColor, bounceScale = 1.08 }) => {
  return (
    <span
      style={{
        display: 'inline-block',
        margin: '0 0.15em',
        padding: '0.05em 0.2em',
        borderRadius: '0.2em',
        background: isActive ? accentColor : 'transparent',
        color: isActive ? '#000' : isNext ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.5)',
        fontWeight: isActive ? FONT_WEIGHT.black : FONT_WEIGHT.bold,
        transform: `scale(${isActive ? bounceScale.toFixed(4) : '1'})`,
        transition: 'all 0.1s ease',
        textShadow: isActive ? 'none' : '0 2px 8px rgba(0,0,0,0.9)',
        letterSpacing: isActive ? '-0.01em' : '0em',
      }}
    >
      {word}
    </span>
  );
};

// ── Word-Highlight Captions (Hauptkomponente) ─────────────────────────────

export const WordHighlightCaptions: React.FC<WordHighlightCaptionsProps> = ({
  words,
  style = 'tiktok',
  accentColor = '#F59E0B',
  position = 'bottom',
  wordsPerLine = 4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentSec = frame / fps;

  // Aktives Wort finden
  const activeIndex = words.findIndex(
    w => currentSec >= w.startInSeconds && currentSec < w.endInSeconds
  );

  if (activeIndex === -1) return null;

  // Frames seit Start des aktiven Wortes (für Bounce-Einblende)
  const activeWord = words[activeIndex];
  const wordStartFrame = activeWord.startInSeconds * fps;
  const wordEndFrame = activeWord.endInSeconds * fps;
  const wordDurationFrames = Math.max(1, wordEndFrame - wordStartFrame);
  const localActiveFrame = Math.max(0, frame - wordStartFrame);
  const activeBounceScale = getWordBounceScale(localActiveFrame, wordDurationFrames, 1.10);

  // Fenster: wordsPerLine Wörter um das aktive herum anzeigen
  const windowStart = Math.max(0, activeIndex - Math.floor(wordsPerLine / 2));
  const windowEnd = Math.min(words.length, windowStart + wordsPerLine);
  const visibleWords = words.slice(windowStart, windowEnd);

  const posStyle: React.CSSProperties =
    position === 'bottom'
      ? { bottom: '10%', left: '5%', right: '5%', justifyContent: 'center' }
      : { top: '50%', left: '5%', right: '5%', transform: 'translateY(-50%)', justifyContent: 'center' };

  if (style === 'tiktok') {
    return (
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {/* Gradient Hintergrund */}
        {position === 'bottom' && (
          <AbsoluteFill
            style={{
              background: 'linear-gradient(0deg, rgba(0,0,0,0.65) 0%, transparent 30%)',
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            ...posStyle,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.1em',
            fontSize: 'clamp(1.6rem, 7vw, 3rem)', // +50% für Lesbarkeit auf Mobil
          }}
        >
          {visibleWords.map((word, i) => {
            const globalIndex = windowStart + i;
            return (
              <TikTokWord
                key={`${word.text}-${globalIndex}`}
                word={word.text}
                isActive={globalIndex === activeIndex}
                isNext={globalIndex === activeIndex + 1}
                accentColor={accentColor}
                bounceScale={globalIndex === activeIndex ? activeBounceScale : 1.08}
              />
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }

  // Minimal Style
  if (style === 'minimal') {
    const activeWord = words[activeIndex];
    return (
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {position === 'bottom' && (
          <AbsoluteFill
            style={{
              background: 'linear-gradient(0deg, rgba(0,0,0,0.6) 0%, transparent 25%)',
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            ...posStyle,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              ...TEXT_STYLES.caption,
              fontSize: 'clamp(1.8rem, 7vw, 3rem)',
              color: '#FFFFFF',
              textShadow: '0 2px 12px rgba(0,0,0,0.9)',
              textAlign: 'center',
              padding: '0.3em 0.8em',
              background: 'rgba(0,0,0,0.45)',
              borderRadius: '0.4em',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.12)',
              maxWidth: '85%',
            }}
          >
            {visibleWords.map((word, i) => {
              const globalIndex = windowStart + i;
              return (
                <span
                  key={`${word.text}-${globalIndex}`}
                  style={{
                    color: globalIndex === activeIndex ? accentColor : '#FFFFFF',
                    fontWeight: globalIndex === activeIndex ? FONT_WEIGHT.black : FONT_WEIGHT.semibold,
                  }}
                >
                  {word.text}{' '}
                </span>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // Full-Line Style: ganze Zeile auf einmal
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {position === 'bottom' && (
        <AbsoluteFill
          style={{
            background: 'linear-gradient(0deg, rgba(0,0,0,0.65) 0%, transparent 25%)',
          }}
        />
      )}
      <div style={{ position: 'absolute', ...posStyle }}>
        <div
          style={{
            ...TEXT_STYLES.caption,
            fontSize: 'clamp(2rem, 7.5vw, 3.3rem)',
            color: '#FFFFFF',
            textShadow: '0 2px 10px rgba(0,0,0,0.9)',
            textAlign: 'center',
            maxWidth: '85%',
          }}
        >
          {visibleWords.map(w => w.text).join(' ')}
        </div>
      </div>
</AbsoluteFill>
  );
};

// ── PerSlide Caption (einfach, robust, dynamisch) ──────────────────────────
//
// Ersetzt AutoCaptions + WordHighlightCaptions für den TikTok-Fall.
// Jeder Slide bekommt genau eine Caption, die während seiner gesamten
// Slide-Dauer sichtbar ist. Kein Wort-Level-Timing – stattdessen wird
// der Text Wort-für-Wort chunkweise eingeblendet (Chunk-Größe = 3).

interface PerSlideCaptionProps {
  /** Array von Caption-Texten (einer pro Slide) */
  captions: string[];
  /** Start-Frame der Slideshow (nach Hook) */
  slidesStartFrame: number;
  /** Dynamische Slide-Dauern in Frames */
  slidesFrames: number[];
  /** Stil: 'tiktok' = Karaoke, 'chunked' = 3-Wort-Chunks */
  style?: 'tiktok' | 'chunked' | 'full-line';
  accentColor?: string;
  /** Slide-Index der ausgeblendet werden soll (z.B. Routen-Karte) */
  excludeSlideIndex?: number;
  /**
   * Ziel-Plattform – bestimmt die Caption-Position (bottom %)
   *   tiktok:  20% (384px frei, UI endet bei ~350px)
   *   reels:   25% (480px frei, UI endet bei ~450px nach Update 2025)
   *   youtube: 18% (346px frei, UI endet bei ~300px)
   */
  platform?: 'tiktok' | 'reels' | 'youtube';
}

export const PerSlideCaption: React.FC<PerSlideCaptionProps> = ({
  captions,
  slidesStartFrame,
  slidesFrames,
  style = 'chunked',
  accentColor = '#F59E0B',
  excludeSlideIndex,
  platform = 'tiktok',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Aktuellen Slide finden
  let slideIndex = -1;
  let slideStart = slidesStartFrame;
  for (let i = 0; i < slidesFrames.length; i++) {
    if (frame >= slideStart && frame < slideStart + slidesFrames[i]) {
      slideIndex = i;
      break;
    }
    slideStart += slidesFrames[i];
  }

  // Keine Caption wenn: kein Slide, kein Text, oder exkludierter Slide
  if (slideIndex === -1 || slideIndex >= captions.length) return null;
  if (excludeSlideIndex !== undefined && slideIndex === excludeSlideIndex) return null;

  const captionText = captions[slideIndex];
  if (!captionText || !captionText.trim()) return null;
  const displayText = stripHeroMarkup(captionText);

  // ── YouTube Longform: klassische 2-Zeilen-Captions mit fixen px-Werten ─
  const isYouTube = platform === 'youtube';
  const youtubeLines = isYouTube
    ? splitCaptionIntoLines(
        displayText,
        YOUTUBE_LONGFORM_CAPTION.maxCharsPerLine,
        YOUTUBE_LONGFORM_CAPTION.maxLines
      )
    : [];

  const words = displayText.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  // Wort-Timing innerhalb dieses Slides (Shorts / dynamische Styles)
  const slideFrame = frame - slideStart; // Frame innerhalb dieses Slides
  const slideDurationFrames = slidesFrames[slideIndex];
  const perWordFrames = slideDurationFrames / words.length;
  const activeWordIdx = Math.min(
    Math.floor(slideFrame / perWordFrames),
    words.length - 1
  );

  // Lokaler Frame im aktiven Wort für Bounce-Einblendung
  const activeWordStartFrame = activeWordIdx * perWordFrames;
  const localActiveFrame = Math.max(0, slideFrame - activeWordStartFrame);
  const activeBounceScale = getWordBounceScale(localActiveFrame, perWordFrames, 1.08);

  // Chunk-Fenster: 3 Wörter um das aktive herum (für 'chunked') oder alle (für 'tiktok')
  const isChunked = style === 'chunked';
  const windowSize = isChunked ? 3 : words.length;
  const chunkStart = isChunked
    ? Math.max(0, Math.min(activeWordIdx - 1, words.length - windowSize))
    : 0;
  const chunkEnd = isChunked
    ? Math.min(chunkStart + windowSize, words.length)
    : words.length;
  const visibleWords = words.slice(chunkStart, chunkEnd);

  const bottomPos = isYouTube
    ? `${YOUTUBE_LONGFORM_CAPTION.bottomMarginPx}px`
    : SHORTS_CAPTION_BOTTOM[platform] || SHORTS_CAPTION_BOTTOM.tiktok;

  // YouTube Longform: feste px-Schriftgröße + Schwarz-Outline
  if (isYouTube) {
    const { classicFontSizePx, sideMarginPx, strokeWidthPx, strokeColor, lineHeight } =
      YOUTUBE_LONGFORM_CAPTION;

    return (
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {/* Dezenter Bottom-Gradient für Lesbarkeit */}
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(0deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.20) 55%, transparent 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: bottomPos,
            left: `${sideMarginPx}px`,
            right: `${sideMarginPx}px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            fontFamily: FONT_FAMILY_REGULAR,
            fontSize: `${classicFontSizePx}px`,
            fontWeight: FONT_WEIGHT.bold,
            color: '#FFFFFF',
            lineHeight,
            textShadow: `${textShadowOutline(strokeWidthPx)}, 0 4px 12px rgba(0,0,0,0.5)`,
          }}
        >
          {youtubeLines.map((line, i) => (
            <div key={`line-${i}`} style={{ whiteSpace: 'nowrap' }}>
              {line}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Pill-Hintergrund + Caption-Text */}
      <div
        style={{
          position: 'absolute',
          bottom: bottomPos,
          left: '6%',
          right: '6%',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.15em',
          fontSize: 'clamp(2rem, 7.5vw, 3.5rem)',
          textAlign: 'center',
          lineHeight: 1.4,
          // Pill: leicht abgedunkelter Hintergrund, weiche Kanten
          background: 'rgba(0,0,0,0.18)',
          backdropFilter: 'blur(4px)',
          borderRadius: '12px',
          padding: '0.35em 0.8em',
        }}
      >
        {visibleWords.map((word, i) => {
          const globalWordIdx = chunkStart + i;
          const isActive = globalWordIdx === activeWordIdx &&
            (style === 'tiktok' || isChunked);
          return (
            <span
              key={`${word}-${globalWordIdx}`}
              style={{
                color: isActive ? accentColor : '#FFFFFF',
                fontWeight: isActive ? 900 : (style === 'full-line' ? 700 : 500),
                textShadow: isActive
                  ? `0 0 20px ${accentColor}88`
                  : '0 1px 4px rgba(0,0,0,0.7)',
                transform: `scale(${isActive ? activeBounceScale.toFixed(4) : '1'})`,
                opacity: isChunked && !isActive && i >= windowSize - 1 ? 0.65 : 1,
              }}
            >
              {word}{' '}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── Auto Captions (einfach, ohne Paket) ──────────────────────────────────

/**
 * AutoCaptions — Baut aus einem String-Array automatisch
 * eine Wort-für-Wort Einblendung.
 *
 * Perfekt für die Captions die im RemotionVideoBlock eingegeben werden.
 */
export const AutoCaptions: React.FC<AutoCaptionsProps> = ({
  captions,
  framesPerCaption,
  startFrame,
  style = 'tiktok',
  accentColor = '#F59E0B',
  position = 'bottom',
}) => {
  const { fps } = useVideoConfig();

  if (!captions || captions.length === 0) return null;

  const timeline = captionsToTimeline(captions, framesPerCaption, startFrame, fps);

  return (
    <WordHighlightCaptions
      words={timeline}
      style={style}
      accentColor={accentColor}
      position={position}
      wordsPerLine={5}
    />
  );
};

// ── Subtitle-Zeile (einzelner Text, animiert) ─────────────────────────────

interface SubtitleLineProps {
  text: string;
  fromFrame: number;
  toFrame: number;
  accentColor?: string;
  fontSize?: string;
  position?: 'bottom' | 'top' | 'center';
}

export const SubtitleLine: React.FC<SubtitleLineProps> = ({
  text,
  fromFrame,
  toFrame,
  accentColor = '#F59E0B',
  fontSize = 'clamp(0.85rem, 2.8vw, 1.4rem)',
  position = 'bottom',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < fromFrame || frame > toFrame) return null;

  const localFrame = frame - fromFrame;
  const duration = toFrame - fromFrame;

  const enter = spring({
    frame: localFrame,
    fps,
    config: { damping: 20, stiffness: 150 },
  });

  const fadeOut = interpolate(localFrame, [duration - 10, duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = Math.min(enter, fadeOut);
  const translateY = interpolate(enter, [0, 1], [20, 0]);

  const posStyle: React.CSSProperties =
    position === 'top'
      ? { top: '6%' }
      : position === 'center'
      ? { top: '50%', transform: `translateY(calc(-50% + ${translateY}px))` }
      : { bottom: '8%' };

  if (position !== 'center') {
    (posStyle as any).transform = `translateY(${position === 'top' ? -translateY : translateY}px)`;
  }

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {position === 'bottom' && (
        <AbsoluteFill
          style={{
            background: 'linear-gradient(0deg, rgba(0,0,0,0.55) 0%, transparent 20%)',
            opacity,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: '6%',
          right: '6%',
          textAlign: 'center',
          ...posStyle,
          opacity,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            ...TEXT_STYLES.caption,
            fontSize,
            color: '#FFFFFF',
            textShadow: '0 2px 12px rgba(0,0,0,0.95)',
            background: 'rgba(0,0,0,0.5)',
            padding: '0.3em 0.9em',
            borderRadius: '0.35em',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.10)',
            maxWidth: '100%',
            lineHeight: 1.4,
          }}
        >
          {/* Aktives Wort highlighten (erstes Wort als Hook) */}
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
