/**
 * BeatSyncLayer — Schnitte synchron zur Musik (viral!)
 *
 * FIX: Kein Top-Level await import() — das crasht esbuild (EPIPE).
 * Stattdessen: synchrones require() mit try/catch für optionale Packages.
 *
 * Strategie:
 *  - useAudioData() liest Amplitude pro Frame aus der Musik-Datei
 *  - Bei jedem Beat: Flash-Effekt + Bloom-Glühring → visueller Punch
 *  - Fallback: synthetische Beats auf Bild-Wechseln (kein Package nötig)
 */

import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// ── Optionale Packages: synchrones require() statt await import() ──────────
// await import() auf Top-Level crasht den Remotion/esbuild-Bundler (EPIPE)!

type AudioData = any;

type UseAudioDataFn = (src: string) => AudioData | null;
type VisualizeAudioFn = (params: {
  fps: number;
  frame: number;
  audioData: AudioData;
  numberOfSamples: number;
  optimizeFor?: 'speed' | 'accuracy';
}) => number[];

let useAudioDataFn: UseAudioDataFn | null = null;
let visualizeAudioFn: VisualizeAudioFn | null = null;

// Synchrones require() — funktioniert im Node/webpack-Kontext des Bundlers
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mediaUtils = require('@remotion/media-utils');
  if (mediaUtils?.useAudioData) {
    useAudioDataFn = mediaUtils.useAudioData;
    visualizeAudioFn = mediaUtils.visualizeAudio ?? null;
  }
} catch (_) {
  // @remotion/media-utils nicht installiert → Fallback-Modus
}

// ── Typen ─────────────────────────────────────────────────────────────────

export interface BeatInfo {
  /** Frame-Nummer wo ein Beat erkannt wurde */
  frame: number;
  /** Intensität 0–1 */
  intensity: number;
}

interface BeatSyncLayerProps {
  musicUrl?: string;
  numberOfSamples?: number;
  beatThreshold?: number;
  flashColor?: string;
  flashOpacity?: number;
  accentColor?: string;
  strength?: number;
}

// ── Fallback-Beats vorberechnen ───────────────────────────────────────────

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

// ── Beat-Flash Darstellung ────────────────────────────────────────────────

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

  const frameSinceBeat = currentFrame - nearestBeat.frame;
  const flashT = interpolate(frameSinceBeat, [0, FLASH_WINDOW], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = flashOpacity * flashT * flashT * nearestBeat.intensity * strength;
  if (opacity < 0.01) return null;

  const ringOpacity = opacity * 0.4;
  const ringScale = interpolate(flashT, [0, 1], [1, 1.06]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill
        style={{ background: flashColor, opacity, mixBlendMode: 'screen' }}
      />
      <AbsoluteFill
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div
          style={{
            width: `${ringScale * 100}%`,
            height: `${ringScale * 100}%`,
            borderRadius: '50%',
            border: `3px solid ${accentColor}`,
            opacity: ringOpacity,
            boxShadow: `0 0 40px ${accentColor}88, inset 0 0 40px ${accentColor}44`,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Inner-Komponente für echte useAudioData-Analyse ───────────────────────
// Nur rendern wenn useAudioDataFn vorhanden → Hook-Regeln sicher einhalten

const BeatSyncWithAudio: React.FC<{
  musicUrl: string;
  numberOfSamples: number;
  beatThreshold: number;
  flashColor: string;
  flashOpacity: number;
  accentColor: string;
  strength: number;
  fallbackBeats: BeatInfo[];
}> = ({
  musicUrl, numberOfSamples, beatThreshold,
  flashColor, flashOpacity, accentColor, strength, fallbackBeats,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // useAudioData als normaler Hook-Aufruf (kein bedingter Aufruf)
  const audioData = (useAudioDataFn as UseAudioDataFn)(musicUrl);

  if (!audioData || !visualizeAudioFn) {
    return (
      <BeatFlash
        beats={fallbackBeats}
        currentFrame={frame}
        flashColor={flashColor}
        flashOpacity={flashOpacity}
        accentColor={accentColor}
        strength={strength}
      />
    );
  }

  const frequencies = visualizeAudioFn({
    fps, frame, audioData, numberOfSamples, optimizeFor: 'speed',
  });

  const bassEnd = Math.floor(numberOfSamples * 0.25);
  const bassFreqs = frequencies.slice(0, bassEnd);
  const bassAvg = bassFreqs.reduce((a: number, b: number) => a + b, 0) / bassEnd;

  if (bassAvg <= beatThreshold) return null;

  const activeBeat: BeatInfo = { frame, intensity: Math.min(1, bassAvg) };

  return (
    <BeatFlash
      beats={[activeBeat]}
      currentFrame={frame}
      flashColor={flashColor}
      flashOpacity={flashOpacity}
      accentColor={accentColor}
      strength={strength}
    />
  );
};

// ── Haupt-Export ──────────────────────────────────────────────────────────

export const BeatSyncLayer: React.FC<
  BeatSyncLayerProps & { fallbackBeats?: BeatInfo[] }
> = ({
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

  // Echte Audio-Analyse nur wenn Package verfügbar UND musicUrl vorhanden
  if (useAudioDataFn && musicUrl) {
    return (
      <BeatSyncWithAudio
        musicUrl={musicUrl}
        numberOfSamples={numberOfSamples}
        beatThreshold={beatThreshold}
        flashColor={flashColor}
        flashOpacity={flashOpacity}
        accentColor={accentColor}
        strength={strength}
        fallbackBeats={fallbackBeats}
      />
    );
  }

  // Fallback: vorberechnete Beats (kein Package nötig)
  if (fallbackBeats.length === 0) return null;

  return (
    <BeatFlash
      beats={fallbackBeats}
      currentFrame={frame}
      flashColor={flashColor}
      flashOpacity={flashOpacity}
      accentColor={accentColor}
      strength={strength}
    />
  );
};

// ── Waveform-Visualizer ────────────────────────────────────────────────────

export const AudioWaveformBar: React.FC<{
  musicUrl?: string;
  accentColor?: string;
  numberOfBars?: number;
  position?: 'bottom' | 'top';
  height?: number;
  opacity?: number;
}> = ({
  accentColor = '#F59E0B',
  numberOfBars = 32,
  position = 'bottom',
  height = 48,
  opacity = 0.55,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pseudo-Waveform: sinusförmig animiert (kein Package nötig)
  const bars = Array.from({ length: numberOfBars }, (_, i) => {
    const phase = (i / numberOfBars) * Math.PI * 2;
    const timePhase = (frame / fps) * Math.PI * 2 * 1.5;
    const wave = Math.sin(phase + timePhase) * 0.5 + 0.5;
    const wave2 = Math.sin(phase * 2 + timePhase * 0.7) * 0.3;
    return Math.max(0.05, Math.min(1, wave + wave2));
  });

  const posStyle: React.CSSProperties =
    position === 'bottom'
      ? { bottom: 0, left: 0, right: 0 }
      : { top: 0, left: 0, right: 0 };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          ...posStyle,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: '2px',
          padding: '0 8px',
          height: `${height}px`,
          opacity,
        }}
      >
        {bars.map((barHeight, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${barHeight * 100}%`,
              background: `linear-gradient(to top, ${accentColor}, ${accentColor}55)`,
              borderRadius: '2px 2px 0 0',
              minWidth: '2px',
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
