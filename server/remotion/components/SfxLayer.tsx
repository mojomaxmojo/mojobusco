/**
 * SfxLayer — Sound-SFX auf Cut-Punkten (Whoosh / Ding / Impact)
 *
 * Rein additiver Zusatz-Layer, gated hinter sfxEnabled (Default: false in
 * MojoBusVideo.tsx). Analog zum StickerPop-Layer (Schritt 3): iteriert über
 * die bestehenden Cut-Effekte (cutFx) und legt bei passendem Effekt-Typ
 * einen kurzen One-Shot-Sound auf denselben Cut-Frame.
 *
 * Kein Loop, keine Fade-Logik nötig — die WAV-Dateien selbst enden bereits
 * mit einem Fade-out (siehe sfx.js).
 */

import React from 'react';
import { Audio, Sequence, useVideoConfig } from 'remotion';

// ══════════════════════════════════════════════════════════════════════════
// SFX-CUE MAPPING (reine Funktion, kein Seiteneffekt)
// ══════════════════════════════════════════════════════════════════════════

export interface SfxCue {
  cutFrame: number;
  type: 'whoosh' | 'ding' | 'impact';
}

/**
 * Mappt die bestehenden Cut-Effekte (cutFx aus CinematicEffects.tsx) auf
 * einen passenden SFX-Typ:
 *  - 'flash' → 'ding'    (kurzer, heller Effekt)
 *  - 'whip'  → 'whoosh'  (Kamera-Schwenk-Charakter)
 *  - 'leak'  → 'impact'  (Licht-Leak = wuchtigerer Cut)
 *  - 'none'  → kein Cue
 *
 * @param cutFx            – ein Effekt-Typ pro Cut-Index (wie in MojoBusVideo.tsx)
 * @param slideStartFrames – der Start-Frame pro Cut-Index (slideStartFrame(i))
 */
export function buildSfxCues(cutFx: string[], slideStartFrames: number[]): SfxCue[] {
  const cues: SfxCue[] = [];
  for (let i = 0; i < cutFx.length; i++) {
    const cutFrame = slideStartFrames[i];
    if (cutFrame == null) continue;

    if (cutFx[i] === 'flash') {
      cues.push({ cutFrame, type: 'ding' });
    } else if (cutFx[i] === 'whip') {
      cues.push({ cutFrame, type: 'whoosh' });
    } else if (cutFx[i] === 'leak') {
      cues.push({ cutFrame, type: 'impact' });
    }
    // 'none' → kein Cue
  }
  return cues;
}

// ══════════════════════════════════════════════════════════════════════════
// SFX-LAYER — rendert pro Cue eine kurze One-Shot-Audio-Sequence
// ══════════════════════════════════════════════════════════════════════════

// Dauer je SFX-Typ in Sekunden (identisch zu SFX_FILTERS in sfx.js)
const SFX_DURATION_SEC: Record<SfxCue['type'], number> = {
  whoosh: 0.5,
  ding: 0.4,
  impact: 0.3,
};

interface SfxLayerProps {
  cues: SfxCue[];
  sfxUrls: Record<string, string>;
  volume?: number;
}

export const SfxLayer: React.FC<SfxLayerProps> = ({ cues, sfxUrls, volume = 0.5 }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {cues.map((cue, i) => {
        const src = sfxUrls[cue.type];
        if (!src) return null;
        const durationInFrames = Math.max(1, Math.round(SFX_DURATION_SEC[cue.type] * fps));
        return (
          <Sequence
            key={`sfx-${i}`}
            from={cue.cutFrame}
            durationInFrames={durationInFrames}
          >
            <Audio src={src} volume={volume} />
          </Sequence>
        );
      })}
    </>
  );
};
