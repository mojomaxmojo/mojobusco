/**
 * LottieBusIcon — MojoBus US Class-A Hippie-Coach (v5)
 *
 * Nachgebaut nach echtem Foto-Vorbild:
 *  - Kastenförmiger US Class-A RV / Coach-Bus
 *  - Cremeweiß, abgerundete obere Ecken
 *  - Große 2-teilige Windschutzscheibe mit Mittelsteg + Scheibenwischer
 *  - LKW-Außenspiegel (Arm + Rechteck)
 *  - Rechteckige Doppelscheinwerfer + Blinker
 *  - Breite Chromstoßstange
 *  - Kühlergrill (horizontale Streben)
 *  - Peace-Zeichen UMGEKEHRT bunt (Strich ↓, Diagonalen ↑)
 *  - Sonnenblumen + Prillblumen + Schmetterlinge + Sterne
 *  - "Live Love Travel" Text auf Scheibe
 *  - Multi-Speichen Chromfelgen
 *  - AC-Unit auf dem Dach
 *  - Proportionen: ~10m × 3.3m → W:H ≈ 3:1
 */

import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// ─────────────────────────────────────────────────────────────────────────────
// HILFSKOMPONENTEN
// ─────────────────────────────────────────────────────────────────────────────

// ── Abgas-Wölkchen ────────────────────────────────────────────────────────
const ExhaustPuff: React.FC<{ cx: number; cy: number; frame: number; fps: number; delay?: number }> =
  ({ cx, cy, frame, fps, delay = 0 }) => {
    const t = ((frame - delay) / fps) % 1.5;
    if (t < 0) return null;
    const opacity = interpolate(t, [0, 0.2, 1.5], [0.5, 0.35, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const sc = interpolate(t, [0, 1.5], [0.3, 2.2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const dx = interpolate(t, [0, 1.5], [0, -28], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const dy = interpolate(t, [0, 1.5], [0, -12], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return <ellipse cx={cx + dx} cy={cy + dy} rx={7 * sc} ry={5 * sc} fill="#c8d0d8" opacity={opacity} />;
  };

// ── Prillblume (5 Blütenblätter, elliptisch) ─────────────────────────────
const PrillFlower: React.FC<{
  cx: number; cy: number; r: number;
  petalColor: string; centerColor: string;
  frame: number; fps: number; rotOffset?: number; numPetals?: number;
}> = ({ cx, cy, r, petalColor, centerColor, frame, fps, rotOffset = 0, numPetals = 5 }) => {
  const wobble = Math.sin((frame / fps) * Math.PI * 2 * 0.85 + rotOffset) * 3.5;
  const angles = Array.from({ length: numPetals }, (_, i) => (360 / numPetals) * i);
  return (
    <g transform={`translate(${cx},${cy}) rotate(${wobble + rotOffset})`}>
      {angles.map((a) => {
        const rad = (a * Math.PI) / 180;
        const px = Math.cos(rad) * r * 0.68;
        const py = Math.sin(rad) * r * 0.68;
        return (
          <ellipse key={a} cx={px} cy={py} rx={r * 0.42} ry={r * 0.28}
            fill={petalColor} opacity={0.93}
            transform={`rotate(${a}, ${px}, ${py})`} />
        );
      })}
      <circle r={r * 0.3} fill={centerColor} />
      <circle r={r * 0.14} fill="#fff" opacity={0.55} cx={-r * 0.06} cy={-r * 0.06} />
    </g>
  );
};

// ── Sonnenblume (viele schmale Blätter) ──────────────────────────────────
const Sunflower: React.FC<{
  cx: number; cy: number; r: number; frame: number; fps: number; rotOffset?: number;
}> = ({ cx, cy, r, frame, fps, rotOffset = 0 }) => {
  const wobble = Math.sin((frame / fps) * Math.PI * 2 * 0.6 + rotOffset) * 2.5;
  const petals = Array.from({ length: 16 }, (_, i) => (360 / 16) * i);
  return (
    <g transform={`translate(${cx},${cy}) rotate(${wobble})`}>
      {petals.map((a) => {
        const rad = (a * Math.PI) / 180;
        const px = Math.cos(rad) * r * 0.72;
        const py = Math.sin(rad) * r * 0.72;
        return (
          <ellipse key={a} cx={px} cy={py} rx={r * 0.22} ry={r * 0.42}
            fill="#f59e0b" opacity={0.9}
            transform={`rotate(${a}, ${px}, ${py})`} />
        );
      })}
      {/* Brauner Kern */}
      <circle r={r * 0.38} fill="#78350f" />
      <circle r={r * 0.26} fill="#92400e" />
      {/* Kern-Muster (Punkte) */}
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const rad = (a * Math.PI) / 180;
        return <circle key={a} cx={Math.cos(rad) * r * 0.13} cy={Math.sin(rad) * r * 0.13}
          r={r * 0.05} fill="#451a03" opacity={0.7} />;
      })}
      <circle r={r * 0.06} fill="#451a03" opacity={0.8} />
    </g>
  );
};

// ── Schmetterling ─────────────────────────────────────────────────────────
const Butterfly: React.FC<{
  cx: number; cy: number; size: number; color1: string; color2: string;
  frame: number; fps: number; rotOffset?: number;
}> = ({ cx, cy, size, color1, color2, frame, fps, rotOffset = 0 }) => {
  // Flügelschlag
  const flap = Math.sin((frame / fps) * Math.PI * 2 * 3.5 + rotOffset);
  const scaleX = interpolate(flap, [-1, 1], [0.3, 1.0]);
  const s = size;
  return (
    <g transform={`translate(${cx},${cy})`}>
      {/* Obere Flügel */}
      <ellipse cx={-s * 0.55} cy={-s * 0.3} rx={s * 0.55} ry={s * 0.4}
        fill={color1} opacity={0.88} transform={`scale(${scaleX},1)`} />
      <ellipse cx={s * 0.55} cy={-s * 0.3} rx={s * 0.55} ry={s * 0.4}
        fill={color1} opacity={0.88} transform={`scale(${-scaleX},1)`} />
      {/* Untere Flügel */}
      <ellipse cx={-s * 0.45} cy={s * 0.2} rx={s * 0.4} ry={s * 0.3}
        fill={color2} opacity={0.85} transform={`scale(${scaleX},1)`} />
      <ellipse cx={s * 0.45} cy={s * 0.2} rx={s * 0.4} ry={s * 0.3}
        fill={color2} opacity={0.85} transform={`scale(${-scaleX},1)`} />
      {/* Körper */}
      <ellipse cx={0} cy={0} rx={s * 0.08} ry={s * 0.45} fill="#1a1a1a" />
      {/* Fühler */}
      <line x1={0} y1={-s * 0.4} x2={-s * 0.25} y2={-s * 0.75} stroke="#333" strokeWidth={s * 0.06} />
      <line x1={0} y1={-s * 0.4} x2={s * 0.25}  y2={-s * 0.75} stroke="#333" strokeWidth={s * 0.06} />
      <circle cx={-s * 0.25} cy={-s * 0.75} r={s * 0.06} fill="#333" />
      <circle cx={s * 0.25}  cy={-s * 0.75} r={s * 0.06} fill="#333" />
    </g>
  );
};

// ── Stern (4-zackig) ──────────────────────────────────────────────────────
const Star4: React.FC<{ cx: number; cy: number; r: number; color: string; frame: number; fps: number; rotOffset?: number }> =
  ({ cx, cy, r, color, frame, fps, rotOffset = 0 }) => {
    const spin = (frame / fps) * 90 + rotOffset;
    const pts = [0, 90, 180, 270].map((a) => {
      const rad = ((a + spin) * Math.PI) / 180;
      const ri = (((a + 45 + spin) * Math.PI) / 180);
      return [
        `${Math.cos(rad) * r},${Math.sin(rad) * r}`,
        `${Math.cos(ri) * r * 0.38},${Math.sin(ri) * r * 0.38}`,
      ];
    }).flat().join(' ');
    return <polygon points={pts} fill={color} cx={cx} cy={cy}
      transform={`translate(${cx},${cy})`} opacity={0.9} />;
  };

// ── Peace-Zeichen UMGEKEHRT (Strich ↓, Diagonalen → oben-außen) ──────────
const InvertedPeace: React.FC<{
  cx: number; cy: number; r: number;
  colors?: string[]; strokeW: number; frame: number; fps: number;
}> = ({ cx, cy, r, colors, strokeW, frame, fps }) => {
  // Regenbogenfarben für Strich + linke + rechte Linie
  const c = colors || ['#e63946', '#f4a261', '#2a9d8f'];
  // leichtes Pulsieren
  const pulse = 1 + Math.sin((frame / fps) * Math.PI * 2 * 0.7) * 0.04;
  return (
    <g transform={`translate(${cx},${cy}) scale(${pulse})`}>
      {/* Äußerer Kreis — Regenbogen-Strich */}
      <circle r={r} fill="none" stroke={c[0]} strokeWidth={strokeW} />
      {/* Senkrechter Strich: Mitte → UNTEN */}
      <line x1={0} y1={0} x2={0} y2={r}
        stroke={c[1]} strokeWidth={strokeW} strokeLinecap="round" />
      {/* Linke Diagonale: Mitte → OBEN-LINKS */}
      <line x1={0} y1={0} x2={-r * 0.71} y2={-r * 0.71}
        stroke={c[2]} strokeWidth={strokeW} strokeLinecap="round" />
      {/* Rechte Diagonale: Mitte → OBEN-RECHTS */}
      <line x1={0} y1={0} x2={r * 0.71} y2={-r * 0.71}
        stroke={c[0]} strokeWidth={strokeW} strokeLinecap="round" />
    </g>
  );
};

// ── 8-Speichen Chromfelge ─────────────────────────────────────────────────
const ChromeWheel: React.FC<{ cx: number; cy: number; r: number; wheelRot: number }> =
  ({ cx, cy, r, wheelRot }) => (
    <g transform={`translate(${cx},${cy})`}>
      {/* Reifen */}
      <circle r={r}         fill="#111" />
      {/* Weißwand */}
      <circle r={r * 0.83}  fill="#e8e4d8" />
      <circle r={r * 0.70}  fill="#111" />
      {/* Felge dreht sich */}
      <g transform={`rotate(${wheelRot})`}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
          const rad = (a * Math.PI) / 180;
          return (
            <line key={a}
              x1={Math.cos(rad) * r * 0.15} y1={Math.sin(rad) * r * 0.15}
              x2={Math.cos(rad) * r * 0.63} y2={Math.sin(rad) * r * 0.63}
              stroke="#ddd" strokeWidth={r * 0.1} strokeLinecap="round" />
          );
        })}
        <circle r={r * 0.63} fill="none" stroke="#ccc" strokeWidth={r * 0.055} />
        <circle r={r * 0.26} fill="#d0d0d0" />
        <circle r={r * 0.16} fill="#f0f0f0" />
      </g>
      {/* Nabenkappe */}
      <circle r={r * 0.15}  fill="#e8e8e8" stroke="#bbb" strokeWidth={r * 0.035} />
      <circle r={r * 0.07}  fill="#fff" opacity={0.6} cx={-r*0.04} cy={-r*0.04} />
    </g>
  );

