/**
 * PhotoDumpLayout — Split-Screen Layouts für TikTok/Reels "Photo Dump" Look
 *
 * CSS-only (kein WebGL/Canvas), VPS- und headless-Chrome-sicher.
 * Jede Zelle rendert eine KenBurnsImage mit reduzierter Intensität, damit der
 * typische Zoom/Pan Effekt erhalten bleibt, aber nicht zu hektisch wirkt.
 */

import React from 'react';
import { AbsoluteFill } from 'remotion';
import { KenBurnsImage, pickDirection } from './KenBurnsImage';
import type { SlideLayout } from '../slideLayouts';

interface PhotoDumpLayoutProps {
  /** Bis zu 4 Bild-URLs für diesen Slide */
  images: string[];
  /** Gewünschtes Layout (single, split-2-v, split-2-h, split-3, split-4) */
  layout: SlideLayout;
  /** Slide-Index für deterministische Animations-Richtungen */
  slideIndex: number;
}

const LAYOUT_CELLS: Record<SlideLayout, number> = {
  single: 1,
  'split-2-v': 2,
  'split-2-h': 2,
  'split-3': 3,
  'split-4': 4,
};

/** Ermittelt die Richtung für eine Zelle (verschieden pro Zelle, deterministisch) */
function cellDirection(slideIndex: number, cellIndex: number) {
  const base = pickDirection(slideIndex + cellIndex * 3);
  // Reduziere hektische Richtungen leicht
  if (base === 'handheld') return 'noise';
  return base;
}

export const PhotoDumpLayout: React.FC<PhotoDumpLayoutProps> = ({
  images,
  layout,
  slideIndex,
}) => {
  const count = LAYOUT_CELLS[layout] ?? 1;
  // Sicherstellen, dass wir nie mehr Zellen als Bilder haben
  const effectiveCount = Math.min(count, images.length);
  const slots = Array.from({ length: effectiveCount }, (_, i) => i);

  if (effectiveCount === 1 || layout === 'single') {
    return (
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <KenBurnsImage
          src={images[0]}
          direction={cellDirection(slideIndex, 0)}
          intensity={0.08}
          motionBlurStrength={0}
          noiseSeed={slideIndex}
        />
      </AbsoluteFill>
    );
  }

  const commonCellStyle: React.CSSProperties = {
    overflow: 'hidden',
    position: 'absolute',
  };

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {layout === 'split-2-v' && (
        <>
          {slots.map((i) => (
            <div
              key={i}
              style={{
                ...commonCellStyle,
                top: 0,
                bottom: 0,
                left: i === 0 ? '0%' : '50.5%',
                right: i === 0 ? '50.5%' : '0%',
              }}
            >
              <KenBurnsImage
                src={images[i]}
                direction={cellDirection(slideIndex, i)}
                intensity={0.07}
                motionBlurStrength={0}
                noiseSeed={slideIndex + i}
              />
            </div>
          ))}
        </>
      )}

      {layout === 'split-2-h' && (
        <>
          {slots.map((i) => (
            <div
              key={i}
              style={{
                ...commonCellStyle,
                left: 0,
                right: 0,
                top: i === 0 ? '0%' : '50.5%',
                bottom: i === 0 ? '50.5%' : '0%',
              }}
            >
              <KenBurnsImage
                src={images[i]}
                direction={cellDirection(slideIndex, i)}
                intensity={0.07}
                motionBlurStrength={0}
                noiseSeed={slideIndex + i}
              />
            </div>
          ))}
        </>
      )}

      {layout === 'split-3' && (
        <>
          {/* Oben: 1 großes Bild über volle Breite */}
          <div
            style={{
              ...commonCellStyle,
              top: 0,
              left: 0,
              right: 0,
              bottom: '50.5%',
            }}
          >
            <KenBurnsImage
              src={images[0]}
              direction={cellDirection(slideIndex, 0)}
              intensity={0.06}
              motionBlurStrength={0}
              noiseSeed={slideIndex}
            />
          </div>
          {/* Unten: 2 Bilder nebeneinander */}
          <div
            style={{
              ...commonCellStyle,
              top: '50.5%',
              left: 0,
              right: '50.5%',
              bottom: 0,
            }}
          >
            <KenBurnsImage
              src={images[1]}
              direction={cellDirection(slideIndex, 1)}
              intensity={0.07}
              motionBlurStrength={0}
              noiseSeed={slideIndex + 1}
            />
          </div>
          <div
            style={{
              ...commonCellStyle,
              top: '50.5%',
              left: '50.5%',
              right: 0,
              bottom: 0,
            }}
          >
            <KenBurnsImage
              src={images[2]}
              direction={cellDirection(slideIndex, 2)}
              intensity={0.07}
              motionBlurStrength={0}
              noiseSeed={slideIndex + 2}
            />
          </div>
        </>
      )}

      {layout === 'split-4' && (
        <>
          {slots.map((i) => {
            const col = i % 2; // 0 = links, 1 = rechts
            const row = Math.floor(i / 2); // 0 = oben, 1 = unten
            return (
              <div
                key={i}
                style={{
                  ...commonCellStyle,
                  top: row === 0 ? '0%' : '50.5%',
                  bottom: row === 0 ? '50.5%' : '0%',
                  left: col === 0 ? '0%' : '50.5%',
                  right: col === 0 ? '50.5%' : '0%',
                }}
              >
                <KenBurnsImage
                  src={images[i]}
                  direction={cellDirection(slideIndex, i)}
                  intensity={0.06}
                  motionBlurStrength={0}
                  noiseSeed={slideIndex + i}
                />
              </div>
            );
          })}
        </>
      )}
    </AbsoluteFill>
  );
};

export default PhotoDumpLayout;
