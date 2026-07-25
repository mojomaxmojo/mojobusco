import React from 'react';
import { Sequence } from 'remotion';
import { MediaRenderer } from './MediaRenderer';
import { FadeIn, FadeOut } from './CrossFade';
import { PhotoDumpLayout } from './PhotoDumpLayout';
import { TransitionWrapper, CardFlipTransition } from './TransitionSlideshow';
import { RouteMapLine, type RouteCoord } from './RouteMapLine';
import {
  ZoomPunchWrapper,
  WhipPanWrapper,
  MatchCutZoomWrapper,
  type PlatformEffects,
} from './CinematicEffects';
import type { SlideDef } from '../slidePlan';
import type { ColorGrade } from './ColorGradeOverlay';

interface SlideshowLayerProps {
  images: string[];
  slideDefs: SlideDef[];
  slideStartFrame: (idx: number) => number;
  transitionType?: string;
  fx: PlatformEffects;
  cutFx: string[];
  matchCutMap: Record<number, { from: number; to: number }>;
  whipDir: (i: number) => 'left' | 'right';
  heroWordWindows: { slideIndex: number; startFrame: number; endFrame: number }[];
  previousImageUrls: (string | null)[];
  effectiveRouteCoords: RouteCoord[];
  mapImageUrl?: string;
  accentColor?: string;
  keepOriginalAudio?: boolean;
  speedRampEnabled?: boolean;
  platform?: string;
  hookFrames: number;
  slideshowFrames: number;
  ctaFrames: number;
  transitionFrames: number;
  grade?: ColorGrade;
}

