/**
 * CinematicEffects — 6 neue Effekte + Plattform-Matrix
 *
 *  1. ZoomPunch     — Punch-In auf den Cut (TikTok-Signature-Effekt)
 *  2. WhipPan       — Peitschenschwenk-Übergang (Pan + horizontaler Blur)
 *  3. FlashCut      — Luma-Blitz am Schnitt (weiß = energetisch, schwarz = cinematisch)
 *  4. LightLeak     — Warmes Licht "brennt" über den Übergang (Analog-Look)
 *  5. Letterbox     — Cinematic-Balken (fahren beim Hook rein, bei CTA raus)
 *  6. MatchCutZoom  — Scale-Kontinuität über den Schnitt (End-Zoom = Start-Zoom)
 *
 * PLATTFORM-MATRIX (abgestimmt, siehe MOJOBUS_CONTEXT.md):
 *   Effekt          TikTok      Reels       YouTube
 *   ZoomPunch       ✅✅ stark   ✅ dezent    ⚪ aus
 *   WhipPan         ✅✅         ✅           ✅
 *   FlashCut        ✅ weiß      ⚪ aus       ✅ schwarz
 *   LightLeaks      ⚪ aus       ✅✅         ✅
 *   Letterbox       ⚪ aus       ✅ 6%        ✅✅ 8%
 *   MatchCutZoom    ✅           ✅           ✅
 *
 * RENDERING-REGELN (SwiftShader/headless Chrome auf VPS):
 * - NUR CSS-Transforms, Gradients, Opacity — kein WebGL, kein Canvas
 * - Kein Math.random() — alles deterministisch (frame-basiert)
 * - Kein feTurbulence/feDisplacementMap (img.decode-Fehler)
 * - useCurrentFrame NUR auf Top-Level von Komponenten
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

// ══════════════════════════════════════════════════════════════════════════
// PLATTFORM-MATRIX
// ══════════════════════════════════════════════════════════════════════════

export type EffectPlatform = 'tiktok' | 'reels' | 'youtube';

export interface PlatformEffects {
  /** Punch-In-Stärke am Cut (0 = aus). TikTok 0.12, Reels 0.07, YouTube 0 */
  zoomPunchScale: number;
  /** WhipPan im Cut-Rotationsplan verwenden */
  whipPan: boolean;
  /** FlashCut-Farbe ('' = aus). TikTok weiß, YouTube schwarz */
  flashColor: string;
  /** LightLeaks im Cut-Rotationsplan verwenden */
  lightLeaks: boolean;
  /** Letterbox-Balkenhöhe in % der Videohöhe (0 = aus) */
  letterboxPct: number;
  /** Match-Cut-Zoom-Paare aktivieren */
  matchCutZoom: boolean;
}

export const PLATFORM_EFFECTS: Record<EffectPlatform, PlatformEffects> = {
  tiktok: {
    zoomPunchScale: 0.12,
    whipPan: true,
    flashColor: 'rgba(255,255,255,1)', // weiß = energetisch
    lightLeaks: false,
    letterboxPct: 0,                    // frisst Caption-Safe-Zone → aus
    matchCutZoom: true,
  },
  reels: {
    zoomPunchScale: 0.07,
    whipPan: true,
    flashColor: '',                     // kein Flash – Lifestyle-Publikum
    lightLeaks: true,
    letterboxPct: 6,
    matchCutZoom: true,
  },
  youtube: {
    zoomPunchScale: 0,
    whipPan: true,
    flashColor: 'rgba(0,0,0,1)',        // schwarz = cinematisch
    lightLeaks: true,
    letterboxPct: 8,
    matchCutZoom: true,
  },
};

export function getPlatformEffects(platform?: string): PlatformEffects {
  return PLATFORM_EFFECTS[(platform as EffectPlatform) || 'tiktok'] ?? PLATFORM_EFFECTS.tiktok;
}

// ══════════════════════════════════════════════════════════════════════════
// CUT-EFFEKT-ROTATION (deterministisch, plattform-gewichtet)
// ══════════════════════════════════════════════════════════════════════════

export type CutEffect = 'whip' | 'flash' | 'leak' | 'none';

/**
 * Rotationspläne pro Plattform. 'none' = normaler CrossFade (Abwechslung!).
 * Nicht jeder Cut braucht einen Effekt – sonst wirkt es wie ein Template.
 */
const CUT_ROTATION: Record<EffectPlatform, CutEffect[]> = {
  tiktok:  ['flash', 'whip', 'none', 'whip', 'flash', 'none'],
  reels:   ['leak',  'whip', 'none', 'leak', 'whip',  'none'],
  youtube: ['none',  'whip', 'flash', 'none', 'leak', 'whip'],
};

