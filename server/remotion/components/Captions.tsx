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

// ── Typen ─────────────────────────────────────────────────────────────────

export interface CaptionWord {
  text: string;
  /** Start-Zeit in Sekunden */
  startInSeconds: number;
  /** End-Zeit in Sekunden */
  endInSeconds: number;
}

export type CaptionStyle = 'word-highlight' | 'full-line' | 'tiktok' | 'minimal';

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
}> = ({ word, isActive, isNext, accentColor }) => {
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
        transform: isActive ? 'scale(1.08)' : 'scale(1)',
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
              fontSize: 'clamp(1rem, 3.5vw, 1.8rem)',
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
            fontSize: 'clamp(0.85rem, 3vw, 1.5rem)',
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
