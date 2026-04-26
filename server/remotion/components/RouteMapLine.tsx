/**
 * RouteMapLine — Animierte Routen-Linie auf einer Karte
 *
 * Zwei Betriebsmodi:
 *  1. MIT Karten-Hintergrund: Statisches Map-Bild + SVG-Polyline darüber
 *  2. OHNE Karte: Rein abstrakte Routen-Animation (immer verfügbar)
 *
 * @remotion/shapes Integration:
 *  - Nutzt Triangle / Circle aus @remotion/shapes für Start/End-Marker
 *  - Fallback: eigene SVG-Shapes wenn Package fehlt
 *
 * Einsatz im Video:
 *  - Zeige die Reiseroute (z.B. Portugal-Westküste) als animierte Linie
 *  - Dauer: 1 Slide (perSlide Frames)
 *  - Positionierung: Vollbild oder als Overlay
 *
 * Package: npm install @remotion/shapes
 */

import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { FONT_FAMILY_REGULAR, FONT_WEIGHT } from './Fonts';

// ── Typen ─────────────────────────────────────────────────────────────────

export interface RouteCoord {
  /** X-Position in Prozent (0–100 der Video-Breite) */
  x: number;
  /** Y-Position in Prozent (0–100 der Video-Höhe) */
  y: number;
  /** Optionaler Label-Text (Stadt, Region) */
  label?: string;
}

export interface RouteMapLineProps {
  /** Koordinaten der Routen-Punkte (mind. 2) */
  coords: RouteCoord[];
  /** Karten-Hintergrund URL (optional) */
  mapImageUrl?: string;
  /** Linien-Farbe */
  color?: string;
  /** Akzentfarbe für Marker */
  accentColor?: string;
  /** Linienbreite in px */
  strokeWidth?: number;
  /** Animations-Typ: 'draw' = Linie zeichnen, 'pulse' = pulsierender Marker */
  animType?: 'draw' | 'pulse' | 'both';
  /** Zeige Labels */
  showLabels?: boolean;
  /** Zeige Bus-Icon am aktuellen Positions-Punkt */
  showBusMarker?: boolean;
  /** Hintergrund-Overlay Opacity (0 = kein Overlay) */
  overlayOpacity?: number;
}

// Hinweis: @remotion/shapes wird hier NICHT importiert.
// RouteMapLine verwendet eigene SVG-Inline-Implementierungen —
// das ist robuster und braucht kein extra Package.

// ── Fallback Shapes (reine SVG, kein Package) ─────────────────────────────

