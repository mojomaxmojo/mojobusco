/**
 * HookTitle — Stop-the-Scroll Titel für die ersten 4 Sekunden
 * Animiert: Slide-up + Fade-in Text mit optionalem Emoji-Icon
 * Nutzt Montserrat via @remotion/google-fonts (Fonts.tsx)
 */

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_FAMILY, FONT_FAMILY_REGULAR, FONT_WEIGHT, TEXT_STYLES } from './Fonts';

interface HookTitleProps {
  title: string;
  subtitle?: string;
  emoji?: string;
  fromFrame?: number;
  toFrame?: number;
  textColor?: string;
  accentColor?: string;
}

export const HookTitle: React.FC<HookTitleProps> = ({
  title,
  subtitle,
  emoji = '🌍',
  fromFrame = 0,
  toFrame,
  textColor = '#FFFFFF',
  accentColor = '#F59E0B',
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const end = toFrame ?? durationInFrames;

  const enter = spring({
    frame: frame - fromFrame,
    fps,
    config: { damping: 15, stiffness: 120, mass: 0.8 },
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

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: '10%',
        pointerEvents: 'none',
      }}
    >
      {/* Dunkler Gradient-Hintergrund */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.65) 60%, rgba(0,0,0,0.88) 100%)',
        }}
      />

      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          textAlign: 'center',
          position: 'relative',
          zIndex: 10,
          maxWidth: '88%',
        }}
      >
        {/* Emoji */}
        {emoji && (
          <div
            style={{
              fontSize: 'clamp(2.5rem, 8vw, 4rem)',
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
            fontSize: 'clamp(1.8rem, 7.5vw, 5rem)',
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
            width: '56px',
            height: '4px',
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
              fontSize: 'clamp(0.75rem, 2.8vw, 1.35rem)',
              color: 'rgba(255,255,255,0.88)',
              textShadow: '0 2px 10px rgba(0,0,0,0.8)',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
