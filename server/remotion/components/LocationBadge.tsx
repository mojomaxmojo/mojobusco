/**
 * LocationBadge — Orts-Anzeige mit Pin-Icon + Montserrat Font
 */

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_FAMILY_REGULAR, FONT_WEIGHT, TEXT_STYLES } from './Fonts';

interface LocationBadgeProps {
  location: string;
  country?: string;
  countryFlag?: string;
  fromFrame?: number;
  toFrame?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /**
   * Abstand vom oberen Rand in % für 'top-left'/'top-right' (Default 10%).
   * Wird von MojoBusVideo dynamisch übergeben, damit das Badge NIE mit dem
   * Cinematic-Letterbox-Balken (Reels 6% / YouTube 8%) kollidiert – die
   * ProgressBar (3px, ganz oben) ist so dünn, dass sie ignoriert werden kann.
   */
  topOffsetPct?: number;
}

const FLAG_MAP: Record<string, string> = {
  portugal: '🇵🇹', spain: '🇪🇸', spanien: '🇪🇸', france: '🇫🇷', frankreich: '🇫🇷',
  italy: '🇮🇹', italien: '🇮🇹', croatia: '🇭🇷', kroatien: '🇭🇷',
  germany: '🇩🇪', deutschland: '🇩🇪', austria: '🇦🇹', österreich: '🇦🇹',
  switzerland: '🇨🇭', schweiz: '🇨🇭', usa: '🇺🇸', mexico: '🇲🇽',
  morocco: '🇲🇦', marokko: '🇲🇦', greece: '🇬🇷', griechenland: '🇬🇷',
  netherlands: '🇳🇱', niederlande: '🇳🇱', belgium: '🇧🇪', belgien: '🇧🇪',
  norway: '🇳🇴', norwegen: '🇳🇴', sweden: '🇸🇪', schweden: '🇸🇪',
  uk: '🇬🇧', england: '🇬🇧', ireland: '🇮🇪', irland: '🇮🇪',
};

export const LocationBadge: React.FC<LocationBadgeProps> = ({
  location,
  country,
  countryFlag,
  fromFrame = 0,
  toFrame,
  position = 'top-left',
  topOffsetPct = 10,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const end = toFrame ?? durationInFrames - 5;

  const enter = spring({
    frame: frame - fromFrame,
    fps,
    config: { damping: 18, stiffness: 100 },
  });

  const fadeOut = interpolate(frame, [end - 10, end], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < fromFrame || frame > end) return null;

  const translateX = interpolate(enter, [0, 1], [-250, 0]);
  const opacity = Math.min(enter, fadeOut);

  const flag =
    countryFlag ||
    (country ? FLAG_MAP[country.toLowerCase()] : undefined) ||
    '📍';

  // Standard: OBEN im Video (Safe-Zone gegenüber TikTok/Reels/YouTube-UI-
  // Elementen wie Sound-Titel, Follow-Button, Kommentare unten). Die
  // Caption + LocationBadge dürfen sich NIE überlappen – deshalb liegt
  // das Badge standardmäßig oben, unabhängig von der Caption-Position.
  const posStyles: React.CSSProperties =
    position === 'top-right'
      ? { top: `${topOffsetPct}%`, right: '5%' }
      : position === 'bottom-right'
      ? { bottom: '14%', right: '5%' }
      : position === 'bottom-left'
      ? { bottom: '20%', left: '5%' }
      : { top: `${topOffsetPct}%`, left: '5%' };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          ...posStyles,
          opacity,
          transform: `translateX(${translateX}px)`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          background: 'rgba(0,0,0,0.58)',
          backdropFilter: 'blur(10px)',
          borderRadius: '100px',
          padding: '0.38rem 1rem 0.38rem 0.6rem',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
        }}
      >
        <span style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.15rem)', lineHeight: 1 }}>{flag}</span>
        <span
          style={{
            ...TEXT_STYLES.badge,
            fontSize: 'clamp(0.6rem, 1.8vw, 0.88rem)',
            color: '#FFFFFF',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}
        >
          {location}
        </span>
      </div>
    </AbsoluteFill>
  );
};
