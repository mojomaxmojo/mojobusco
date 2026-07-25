/**
 * HookTitle — Stop-the-Scroll Titel für die ersten 4 Sekunden
 * Animiert: Slide-up + Fade-in Text mit optionalem Emoji-Icon
 * Nutzt Montserrat via @remotion/google-fonts (Fonts.tsx)
 */

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_FAMILY, FONT_FAMILY_REGULAR, FONT_WEIGHT, TEXT_STYLES } from './Fonts';
import { YOUTUBE_LONGFORM_CAPTION } from '../../../src/config/captions';

interface HookTitleProps {
  title: string;
  subtitle?: string;
  emoji?: string;
  fromFrame?: number;
  toFrame?: number;
  textColor?: string;
  accentColor?: string;
  /** Kapitel-Marker: optionale Caption unter dem Title (z.B. "Algarve, Portugal") */
  caption?: string;
  /** Ziel-Plattform – YouTube Longform bekommt größeren, optisch zentrierten Hook-Text */
  platform?: 'tiktok' | 'reels' | 'youtube';
}

export const HookTitle: React.FC<HookTitleProps> = ({
  title,
  subtitle,
  emoji = '🌍',
  fromFrame = 0,
  toFrame,
  textColor = '#FFFFFF',
  accentColor = '#F59E0B',
  caption,
  platform = 'tiktok',
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const end = toFrame ?? durationInFrames;

  // Schneller Spring: Text bei ~0,3s voll lesbar (war ~1s).
  // Die erste halbe Sekunde entscheidet ob der Zuschauer bleibt –
  // ein langsam einfliegender Hook verschenkt das TikTok-Hook-Fenster (0,8-1,2s).
  const enter = spring({
    frame: frame - fromFrame,
    fps,
    config: { damping: 18, stiffness: 380, mass: 0.4 },
  });

  const fadeOut = interpolate(frame, [end - 10, end], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < fromFrame || frame > end) return null;

  const opacity = Math.min(enter, fadeOut);
  const translateY = interpolate(enter, [0, 1], [60, 0]);

  // Wörter des Titels einzeln animieren (leicht versetzt)
  const titleWords = title.split(' ');

  const isYouTube = platform === 'youtube';
  const { sideMarginPx } = YOUTUBE_LONGFORM_CAPTION;

  // YouTube Longform: größerer Hook-Text, optische Mitte bei ~45% Höhe
  const titleFontSize = isYouTube ? '120px' : 'clamp(2.4rem, 10vw, 5.5rem)';
  const subtitleFontSize = isYouTube ? '28px' : 'clamp(1rem, 4vw, 1.8rem)';
  const captionFontSize = isYouTube ? '24px' : 'clamp(0.9rem, 3.5vw, 1.4rem)';

  return (
    <AbsoluteFill
      style={{
        justifyContent: isYouTube ? 'flex-start' : 'center',
        alignItems: 'center',
        padding: isYouTube ? 0 : '10%',
        pointerEvents: 'none',
      }}
    >
      {/* Radialer Gradient um den Text-Bereich für extra Tiefe
           (globales Dim-Overlay macht bereits das Abdunkeln des Bildes) */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 55%, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.0) 100%)',
        }}
      />

      <div
        style={{
          opacity,
          transform: isYouTube
            ? `translate(-50%, -50%) translateY(${translateY}px)`
            : `translateY(${translateY}px)`,
          textAlign: 'center',
          position: isYouTube ? 'absolute' : 'relative',
          top: isYouTube ? '45%' : undefined,
          left: isYouTube ? '50%' : undefined,
          zIndex: 10,
          maxWidth: isYouTube ? `calc(100% - ${sideMarginPx * 2}px)` : '88%',
          width: isYouTube ? `calc(100% - ${sideMarginPx * 2}px)` : undefined,
        }}
      >
        {/* Emoji */}
        {emoji && (
          <div
            style={{
              fontSize: isYouTube ? '64px' : 'clamp(2.5rem, 8vw, 4rem)',
              marginBottom: '0.4rem',
              filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.7))',
              lineHeight: 1,
            }}
          >
            {emoji}
          </div>
        )}

        {/* Haupttitel — Montserrat Black */}
        <div
          style={{
            ...TEXT_STYLES.hookTitle,
            fontSize: titleFontSize,
            color: textColor,
            textShadow: '0 4px 24px rgba(0,0,0,0.85), 0 2px 6px rgba(0,0,0,0.7)',
            wordBreak: 'break-word',
            hyphens: 'auto',
          }}
        >
          {title}
        </div>

        {/* Akzentlinie */}
        <div
          style={{
            width: isYouTube ? '80px' : '56px',
            height: isYouTube ? '5px' : '4px',
            background: `linear-gradient(90deg, ${accentColor}, ${accentColor}AA)`,
            margin: '0.85rem auto',
            borderRadius: '2px',
            boxShadow: `0 0 16px ${accentColor}80`,
          }}
        />

        {/* Untertitel — Montserrat Medium */}
        {subtitle && (
          <div
            style={{
              ...TEXT_STYLES.hookSubtitle,
              fontSize: subtitleFontSize,
              color: 'rgba(255,255,255,0.88)',
              textShadow: '0 2px 10px rgba(0,0,0,0.8)',
            }}
          >
            {subtitle}
          </div>
        )}

        {/* Kapitel-Marker: Caption unter dem Titel */}
        {caption && (
          <div
            style={{
              fontFamily: FONT_FAMILY_REGULAR,
              fontWeight: FONT_WEIGHT.medium,
              fontSize: captionFontSize,
              color: accentColor,
              textShadow: '0 2px 10px rgba(0,0,0,0.8)',
              marginTop: '0.6rem',
              letterSpacing: '0.04em',
            }}
          >
            {caption}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