export const SlideshowLayer: React.FC<SlideshowLayerProps> = ({
  images,
  slideDefs,
  slideStartFrame,
  transitionType = 'auto',
  fx,
  cutFx,
  matchCutMap,
  whipDir,
  heroWordWindows,
  previousImageUrls,
  effectiveRouteCoords,
  mapImageUrl,
  accentColor = '#F59E0B',
  keepOriginalAudio = false,
  speedRampEnabled = false,
  platform,
  hookFrames,
  slideshowFrames,
  ctaFrames,
  transitionFrames,
}) => {
  const imageCount = images.length;
  const totalSlides = slideDefs.length;

  return (
    <>
      {/* HOOK — erstes Bild, blendet am Ende aus */}
      {images[0] && (
        <Sequence from={0} durationInFrames={hookFrames + transitionFrames}>
          <FadeOut
            durationFrames={transitionFrames}
            totalFrames={hookFrames + transitionFrames}
          >
            <MediaRenderer src={images[0]} index={0} />
          </FadeOut>
        </Sequence>
      )}

      {/* SLIDESHOW — alle Slides (Bilder + ggf. Routen-Karte dazwischen) */}
      {slideDefs.map((def, i) => {
        const isLastSlide = i === totalSlides - 1;
        const isRoute = def.type === 'route';
        const absoluteStart = slideStartFrame(i);
        const thisSlideFrames = def.frames;
        const seqDuration = isLastSlide ? thisSlideFrames : thisSlideFrames + transitionFrames;
        const nextDef = !isLastSlide ? slideDefs[i + 1] : undefined;

        // ── Cinematic Effects für diesen Slide ─────────────────────────
        // Cut i = Übergang IN Slide i. WhipPan verbindet beide Seiten:
        //   Slide i-1 reißt raus (whipOut, cutFx[i]), Slide i reißt rein (whipIn).
        // Zoom-Punch nur wenn KEIN Whip auf dem Cut liegt (sonst doppelt).
        // WhipIn nicht auf Cut 0 (Hook blendet weich aus – halber Whip sähe kaputt aus)
        // und nicht nach einer Route-Slide (Karte whippt nicht raus → inkonsistent)
        const prevDef = i > 0 ? slideDefs[i - 1] : undefined;
        const hasWhipIn  = !isRoute && i > 0 && cutFx[i] === 'whip' && prevDef?.type !== 'route';
        // Kein WhipOut in eine Route-Slide hinein (Karte whippt nicht rein → inkonsistent)
        const hasWhipOut = !isRoute && !isLastSlide && cutFx[i + 1] === 'whip' && nextDef?.type !== 'route';
        const cutPunchHere = !isRoute && fx.zoomPunchScale > 0 && cutFx[i] !== 'whip' && i > 0;
        const heroWindow = heroWordWindows.find(w => w.slideIndex === i);
        const punchHere  = cutPunchHere || !!heroWindow;
        // Trigger-Frame für den Punch (lokal zur Sequence, die bei
        // absoluteStart beginnt): Ein ZoomPunchWrapper kann nur EINEN
        // Zeitpunkt bedienen. Liegt auf diesem Slide ein Hero-Wort-Fenster
        // vor, hat es IMMER Vorrang vor dem normalen Cut-Punch (der sonst
        // bei triggerFrame=0 feuern würde und auf TikTok fast immer aktiv
        // ist) – sonst würde der explizit gewünschte Hook-Wort-Zoom auf
        // den meisten Slides nie sichtbar werden. Ohne Hero-Fenster bleibt
        // das bestehende Cut-Punch-Verhalten (triggerFrame=0) unverändert.
        const punchTriggerFrame = heroWindow
          ? Math.max(0, heroWindow.startFrame - absoluteStart)
          : 0;
        const matchCut   = !isRoute ? matchCutMap[i] : undefined;

        // Effekt-Kette (innen → außen): Media → MatchCut → Punch → Whip → FadeOut
        let slideContent: React.ReactNode = !isRoute ? (
          def.imageIndices.length === 1 && (!def.layout || def.layout === 'single') ? (
            <MediaRenderer src={images[def.imageIndices[0]]} index={def.imageIndices[0] + 1} allowAudio={keepOriginalAudio} speedRamp={speedRampEnabled} slideFrames={thisSlideFrames} />
          ) : (
            <PhotoDumpLayout
              images={def.imageIndices.map(idx => images[idx])}
              layout={def.layout || 'single'}
              slideIndex={i}
            />
          )
        ) : null;
        if (matchCut) {
          slideContent = (
            <MatchCutZoomWrapper from={matchCut.from} to={matchCut.to}>
              {slideContent}
            </MatchCutZoomWrapper>
          );
        }
        if (punchHere) {
          // Hero-Wort-Punch nutzt eine feste, moderate Stärke (0.08, siehe
          // FEATURE-PLAN.md Schritt 5), unabhängig von der Plattform-Matrix
          // (die für diesen Slide ggf. 0 liefert, z.B. YouTube) und hat
          // Vorrang vor dem Cut-Punch-Wert (siehe punchTriggerFrame oben).
          // Ohne Hero-Fenster bleibt der normale Cut-Punch bei fx.zoomPunchScale.
          const punchScaleHere = heroWindow ? 0.08 : fx.zoomPunchScale;
          slideContent = (
            <ZoomPunchWrapper punchScale={punchScaleHere} triggerFrame={punchTriggerFrame}>
              {slideContent}
            </ZoomPunchWrapper>
          );
        }
        if (hasWhipIn || hasWhipOut) {
          slideContent = (
            <WhipPanWrapper
              whipIn={hasWhipIn}
              whipOut={hasWhipOut}
              direction={hasWhipIn ? whipDir(i) : whipDir(i + 1)}
              // WICHTIG: thisSlideFrames (nicht seqDuration) – der WhipOut muss
              // AM CUT enden. seqDuration läuft transitionFrames darüber hinaus,
              // dann würde der Raus-Schwenk erst NACH dem Rein-Schwenk des
              // nächsten Slides laufen → kein durchgehender Kameraschwenk.
              totalFrames={thisSlideFrames}
            >
              {slideContent}
            </WhipPanWrapper>
          );
        }

        return (
          <Sequence key={`slide-${i}`} from={absoluteStart} durationInFrames={seqDuration}>
            {isRoute ? (
              <RouteMapLine
                coords={effectiveRouteCoords}
                mapImageUrl={mapImageUrl}
                color="#FFFFFF"
                accentColor={accentColor}
                strokeWidth={4}
                animType="both"
                showLabels={true}
                showBusMarker={true}
                overlayOpacity={mapImageUrl ? 0.4 : 0}
              />
            ) : transitionType === 'cardFlip' ? (
              isLastSlide ? (
                <CardFlipTransition
                  durationFrames={transitionFrames}
                  direction={i % 2 === 0 ? 'right' : 'left'}
                  previousChildren={previousImageUrls[i] ? <MediaRenderer src={previousImageUrls[i]} index={-1} /> : slideContent}
                >
                  {slideContent}
                </CardFlipTransition>
              ) : (
                <FadeOut
                  durationFrames={transitionFrames}
                  totalFrames={seqDuration}
                >
                  <CardFlipTransition
                    durationFrames={transitionFrames}
                    direction={i % 2 === 0 ? 'right' : 'left'}
                    previousChildren={previousImageUrls[i] ? <MediaRenderer src={previousImageUrls[i]} index={-1} /> : slideContent}
                  >
                    {slideContent}
                  </CardFlipTransition>
                </FadeOut>
              )
            ) : isLastSlide ? (
              transitionType === 'busWipe' ? (
                slideContent
              ) : (
                <TransitionWrapper
                  type={transitionType}
                  durationFrames={transitionFrames}
                  imageIndex={i}
                >
                  {slideContent}
                </TransitionWrapper>
              )
            ) : transitionType === 'busWipe' ? (
              <TransitionWrapper
                type={transitionType}
                durationFrames={transitionFrames}
                imageIndex={i}
              >
                {slideContent}
              </TransitionWrapper>
            ) : (
              <FadeOut
                durationFrames={transitionFrames}
                totalFrames={seqDuration}
              >
                <TransitionWrapper
                  type={transitionType}
                  durationFrames={transitionFrames}
                  imageIndex={i}
                >
                  {slideContent}
                </TransitionWrapper>
              </FadeOut>
            )}
          </Sequence>
        );
      })}

      {/* CTA Hintergrund — letztes Bild, sehr langsamer Zoom */}
      {images[imageCount - 1] && (
        <Sequence from={hookFrames + slideshowFrames} durationInFrames={ctaFrames}>
          <FadeIn durationFrames={20}>
            <MediaRenderer src={images[imageCount - 1]} index={imageCount + 1} />
          </FadeIn>
        </Sequence>
      )}
    </>
  );
};
