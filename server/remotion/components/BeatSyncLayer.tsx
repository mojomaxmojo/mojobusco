/**
 * BeatSyncLayer — Beat-Sync Flash-Effekt
 *
 * Echte Beat-Erkennung via @remotion/media-utils (useAudioData + visualizeAudio),
 * wenn eine musicUrl übergeben wird und das Laden/Analysieren erfolgreich ist.
 * Fallback: synthetische Beats auf Bild-Wechseln (fallbackBeats-Prop) — greift
 * unverändert, wenn keine musicUrl vorhanden ist, das Laden fehlschlägt oder
 * keine echten Beats gefunden werden. Keine Regression möglich.
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAudioData, visualizeAudio, type AudioData } from '@remotion/media-utils';
import { staticFile } from 'remotion';

// Leere WAV-Datei für den Fall, dass keine Musik vorhanden ist.
// Remotion's useAudioData braucht eine decodierbare Audio-URL, darf aber
// nicht mit leerem String aufgerufen werden (Hooks-Regel).
const EMPTY_AUDIO_SRC = staticFile('silence.wav');

// ── useBeats Hook ───────────────────────────────────────────────────────
// Wiederverwendbare Beat-Erkennung für andere Components (z. B. LottieBus).
// Ruft useAudioData immer mit einem String auf (Hooks-Regel) und ignoriert
// das Ergebnis, wenn keine musicUrl vorhanden ist.

export function useBeats(
  musicUrl: string | undefined,
  fps: number,
  durationInFrames: number,
  beatThreshold: number,
  fallbackBeats: BeatInfo[]
): BeatInfo[] {
  const audioData = useAudioData(musicUrl || EMPTY_AUDIO_SRC);

  return React.useMemo(() => {
    if (!musicUrl || !audioData) return fallbackBeats;
    try {
      const realBeats = computeAudioBeats(audioData, fps, durationInFrames, beatThreshold);
      return realBeats.length > 0 ? realBeats : fallbackBeats;
    } catch {
      return fallbackBeats;
    }
  }, [audioData, beatThreshold, durationInFrames, fallbackBeats, fps, musicUrl]);
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
// Zwei Varianten je nach musicUrl, damit Hooks nie bedingt aufgerufen werden:
// - vorhanden  → BeatSyncLayerWithMusic (versucht echte Beats via useAudioData)
// - nicht da   → BeatSyncLayerFallbackOnly (reines Fallback, wie bisher)

type BeatSyncLayerProps = {
  musicUrl?: string;
  numberOfSamples?: number;
  beatThreshold?: number;
  flashColor?: string;
  flashOpacity?: number;
  accentColor?: string;
  strength?: number;
  fallbackBeats?: BeatInfo[];
};

const BeatSyncLayerFallbackOnly: React.FC<Omit<BeatSyncLayerProps, 'musicUrl'>> = ({
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

const BeatSyncLayerWithMusic: React.FC<BeatSyncLayerProps & { musicUrl: string }> = ({
  musicUrl,
  beatThreshold = 0.45,
  strength = 1,
  flashColor = 'rgba(255,255,255,1)',
  flashOpacity = 0.18,
  accentColor = '#F59E0B',
  fallbackBeats = [],
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // useAudioData liefert null solange nicht geladen / bei Fehlschlag.
  // Kein try/catch nötig: die Funktion selbst behandelt Ladefehler intern
  // (delayRender/continueRender) und gibt im Zweifel null zurück.
  const audioData = useAudioData(musicUrl);

  const realBeats = React.useMemo(() => {
    if (!audioData) return null;
    try {
      const beats = computeAudioBeats(audioData, fps, durationInFrames, beatThreshold);
      return beats.length > 0 ? beats : null;
    } catch {
      return null;
    }
  }, [audioData, fps, durationInFrames, beatThreshold]);

  const beats = realBeats ?? fallbackBeats;
  if (strength <= 0 || beats.length === 0) return null;
  return <BeatFlash beats={beats} currentFrame={frame}
    flashColor={flashColor} flashOpacity={flashOpacity}
    accentColor={accentColor} strength={strength} />;
};

export const BeatSyncLayer: React.FC<BeatSyncLayerProps> = (props) => {
  if (props.musicUrl) {
    return <BeatSyncLayerWithMusic {...props} musicUrl={props.musicUrl} />;
  }
  return <BeatSyncLayerFallbackOnly {...props} />;
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