const FallbackCircle: React.FC<{
  radius: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  pulse?: boolean;
}> = ({ radius, fill, stroke, strokeWidth = 2, pulse = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pulseScale = pulse
    ? 1 + Math.sin((frame / fps) * Math.PI * 2 * 1.5) * 0.15
    : 1;

  return (
    <svg
      width={radius * 2 * 1.5}
      height={radius * 2 * 1.5}
      viewBox={`0 0 ${radius * 2} ${radius * 2}`}
      style={{ overflow: 'visible' }}
    >
      {pulse && (
        <circle
          cx={radius}
          cy={radius}
          r={radius * pulseScale * 1.3}
          fill={`${fill}33`}
        />
      )}
      <circle
        cx={radius}
        cy={radius}
        r={radius}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
};

const FallbackTriangle: React.FC<{
  size: number;
  fill: string;
  direction?: 'up' | 'down';
}> = ({ size, fill, direction = 'down' }) => {
  const points =
    direction === 'down'
      ? `${size / 2},${size} 0,0 ${size},0`
      : `${size / 2},0 0,${size} ${size},${size}`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={points} fill={fill} />
    </svg>
  );
};

// ── Bus-Marker (SVG-Icon) ─────────────────────────────────────────────────

const BusMarker: React.FC<{
  size?: number;
  color?: string;
  accentColor?: string;
}> = ({ size = 32, color = '#FFFFFF', accentColor = '#F59E0B' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bounce = Math.sin((frame / fps) * Math.PI * 2 * 2) * 2;

  return (
    <div
      style={{
        transform: `translateY(${bounce}px)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Bus body */}
        <rect x="2" y="4" width="20" height="14" rx="2" fill={accentColor} />
        {/* Windows */}
        <rect x="4" y="6" width="4" height="4" rx="1" fill={color} opacity="0.9" />
        <rect x="10" y="6" width="4" height="4" rx="1" fill={color} opacity="0.9" />
        <rect x="16" y="6" width="4" height="4" rx="1" fill={color} opacity="0.9" />
        {/* Door */}
        <rect x="10" y="11" width="4" height="5" rx="1" fill={color} opacity="0.7" />
        {/* Wheels */}
        <circle cx="7" cy="19" r="2.5" fill="#333" stroke={color} strokeWidth="0.8" />
        <circle cx="17" cy="19" r="2.5" fill="#333" stroke={color} strokeWidth="0.8" />
        {/* Front stripe */}
        <rect x="2" y="4" width="3" height="14" rx="2" fill={color} opacity="0.15" />
      </svg>
    </div>
  );
};

// ── SVG Pfad-Hilfsfunktionen ──────────────────────────────────────────────

/** Konvertiert RouteCoord[] zu SVG-Polyline Points-String (in absoluten px) */
function coordsToSvgPoints(
  coords: RouteCoord[],
  svgWidth: number,
  svgHeight: number
): string {
  return coords
    .map(c => `${(c.x / 100) * svgWidth},${(c.y / 100) * svgHeight}`)
    .join(' ');
}

/** Berechnet die Gesamt-Länge der Polyline (für stroke-dasharray) */
function calcPolylineLength(
  coords: RouteCoord[],
  w: number,
  h: number
): number {
  let len = 0;
  for (let i = 1; i < coords.length; i++) {
    const dx = ((coords[i].x - coords[i - 1].x) / 100) * w;
    const dy = ((coords[i].y - coords[i - 1].y) / 100) * h;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

/** Interpolierter Punkt auf der Polyline (t = 0..1) */
function getPointOnPolyline(
  coords: RouteCoord[],
  t: number,
  w: number,
  h: number
): { x: number; y: number } {
  if (coords.length < 2) return { x: coords[0].x / 100 * w, y: coords[0].y / 100 * h };

  const segments: Array<{ len: number; x1: number; y1: number; x2: number; y2: number }> = [];
  let totalLen = 0;

  for (let i = 1; i < coords.length; i++) {
    const x1 = (coords[i - 1].x / 100) * w;
    const y1 = (coords[i - 1].y / 100) * h;
    const x2 = (coords[i].x / 100) * w;
    const y2 = (coords[i].y / 100) * h;
    const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    segments.push({ len, x1, y1, x2, y2 });
    totalLen += len;
  }

  const targetLen = t * totalLen;
  let cumLen = 0;

  for (const seg of segments) {
    if (cumLen + seg.len >= targetLen) {
      const segT = (targetLen - cumLen) / seg.len;
      return {
        x: seg.x1 + (seg.x2 - seg.x1) * segT,
        y: seg.y1 + (seg.y2 - seg.y1) * segT,
      };
    }
    cumLen += seg.len;
  }

  const last = coords[coords.length - 1];
  return { x: (last.x / 100) * w, y: (last.y / 100) * h };
}

// ── Haupt-Komponente ───────────────────────────────────────────────────────

export const RouteMapLine: React.FC<RouteMapLineProps> = ({
  coords,
  mapImageUrl,
  color = '#FFFFFF',
  accentColor = '#F59E0B',
  strokeWidth = 4,
  animType = 'both',
  showLabels = true,
  showBusMarker = true,
  overlayOpacity = 0.45,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();

  if (!coords || coords.length < 2) return null;

  // Einblenden
  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const globalOpacity = interpolate(enterSpring, [0, 1], [0, 1]);

  // Linie zeichnen: 0→1 über die ersten 60% der Sequence
  const drawProgress = interpolate(
    frame,
    [0, Math.round(durationInFrames * 0.65)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Cubic ease-out
  const drawEased = 1 - Math.pow(1 - drawProgress, 3);

  // SVG-Dimensionen (=Video-Dimensionen)
  const svgW = width;
  const svgH = height;

  const polylinePoints = coordsToSvgPoints(coords, svgW, svgH);
  const totalLength = calcPolylineLength(coords, svgW, svgH);

  // Stroke-Dasharray Trick: zeichnet die Linie progressiv
  const dashArray = totalLength;
  const dashOffset = totalLength * (1 - drawEased);

  // Aktueller Bus-Positions-Punkt
  const busPos = getPointOnPolyline(coords, drawEased, svgW, svgH);

  // Start + End Marker
  const startCoord = coords[0];
  const endCoord = coords[coords.length - 1];

  return (
    <AbsoluteFill style={{ opacity: globalOpacity, pointerEvents: 'none' }}>

      {/* Karten-Hintergrund wenn vorhanden */}
      {mapImageUrl && (
        <AbsoluteFill>
          <img
            src={mapImageUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
            }}
          />
          {/* Dunkel-Overlay für bessere Sichtbarkeit der Route */}
          <AbsoluteFill
            style={{ background: `rgba(0,0,0,${overlayOpacity})` }}
          />
        </AbsoluteFill>
      )}

      {/* SVG Routen-Linie */}
      <AbsoluteFill>
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <defs>
            {/* Glühender Linien-Effekt */}
            <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Schärfere Linie ohne Glow */}
            <filter id="route-sharp">
              <feGaussianBlur stdDeviation="0" />
            </filter>
          </defs>

          {/* Schatten/Glow der Linie */}
          {(animType === 'draw' || animType === 'both') && (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke={accentColor}
              strokeWidth={strokeWidth * 2.5}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.35}
              filter="url(#route-glow)"
            />
          )}

          {/* Haupt-Linie */}
          {(animType === 'draw' || animType === 'both') && (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Start-Marker (Kreis) */}
          {drawEased > 0.05 && (
            <circle
              cx={(startCoord.x / 100) * svgW}
              cy={(startCoord.y / 100) * svgH}
              r={strokeWidth * 2.5}
              fill={accentColor}
              stroke={color}
              strokeWidth={2}
            />
          )}

          {/* End-Marker (Ziel-Marker erscheint wenn Linie fast fertig) */}
          {drawEased > 0.9 && (
            <>
              {/* Pulsierender Ring */}
              <circle
                cx={(endCoord.x / 100) * svgW}
                cy={(endCoord.y / 100) * svgH}
                r={strokeWidth * 5}
                fill="none"
                stroke={accentColor}
                strokeWidth={2}
                opacity={
                  interpolate(frame, [
                    Math.round(durationInFrames * 0.9),
                    durationInFrames,
                  ], [0, 0.7], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  })
                }
              />
              {/* Ziel-Punkt */}
              <circle
                cx={(endCoord.x / 100) * svgW}
                cy={(endCoord.y / 100) * svgH}
                r={strokeWidth * 3}
                fill={accentColor}
                stroke={color}
                strokeWidth={2}
              />
              {/* Ziel-Kreuz */}
              <line
                x1={(endCoord.x / 100) * svgW - strokeWidth * 1.5}
                y1={(endCoord.y / 100) * svgH}
                x2={(endCoord.x / 100) * svgW + strokeWidth * 1.5}
                y2={(endCoord.y / 100) * svgH}
                stroke={color}
                strokeWidth={1.5}
              />
              <line
                x1={(endCoord.x / 100) * svgW}
                y1={(endCoord.y / 100) * svgH - strokeWidth * 1.5}
                x2={(endCoord.x / 100) * svgW}
                y2={(endCoord.y / 100) * svgH + strokeWidth * 1.5}
                stroke={color}
                strokeWidth={1.5}
              />
            </>
          )}
        </svg>
      </AbsoluteFill>

      {/* Bus-Marker bewegt sich entlang der Route */}
      {showBusMarker && drawEased > 0.05 && (
        <AbsoluteFill>
          <div
            style={{
              position: 'absolute',
              left: busPos.x,
              top: busPos.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <BusMarker size={36} accentColor={accentColor} />
          </div>
        </AbsoluteFill>
      )}

      {/* Labels für Städte/Regionen */}
      {showLabels && (
        <AbsoluteFill>
          {coords.map((coord, i) => {
            if (!coord.label) return null;

            // Label erscheint wenn die Linie diesen Punkt erreicht
            const coordProgress = i / (coords.length - 1);
            const labelOpacity = interpolate(
              drawEased,
              [coordProgress - 0.05, coordProgress + 0.1],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );

            if (labelOpacity < 0.05) return null;

            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${coord.x}%`,
                  top: `${coord.y}%`,
                  transform: 'translate(-50%, calc(-100% - 12px))',
                  opacity: labelOpacity,
                  pointerEvents: 'none',
                }}
              >
                {/* Label-Box */}
                <div
                  style={{
                    background: 'rgba(0,0,0,0.72)',
                    color: '#FFFFFF',
                    fontFamily: FONT_FAMILY_REGULAR,
                    fontWeight: FONT_WEIGHT.semibold,
                    fontSize: 'clamp(0.55rem, 1.5vw, 0.75rem)',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '100px',
                    border: `1px solid ${accentColor}66`,
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                  }}
                >
                  {i === 0 ? '🚌 ' : i === coords.length - 1 ? '📍 ' : '· '}
                  {coord.label}
                </div>
                {/* Verbindungs-Linie zum Punkt */}
                <div
                  style={{
                    width: '1px',
                    height: '8px',
                    background: accentColor,
                    margin: '0 auto',
                  }}
                />
              </div>
            );
          })}
        </AbsoluteFill>
      )}

    </AbsoluteFill>
  );
};