// ── Rost-Fleck ────────────────────────────────────────────────────────────
const RustSpot: React.FC<{ cx: number; cy: number; rx: number; ry: number; opacity?: number }> =
  ({ cx, cy, rx, ry, opacity = 0.3 }) => (
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#8B4513" opacity={opacity} />
  );

// ─────────────────────────────────────────────────────────────────────────────
// HAUPT-BUS SVG
// ─────────────────────────────────────────────────────────────────────────────

const MojoBusCoach: React.FC<{
  size?: number;
  accentColor?: string;
  color?: string;
  driveIn?: boolean;
  label?: string;
}> = ({
  size    = 420,
  accentColor = '#F59E0B',
  color   = '#FFFFFF',
  driveIn = true,
  label   = 'MOJOBUS',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Animationen ──────────────────────────────────────────────────────────
  const enter     = spring({ frame, fps, config: { damping: 18, stiffness: 42, mass: 1.5 } });
  const driveInX  = driveIn ? interpolate(enter, [0, 1], [-(size * 4), 0]) : 0;
  const rockAngle = Math.sin((frame / fps) * Math.PI * 2 * 1.2) * 0.55;
  const bounceY   = Math.abs(Math.sin((frame / fps) * Math.PI * 2.4)) * 2.2;
  const wheelRot  = (frame / fps) * 360 * 1.4;
  const lightPulse = 0.72 + Math.sin((frame / fps) * Math.PI * 2 * 0.9) * 0.16;

  // ── Proportionen: 10m × 3.3m → H = W × 0.33 ────────────────────────────
  const W  = size; // Original width
  const H  = size * 0.33;
  const WR = H * 0.40;          // Rad-Radius
  const RY = H + WR * 0.52;     // Rad-Mitte Y

  // ── Farben ───────────────────────────────────────────────────────────────
  const cream    = '#faf7f0';
  const creamMid = '#f0ece0';
  const creamDrk = '#e0d8c4';
  const glassHL  = 'rgba(255,255,255,0.42)';
  const chrome   = '#e0e0e0';

  // ── Dekorations-Daten ────────────────────────────────────────────────────

  // Große Prillblumen (unterhalb Fensterzone)
  const bigFlowers = [
    { cx: W*0.10, cy: H*0.80, r: H*0.115, petal: '#f97316', center: '#ffd93d', rot: 0  },
    { cx: W*0.21, cy: H*0.72, r: H*0.13,  petal: '#ec4899', center: '#fbbf24', rot: 25 },
    { cx: W*0.32, cy: H*0.80, r: H*0.12,  petal: '#a3e635', center: '#f97316', rot: 10 },
    { cx: W*0.43, cy: H*0.71, r: H*0.125, petal: '#38bdf8', center: '#c084fc', rot: 42 },
    { cx: W*0.54, cy: H*0.80, r: H*0.11,  petal: '#c084fc', center: '#4ade80', rot: 18 },
    { cx: W*0.64, cy: H*0.72, r: H*0.13,  petal: '#4ade80', center: '#f97316', rot: 55 },
    { cx: W*0.73, cy: H*0.81, r: H*0.10,  petal: '#fbbf24', center: '#ec4899', rot: 30 },
  ];

  // Kleine Füll-Blumen (dazwischen + oben über Fenstern)
  const smallFlowers = [
    { cx: W*0.07, cy: H*0.58, r: H*0.065, petal: '#f472b6', center: '#fde68a', rot: 15 },
    { cx: W*0.16, cy: H*0.88, r: H*0.07,  petal: '#fde68a', center: '#ec4899', rot: 60 },
    { cx: W*0.27, cy: H*0.62, r: H*0.06,  petal: '#86efac', center: '#38bdf8', rot: 5  },
    { cx: W*0.38, cy: H*0.90, r: H*0.065, petal: '#c084fc', center: '#fde68a', rot: 35 },
    { cx: W*0.49, cy: H*0.60, r: H*0.06,  petal: '#f97316', center: '#86efac', rot: 48 },
    { cx: W*0.59, cy: H*0.89, r: H*0.07,  petal: '#38bdf8', center: '#f472b6', rot: 22 },
    { cx: W*0.68, cy: H*0.60, r: H*0.055, petal: '#fbbf24', center: '#c084fc', rot: 70 },
    { cx: W*0.76, cy: H*0.88, r: H*0.065, petal: '#ec4899', center: '#a3e635', rot: 8  },
  ];

  // Sonnenblumen
  const sunflowers = [
    { cx: W*0.14, cy: H*0.66, r: H*0.09, rot: 0  },
    { cx: W*0.47, cy: H*0.63, r: H*0.085,rot: 20 },
    { cx: W*0.70, cy: H*0.67, r: H*0.08, rot: 40 },
  ];

  // Schmetterlinge
  const butterflies = [
    { cx: W*0.25, cy: H*0.56, s: H*0.07, c1: '#7c3aed', c2: '#c084fc', rot: 0  },
    { cx: W*0.58, cy: H*0.53, s: H*0.065,c1: '#0369a1', c2: '#38bdf8', rot: 1.5},
    { cx: W*0.78, cy: H*0.57, s: H*0.06, c1: '#be123c', c2: '#f472b6', rot: 3  },
  ];

  // Sterne
  const stars = [
    { cx: W*0.09, cy: H*0.50, r: H*0.035, color: '#fde68a', rot: 0  },
    { cx: W*0.34, cy: H*0.58, r: H*0.028, color: '#f472b6', rot: 15 },
    { cx: W*0.52, cy: H*0.88, r: H*0.03,  color: '#86efac', rot: 30 },
    { cx: W*0.63, cy: H*0.54, r: H*0.032, color: '#fbbf24', rot: 5  },
    { cx: W*0.79, cy: H*0.64, r: H*0.025, color: '#c084fc', rot: 20 },
  ];

  return (
    <div style={{
      transform:       `translateX(${driveInX}px) rotate(${rockAngle}deg) translateY(${bounceY}px)`,
      transformOrigin: 'bottom center',
      display:         'inline-block',
      filter:          'drop-shadow(0 14px 32px rgba(0,0,0,0.65))',
    }}>
      <svg
        width={W}
        height={RY + WR * 1.3}
        viewBox={`0 0 ${W} ${RY + WR * 1.3}`}
        overflow="visible"
      >
        <defs>
          {/* Karosserie-Gradient: oben heller, unten minimal dunkler */}
          <linearGradient id="mb-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#fefcf8" />
            <stop offset="25%"  stopColor={cream} />
            <stop offset="75%"  stopColor={creamMid} />
            <stop offset="100%" stopColor={creamDrk} />
          </linearGradient>

          {/* Glas */}
          <linearGradient id="mb-glass" x1="0" y1="0" x2="0.15" y2="1">
            <stop offset="0%"   stopColor="#cce8ff" stopOpacity="0.92" />
            <stop offset="50%"  stopColor="#a8d8f0" stopOpacity="0.78" />
            <stop offset="100%" stopColor="#6ab4dc" stopOpacity="0.65" />
          </linearGradient>

          {/* Chrome */}
          <linearGradient id="mb-chrome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#ffffff" />
            <stop offset="30%"  stopColor="#e8e8e8" />
            <stop offset="70%"  stopColor="#b0b0b0" />
            <stop offset="100%" stopColor="#888" />
          </linearGradient>

          {/* Chromspeichen */}
          <linearGradient id="chrome-spoke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#d0d0d0" />
            <stop offset="50%"  stopColor="#ffffff" />
            <stop offset="100%" stopColor="#c0c0c0" />
          </linearGradient>

          {/* Scheinwerfer-Glow */}
          <radialGradient id="mb-light" cx="40%" cy="40%" r="60%">
            <stop offset="0%"   stopColor="#fffde7" stopOpacity="1" />
            <stop offset="60%"  stopColor="#fef08a" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>

          {/* Grill-Clip */}
          <clipPath id="grill-clip">
            <rect x={W*0.896} y={H*0.75} width={W*0.085} height={H*0.14} rx={2} />
          </clipPath>
        </defs>

        {/* ══════════════════════════════════════════════════════════════════
            BODENSCHATTEN
        ══════════════════════════════════════════════════════════════════ */}
        <ellipse cx={W*0.5} cy={RY+WR*1.18} rx={W*0.5} ry={WR*0.2} fill="rgba(0,0,0,0.45)" transform="skewX(15)" />

        {/* ══════════════════════════════════════════════════════════════════
            HAUPTKAROSSERIE
            Kastenform mit abgerundeten OBEREN Ecken, scharfe untere Kanten
        ══════════════════════════════════════════════════════════════════ */}

{/* Seitenansicht Karosserie */}
         <rect x={W*0.01} y={H*0.12} width={W*0.98} height={H*0.9} fill="url(#mb-body)" />
         {/* Obere abgerundete Kappe */}
         <rect x={W*0.01} y={H*0.04} width={W*0.98} height={H*0.12} rx={H*0.06} fill="url(#mb-body)" />
         {/* Dach-Leiste */}
         <rect x={W*0.01} y={H*0.04} width={W*0.98} height={H*0.05} rx={H*0.06} fill={creamDrk} opacity={0.35} />

{/* ══════════════════════════════════════════════════════════════════
             SEITENANSICHT (Fahrerseite links)
         ══════════════════════════════════════════════════════════════════ */}

         {/* Fahrertür-Fenster */}
         <rect x={W*0.05} y={H*0.095} width={W*0.18} height={H*0.35} rx={H*0.05} fill="url(#mb-glass)" stroke="#444" strokeWidth={1.5} />
         {/* Glasspiegelung im Fahrerfenster */}
         <rect x={W*0.065} y={H*0.108} width={W*0.025} height={H*0.26} rx={2} fill={glassHL} transform="skewY(5)" />

         {/* Wohnraum-Fenster (3 breite Querformat-Fenster) */}
         {[0.25, 0.45, 0.65].map((x, i) => (
           <g key={i}>
             <rect x={W*x} y={H*0.095} width={W*0.18} height={H*0.35} rx={H*0.05} fill="url(#mb-glass)" stroke="#444" strokeWidth={1.5} />
             {/* Glasspiegelung */}
             <rect x={W*(x+0.015)} y={H*0.108} width={W*0.03} height={H*0.26} rx={2} fill={glassHL} transform="skewY(5)" />
             {/* Fenster-Unterteilung (kleines Lüftungsklappchen oben) */}
             <rect x={W*x} y={H*0.095} width={W*0.18} height={H*0.07} rx={0} fill="rgba(0,0,0,0.12)" />
             <line x1={W*x} y1={H*0.165} x2={W*(x+0.18)} y2={H*0.165} stroke="#555" strokeWidth={1} opacity={0.6} />
           </g>
         ))}

         {/* ══════════════════════════════════════════════════════════════════
             FRONTBEREICH (sichtbar in Seitenansicht - rechtes Ende)
         ══════════════════════════════════════════════════════════════════ */}

         {/* Front-Fläche (leicht dunkler für Tiefe) */}
         <rect x={W*0.80} y={H*0.04} width={W*0.18} height={H*1.0} fill={creamMid} />

         {/* Große Windschutzscheibe (schräg) */}
         <polygon points={`${W*0.80},${H*0.07} ${W*0.86},${H*0.07} ${W*0.88},${H*0.59} ${W*0.82},${H*0.59}`} fill="url(#mb-glass)" stroke="#444" strokeWidth={2} />

         {/* Mittelsteg der Windschutzscheibe */}
         <rect x={W*0.86} y={H*0.07} width={W*0.015} height={H*0.52} fill={cream} />

         {/* Glasspiegelungen in der Frontscheibe */}
         <rect x={W*0.81} y={H*0.085} width={W*0.015} height={H*0.38} rx={2} fill={glassHL} />

         {/* Scheibenwischer (2 Stück) */}
         <line x1={W*0.83} y1={H*0.575} x2={W*0.80} y2={H*0.50}
           stroke="#222" strokeWidth={H*0.018} strokeLinecap="round" />
         <line x1={W*0.87} y1={H*0.575} x2={W*0.85} y2={H*0.50}
           stroke="#222" strokeWidth={H*0.018} strokeLinecap="round" />

         {/* "Live Love Travel" Text auf Scheibe */}
         <text x={W*0.81} y={H*0.185} fontSize={H*0.055} transform="skewX(-12)"
           fontFamily="Arial, sans-serif" fontStyle="italic"
           fill="#1a3a5c" opacity={0.75} fontWeight="bold">Live Love</text>
         <text x={W*0.81} y={H*0.245} fontSize={H*0.05}
           fontFamily="Arial, sans-serif" fontStyle="italic"
           fill="#1a3a5c" opacity={0.75} fontWeight="bold">Travel ☮</text>

         {/* Rechteckige Doppelscheinwerfer (US-Stil) */}
         {/* Oberes Paar */}
         <rect x={W*0.81} y={H*0.62} width={W*0.04} height={H*0.07}
           rx={H*0.01} fill="#e8e8d0" stroke="#999" strokeWidth={1} />
         <rect x={W*0.81} y={H*0.62} width={W*0.04} height={H*0.07}
           rx={H*0.01} fill="#fffde7" opacity={lightPulse * 0.7} />
         <rect x={W*0.86} y={H*0.62} width={W*0.04} height={H*0.07}
           rx={H*0.01} fill="#e8e8d0" stroke="#999" strokeWidth={1} />
         <rect x={W*0.86} y={H*0.62} width={W*0.04} height={H*0.07}
           rx={H*0.01} fill="#fffde7" opacity={lightPulse * 0.65} />

         {/* Unteres Paar (Nebelscheinwerfer) */}
         <rect x={W*0.815} y={H*0.70} width={W*0.035} height={H*0.055}
           rx={H*0.008} fill="#fffacd" stroke="#aaa" strokeWidth={1} opacity={lightPulse*0.8} />
         <rect x={W*0.86} y={H*0.70} width={W*0.035} height={H*0.055}
           rx={H*0.008} fill="#fffacd" stroke="#aaa" strokeWidth={1} opacity={lightPulse*0.75} />

         {/* Blinker (groß, bernsteinfarben) */}
         <rect x={W*0.80} y={H*0.775} width={W*0.09} height={H*0.045}
           rx={H*0.01} fill="#d97706" stroke="#92400e" strokeWidth={1} />
         <rect x={W*0.805} y={H*0.782} width={W*0.08} height={H*0.03}
           rx={H*0.006} fill="#fbbf24" opacity={0.85} />

         {/* Kühlergrill (horizontale Streben) */}
         <rect x={W*0.80} y={H*0.765} width={W*0.095} height={H*0.145}
           rx={3} fill="#222" />
         {[0, 1, 2, 3, 4].map((i) => (
           <rect key={i}
             x={W*0.805} y={H*(0.775 + i * 0.025)}
             width={W*0.085} height={H*0.015}
             fill="#555" />
         ))}

         {/* Chromstoßstange (breit, massiv) */}
         <rect x={W*0.795} y={H*0.875} width={W*0.12} height={H*0.09}
           rx={H*0.02} fill="url(#mb-chrome)" />
         {/* Glanzstreifen oben */}
         <rect x={W*0.80} y={H*0.878} width={W*0.11} height={H*0.018}
           rx={H*0.008} fill="#fff" opacity={0.55} />
         {/* Unterer Chrom-Wulst */}
         <rect x={W*0.805} y={H*0.942} width={W*0.1} height={H*0.015}
           rx={H*0.006} fill="#ccc" />

         {/* LKW-Außenspiegel (Arm + großes Rechteck) */}
         {/* Spiegelarm */}
         <rect x={W*0.78} y={H*0.10} width={W*0.02} height={H*0.14}
           rx={3} fill="#aaa" />
         {/* Spiegel-Gehäuse */}
         <rect x={W*0.75} y={H*0.08} width={W*0.035} height={H*0.1}
           rx={H*0.015} fill="#ccc" stroke="#999" strokeWidth={1} />
         {/* Spiegel-Glas */}
         <rect x={W*0.755} y={H*0.085} width={W*0.025} height={H*0.085}
           rx={H*0.012} fill="url(#mb-glass)" opacity={0.8} />
         <rect x={W*0.758} y={H*0.088} width={W*0.008} height={H*0.065}
           rx={2} fill={glassHL} />

{/* ══════════════════════════════════════════════════════════════════
             FENSTERGÜRTEL (Seitenansicht)
         ══════════════════════════════════════════════════════════════════ */}

         {/* Fensterschiene oben */}
         <rect x={W*0.02} y={H*0.075} width={W*0.85} height={H*0.022}
           rx={2} fill="#888" opacity={0.5} />

         {/* Fensterschiene unten */}
         <rect x={W*0.02} y={H*0.44} width={W*0.85} height={H*0.02}
           rx={2} fill="#888" opacity={0.45} />

        {/* ══════════════════════════════════════════════════════════════════
            HECKPARTIE (links im SVG)
        ══════════════════════════════════════════════════════════════════ */}

        {/* Heck-Fläche */}
        <rect x={W*0.01} y={H*0.04} width={W*0.04} height={H*1.0} fill={creamMid} />

        {/* Heckscheibe */}
        <rect x={W*0.014} y={H*0.095} width={W*0.032} height={H*0.3}
          rx={H*0.02} fill="url(#mb-glass)" stroke="#555" strokeWidth={1} />
        <rect x={W*0.017} y={H*0.108} width={W*0.009} height={H*0.22}
          rx={2} fill={glassHL} />

        {/* Rücklichter (rund, US-Stil, 2 übereinander) */}
        {[H*0.52, H*0.65].map((cy, i) => (
          <g key={i}>
            <circle cx={W*0.028} cy={cy} r={H*0.065} fill="#b91c1c" stroke="#7f1d1d" strokeWidth={1} />
            <circle cx={W*0.028} cy={cy} r={H*0.042} fill="#dc2626" opacity={0.9} />
            <circle cx={W*0.028} cy={cy} r={H*0.024} fill="#fca5a5" opacity={0.75} />
          </g>
        ))}

        {/* Heck-Stoßstange */}
        <rect x={W*0.008} y={H*0.875} width={W*0.048} height={H*0.088}
          rx={H*0.018} fill="url(#mb-chrome)" />
        <rect x={W*0.010} y={H*0.878} width={W*0.044} height={H*0.016}
          rx={H*0.006} fill="#fff" opacity={0.5} />

        {/* ══════════════════════════════════════════════════════════════════
            DEKORATIONEN: Blumen, Schmetterlinge, Sterne, Peace
        ══════════════════════════════════════════════════════════════════ */}

        {/* Große Prillblumen */}
        {bigFlowers.map((f, i) => (
          <PrillFlower key={`bf-${i}`}
            cx={f.cx} cy={f.cy} r={f.r}
            petalColor={f.petal} centerColor={f.center}
            frame={frame} fps={fps} rotOffset={f.rot} />
        ))}

        {/* Kleine Füll-Blumen */}
        {smallFlowers.map((f, i) => (
          <PrillFlower key={`sf-${i}`}
            cx={f.cx} cy={f.cy} r={f.r}
            petalColor={f.petal} centerColor={f.center}
            frame={frame} fps={fps} rotOffset={f.rot} numPetals={6} />
        ))}

        {/* Sonnenblumen */}
        {sunflowers.map((f, i) => (
          <Sunflower key={`sun-${i}`}
            cx={f.cx} cy={f.cy} r={f.r}
            frame={frame} fps={fps} rotOffset={f.rot} />
        ))}

        {/* Schmetterlinge */}
        {butterflies.map((b, i) => (
          <Butterfly key={`bt-${i}`}
            cx={b.cx} cy={b.cy} size={b.s}
            color1={b.c1} color2={b.c2}
            frame={frame} fps={fps} rotOffset={b.rot} />
        ))}

        {/* Sterne */}
        {stars.map((s, i) => (
          <Star4 key={`st-${i}`}
            cx={s.cx} cy={s.cy} r={s.r} color={s.color}
            frame={frame} fps={fps} rotOffset={s.rot} />
        ))}

        {/* ── Peace-Zeichen UMGEKEHRT (bunt, auf Frontschürze) ── */}
        {/* Großes buntes Peace auf der Seite (links Mitte) */}
        <InvertedPeace
          cx={W*0.06} cy={H*0.72} r={H*0.18}
          colors={['#e63946', '#f4a261', '#2a9d8f']}
          strokeW={H*0.032}
          frame={frame} fps={fps}
        />

        {/* ── MOJOBUS Schriftzug ── */}
        <rect x={W*0.30} y={H*0.475} width={W*0.40} height={H*0.115} rx={6}
          fill="rgba(0,0,0,0.18)" />
        <text
          x={W*0.50} y={H*0.567}
          textAnchor="middle"
          fill={color}
          fontSize={H*0.1}
          fontFamily="Arial Black, Impact, sans-serif"
          fontWeight="900"
          letterSpacing="6"
          opacity={0.92}
          style={{ textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}
        >{label}</text>

        {/* ══════════════════════════════════════════════════════════════════
            ROST-FLECKEN (Oldtimer-Authentizität)
        ══════════════════════════════════════════════════════════════════ */}
        <RustSpot cx={W*0.08} cy={H*0.94} rx={W*0.014} ry={H*0.018} opacity={0.28} />
        <RustSpot cx={W*0.19} cy={H*0.97} rx={W*0.010} ry={H*0.014} opacity={0.22} />
        <RustSpot cx={W*0.55} cy={H*0.96} rx={W*0.012} ry={H*0.016} opacity={0.25} />
        <RustSpot cx={W*0.72} cy={H*0.95} rx={W*0.009} ry={H*0.012} opacity={0.20} />
        <RustSpot cx={W*0.03} cy={H*0.72} rx={W*0.007} ry={H*0.016} opacity={0.22} />

        {/* ══════════════════════════════════════════════════════════════════
            ABGAS-WÖLKCHEN (hinten links)
        ══════════════════════════════════════════════════════════════════ */}
        <ExhaustPuff cx={W*0.012} cy={H*0.82} frame={frame} fps={fps} delay={0}  />
        <ExhaustPuff cx={W*0.012} cy={H*0.79} frame={frame} fps={fps} delay={9}  />
        <ExhaustPuff cx={W*0.012} cy={H*0.85} frame={frame} fps={fps} delay={18} />

        {/* ══════════════════════════════════════════════════════════════════
            RÄDER
        ══════════════════════════════════════════════════════════════════ */}
        {/* Radkästen */}
        <ellipse cx={W*0.175} cy={RY} rx={WR*1.35} ry={WR*0.38} fill="#111" transform="skewX(5)" />
        <ellipse cx={W*0.77}  cy={RY} rx={WR*1.35} ry={WR*0.38} fill="#111" transform="skewX(5)" />

        {/* Hinterrad */}
        <ChromeWheel cx={W*0.175} cy={RY} r={WR} wheelRot={wheelRot} />
        {/* Vorderrad */}
         <ChromeWheel cx={W*0.77}  cy={RY} r={WR} wheelRot={wheelRot - 8} />

{/* ══════════════════════════════════════════════════════════════════
             DACH: AC-UNITS (je über der Achse)
         ══════════════════════════════════════════════════════════════════ */}
         {/* Hintere AC-Unit */}
         <g transform={`translate(${W*0.175}, ${-H*0.035})`}>
           <rect x={-W*0.11} y={0} width={W*0.22} height={H*0.07} rx={H*0.02} fill="#c8c0b0" />
           <rect x={-W*0.09} y={H*0.01} width={W*0.18} height={H*0.05} rx={H*0.015} fill="#b0a898" />
           {/* AC-Lamellen */}
           {[-0.085, -0.055, -0.025, 0.005, 0.035, 0.065].map((x, i) => (
             <rect key={i} x={W*x} y={H*0.013} width={W*0.018} height={H*0.044} rx={1} fill="#888" opacity={0.6} />
           ))}
         </g>
         
         {/* Vordere AC-Unit */}
         <g transform={`translate(${W*0.77}, ${-H*0.035})`}>
           <rect x={-W*0.11} y={0} width={W*0.22} height={H*0.07} rx={H*0.02} fill="#c8c0b0" />
           <rect x={-W*0.09} y={H*0.01} width={W*0.18} height={H*0.05} rx={H*0.015} fill="#b0a898" />
           {/* AC-Lamellen */}
           {[-0.085, -0.055, -0.025, 0.005, 0.035, 0.065].map((x, i) => (
             <rect key={i} x={W*x} y={H*0.013} width={W*0.018} height={H*0.044} rx={1} fill="#888" opacity={0.6} />
           ))}
         </g>

      </svg>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export interface LottieBusIconProps {
  size?: number;
  accentColor?: string;
  bodyColor?: string;
  color?: string;
  driveIn?: boolean;
  position?: 'center' | 'bottom-center' | 'top-center';
  label?: string;
  lottieData?: object | null;
}

export const LottieBusIcon: React.FC<LottieBusIconProps> = ({
  size     = 420,
  accentColor = '#F59E0B',
  bodyColor,
  color    = '#FFFFFF',
  driveIn  = true,
  position = 'center',
  label    = 'MOJOBUS',
  lottieData,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const posStyles: React.CSSProperties =
    position === 'bottom-center'
      ? { position: 'absolute', bottom: '5%',  left: '50%', transform: 'translateX(-50%)' }
      : position === 'top-center'
      ? { position: 'absolute', top:    '5%',  left: '50%', transform: 'translateX(-50%)' }
      : { position: 'absolute', top:    '50%', left: '50%', transform: 'translate(-50%,-50%)' };

  const enter   = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  return (
    <div style={{ ...posStyles, opacity, pointerEvents: 'none' }}>
      <MojoBusCoach
        size={size}
        accentColor={accentColor}
        color={color}
        driveIn={driveIn}
        label={label}
      />
    </div>
  );
};

// ── BusRideOverlay — Bus fährt durchs Bild ───────────────────────────────

export const BusRideOverlay: React.FC<{
  accentColor?: string;
  size?: number;
  verticalPosition?: number;
  label?: string;
}> = ({ accentColor = '#F59E0B', size = 320, verticalPosition = 75, label = 'MOJOBUS' }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const xPercent = interpolate(frame, [0, durationInFrames], [-25, 120], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position:  'absolute',
        left:      `${xPercent}%`,
        top:       `${verticalPosition}%`,
        transform: 'translate(-50%, -50%)',
      }}>
        <MojoBusCoach size={size} accentColor={accentColor} driveIn={false} label={label} />
      </div>
    </AbsoluteFill>
  );
};
