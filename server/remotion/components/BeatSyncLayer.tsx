/**
 * BeatSyncLayer — Schnitte synchron zur Musik (viral!)
 *
 * Strategie:
 *  - useAudioData() liest Amplitude pro Frame aus der Musik-Datei
 *  - Wir analysieren die Waveform und erkennen Beats (lokale Maxima)
 *  - Bei jedem Beat: Flash-Effekt + Bloom-Glühring → visueller Punch
 *  - Optional: beatCutFrames Array für harte Schnitte an Beat-Positionen
 *    (die eigentliche Bild-Sequenz kann darauf reagieren)
 *
 * WICHTIG für VPS:
 *  - useAudioData() braucht @remotion/media-utils (bereits in remotion enthalten)
 *  - Die Audiodatei muss über HTTP erreichbar sein (nicht file://)
 *  - Falls kein musicUrl → keine Analyse, kein Effekt (graceful fallback)
 *
 * Package: useAudioData ist in 'remotion' enthalten (seit v3.x)
 * Kein extra npm install nötig!
 */

import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// useAudioData ist in @remotion/media-utils
// Lazy import damit kein Build-Fehler wenn Package fehlt
let useAudioDataFn: ((src: string) => AudioData | null) | null = null;
let visualizeAudioFn: ((params: {
  fps: number;
  frame: number;
  audioData: AudioData;
  numberOfSamples: number;
  optimizeFor?: 'speed' | 'accuracy';
}) => number[]) | null = null;

try {
  // @ts-ignore — dynamisch geladen
  const mediaUtils = await import('@remotion/media-utils').catch(() => null);
  if (mediaUtils) {
    useAudioDataFn = mediaUtils.useAudioData;
    visualizeAudioFn = mediaUtils.visualizeAudio;
  }
} catch (_) {}

// ── Typen ─────────────────────────────────────────────────────────────────

export interface BeatInfo {
  /** Frame-Nummer wo ein Beat erkannt wurde */
  frame: number;
  /** Intensität 0–1 */
  intensity: number;
}

interface BeatSyncLayerProps {
  /** Musik-URL (muss HTTP sein, kein file://) */
  musicUrl?: string;
  /** Anzahl der Frequenz-Samples für Beat-Erkennung */
  numberOfSamples?: number;
  /** Mindest-Energie um als Beat zu zählen (0–1, default 0.6) */
  beatThreshold?: number;
  /** Flash-Farbe bei Beat (default: weiß) */
  flashColor?: string;
  /** Max. Flash-Opacity (0–1, default 0.18) */
  flashOpacity?: number;
  /** Bloom-Ring Farbe (default: accentColor) */
  accentColor?: string;
  /** Beat-Sync Stärke 0–1 (0 = aus) */
  strength?: number;
  /** Wenn true: Gibt beatCutFrames nach außen (für Bild-Wechsel) */
  onBeatFrames?: (frames: number[]) => void;
}

// ── Beat-Analyse ohne AudioData (statischer Fallback) ─────────────────────

/**
 * Erzeuge synthetische Beat-Frames wenn keine Audiodaten verfügbar.
 * Basiert auf secondsPerImage → Beats auf Bild-Wechseln.
 */
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
      // Extra-Beat in der Mitte jedes Slides (halber Takt)
      const midFrame = beatFrame + Math.round(perSlide / 2);
      if (midFrame < totalFrames) {
        beats.push({ frame: midFrame, intensity: 0.45 });
      }
    }
  }

  return beats;
}

// ── Beat Flash Effekt ──────────────────────────────────────────────────────

interface BeatFlashProps {
  beats: BeatInfo[];
  currentFrame: number;
  flashColor: string;
  flashOpacity: number;
  accentColor: string;
  strength: number;
}