/**
 * Wählt den Effekt für Cut Nummer cutIndex (deterministisch).
 * Filtert Effekte raus, die die Plattform-Matrix deaktiviert hat.
 */
export function pickCutEffect(cutIndex: number, platform?: string): CutEffect {
  const plat = (platform as EffectPlatform) || 'tiktok';
  const fx = PLATFORM_EFFECTS[plat] ?? PLATFORM_EFFECTS.tiktok;
  const rotation = CUT_ROTATION[plat] ?? CUT_ROTATION.tiktok;
  const effect = rotation[cutIndex % rotation.length];

  // Matrix-Gating: deaktivierte Effekte → 'none'
  if (effect === 'flash' && !fx.flashColor) return 'none';
  if (effect === 'leak' && !fx.lightLeaks) return 'none';
  if (effect === 'whip' && !fx.whipPan) return 'none';
  return effect;
}

// ══════════════════════════════════════════════════════════════════════════
// 1. ZOOM-PUNCH — Punch-In am Cut
// ══════════════════════════════════════════════════════════════════════════

/**
 * Wrapper um den Slide-Inhalt: bei Sequenz-Start (= Cut) springt die Skalierung
 * auf 1+punchScale und federt in ~5 Frames auf 1.0 zurück (ease-out).
 * Der "Schlag" auf den Beat. Cuts liegen durch Beat-Sync bereits auf der Musik.
 */
