/**
 * ColorGradeOverlay — Cinematic Look via CSS-Filter + Gradient Overlay
 * Styles: 'golden' | 'warm' | 'moody' | 'blue' | 'teal-orange' | 'vintage'
 */

import { AbsoluteFill } from 'remotion';

export type ColorGrade = 'golden' | 'warm' | 'moody' | 'blue' | 'teal-orange' | 'vintage' | 'vhs' | 'glitch' | 'duotone' | 'none';

const GRADES: Record<ColorGrade, {
  filter: string;
  overlay: string;
  opacity: number;
  blendMode?: string;
}> = {
  golden: {
    filter: 'contrast(1.05) saturate(1.15) brightness(1.02)',
    overlay: 'linear-gradient(135deg, rgba(255,180,50,0.18) 0%, rgba(255,120,20,0.10) 100%)',
    opacity: 1,
  },
  warm: {
    filter: 'contrast(1.08) saturate(1.20) brightness(1.05) sepia(0.12)',
    overlay: 'linear-gradient(180deg, rgba(255,160,80,0.12) 0%, rgba(200,80,20,0.08) 100%)',
    opacity: 1,
  },
  moody: {
    filter: 'contrast(1.15) saturate(0.85) brightness(0.95)',
    overlay: 'linear-gradient(180deg, rgba(20,20,40,0.25) 0%, rgba(80,40,20,0.10) 100%)',
    opacity: 1,
  },
  blue: {
    filter: 'contrast(1.10) saturate(0.90) brightness(1.00) hue-rotate(10deg)',
    overlay: 'linear-gradient(135deg, rgba(30,80,160,0.18) 0%, rgba(10,40,100,0.12) 100%)',
    opacity: 1,
  },
  'teal-orange': {
    filter: 'contrast(1.12) saturate(1.25) brightness(0.98)',
    overlay: 'linear-gradient(135deg, rgba(0,200,180,0.10) 0%, rgba(255,100,20,0.10) 100%)',
    opacity: 1,
  },
  vintage: {
    filter: 'contrast(1.05) saturate(0.75) brightness(0.98) sepia(0.25)',
    overlay: 'linear-gradient(135deg, rgba(180,150,80,0.15) 0%, rgba(100,60,20,0.12) 100%)',
    opacity: 1,
  },
  vhs: {
    filter: 'contrast(1.1) saturate(1.3) brightness(1.05)',
    overlay: 'linear-gradient(135deg, rgba(0,255,255,0.08) -10%, rgba(255,0,128,0.08) 110%)',
    opacity: 1,
  },
  glitch: {
    filter: 'contrast(1.2) saturate(1.4) hue-rotate(-5deg)',
    overlay: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
    opacity: 1,
  },
  duotone: {
    filter: 'grayscale(1) contrast(1.15)',
    overlay: 'linear-gradient(135deg, #F59E0B 0%, #3B82F6 100%)',
    opacity: 1,
    blendMode: 'color',
  },
  none: {
    filter: 'none',
    overlay: 'none',
    opacity: 0,
  },
};

/** Lifestyle → Default Color Grade Mapping */
export function lifestyleToGrade(lifestyle: string): ColorGrade {
  const map: Record<string, ColorGrade> = {
    mojobus: 'golden',
    vanlife: 'warm',
    rvlife: 'teal-orange',
    beachlife: 'blue',
    wohnmobil: 'vintage',
    'perpetual-travelers': 'moody',
  };
  return map[lifestyle] || 'golden';
}

interface ColorGradeOverlayProps {
  grade: ColorGrade;
}

export const ColorGradeOverlay: React.FC<ColorGradeOverlayProps> = ({ grade }) => {
  const config = GRADES[grade] || GRADES.golden;
  if (grade === 'none') return null;

  return (
    <>
      {/* CSS-Filter wird auf ein unsichtbares Element gesetzt, der eigentliche
          Filter wird via backdropFilter oder als Wrapper angewendet.
          Hier: Gradient-Overlay als Semi-transparente Schicht */}
      <AbsoluteFill
        style={{
          background: config.overlay,
          mixBlendMode: (config.blendMode || 'multiply') as React.CSSProperties['mixBlendMode'],
          pointerEvents: 'none',
        }}
      />
    </>
  );
};

/** Wrapper der den Filter auf den Inhalt anwendet */
export const ColorGradeWrapper: React.FC<{
  grade: ColorGrade;
  children: React.ReactNode;
}> = ({ grade, children }) => {
  const config = GRADES[grade] || GRADES.golden;
  return (
    <AbsoluteFill style={{ filter: config.filter }}>
      {children}
    </AbsoluteFill>
  );
};