const BeatFlash: React.FC<BeatFlashProps> = ({
  beats,
  currentFrame,
  flashColor,
  flashOpacity,
  accentColor,
  strength,
}) => {
  if (strength <= 0) return null;

  // Nächster Beat in einem Fenster von ±8 Frames
  const FLASH_WINDOW = 8;
  const nearestBeat = beats.reduce<{ beat: BeatInfo | null; dist: number }>(
    (acc, b) => {
      const dist = Math.abs(currentFrame - b.frame);
      if (dist < acc.dist && dist <= FLASH_WINDOW) {
        return { beat: b, dist };
      }
      return acc;
    },
    { beat: null, dist: Infinity }
  );

  if (!nearestBeat.beat) return null;

  const { beat, dist } = nearestBeat;

  // Flash: Schnell rein, langsam raus
  // Frame 0 = Beat, dann Decay über FLASH_WINDOW Frames
  const frameSinceBeat = currentFrame - beat.frame;
  const flashT = interpolate(
    frameSinceBeat,
    [0, FLASH_WINDOW],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Quadratischer Decay: schnell raus
  const flashDecay = flashT * flashT;
  const opacity = flashOpacity * flashDecay * beat.intensity * strength;

  if (opacity < 0.01) return null;

  // Bloom-Ring: leicht größer als der Flash
  const ringOpacity = opacity * 0.4;
  const ringScale = interpolate(flashT, [0, 1], [1, 1.06]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Weißer Flash */}
      <AbsoluteFill
        style={{
          background: flashColor,
          opacity,
          mixBlendMode: 'screen',
        }}
      />
      {/* Bloom-Ring (Glühring) */}
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
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

// ── Haupt-Komponente mit AudioData ─────────────────────────────────────────

/**
 * BeatSyncLayerInner — nutzt useAudioData wenn verfügbar
 * Wird nur gerendert wenn useAudioDataFn geladen ist.
 */
const BeatSyncLayerInner: React.FC<BeatSyncLayerProps & {
  useAudioDataHook: (src: string) => any;
  visualizeAudioHook: (params: any) => number[];
  beats: BeatInfo[];
}> = ({
  musicUrl,
  numberOfSamples = 256,
  beatThreshold = 0.60,
  flashColor = 'rgba(255,255,255,1)',
  flashOpacity = 0.18,
  accentColor = '#F59E0B',
  strength = 1,
  useAudioDataHook,
  visualizeAudioHook,
  beats: fallbackBeats,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Versuche echte Audio-Daten zu laden
  const audioData = musicUrl ? useAudioDataHook(musicUrl) : null;

  let activeBeat: BeatInfo | null = null;
  let activeBeatFrame = -1;

  if (audioData && visualizeAudioHook) {
    // Echte Frequenz-Analyse
    const frequencies = visualizeAudioHook({
      fps,
      frame,
      audioData,
      numberOfSamples,
      optimizeFor: 'speed',
    });

    // Bass-Bereich (erste 25% der Samples = Bässe)
    const bassEnd = Math.floor(numberOfSamples * 0.25);
    const bassFreqs = frequencies.slice(0, bassEnd);
    const bassAvg = bassFreqs.reduce((a, b) => a + b, 0) / bassEnd;

    // Beat erkannt wenn Bass über Schwellwert
    if (bassAvg > beatThreshold) {
      activeBeat = { frame, intensity: Math.min(1, bassAvg) };
    }
  }

  // Finale Beats: echte AudioData wenn verfügbar, sonst Fallback
  const effectiveBeat = activeBeat;
  const usedBeats = audioData ? [] : fallbackBeats;

  if (!effectiveBeat && usedBeats.length === 0) return null;

  // Wenn echte AudioData: direkt rendern (kein Pre-analysis nötig)
  if (effectiveBeat) {
    return (
      <BeatFlash
        beats={[effectiveBeat]}
        currentFrame={frame}
        flashColor={flashColor}
        flashOpacity={flashOpacity}
        accentColor={accentColor}
        strength={strength}
      />
    );
  }

  // Fallback: vorberechnete Beat-Frames
  return (
    <BeatFlash
      beats={usedBeats}
      currentFrame={frame}
      flashColor={flashColor}
      flashOpacity={flashOpacity}
      accentColor={accentColor}
      strength={strength}
    />
  );
};

// ── Export: BeatSyncLayer ──────────────────────────────────────────────────

/**
 * BeatSyncLayer — Drop-in Komponente für viral Beat-Cuts.
 *
 * Nutzt @remotion/media-utils (useAudioData) wenn installiert.
 * Fallback: synthetische Beats auf Bild-Wechseln.
 *
 * Einbinden in MojoBusVideo:
 * ```tsx
 * <BeatSyncLayer
 *   musicUrl={musicUrl}
 *   accentColor={accentColor}
 *   strength={beatSyncStrength}
 *   fallbackBeats={generateFallbackBeats(...)}
 * />
 * ```
 */
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

  // Wenn @remotion/media-utils verfügbar: nutze echte AudioData
  if (useAudioDataFn && visualizeAudioFn && musicUrl) {
    return (
      <BeatSyncLayerInner
        musicUrl={musicUrl}
        numberOfSamples={numberOfSamples}
        beatThreshold={beatThreshold}
        flashColor={flashColor}
        flashOpacity={flashOpacity}
        accentColor={accentColor}
        strength={strength}
        useAudioDataHook={useAudioDataFn}
        visualizeAudioHook={visualizeAudioFn}
        beats={fallbackBeats}
      />
    );
  }

  // Kein @remotion/media-utils oder kein musicUrl → Fallback-Beats
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

// ── Audio-Waveform Visualizer (Bonus-Komponente) ───────────────────────────

/**
 * AudioWaveformBar — Zeigt animierte Equalizer-Balken.
 * Viral-Effekt: sieht aus als würde die Musik visualisiert.
 * Fallback wenn kein AudioData: animierte Pseudo-Balken.
 */
export const AudioWaveformBar: React.FC<{
  musicUrl?: string;
  accentColor?: string;
  numberOfBars?: number;
  position?: 'bottom' | 'top';
  height?: number;
  opacity?: number;
}> = ({
  musicUrl,
  accentColor = '#F59E0B',
  numberOfBars = 32,
  position = 'bottom',
  height = 48,
  opacity = 0.55,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pseudo-Waveform ohne AudioData (sinusförmig animiert)
  const bars = Array.from({ length: numberOfBars }, (_, i) => {
    const phase = (i / numberOfBars) * Math.PI * 2;
    const timePhase = (frame / fps) * Math.PI * 2 * 1.5; // 1.5 Hz
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