export const ZoomPunchWrapper: React.FC<{
  punchScale: number;
  children: React.ReactNode;
  /**
   * Lokaler Frame (relativ zum Start der umgebenden Sequence), an dem der
   * Punch einschlägt. Default 0 = Punch direkt am Cut (bestehendes Verhalten,
   * unverändert für alle bisherigen Aufrufer). Für den Hook-Wort-Zoom
   * (Schritt 5) wird hier der lokale Frame des markierten Wortes übergeben,
   * damit der Punch zum Zeitpunkt der Wort-Einblendung einschlägt statt am
   * Slide-Anfang.
   */
  triggerFrame?: number;
}> = ({ punchScale, children, triggerFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (punchScale <= 0) return <>{children}</>;

  const punchFrames = Math.max(3, Math.round(fps * 0.16)); // ~5 Frames @ 30fps
  // Lokaler Frame relativ zum Trigger. Außerhalb des Punch-Fensters (davor
  // ODER danach) ist t=0 (kein Effekt) — WICHTIG: 'clamp' allein würde bei
  // triggerFrame>0 vor dem Trigger fälschlich t=1 (Maximal-Zoom) liefern,
  // da extrapolateLeft auf den Eingabewert an Position 0 clampt (=1).
  const localFrame = frame - triggerFrame;
  const t = localFrame < 0
    ? 0
    : interpolate(localFrame, [0, punchFrames], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
  // Ease-out quart: schneller Einschlag, weiches Ausfedern
  const eased = t * t * t * t;
  const scale = 1 + punchScale * eased;
  // Leichter Blur während des Punches verstärkt die Wucht (ersetzt Trail-Frames)
  const blur = eased * punchScale * 14;

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale.toFixed(4)})`,
        transformOrigin: 'center center',
        filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined,
        willChange: 'transform',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// 2. WHIP PAN — Peitschenschwenk
// ══════════════════════════════════════════════════════════════════════════

/**
 * Wrapper um den Slide-Inhalt:
 *  - whipIn:  Slide reißt bei Sequenz-Start aus der Richtung herein (translateX + Blur)
 *  - whipOut: Slide reißt am Sequenz-Ende in die Richtung heraus
 * Beide Slides nutzen DIESELBE Richtung → wirkt wie EIN Kameraschwenk.
 * Der horizontale Blur kaschiert, dass es Fotos sind – fühlt sich gefilmt an.
 */
export const WhipPanWrapper: React.FC<{
  whipIn?: boolean;
  whipOut?: boolean;
  /** Richtung des Schwenks: 'left' = Kamera schwenkt nach links */
  direction?: 'left' | 'right';
  /** Frames am Ende der Sequenz, ab denen whipOut startet */
  totalFrames: number;
  children: React.ReactNode;
}> = ({ whipIn = false, whipOut = false, direction = 'left', totalFrames, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const whipFrames = Math.max(4, Math.round(fps * 0.25)); // ~8 Frames @ 30fps
  const dir = direction === 'left' ? -1 : 1;

  let translateX = 0;
  let blur = 0;

  if (whipIn && frame < whipFrames) {
    // Herein: von +100% (aus der Gegenrichtung) auf 0 – ease-out
    const t = interpolate(frame, [0, whipFrames], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const eased = t * t * t;
    translateX = -dir * 100 * eased;
    blur = eased * 24;
  } else if (whipOut && frame > totalFrames - whipFrames) {
    // Heraus: von 0 auf -100% – ease-in
    const t = interpolate(frame, [totalFrames - whipFrames, totalFrames], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const eased = t * t * t;
    translateX = dir * 100 * eased;
    blur = eased * 24;
  }

  if (translateX === 0 && blur === 0) return <>{children}</>;

  return (
    <AbsoluteFill
      style={{
        transform: `translateX(${translateX.toFixed(2)}%)`,
        // Nur horizontaler Bewegungs-Blur-Eindruck: normaler Blur reicht,
        // da die Bewegung selbst die Richtung vorgibt
        filter: blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : undefined,
        willChange: 'transform',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// 3. FLASH-CUT — Luma-Blitz am Schnitt
// ══════════════════════════════════════════════════════════════════════════

/**
 * Ein einzelner Blitz: 2 Frames voll, 3 Frames Ausklang.
 * Weiß (screen) = energetisch/TikTok · Schwarz (normal) = cinematisch/YouTube.
 * Wird als eigene Sequence AUF dem Cut-Frame platziert.
 */
export const FlashCut: React.FC<{
  color: string;
}> = ({ color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const holdFrames = Math.max(1, Math.round(fps / 15)); // 2 Frames @ 30fps
  const fadeFrames = Math.max(2, Math.round(fps / 10)); // 3 Frames @ 30fps

  const opacity = frame <= holdFrames
    ? 1
    : interpolate(frame, [holdFrames, holdFrames + fadeFrames], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  if (opacity < 0.01) return null;

  const isWhite = color.includes('255');

  return (
    <AbsoluteFill
      style={{
        background: color,
        opacity: opacity * (isWhite ? 0.9 : 1),
        mixBlendMode: isWhite ? 'screen' : 'normal',
        pointerEvents: 'none',
      }}
    />
  );
};

/** Dauer einer FlashCut-Sequence in Frames */
export function flashCutDuration(fps: number): number {
  return Math.max(3, Math.round(fps / 15) + Math.round(fps / 10) + 1);
}

// ══════════════════════════════════════════════════════════════════════════
// 4. LIGHT LEAK — Film Burn über den Übergang
// ══════════════════════════════════════════════════════════════════════════

/**
 * Warmes Licht wandert über den Schnitt – rein CSS-Gradients mit
 * mix-blend-mode: screen. Kein Asset nötig, deterministisch.
 * Variante wechselt pro Cut (seed) → nie zweimal derselbe Leak hintereinander.
 */
export const LightLeak: React.FC<{
  /** Deterministischer Varianten-Seed (Cut-Index) */
  seed?: number;
}> = ({ seed = 0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const t = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Glockenkurve: rein → Peak in der Mitte (= am Cut) → raus
  const bell = Math.sin(t * Math.PI);
  const opacity = bell * 0.75;
  if (opacity < 0.02) return null;

  // 3 Varianten, deterministisch nach seed
  const variant = seed % 3;

  // Leak wandert von einer Seite zur anderen
  const drift = interpolate(t, [0, 1], [-25, 25]);

  const gradients: string[] = [];
  if (variant === 0) {
    // Warmer Blob von rechts oben
    gradients.push(
      `radial-gradient(ellipse 80% 60% at ${75 + drift}% 15%, rgba(255,150,50,0.85) 0%, rgba(255,90,40,0.4) 35%, transparent 70%)`,
      `radial-gradient(ellipse 50% 40% at ${85 + drift}% 40%, rgba(255,220,150,0.6) 0%, transparent 60%)`
    );
  } else if (variant === 1) {
    // Streifen-Burn von links
    gradients.push(
      `linear-gradient(${100 + drift}deg, rgba(255,120,60,0.7) 0%, rgba(255,180,80,0.35) 18%, transparent 40%)`,
      `radial-gradient(ellipse 60% 90% at ${8 + drift}% 55%, rgba(255,200,120,0.55) 0%, transparent 65%)`
    );
  } else {
    // Doppel-Blob unten (Lagerfeuer-Stimmung)
    gradients.push(
      `radial-gradient(ellipse 70% 50% at ${30 + drift}% 92%, rgba(255,140,60,0.75) 0%, rgba(200,60,30,0.35) 40%, transparent 72%)`,
      `radial-gradient(ellipse 40% 35% at ${68 + drift}% 85%, rgba(255,210,140,0.5) 0%, transparent 60%)`
    );
  }

  return (
    <AbsoluteFill
      style={{
        background: gradients.join(', '),
        opacity,
        mixBlendMode: 'screen',
        pointerEvents: 'none',
      }}
    />
  );
};

/** Dauer einer LightLeak-Sequence in Frames (~1s, Peak am Cut) */
export function lightLeakDuration(fps: number): number {
  return Math.round(fps * 1.0);
}

// ══════════════════════════════════════════════════════════════════════════
// 5. CINEMATIC LETTERBOX — animierte Balken
// ══════════════════════════════════════════════════════════════════════════

/**
 * Schwarze Balken (oben + unten) fahren beim Hook rein und bei der CTA
 * wieder raus. Signalisiert "Film, nicht Content".
 * Läuft als EIN Layer über die gesamte Video-Dauer.
 */
export const CinematicLetterbox: React.FC<{
  /** Balkenhöhe in % der Videohöhe (pro Balken) */
  barPct: number;
  /** Frames für das Einfahren (ab Frame 0) */
  enterFrames: number;
  /** Absoluter Frame, an dem das Ausfahren beginnt (CTA-Start) */
  exitStartFrame: number;
  /** Frames für das Ausfahren */
  exitFrames: number;
}> = ({ barPct, enterFrames, exitStartFrame, exitFrames }) => {
  const frame = useCurrentFrame();

  if (barPct <= 0) return null;

  let progress: number;
  if (frame < exitStartFrame) {
    // Einfahren mit ease-out
    const t = interpolate(frame, [0, enterFrames], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    progress = 1 - Math.pow(1 - t, 3);
  } else {
    // Ausfahren mit ease-in
    const t = interpolate(frame, [exitStartFrame, exitStartFrame + exitFrames], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    progress = t * t;
  }

  if (progress < 0.01) return null;

  const h = barPct * progress;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${h.toFixed(2)}%`,
          background: '#000',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${h.toFixed(2)}%`,
          background: '#000',
        }}
      />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// 6. MATCH-CUT-ZOOM — Scale-Kontinuität (Helper)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Berechnet Match-Cut-Paare für die Bild-Slides.
 * Muster (deterministisch): jedes 3. Slide-Paar wird verkettet:
 *   Slide i:   zoomt 1.00 → 1.12 (rein)
 *   Slide i+1: startet bei 1.12 → 1.02 (raus)
 * Das Gehirn liest den Schnitt als EINE durchgehende Kamerabewegung.
 *
 * Route-Slides werden übersprungen (Karte braucht keinen Zoom-Trick).
 *
 * @param slideDefs - [{type: 'image'|'route'}, ...] wie in MojoBusVideo
 * @returns Map slideIndex → {from, to} Scale-Werte (nur für gepaarte Slides)
 */
export function buildMatchCutMap(
  slideDefs: { type: 'image' | 'route' }[]
): Record<number, { from: number; to: number }> {
  const map: Record<number, { from: number; to: number }> = {};
  let pairCounter = 0;

  for (let i = 0; i < slideDefs.length - 1; i++) {
    if (slideDefs[i].type !== 'image' || slideDefs[i + 1].type !== 'image') continue;
    // Jedes 3. mögliche Paar verketten (Abwechslung: nicht ALLE Cuts sind Match-Cuts)
    if (pairCounter % 3 === 1 && !map[i] && !map[i + 1]) {
      map[i] = { from: 1.0, to: 1.12 };      // rein
      map[i + 1] = { from: 1.12, to: 1.02 }; // raus (nicht ganz auf 1.0 – bleibt lebendig)
    }
    pairCounter++;
  }

  return map;
}

/**
 * MatchCutZoomWrapper — legt die durchgehende Zoom-Bewegung ÜBER den Slide.
 * Ersetzt für gepaarte Slides das KenBurns-Zoom-Verhalten (KenBurns läuft
 * darunter mit intensity 0-Pan weiter, der Zoom kommt von hier).
 * Linear + minimales Easing – die KONTINUITÄT über den Schnitt ist der Effekt,
 * nicht die Kurve.
 */
export const MatchCutZoomWrapper: React.FC<{
  from: number;
  to: number;
  children: React.ReactNode;
}> = ({ from, to, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const t = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Sehr leichtes ease-in-out damit der Übergang am Cut nahtlos wirkt
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const scale = from + (to - from) * eased;

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale.toFixed(4)})`,
        transformOrigin: 'center center',
        willChange: 'transform',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
