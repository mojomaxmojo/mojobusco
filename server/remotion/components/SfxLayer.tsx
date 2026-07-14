/**
 * SfxLayer.tsx – Sound-SFX-Layer (Whoosh/Ding/Impact auf Cuts)
 *
 * Rendert pro Cue eine kurze <Sequence> mit <Audio> für One-Shot-Sounds.
 * Kein Loop, keine Fade-Logik nötig – reine Trigger-Effekte auf Bildschnitten.
 *
 * Nutzung: buildSfxCues() erzeugt das Mapping cutFx[] → SfxCue[].
 * SfxLayer rendert daraus die Audio-Sequenzen.
 */
import React from 'react';
import { Sequence, Audio } from 'remotion';

export type SfxType = 'whoosh' | 'ding' | 'impact';

export interface SfxCue {
  cutFrame: number;
  type: SfxType;
}

/**
 * Mappt cutFx-Effekte auf SFX-Typen:
 *   'flash' → 'ding'
 *   'whip'  → 'whoosh'
 *   'leak'  → 'impact'
 *   'none'  → kein Cue
 */
const CUT_TO_SFX: Record<string, SfxType | null> = {
  flash: 'ding',
  whip: 'whoosh',
  leak: 'impact',
  none: null,
};

/**
 * Baut aus dem cutFx-Array und den Slide-Start-Frames ein Array von SfxCues.
 * Nur Cuts mit einem nicht-leeren Effekt (flash/whip/leak) erzeugen einen Cue.
 */
export function buildSfxCues(
  cutFx: string[],
  slideStartFrames: number[]
): SfxCue[] {
  const cues: SfxCue[] = [];
  for (let i = 0; i < cutFx.length; i++) {
    const type = CUT_TO_SFX[cutFx[i]];
    if (type && slideStartFrames[i] !== undefined) {
      cues.push({ cutFrame: slideStartFrames[i], type });
    }
  }
  return cues;
}

/**
 * SfxLayer – rendert pro SfxCue eine kurze Audio-Sequence.
 *
 * Props:
 *   cues     – Array von SfxCue (erzeugt von buildSfxCues)
 *   sfxUrls  – Record, das Typ → URL mappt (z.B. { whoosh: 'http://.../sfx-whoosh.wav' })
 *   volume   – Lautstärke 0-1 (Default: 0.5)
 */
export const SfxLayer: React.FC<{
  cues: SfxCue[];
  sfxUrls: Record<string, string>;
  volume?: number;
}> = ({ cues, sfxUrls, volume = 0.5 }) => {
  return (
    <>
      {cues.map((cue, i) => {
        const url = sfxUrls[cue.type];
        if (!url) return null;
        return (
          <Sequence
            key={`sfx-${i}`}
            from={cue.cutFrame}
            durationInFrames={3}
          >
            <Audio src={url} volume={volume} />
          </Sequence>
        );
      })}
    </>
  );
};