// ── Demo-Routen für verschiedene Destinations ─────────────────────────────

/**
 * Vorgefertigte Routen für häufige MojoBus-Destinationen.
 * Koordinaten: Prozent des Video-Frames (nicht GPS-Koordinaten!)
 */
export const DEMO_ROUTES: Record<string, RouteCoord[]> = {
  // Portugal Westküste: Porto → Nazaré → Setúbal → Sagres
  'portugal-west': [
    { x: 28, y: 18, label: 'Porto' },
    { x: 24, y: 32, label: 'Nazaré' },
    { x: 22, y: 48, label: 'Setúbal' },
    { x: 15, y: 75, label: 'Sagres' },
  ],
  // Spanien Nordküste: San Sebastián → Santander → Oviedo → A Coruña
  'spain-north': [
    { x: 72, y: 20, label: 'San Sebastián' },
    { x: 52, y: 18, label: 'Santander' },
    { x: 38, y: 22, label: 'Oviedo' },
    { x: 18, y: 18, label: 'A Coruña' },
  ],
  // Südfrankreich: Marseille → Montpellier → Barcelona
  'south-france': [
    { x: 55, y: 38, label: 'Marseille' },
    { x: 40, y: 42, label: 'Montpellier' },
    { x: 25, y: 55, label: 'Barcelona' },
  ],
  // Deutschland → Niederlande → Belgien: München → Köln → Amsterdam
  'central-europe': [
    { x: 58, y: 78, label: 'München' },
    { x: 42, y: 42, label: 'Köln' },
    { x: 32, y: 22, label: 'Amsterdam' },
  ],
  // Einfache Demo (abstrakter Pfad)
  'demo': [
    { x: 15, y: 50, label: 'Start' },
    { x: 30, y: 30, label: 'Etappe 1' },
    { x: 50, y: 45, label: 'Etappe 2' },
    { x: 70, y: 25, label: 'Etappe 3' },
    { x: 85, y: 50, label: 'Ziel' },
  ],
};

/**
 * Wählt eine passende Demo-Route basierend auf country-String.
 */
export function pickDemoRoute(country?: string): RouteCoord[] {
  if (!country) return DEMO_ROUTES.demo;
  const lower = country.toLowerCase();
  if (lower === 'portugal') return DEMO_ROUTES['portugal-west'];
  if (lower === 'spain' || lower === 'spanien') return DEMO_ROUTES['spain-north'];
  if (lower === 'france' || lower === 'frankreich') return DEMO_ROUTES['south-france'];
  if (lower === 'germany' || lower === 'deutschland') return DEMO_ROUTES['central-europe'];
  return DEMO_ROUTES.demo;
}
