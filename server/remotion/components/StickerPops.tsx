/**
 * StickerPops — Animierte Emoji-Sticker an Cut-Punkten
 *
 * Deterministische Rotation durch eine kleine Emoji-Liste, analog zu
 * `pickCutEffect` in `CinematicEffects.tsx`, aber komplett unabhängig.
 * Sticker poppt mit `spring()` rein (Scale 0→1.2→1) und faded nach ~0.6s aus.
 */

import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

/** Emoji-Liste für deterministische Rotation */
const STICKER_EMOJIS = ['📍', '🔥', '❤️', '✨'];

/**
 * Deterministische Rotation durch die Emoji-Liste.
 * Analog zu `pickCutEffect` in CinematicEffects.tsx.
 */
export function pickStickerForCut(cutIndex: number): string {
  return STICKER_EMOJIS[cutIndex % STICKER_EMOJIS.length];
}

/**
 * Dauer der StickerPop-Sequence in Frames (analog `flashCutDuration`).
 * ~0.6s bei 30fps = ~18 Frames
 */
export function stickerPopDuration(fps: number): number {
  return Math.max(12, Math.round(fps * 0.6));
}

/**
 * StickerPop — Zeigt ein Emoji zentriert/leicht versetzt mit Spring-Animation.
 * Poppt mit Scale 0→1.2→1 rein und faded nach ~0.6s aus.
 */
export const StickerPop: React.FC<{ emoji: string }> = ({ emoji }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = stickerPopDuration(fps);

  // Spring-Animation: 0 → 1.2 → 1 in den ersten ~40% der Dauer
  const scale = spring({
    frame: frame,
    fps,
    config: {
      damping: 10,
      stiffness: 150,
      mass: 0.5,
    },
  });

  // Fade-out in den letzten ~40% der Dauer
  const fadeOutStart = Math.round(duration * 0.6);
  const opacity = frame >= fadeOutStart
    ? interpolate(frame, [fadeOutStart, duration], [1, 0], { extrapolateRight: 'clamp' })
    : 1;

  // Leicht versetzte Position (mal oben-links, mal unten-rechts, etc.)
  const offsets = [
    { top: '25%', left: '33%' },
    { top: '55%', left: '60%' },
    { top: '30%', left: '55%' },
    { top: '60%', left: '30%' },
  ];
  const pos = offsets[Math.floor(frame / duration * offsets.length) % offsets.length];

  return (
    <div
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        opacity,
        transform: `scale(${scale})`,
        top: pos.top,
        left: pos.left,
        fontSize: 48,
        zIndex: 10,
        lineHeight: 1,
      }}
    >
      {emoji}
    </div>
  );
};