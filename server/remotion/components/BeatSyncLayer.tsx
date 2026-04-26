/**
 * BeatSyncLayer — Schnitte synchron zur Musik (viral!)
 *
 * @remotion/media-utils laden:
 *  - require() mit NullPlugin-Kompatibilität (render.js gibt {} wenn fehlt)
 *  - Prüfung ob useAudioData eine Funktion ist bevor Nutzung
 *  - Fallback: synthetische Beats auf Bild-Wechseln (kein Package nötig)
 */

import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// @remotion/media-utils laden — NullPlugin gibt {} zurück wenn fehlt
/* eslint-disable @typescript-eslint/no-var-requires */
const _mediaUtils = require('@remotion/media-utils');
/* eslint-enable @typescript-eslint/no-var-requires */

// Prüfe ob echte Funktionen vorhanden (nicht leeres {})
const _useAudioData: ((src: string) => any) | null =
  typeof _mediaUtils?.useAudioData === 'function' ? _mediaUtils.useAudioData : null;
const _visualizeAudio: ((params: any) => number[]) | null =
  typeof _mediaUtils?.visualizeAudio === 'function' ? _mediaUtils.visualizeAudio : null;

const HAS_AUDIO_UTILS = Boolean(_useAudioData && _visualizeAudio);

// ── Typen ─────────────────────────────────────────────────────────────────

export interface BeatInfo {
  frame: number;
  intensity: number;
}

// ── Fallback-Beats (kein Audio nötig) ─────────────────────────────────────

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
      const midFrame = beatFrame + Math.round(perSlide / 2);
      if (midFrame < totalFrames) {
        beats.push({ frame: midFrame, intensity: 0.45 });
      }
    }
  }
  return beats;
}

// ── Beat-Flash Effekt ─────────────────────────────────────────────────────

const BeatFlash: React.FC<{
  beats: BeatInfo[];
  currentFrame: number;
  flashColor: string;
  flashOpacity: number;
  accentColor: string;
  strength: number;
}> = ({ beats, currentFrame, flashColor, flashOpacity, accentColor, strength }) => {
  if (strength <= 0 || beats.length === 0) return null;

  const FLASH_WINDOW = 8;
  let nearestBeat: BeatInfo | null = null;
  let nearestDist = Infinity;
  for (const b of beats) {
    const dist = Math.abs(currentFrame - b.frame);
    if (dist <= FLASH_WINDOW && dist < nearestDist) {
      nearestBeat = b;
      nearestDist = dist;
    }
  }
  if (!nearestBeat) return null;

  const flashT = interpolate(currentFrame - nearestBeat.frame, [0, FLASH_WINDOW], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const opacity = flashOpacity * flashT * flashT * nearestBeat.intensity * strength;
  if (opacity < 0.01) return null;

  const ringScale = interpolate(flashT, [0, 1], [1, 1.06]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: flashColor, opacity, mixBlendMode: 'screen' }} />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: `${ringScale * 100}%`, height: `${ringScale * 100}%`,
          borderRadius: '50%', border: `3px solid ${accentColor}`,
          opacity: opacity * 0.4,
          boxShadow: `0 0 40px ${accentColor}88, inset 0 0 40px ${accentColor}44`,
        }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Inner mit echter Audio-Analyse ────────────────────────────────────────
// Eigene Komponente damit useAudioData als normaler Hook aufgerufen wird

const BeatSyncWithAudio: React.FC<{
  musicUrl: string;
  numberOfSamples: number;
  beatThreshold: number;
  flashColor: string;
  flashOpacity: number;
  accentColor: string;
  strength: number;
  fallbackBeats: BeatInfo[];
}> = ({ musicUrl, numberOfSamples, beatThreshold, flashColor, flashOpacity, accentColor, strength, fallbackBeats }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Hook-Aufruf — _useAudioData ist garantiert eine Funktion wenn wir hier sind
  const audioData = (_useAudioData as (src: string) => any)(musicUrl);

  if (!audioData) {
    return <BeatFlash beats={fallbackBeats} currentFrame={frame}
      flashColor={flashColor} flashOpacity={flashOpacity} accentColor={accentColor} strength={strength} />;
  }

  const frequencies = (_visualizeAudio as (p: any) => number[])({
    fps, frame, audioData, numberOfSamples, optimizeFor: 'speed',
  });

  const bassEnd = Math.floor(numberOfSamples * 0.25);
  const bassAvg = frequencies.slice(0, bassEnd).reduce((a: number, b: number) => a + b, 0) / bassEnd;

  if (bassAvg <= beatThreshold) return null;

  return <BeatFlash
    beats={[{ frame, intensity: Math.min(1, bassAvg) }]}
    currentFrame={frame}
    flashColor={flashColor} flashOpacity={flashOpacity} accentColor={accentColor} strength={strength}
  />;
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
  musicUrl,
  numberOfSamples = 256,
  beatThreshold = 0.60,
  flashColor = 'rgba(255,255,255,1)',
  flashOpacity = 0.18,
  accentColor = '#F59E0B',
  strength = 1,
  fallbackBeats = [],
}) => {
  const frame = useCurrentFrame();

  if (strength <= 0) return null;

  if (HAS_AUDIO_UTILS && musicUrl) {
    return <BeatSyncWithAudio
      musicUrl={musicUrl} numberOfSamples={numberOfSamples} beatThreshold={beatThreshold}
      flashColor={flashColor} flashOpacity={flashOpacity} accentColor={accentColor}
      strength={strength} fallbackBeats={fallbackBeats}
    />;
  }

  if (fallbackBeats.length === 0) return null;
  return <BeatFlash beats={fallbackBeats} currentFrame={frame}
    flashColor={flashColor} flashOpacity={flashOpacity} accentColor={accentColor} strength={strength} />;
};

// ── Waveform-Bar ──────────────────────────────────────────────────────────

export const AudioWaveformBar: React.FC<{
  musicUrl?: string;
  accentColor?: string;
  numberOfBars?: number;
  position?: 'bottom' | 'top';
  height?: number;
  opacity?: number;
}> = ({ accentColor = '#F59E0B', numberOfBars = 32, position = 'bottom', height = 48, opacity = 0.55 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bars = Array.from({ length: numberOfBars }, (_, i) => {
    const phase = (i / numberOfBars) * Math.PI * 2;
    const t = (frame / fps) * Math.PI * 2;
    return Math.max(0.05, Math.min(1, Math.sin(phase + t * 1.5) * 0.5 + 0.5 + Math.sin(phase * 2 + t * 0.7) * 0.3));
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
