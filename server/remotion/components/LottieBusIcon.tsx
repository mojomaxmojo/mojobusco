/**
 * LottieBusIcon — MojoBus US-Oldtimer Hippie-Style (v4)
 *
 * US-Bus Proportionen 10m × 3.3m → SVG Ratio W:H = 3.03:1 (lang + flach)
 *  - Karosserie komplett Cremeweiß (oben + unten)
 *  - Peace-Zeichen UMGEKEHRT: Strich nach UNTEN, Diagonalen nach OBEN-AUSSEN
 *  - 8-Speichen Chromfelgen mit Weißwand-Reifen
 *  - Viele Prillblumen (10+) auf der Seite
 *  - Regenbogenstreifen horizontal
 *  - Rost-Flecken
 *  - Surf-Brett aufs Dach
 *  - Animiertes Abgas-Wölkchen
 */

import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// ── Abgas-Wölkchen ────────────────────────────────────────────────────────

const ExhaustPuff: React.FC<{
  cx: number; cy: number; frame: number; fps: number; delay?: number;
}> = ({ cx, cy, frame, fps, delay = 0 }) => {
  const t = ((frame - delay) / fps) % 1.4;
  if (t < 0) return null;
  const opacity = interpolate(t, [0, 0.25, 1.4], [0.55, 0.38, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sc      = interpolate(t, [0, 1.4], [0.35, 2.0],            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dx      = interpolate(t, [0, 1.4], [0, -22],               { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dy      = interpolate(t, [0, 1.4], [0, -10],               { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <ellipse cx={cx + dx} cy={cy + dy} rx={6 * sc} ry={4 * sc} fill="#b0bec5" opacity={opacity} />;
};

// ── Prillblume (5 Blütenblätter) ─────────────────────────────────────────

const PrillFlower: React.FC<{
  cx: number; cy: number; r: number;
  petalColor: string; centerColor: string;
  frame: number; fps: number; rotOffset?: number;
}> = ({ cx, cy, r, petalColor, centerColor, frame, fps, rotOffset = 0 }) => {
  // leichtes Wackeln
  const wobble = Math.sin((frame / fps) * Math.PI * 2 * 0.9 + rotOffset) * 4;
  return (
    <g transform={`translate(${cx},${cy}) rotate(${wobble})`}>
      {[0, 72, 144, 216, 288].map((a) => {
        const rad = ((a + rotOffset) * Math.PI) / 180;
        const px  = Math.cos(rad) * r * 0.72;
        const py  = Math.sin(rad) * r * 0.72;
        return (
          <ellipse
            key={a}
            cx={px} cy={py}
            rx={r * 0.45} ry={r * 0.3}
            fill={petalColor}
            transform={`rotate(${a + rotOffset}, ${px}, ${py})`}
            opacity={0.92}
          />
        );
      })}
      {/* Blütenzentrum */}
      <circle r={r * 0.32} fill={centerColor} />
      <circle r={r * 0.16} fill="#fff" opacity={0.6} cx={-r * 0.06} cy={-r * 0.06} />
    </g>
  );
};

// ── Peace-Zeichen UMGEKEHRT ───────────────────────────────────────────────
// UMGEKEHRT = Strich zeigt nach UNTEN, Diagonalen nach OBEN-AUSSEN
// (normales Peace: Strich nach oben + Diagonalen nach unten-außen)
// → hier: Strich von Mitte nach UNTEN, Diagonalen von Mitte nach OBEN-LINKS + OBEN-RECHTS

const InvertedPeace: React.FC<{
  cx: number; cy: number; r: number; color: string; strokeW: number;
}> = ({ cx, cy, r, color, strokeW }) => (
  <g transform={`translate(${cx},${cy})`}>
    {/* Äußerer Kreis */}
    <circle r={r} fill="none" stroke={color} strokeWidth={strokeW} />
    {/* Senkrechter Strich: Mitte → UNTEN */}
    <line x1={0} y1={0} x2={0} y2={r} stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
    {/* Linke Diagonale: Mitte → OBEN-LINKS */}
    <line x1={0} y1={0} x2={-r * 0.71} y2={-r * 0.71} stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
    {/* Rechte Diagonale: Mitte → OBEN-RECHTS */}
    <line x1={0} y1={0} x2={r * 0.71} y2={-r * 0.71} stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
  </g>
);

// ── 8-Speichen Chromfelge (US-Oldtimer) ──────────────────────────────────

const ChromeWheel: React.FC<{
  cx: number; cy: number; r: number; wheelRot: number;
}> = ({ cx, cy, r, wheelRot }) => (
  <g transform={`translate(${cx},${cy})`}>
    {/* Schwarzer Reifen */}
    <circle r={r}          fill="#111" />
    {/* Weißwand */}
    <circle r={r * 0.84}   fill="#e8e4d8" />
    <circle r={r * 0.72}   fill="#111" />
    {/* Chrom-Felge dreht sich */}
    <g transform={`rotate(${wheelRot})`}>
      {/* 8 Speichen */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <line
            key={a}
            x1={Math.cos(rad) * r * 0.16} y1={Math.sin(rad) * r * 0.16}
            x2={Math.cos(rad) * r * 0.65} y2={Math.sin(rad) * r * 0.65}
            stroke="url(#chrome-spoke)"
            strokeWidth={r * 0.11}
            strokeLinecap="round"
          />
        );
      })}
      {/* Felgenring außen */}
      <circle r={r * 0.65} fill="none" stroke="#e0e0e0" strokeWidth={r * 0.06} />
      {/* Felgenring innen */}
      <circle r={r * 0.28} fill="#d0d0d0" />
      <circle r={r * 0.18} fill="#f0f0f0" />
    </g>
    {/* Nabenkappe (Chrom, statisch) */}
    <circle r={r * 0.16}  fill="#e8e8e8" stroke="#bbb" strokeWidth={r * 0.04} />
    <circle r={r * 0.09}  fill="#f5f5f5" />
    {/* Chrom-Glanzpunkt */}
    <circle r={r * 0.04}  fill="#fff" opacity={0.8} cx={-r * 0.04} cy={-r * 0.05} />
  </g>
);

// ── Rost-Fleck ────────────────────────────────────────────────────────────

const RustSpot: React.FC<{ cx: number; cy: number; rx: number; ry: number; opacity?: number }> = (
  { cx, cy, rx, ry, opacity = 0.35 }
) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#8B4513" opacity={opacity} />
);

// ── Hauptbus: US-Oldtimer Hippie-Bus (10m × 3.3m) ────────────────────────
// Proportionen: W:H = 10:3.3 ≈ 3.03:1  →  H = W * 0.33

const HippieVan: React.FC<{
  size?: number;
  accentColor?: string;
  bodyColor?: string;
  color?: string;
  driveIn?: boolean;
  label?: string;
}> = ({
  size        = 340,           // Breite in px — Bus ist lang
  accentColor = '#F59E0B',
  bodyColor,
  color       = '#FFFFFF',
  driveIn     = true,
  label       = 'MOJOBUS',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animationen
  const enter     = spring({ frame, fps, config: { damping: 18, stiffness: 45, mass: 1.4 } });
  const driveInX  = driveIn ? interpolate(enter, [0, 1], [-(size * 3.5), 0]) : 0;
  const rockAngle = Math.sin((frame / fps) * Math.PI * 2 * 1.3) * 0.7;
  const bounceY   = Math.abs(Math.sin((frame / fps) * Math.PI * 2.6)) * 2.5;
  const wheelRot  = (frame / fps) * 360 * 1.5;
  const lightPulse = 0.7 + Math.sin((frame / fps) * Math.PI * 2 * 0.8) * 0.18;

  // ── Maße: 10m × 3.3m → H = W * 0.33 ────────────────────────────────────
  const W  = size;
  const H  = size * 0.33;     // reale US-Bus-Proportionen
  const WR = H * 0.38;        // Rad-Radius (relativ zur Höhe)
  const RY = H + WR * 0.5;   // Rad-Mitte Y

  // Cremeweiß komplett (oben + unten)
  const cream     = '#faf6ee';
  const creamDark = '#ede8db';
  const glassHL   = 'rgba(255,255,255,0.45)';
  const divCol    = '#d4af37';   // Goldstreifen

  // ── Viele Prillblumen (10 Stück) ────────────────────────────────────────
  // Entlang der unteren Karosserie-Hälfte verteilt
  const flowers = [
    // Große Blumen
    { cx: W*0.12, cy: H*0.72, r: H*0.14, petal: '#ff6b6b', center: '#ffd93d', rot: 0   },
    { cx: W*0.24, cy: H*0.65, r: H*0.12, petal: '#ffd93d', center: '#ff6b6b', rot: 20  },
    { cx: W*0.36, cy: H*0.74, r: H*0.13, petal: '#a8edea', center: '#c77dff', rot: 8   },
    { cx: W*0.48, cy: H*0.63, r: H*0.11, petal: '#c77dff', center: '#ffd93d', rot: 36  },
    { cx: W*0.59, cy: H*0.72, r: H*0.13, petal: '#6bcb77', center: '#ff6b6b', rot: 15  },
    { cx: W*0.70, cy: H*0.65, r: H*0.10, petal: '#ff9f1c', center: '#a8edea', rot: 45  },
    // Kleinere Füll-Blumen
    { cx: W*0.18, cy: H*0.88, r: H*0.075,petal: '#c77dff', center: '#ffd93d', rot: 55  },
    { cx: W*0.31, cy: H*0.86, r: H*0.07, petal: '#ff6b6b', center: '#6bcb77', rot: 28  },
    { cx: W*0.44, cy: H*0.90, r: H*0.065,petal: '#ffd93d', center: '#ff6b6b', rot: 12  },
    { cx: W*0.56, cy: H*0.88, r: H*0.07, petal: '#a8edea', center: '#c77dff', rot: 40  },
    { cx: W*0.67, cy: H*0.87, r: H*0.065,petal: '#ff9f1c', center: '#6bcb77', rot: 70  },
  ];

  // Regenbogenstreifen
  const rainbowColors = ['#e63946','#f4a261','#e9c46a','#2a9d8f','#457b9d','#7b2d8b'];

  return (
    <div style={{
      transform:       `translateX(${driveInX}px) rotate(${rockAngle}deg) translateY(${bounceY}px)`,
      transformOrigin: 'bottom center',
      display:         'inline-block',
      filter:          'drop-shadow(0 12px 28px rgba(0,0,0,0.65))',
    }}>
      <svg
        width={W}
        height={RY + WR * 1.25}
        viewBox={`0 0 ${W} ${RY + WR * 1.25}`}
        overflow="visible"
      >
        <defs>
          {/* Karosserie Gradient — Cremeweiß oben + unten */}
          <linearGradient id="hv-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#fefcf7" />
            <stop offset="30%"  stopColor={cream} />
            <stop offset="70%"  stopColor={creamDark} />
            <stop offset="100%" stopColor="#ddd5c0" />
          </linearGradient>
          <linearGradient id="hv-glass" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%"   stopColor="#d0eeff" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#7ab8e0" stopOpacity="0.68" />
          </linearGradient>
          <linearGradient id="hv-chrome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#ffffff" />
            <stop offset="35%"  stopColor="#e0e0e0" />
            <stop offset="65%"  stopColor="#b0b0b0" />
            <stop offset="100%" stopColor="#888888" />
          </linearGradient>
          {/* Chromspeichen-Gradient */}
          <linearGradient id="chrome-spoke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#e8e8e8" />
            <stop offset="50%"  stopColor="#ffffff" />
            <stop offset="100%" stopColor="#c0c0c0" />
          </linearGradient>
          <radialGradient id="hv-headlight" cx="35%" cy="35%" r="65%">
            <stop offset="0%"   stopColor="#fffde7" stopOpacity="1" />
            <stop offset="60%"  stopColor="#fef08a" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ══ Bodenschatten ══════════════════════════════════════════════ */}
        <ellipse cx={W*0.5} cy={RY+WR*1.15} rx={W*0.44} ry={WR*0.18} fill="rgba(0,0,0,0.42)" />

        {/* ══ Hauptkarosserie (komplett Cremeweiß) ══════════════════════ */}
        <rect x={W*0.02} y={H*0.04} width={W*0.96} height={H*0.97} rx={H*0.07}
          fill="url(#hv-body)" />

        {/* ══ Goldener Zierstreifen (Mitte horizontal) ══════════════════ */}
        <rect x={W*0.02} y={H*0.47} width={W*0.96} height={H*0.04} fill={divCol} />
        <rect x={W*0.02} y={H*0.50} width={W*0.96} height={H*0.015} fill={divCol} opacity={0.45} />

        {/* ══ Regenbogenstreifen (obere Hälfte, diskret) ════════════════ */}
        {rainbowColors.map((c, i) => (
          <rect
            key={i}
            x={W*0.02}
            y={H*(0.06 + i * 0.062)}
            width={W*0.96}
            height={H*0.058}
            fill={c}
            opacity={0.18}
            rx={i === 0 ? H*0.07 : 0}
          />
        ))}

        {/* ══ Fenstergürtel (oben, durchgehend) ════════════════════════ */}
        {/* 5 Fenster nebeneinander entlang der oberen Hälfte */}
        {[0.05, 0.21, 0.37, 0.53, 0.68].map((x, i) => (
          <g key={i}>
            <rect x={W*(x+0.01)} y={H*0.08} width={W*0.135} height={H*0.34}
              rx={H*0.04} fill="url(#hv-glass)" stroke="#666" strokeWidth={1.5} />
            <rect x={W*(x+0.018)} y={H*0.095} width={W*0.03} height={H*0.26}
              rx={2} fill={glassHL} />
          </g>
        ))}
        {/* Fensterschiene oben + unten */}
        <rect x={W*0.02} y={H*0.07}  width={W*0.96} height={H*0.02} rx={2} fill="#aaa" opacity={0.55} />
        <rect x={W*0.02} y={H*0.415} width={W*0.96} height={H*0.018} rx={2} fill="#aaa" opacity={0.45} />

        {/* ══ FRONT RECHTS: Schräge Frontpartie ════════════════════════ */}
        {/* Frontmaske */}
        <rect x={W*0.87} y={H*0.04} width={W*0.11} height={H*0.97} rx={H*0.07}
          fill="url(#hv-body)" />
        {/* Windschutzscheibe (geneigt, 2-teilig) */}
        <rect x={W*0.876} y={H*0.06} width={W*0.082} height={H*0.18} rx={3}
          fill="url(#hv-glass)" stroke="#555" strokeWidth={1.5} />
        <rect x={W*0.876} y={H*0.245} width={W*0.082} height={H*0.015} fill={cream} />
        <rect x={W*0.876} y={H*0.26} width={W*0.082} height={H*0.13} rx={3}
          fill="url(#hv-glass)" stroke="#555" strokeWidth={1.5} />
        {/* Glanzlicht */}
        <rect x={W*0.882} y={H*0.072} width={W*0.016} height={H*0.15} rx={2} fill={glassHL} />

        {/* Rundes Emblem (gold) */}
        <circle cx={W*0.93} cy={H*0.54} r={H*0.07}  fill={divCol} />
        <circle cx={W*0.93} cy={H*0.54} r={H*0.05}  fill={cream} />
        <text x={W*0.93} y={H*0.558} textAnchor="middle"
          fontSize={H*0.048} fontFamily="Arial Black, sans-serif"
          fontWeight="900" fill="#8B6914">M</text>

        {/* Runde Scheinwerfer (2 Stück übereinander, US-Stil) */}
        {[H*0.60, H*0.72].map((cy, i) => (
          <g key={i}>
            <circle cx={W*0.92} cy={cy} r={H*0.07} fill="#ddd" stroke="#aaa" strokeWidth={1.5} />
            <circle cx={W*0.92} cy={cy} r={H*0.05} fill="#fffde7" opacity={lightPulse} />
            <circle cx={W*0.92} cy={cy} r={H*0.03} fill="#fef08a" opacity={lightPulse} />
          </g>
        ))}
        {/* Scheinwerfer-Glow */}
        <ellipse cx={W*0.975} cy={H*0.66} rx={W*0.06} ry={H*0.14}
          fill="url(#hv-headlight)" opacity={lightPulse*0.65} />

        {/* Chromstoßstange vorne */}
        <rect x={W*0.872} y={H*0.86} width={W*0.118} height={H*0.09} rx={4}
          fill="url(#hv-chrome)" />
        <rect x={W*0.878} y={H*0.872} width={W*0.106} height={H*0.022} rx={2}
          fill="#fff" opacity={0.55} />

        {/* Rückspiegel */}
        <rect  x={W*0.858} y={H*0.09} width={W*0.02} height={H*0.1} rx={2} fill="#999" />
        <ellipse cx={W*0.848} cy={H*0.085} rx={W*0.022} ry={H*0.045}
          fill="#bbb" stroke="#777" strokeWidth={1} />
        <ellipse cx={W*0.846} cy={H*0.083} rx={W*0.01} ry={H*0.025} fill={glassHL} />

        {/* ══ HECK LINKS ════════════════════════════════════════════════ */}
        <rect x={W*0.01} y={H*0.04} width={W*0.04} height={H*0.97} rx={H*0.07}
          fill="url(#hv-body)" />
        {/* Heckscheibe */}
        <rect x={W*0.014} y={H*0.08} width={W*0.03} height={H*0.32} rx={3}
          fill="url(#hv-glass)" stroke="#555" strokeWidth={1} />
        {/* Rücklichter (rund, US-Stil, 2 Stück) */}
        {[H*0.56, H*0.7].map((cy, i) => (
          <g key={i}>
            <circle cx={W*0.025} cy={cy} r={H*0.058} fill="#dc2626" opacity={0.9} />
            <circle cx={W*0.025} cy={cy} r={H*0.032} fill="#fca5a5" opacity={0.7} />
          </g>
        ))}
        {/* Heck-Stoßstange */}
        <rect x={W*0.008} y={H*0.86} width={W*0.045} height={H*0.09} rx={3}
          fill="url(#hv-chrome)" />

        {/* ══ Prillblumen (11 Stück) ════════════════════════════════════ */}
        {flowers.map((f, i) => (
          <PrillFlower
            key={i}
            cx={f.cx} cy={f.cy} r={f.r}
            petalColor={f.petal} centerColor={f.center}
            frame={frame} fps={fps} rotOffset={f.rot}
          />
        ))}

        {/* ══ Peace-Zeichen UMGEKEHRT ════════════════════════════════════ */}
        {/* Strich → UNTEN, Diagonalen → OBEN-LINKS + OBEN-RECHTS */}
        <InvertedPeace
          cx={W*0.80} cy={H*0.72}
          r={H*0.14}
          color="rgba(255,255,255,0.9)"
          strokeW={H*0.028}
        />
        {/* Zweites kleineres Peace oben rechts */}
        <InvertedPeace
          cx={W*0.76} cy={H*0.22}
          r={H*0.09}
          color={divCol}
          strokeW={H*0.022}
        />

        {/* ══ MOJOBUS Schriftzug (unten Mitte) ══════════════════════════ */}
        <rect x={W*0.25} y={H*0.53} width={W*0.45} height={H*0.135} rx={5}
          fill="rgba(0,0,0,0.22)" />
        <text
          x={W*0.475} y={H*0.636}
          textAnchor="middle"
          fill={color}
          fontSize={H*0.115}
          fontFamily="Arial Black, Impact, sans-serif"
          fontWeight="900"
          letterSpacing="5"
          opacity={0.95}
        >{label}</text>

        {/* ══ Rost-Flecken ══════════════════════════════════════════════ */}
        <RustSpot cx={W*0.07} cy={H*0.82} rx={W*0.016} ry={H*0.022} opacity={0.3} />
        <RustSpot cx={W*0.16} cy={H*0.96} rx={W*0.012} ry={H*0.016} opacity={0.25} />
        <RustSpot cx={W*0.63} cy={H*0.94} rx={W*0.014} ry={H*0.018} opacity={0.28} />
        <RustSpot cx={W*0.04} cy={H*0.62} rx={W*0.008} ry={H*0.015} opacity={0.22} />
        <RustSpot cx={W*0.85} cy={H*0.92} rx={W*0.009} ry={H*0.012} opacity={0.2}  />

        {/* ══ Abgas-Wölkchen ════════════════════════════════════════════ */}
        <ExhaustPuff cx={W*0.015} cy={H*0.85} frame={frame} fps={fps} delay={0}  />
        <ExhaustPuff cx={W*0.015} cy={H*0.82} frame={frame} fps={fps} delay={10} />
        <ExhaustPuff cx={W*0.015} cy={H*0.88} frame={frame} fps={fps} delay={5}  />

        {/* ══ Räder ══════════════════════════════════════════════════════ */}
        {/* Radkästen (abgerundet) */}
        <ellipse cx={W*0.18}  cy={RY} rx={WR*1.28} ry={WR*0.45} fill="#222" />
        <ellipse cx={W*0.78}  cy={RY} rx={WR*1.28} ry={WR*0.45} fill="#222" />
        {/* Chromfelgen */}
        <ChromeWheel cx={W*0.78} cy={RY} r={WR} wheelRot={wheelRot} />
        <ChromeWheel cx={W*0.18} cy={RY} r={WR} wheelRot={wheelRot} />

        {/* ══ Dach: Surfbrett + Dachgepäck ══════════════════════════════ */}
        {/* Dachträger-Schienen */}
        <rect x={W*0.15} y={-H*0.02} width={W*0.66} height={H*0.03} rx={2} fill="#888" />
        {/* Träger-Bügel */}
        {[W*0.18, W*0.42, W*0.68].map((x, i) => (
          <rect key={i} x={x} y={-H*0.05} width={W*0.018} height={H*0.07} rx={1} fill="#777" />
        ))}
        {/* Surfbrett */}
        <ellipse cx={W*0.44} cy={-H*0.085} rx={W*0.27} ry={H*0.04}
          fill="#e63946" stroke="#b5000a" strokeWidth={1.5} />
        <ellipse cx={W*0.44} cy={-H*0.085} rx={W*0.12} ry={H*0.017}
          fill="#ffd93d" opacity={0.75} />
        <ellipse cx={W*0.44} cy={-H*0.085} rx={W*0.04} ry={H*0.01}
          fill="#fff" opacity={0.5} />
        {/* Halteseile */}
        {[W*0.22, W*0.65].map((x, i) => (
          <line key={i} x1={x} y1={-H*0.02} x2={x + (i===0?0.05:-0.05)*W} y2={-H*0.065}
            stroke="#777" strokeWidth={1.5} />
        ))}

      </svg>
    </div>
  );
};

// ── Haupt-Export ──────────────────────────────────────────────────────────

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
  size = 340,
  accentColor = '#F59E0B',
  bodyColor,
  color = '#FFFFFF',
  driveIn = true,
  position = 'center',
  label = 'MOJOBUS',
  lottieData,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const posStyles: React.CSSProperties =
    position === 'bottom-center'
      ? { position: 'absolute', bottom: '6%', left: '50%', transform: 'translateX(-50%)' }
      : position === 'top-center'
      ? { position: 'absolute', top: '6%',    left: '50%', transform: 'translateX(-50%)' }
      : { position: 'absolute', top: '50%',   left: '50%', transform: 'translate(-50%,-50%)' };

  const enter   = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  return (
    <div style={{ ...posStyles, opacity, pointerEvents: 'none' }}>
      <HippieVan
        size={size}
        accentColor={accentColor}
        bodyColor={bodyColor}
        color={color}
        driveIn={driveIn}
        label={label}
      />
    </div>
  );
};

// ── BusRideOverlay — Hippie-Van fährt durchs Bild ─────────────────────────

export const BusRideOverlay: React.FC<{
  accentColor?: string;
  size?: number;
  verticalPosition?: number;
  label?: string;
}> = ({ accentColor = '#F59E0B', size = 280, verticalPosition = 75, label = 'MOJOBUS' }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const xPercent = interpolate(frame, [0, durationInFrames], [-22, 118], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        left: `${xPercent}%`,
        top:  `${verticalPosition}%`,
        transform: 'translate(-50%, -50%)',
      }}>
        <HippieVan size={size} accentColor={accentColor} driveIn={false} label={label} />
      </div>
    </AbsoluteFill>
  );
};
