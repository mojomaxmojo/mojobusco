/**
 * StickerPops — Animierte Sticker/Emoji-Pops an Cut-Punkten
 *
 * Komplett unabhängig von CinematicEffects.tsx (eigene Rotation, keine
 * Änderung an CUT_ROTATION). Optionaler Zusatz-Layer, gated hinter
 * stickersEnabled (Default: false in MojoBusVideo.tsx).
 */

import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// ══════════════════════════════════════════════════════════════════════════
// STICKER-ROTATION (deterministisch)
// ══════════════════════════════════════════════════════════════════════════

const STICKER_EMOJIS = ['📍', '☀️', '❤️', '✨'];

/**
 * Wählt deterministisch ein Emoji für Cut Nummer cutIndex.
 * Analog zu pickCutEffect in CinematicEffects.tsx, aber komplett eigenständig.
 */
export function pickStickerForCut(cutIndex: number): string {
  return STICKER_EMOJIS[cutIndex % STICKER_EMOJIS.length];
}

// ══════════════════════════════════════════════════════════════════════════
// STICKER-POP — Emoji poppt rein und fadet aus
// ══════════════════════════════════════════════════════════════════════════

/**
 * Zeigt ein Emoji zentriert/leicht versetzt an. Poppt mit spring() rein
 * (Scale 0 → 1.2 → 1) und fadet nach ~0,6s aus (gleiches Zeitfenster-Muster
 * wie FlashCut in CinematicEffects.tsx).
 */
export const StickerPop: React.FC<{ emoji: string }> = ({ emoji }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const popDuration = stickerPopDuration(fps);

  // Scale-Verlauf: 0 → 1.2 (spring) → 1 (leichtes Zurückfedern)
  const scale = spring({
    frame,
    fps,
    config: {
      damping: 10,
      stiffness: 180,
      mass: 0.6,
    },
  });

  // Fade-out in den letzten ~0,25s der Pop-Dauer
  const fadeOutFrames = Math.round(fps * 0.25);
  const opacity = interpolate(
    frame,
    [0, 2, popDuration - fadeOutFrames, popDuration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  if (opacity < 0.01) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: '38%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${scale.toFixed(4)})`,
          fontSize: 110,
          opacity,
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.35))',
        }}
      >
        {emoji}
      </div>
    </AbsoluteFill>
  );
};

/** Dauer einer StickerPop-Sequence in Frames (analog flashCutDuration) */
export function stickerPopDuration(fps: number): number {
  return Math.max(6, Math.round(fps * 0.6));
}
