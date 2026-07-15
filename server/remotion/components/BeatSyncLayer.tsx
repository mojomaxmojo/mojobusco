/**
 * BeatSyncLayer — Beat-Sync Flash-Effekt
 *
 * Kein require(), kein import() von optionalen Packages in dieser Datei.
 * useAudioData + visualizeAudio kommen als Props rein (aus render.js injiziert).
 * Fallback: synthetische Beats auf Bild-Wechseln — kein Package nötig.
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

// ── Typen ─────────────────────────────────────────────────────────────────

export interface BeatInfo {
  frame: number;
  intensity: number;
}

// ── Fallback-Beats ────────────────────────────────────────────────────────

export function generateFallbackBeats(
  totalFrames: number,
  fps: number,
  secondsPerImage: number,
  imageCount: number,
  hookFrames: number
): BeatInfo[] {
  const perSlide = Math.round(secondsPerImage * fps);
  const beats: BeatInfo[] = [];
  for (let i = 0; i < imageCount; i++) {
    const beatFrame = hookFrames + i * perSlide;
    if (beatFrame < totalFrames) {
      beats.push({ frame: beatFrame, intensity: 0.75 });
      const mid = beatFrame + Math.round(perSlide / 2);
      if (mid < totalFrames) beats.push({ frame: mid, intensity: 0.45 });
    }
  }
  return beats;
}

// ── Beat-Flash ────────────────────────────────────────────────────────────

const BeatFlash: React.FC<{
  beats: BeatInfo[];
  currentFrame: number;
  flashColor: string;
  flashOpacity: number;
  accentColor: string;
  strength: number;
}> = ({ beats, currentFrame, flashColor, flashOpacity, accentColor, strength }) => {
  if (strength <= 0 || beats.length === 0) return null;

  const WINDOW = 8;
  let best: BeatInfo | null = null;
  let bestDist = Infinity;
  for (const b of beats) {
    const d = Math.abs(currentFrame - b.frame);
    if (d <= WINDOW && d < bestDist) { best = b; bestDist = d; }
  }
  if (!best) return null;

  const t = interpolate(currentFrame - best.frame, [0, WINDOW], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const opacity = flashOpacity * t * t * best.intensity * strength;
  if (opacity < 0.01) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: flashColor, opacity, mixBlendMode: 'screen' }} />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: `${interpolate(t, [0, 1], [1, 1.06]) * 100}%`,
          height: `${interpolate(t, [0, 1], [1, 1.06]) * 100}%`,
          borderRadius: '50%',
          border: `3px solid ${accentColor}`,
          opacity: opacity * 0.4,
          boxShadow: `0 0 40px ${accentColor}88, inset 0 0 40px ${accentColor}44`,
        }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Haupt-Export ──────────────────────────────────────────────────────────

export const BeatSyncLayer: React.FC<{
  musicUrl?: string;
  numberOfSamples?: number;
  beatThreshold?: number;
  flashColor?: string;
  flashOpacity?: number;
  accentColor?: string;
  strength?: number;
  fallbackBeats?: BeatInfo[];
}> = ({
  strength = 1,
  flashColor = 'rgba(255,255,255,1)',
  flashOpacity = 0.18,
  accentColor = '#F59E0B',
  fallbackBeats = [],
}) => {
  const frame = useCurrentFrame();
  if (strength <= 0 || fallbackBeats.length === 0) return null;
  return <BeatFlash beats={fallbackBeats} currentFrame={frame}
    flashColor={flashColor} flashOpacity={flashOpacity}
    accentColor={accentColor} strength={strength} />;
};

// ── Waveform-Bar ──────────────────────────────────────────────────────────

export const AudioWaveformBar: React.FC<{
  accentColor?: string;
  numberOfBars?: number;
  position?: 'bottom' | 'top';
  height?: number;
  opacity?: number;
}> = ({ accentColor = '#F59E0B', numberOfBars = 32, position = 'bottom', height = 48, opacity = 0.55 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame / fps) * Math.PI * 2;
  const bars = Array.from({ length: numberOfBars }, (_, i) => {
    const p = (i / numberOfBars) * Math.PI * 2;
    return Math.max(0.05, Math.min(1, Math.sin(p + t * 1.5) * 0.5 + 0.5 + Math.sin(p * 2 + t * 0.7) * 0.3));
  });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        ...(position === 'bottom' ? { bottom: 0 } : { top: 0 }),
        left: 0, right: 0,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        gap: '2px', padding: '0 8px', height: `${height}px`, opacity,
      }}>
        {bars.map((h, i) => (
          <div key={i} style={{
            flex: 1, height: `${h * 100}%`,
            background: `linear-gradient(to top, ${accentColor}, ${accentColor}55)`,
            borderRadius: '2px 2px 0 0', minWidth: '2px',
          }} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
