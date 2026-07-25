import {
  getPlatformEffects,
  pickCutEffect,
  buildMatchCutMap,
  type CutEffect,
  type PlatformEffects,
} from './components/CinematicEffects';
import type { SlideDef } from './slidePlan';

export interface CutEffectsPlan {
  fx: PlatformEffects;
  cutFx: CutEffect[];
  matchCutMap: Record<number, { from: number; to: number }>;
  whipDir: (i: number) => 'left' | 'right';
  locationBadgeTopPct: number;
}

export function buildCutEffectsPlan(
  slideDefs: SlideDef[],
  platform: string | undefined,
  cinematicEffects: boolean
): CutEffectsPlan {
  // fx = was die Plattform erlaubt (TikTok: Punch+Flash, YouTube: Letterbox+Leak...)
  // cutFx[i] = Effekt am Cut VOR Slide i (Cut 0 = Übergang Hook→Slide 0)
  // matchCutMap = Slide-Paare mit durchgehender Zoom-Bewegung über den Schnitt
  const fx = cinematicEffects
    ? getPlatformEffects(platform)
    : { zoomPunchScale: 0, whipPan: false, flashColor: '', lightLeaks: false, letterboxPct: 0, matchCutZoom: false } as PlatformEffects;
  const cutFx = slideDefs.map((_, i) => (cinematicEffects ? pickCutEffect(i, platform) : 'none'));
  const matchCutMap = fx.matchCutZoom ? buildMatchCutMap(slideDefs) : {};
  // WhipPan-Richtung pro Cut (deterministisch alternierend)
  const whipDir = (i: number): 'left' | 'right' => (i % 2 === 0 ? 'left' : 'right');

  // LocationBadge Top-Offset: unterhalb Letterbox-Balken (Reels 6% /
  // YouTube 8%) + Sicherheitsabstand, damit das Badge NIE mit dem
  // Cinematic-Letterbox oder der Hook-Titel-Zone kollidiert. TikTok hat
  // keine Letterbox → Standard-Abstand von der oberen Videokante.
  const locationBadgeTopPct = fx.letterboxPct > 0 ? fx.letterboxPct + 5 : 10;

  return { fx, cutFx, matchCutMap, whipDir, locationBadgeTopPct };
}
