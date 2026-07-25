import React from 'react';
import { Sequence, useVideoConfig } from 'remotion';
import {
  FlashCut,
  flashCutDuration,
  LightLeak,
  lightLeakDuration,
  type PlatformEffects,
} from './CinematicEffects';
import { StickerPop, stickerPopDuration, pickStickerForCut } from './StickerPops';
import { buildSfxCues, SfxLayer } from './SfxLayer';
import { SFX_VOLUME } from '../config/renderConfig';
import type { SlideDef } from '../slidePlan';

interface CutEffectsLayerProps {
  cutFx: string[];
  slideDefs: SlideDef[];
  fx: PlatformEffects;
  slideStartFrame: (idx: number) => number;
  transitionType?: string;
  stickersEnabled?: boolean;
  sfxEnabled?: boolean;
  sfxUrls?: Record<string, string>;
}

export const CutEffectsLayer: React.FC<CutEffectsLayerProps> = ({
  cutFx,
  slideDefs,
  fx,
  slideStartFrame,
  transitionType,
  stickersEnabled = false,
  sfxEnabled = false,
  sfxUrls,
}) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {/* ══ NEU SCHICHT 13: FlashCut + LightLeak auf den Cuts ═══════════════
           FlashCut: 2 Frames Blitz AUF dem Cut-Frame (weiß TikTok / schwarz YouTube)
           LightLeak: ~1s Overlay, Peak liegt AUF dem Cut (startet 0.5s davor)
           Beide über ColorGrade + Captions – wie echtes Licht in der Linse. */}
      {slideDefs.map((_, i) => {
        const effect = cutFx[i];
        if (effect !== 'flash' && effect !== 'leak') return null;
        const cutFrame = slideStartFrame(i);

        if (effect === 'flash' && fx.flashColor) {
          return (
            <Sequence
              key={`cutfx-${i}`}
              from={cutFrame}
              durationInFrames={flashCutDuration(fps)}
            >
              <FlashCut color={fx.flashColor} />
            </Sequence>
          );
        }
        if (effect === 'leak' && fx.lightLeaks) {
          const leakDur = lightLeakDuration(fps);
          return (
            <Sequence
              key={`cutfx-${i}`}
              from={Math.max(0, cutFrame - Math.round(leakDur / 2))}
              durationInFrames={leakDur}
            >
              <LightLeak seed={i} />
            </Sequence>
          );
        }
        return null;
      })}

      {/* ══ NEU SCHICHT 14: Sticker/Emoji-Pops an Cut-Punkten (Beta) ═══════════
           Rein additiv, gated hinter stickersEnabled (Default: false).
           Poppt auf denselben Cut-Frames wie FlashCut/LightLeak, aber nur
           bei Cuts mit einem aktiven Effekt (cutFx[i] !== 'none'). */}
      {stickersEnabled && slideDefs.map((_, i) => {
        if (cutFx[i] === 'none') return null;
        const cutFrame = slideStartFrame(i);
        return (
          <Sequence
            key={`sticker-${i}`}
            from={cutFrame}
            durationInFrames={stickerPopDuration(fps)}
          >
            <StickerPop emoji={pickStickerForCut(i)} />
          </Sequence>
        );
      })}

      {/* ══ NEU SCHICHT 15: Sound-SFX (Whoosh/Ding/Impact) auf Cuts (Beta) ═════
           Rein additiv, gated hinter sfxEnabled (Default: false). Nutzt
           dieselben Cut-Frames wie FlashCut/LightLeak/StickerPop. */}
      {sfxEnabled && sfxUrls && (
        <SfxLayer
          cues={buildSfxCues(cutFx, slideDefs.map((_, i) => slideStartFrame(i)), transitionType)}
          sfxUrls={sfxUrls}
          volume={SFX_VOLUME}
        />
      )}
    </>
  );
};
