/**
 * StoryCaption — Text-Einblendung mit Montserrat Font
 */

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_FAMILY, FONT_FAMILY_REGULAR, FONT_WEIGHT, TEXT_STYLES } from './Fonts';

interface StoryCaptionProps {
  text: string;
  fromFrame: number;
  toFrame: number;
  position?: 'bottom' | 'center' | 'top';
  style?: 'minimal' | 'bold' | 'subtitle';
  accentColor?: string;
}

export const StoryCaption: React.FC<StoryCaptionProps> = ({
  text,
  fromFrame,
  toFrame,
  position = 'bottom',
  style = 'minimal',
  accentColor = '#F59E0B',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < fromFrame || frame > toFrame) return null;

  const localFrame = frame - fromFrame;
  const duration = toFrame - fromFrame;

  const enter = spring({
    frame: localFrame,
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  const fadeOut = interpolate(localFrame, [duration - 12, duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = Math.min(enter, fadeOut);
  const translateY = interpolate(enter, [0, 1], [28, 0]);

  const posStyle: React.CSSProperties =
    position === 'top'
      ? { top: '7%', left: '7%', right: '7%' }
      : position === 'center'
      ? { top: '50%', left: '7%', right: '7%' }
      : { bottom: '9%', left: '7%', right: '7%' };

  const transformVal = position === 'center'
    ? `translateY(calc(-50% + ${translateY}px))`
    : `translateY(${position === 'top' ? -translateY : translateY}px)`;

  const textStyleProps: React.CSSProperties =
    style === 'bold'
      ? {
          ...TEXT_STYLES.captionBold,
          fontSize: 'clamp(0.95rem, 3.8vw, 1.9rem)',
          color: '#FFFFFF',
          textShadow: '0 2px 14px rgba(0,0,0,0.9)',
        }
      : style === 'subtitle'
      ? {
          ...TEXT_STYLES.subtitle,
          fontSize: 'clamp(0.7rem, 2.3vw, 1.15rem)',
          color: 'rgba(255,255,255,0.92)',
          textShadow: '0 1px 10px rgba(0,0,0,0.95)',
        }
      : {
          ...TEXT_STYLES.caption,
          fontSize: 'clamp(0.8rem, 2.7vw, 1.3rem)',
          color: '#FFFFFF',
          textShadow: '0 2px 12px rgba(0,0,0,0.9)',
        };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {position === 'bottom' && (
        <AbsoluteFill
          style={{
            background: 'linear-gradient(0deg, rgba(0,0,0,0.58) 0%, transparent 32%)',
            opacity,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          ...posStyle,
          opacity,
          transform: transformVal,
          padding: '0.4rem 0.5rem',
        }}
      >
        {/* Akzentlinie links (nur bei minimal + bold) */}
        {style !== 'subtitle' && (
          <div
            style={{
              width: '3px',
              height: '100%',
              background: accentColor,
              position: 'absolute',
              left: 0,
              top: 0,
              borderRadius: '2px',
              boxShadow: `0 0 10px ${accentColor}70`,
            }}
          />
        )}
        <div
          style={{
            paddingLeft: style !== 'subtitle' ? '0.7rem' : 0,
            ...textStyleProps,
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
