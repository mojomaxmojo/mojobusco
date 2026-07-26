import React from 'react';
import { Sequence, useVideoConfig } from 'remotion';

import { PerSlideCaption } from '../components/Captions';
import { CinematicLetterbox } from '../components/CinematicEffects';
import { CINEMATIC_LETTERBOX_ENTER_SEC, CINEMATIC_LETTERBOX_EXIT_SEC } from '../config/renderConfig';
import type { SlideDef } from '../slidePlan';

interface LongformLayerProps {
  children: React.ReactNode;
  platform: string;
  accentColor: string;
  hookFrames: number;
  ctaFrames: number;
  slideshowFrames: number;
  hasCaptions: boolean;
  captions: string[];
  captionStyle: string;
  totalSlideCount: number;
  routeVisualIndex: number;
  showRouteMap: boolean;
  slideDefs: SlideDef[];
  fx: { letterboxPct: number };
}

export const LongformLayer: React.FC<LongformLayerProps> = (props) => {
  const {
    children,
    platform,
    accentColor,
    hookFrames,
    ctaFrames,
    slideshowFrames,
    hasCaptions,
    captions,
    captionStyle,
    totalSlideCount,
    routeVisualIndex,
    showRouteMap,
    slideDefs,
    fx,
  } = props;

  const { fps } = useVideoConfig();

  return (
    <>
      {children}

      {fx.letterboxPct > 0 && (
        <CinematicLetterbox
          barPct={fx.letterboxPct}
          enterFrames={Math.round(fps * CINEMATIC_LETTERBOX_ENTER_SEC)}
          exitStartFrame={hookFrames + slideshowFrames}
          exitFrames={Math.round(fps * CINEMATIC_LETTERBOX_EXIT_SEC)}
        />
      )}

      {hasCaptions && (
        <PerSlideCaption
          captions={(() => {
            if (captions.length === totalSlideCount) return captions;
            const c = [...captions];
            if (showRouteMap) c.splice(routeVisualIndex, 0, '');
            return c;
          })()}
          slidesStartFrame={hookFrames}
          slidesFrames={slideDefs.map(d => d.frames)}
          style={captionStyle as 'tiktok' | 'chunked' | 'full-line'}
          accentColor={accentColor}
          platform={platform}
        />
      )}
    </>
  );
};
