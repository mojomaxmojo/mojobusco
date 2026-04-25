/**
 * FilmGrain — Authentischer Film-Look via SVG-Filter
 * Basiert auf zufälligem Rauschen das frame-by-frame wechselt
 * → @remotion/noise Alternative (kein extra Package nötig)
 */

import { AbsoluteFill, useCurrentFrame } from 'remotion';

interface FilmGrainProps {
  opacity?: number;
  /** 'fine' | 'medium' | 'coarse' */
  intensity?: 'fine' | 'medium' | 'coarse';
}

export const FilmGrain: React.FC<FilmGrainProps> = ({
  opacity = 0.06,
  intensity = 'fine',
}) => {
  const frame = useCurrentFrame();

  // Verschiedene Grain-Seeds pro Frame (sieht aus wie echtes Film-Grain)
  const seed = frame * 7 + 42;

  const baseFreq = {
    fine: '0.65',
    medium: '0.45',
    coarse: '0.30',
  }[intensity];

  const numOctaves = {
    fine: 4,
    medium: 3,
    coarse: 2,
  }[intensity];

  const filterId = `grain-${frame}`;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        mixBlendMode: 'overlay',
        opacity,
      }}
    >
      <svg
        style={{ position: 'absolute', width: '100%', height: '100%' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id={filterId} x="0%" y="0%" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={baseFreq}
              numOctaves={numOctaves}
              seed={seed}
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix
              type="saturate"
              values="0"
              in="noise"
              result="grayNoise"
            />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" />
          </filter>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          filter={`url(#${filterId})`}
          fill="white"
        />
      </svg>
    </AbsoluteFill>
  );
};
