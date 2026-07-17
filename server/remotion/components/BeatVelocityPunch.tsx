/**
 * BeatVelocityPunch — Beat-synchroner Velocity Scale Punch
 *
 * Auf jedem erkannten Beat zoomt das Bild kurz ein (1.0 → 1.12 → 1.0),
 * der klassische TikTok-Velocity-Edit-Look.
 *
 * Voraussetzung: keine WebGL/Canvas, reine CSS-Transform, deterministisch.
 * Nutzt @remotion/media-utils für echt Beat-Erkennung, sonst Fallback-Beats.
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAudioData } from '@remotion/media-utils';
import { computeAudioBeats, generateFallbackBeats, type BeatInfo } from './BeatSyncLayer';

export interface BeatVelocityPunchProps {
  /** Schaltet den Effekt ein. Default: true */
  enabled?: boolean;
  /** Musik-URL für echte Beat-Erkennung */
  musicUrl?: string;
  /** Beat-Threshold (0–1). Default 0.60 */
  beatThreshold?: number;
  /** Stärke des Punches (0–1, skaliert Amplitude). Default 1.0 */
  strength?: number;
  /** Fallback-Beats, wenn keine Musik oder kein Beat erkannt wird */
  fallbackBeats?: BeatInfo[];
  children: React.ReactNode;
}

/**
 * Berechnet die Skalierung für den aktuellen Frame.
 * Am Beat-Frame ist scale maximal, danach fällt es mit einer Sinus-Halbwelle
 * wieder auf 1.0 zurück.
 */
function calculatePunchScale(
  frame: number,
  fps: number,
  beats: BeatInfo[],
  strength: number
): number {
  if (beats.length === 0 || strength <= 0) return 1;

  // Punch-Fenster: ca. 6 Frames @ 30fps
  const windowFrames = Math.max(4, Math.round(fps * 0.2));

  let best: BeatInfo | null = null;
  let bestDist = Infinity;
  for (const b of beats) {
    const d = Math.abs(frame - b.frame);
    if (d <= windowFrames && d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  if (!best) return 1;

  const t = interpolate(frame - best.frame, [0, windowFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Sinus-Bell: 1 → 1+amp → 1
  const amplitude = 0.12 * strength * best.intensity;
  const scale = 1 + amplitude * Math.sin(t * Math.PI);

  return Math.max(1, scale);
}

const BeatVelocityPunchWithMusic: React.FC<BeatVelocityPunchProps & { musicUrl: string }> = ({
  musicUrl,
  beatThreshold = 0.6,
  strength = 1,
  fallbackBeats = [],
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const audioData = useAudioData(musicUrl);

  const beats = React.useMemo(() => {
    if (!audioData) return fallbackBeats;
    try {
      const realBeats = computeAudioBeats(audioData, fps, durationInFrames, beatThreshold);
      return realBeats.length > 0 ? realBeats : fallbackBeats;
    } catch {
      return fallbackBeats;
    }
  }, [audioData, fps, durationInFrames, beatThreshold, fallbackBeats]);

  const scale = calculatePunchScale(frame, fps, beats, strength);
  if (scale <= 1.001) return <>{children}</>;

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale.toFixed(4)})`,
        transformOrigin: 'center center',
        willChange: 'transform',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const BeatVelocityPunchFallbackOnly: React.FC<Omit<BeatVelocityPunchProps, 'musicUrl'>> = ({
  strength = 1,
  fallbackBeats = [],
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = calculatePunchScale(frame, fps, fallbackBeats, strength);
  if (scale <= 1.001) return <>{children}</>;

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale.toFixed(4)})`,
        transformOrigin: 'center center',
        willChange: 'transform',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const BeatVelocityPunch: React.FC<BeatVelocityPunchProps> = (props) => {
  if (props.enabled === false) return <>{props.children}</>;
  if (props.musicUrl) {
    return <BeatVelocityPunchWithMusic {...props} musicUrl={props.musicUrl} />;
  }
  return <BeatVelocityPunchFallbackOnly {...props} />;
};
