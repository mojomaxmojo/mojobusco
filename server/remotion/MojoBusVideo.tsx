/**
 * MojoBusVideo — Haupt-Remotion Composition (v2.0)
 *
 * NEU in v2.0:
 *  ✅ BeatSyncLayer    — Schnitte synchron zur Musik (viral!) via useAudioData
 *  ✅ TransitionWrapper — wipe, clockWipe, irisWipe, starWipe, heartWipe,
 *                          fade, slide, morph, zoomRelay, glitch, pagePeel
 *  ✅ RouteMapLine      — Animierte Routen-Linie auf Karte (@remotion/shapes)
 *  ✅ LottieBusIcon     — Animierter MojoBus in der Endkarte (@remotion/lottie)
 *
 * Transition-Logik:
 *  Jede Sequence läuft: [startFrame ... startFrame + perSlide]
 *  Das NÄCHSTE Bild startet TRANSITION_FRAMES vor Ende des aktuellen.
 *  → Überlappung = smooth Transition ohne Lücken oder Doppelframes.
 *  Jeder Slide bekommt einen Incoming-TransitionWrapper (z. B. iris/star/heart),
 *  der ausgehende Slide blendet zusätzlich per FadeOut aus.
 */

import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';

import { ColorGradeOverlay, ColorGradeWrapper, lifestyleToGrade, type ColorGrade } from './components/ColorGradeOverlay';
import { HookTitle } from './components/HookTitle';
import { LocationBadge } from './components/LocationBadge';
import { MojoBusCTA } from './components/MojoBusCTA';
import { ProgressBar } from './components/ProgressBar';
import { AudioLayer } from './components/AudioLayer';
import { FadeIn, FadeOut } from './components/CrossFade';
import { StoryCaption } from './components/StoryCaption';
import {
  PerSlideCaption
} from './components/Captions';
import { LoadFonts } from './components/Fonts';
import { HookDimOverlay } from './components/HookDimOverlay';
import { MediaRenderer, isVideo } from './components/MediaRenderer';
import { getHookSeconds } from './duration';
import { PhotoDumpLayout } from './components/PhotoDumpLayout';
import { groupImagesIntoSlides, findRouteSlideIndex } from './slideLayouts';
export { calculateDuration } from './duration';

// ── NEU: 4 neue Skills ────────────────────────────────────────────────────
import {
  BeatSyncLayer,
  AudioWaveformBar,
  generateFallbackBeats,
} from './components/BeatSyncLayer';
import { TransitionWrapper, CardFlipTransition } from './components/TransitionSlideshow';
import { BeatVelocityPunch } from './components/BeatVelocityPunch';
import {
  RouteMapLine,
  pickDemoRoute
} from './components/RouteMapLine';
import { LottieBusIcon } from './components/LottieBusIcon';

// ── NEU: Cinematic Effects (Zoom-Punch, WhipPan, FlashCut, LightLeak,
//         Letterbox, Match-Cut-Zoom) + Plattform-Matrix ──────────────────
import {
  getPlatformEffects,
  pickCutEffect,
  buildMatchCutMap,
  ZoomPunchWrapper,
  WhipPanWrapper,
  FlashCut,
  flashCutDuration,
  LightLeak,
  lightLeakDuration,
  CinematicLetterbox,
  MatchCutZoomWrapper,
} from './components/CinematicEffects';
import { pickStickerForCut, StickerPop, stickerPopDuration } from './components/StickerPops';
import { buildSfxCues, SfxLayer } from './components/SfxLayer';
import { findHeroWordWindow } from './components/CaptionHeroWord';

import { MojoBusVideoProps } from './videoProps';
export { MojoBusVideoProps } from './videoProps';

// ── Haupt-Komponent ────────────────────────────────────────────────────────

export const MojoBusVideo: React.FC<MojoBusVideoProps> = ({
  imageUrls,
  title,
  summary,
  location,
  country,
  lifestyle = 'mojobus',
  musicUrl,
  secondsPerImage = 5,
  colorGrade,
  captions = [],
  captionStyle = 'full-line',
  platform = 'tiktok',
  websiteUrl = 'mojobus.co',
  handle = '@mojobus',
  accentColor = '#F59E0B',
  motionBlurStrength = 1,

  // Beat-Sync
  beatSyncStrength = 0.6,
  beatThreshold = 0.60,
  showWaveformBar = false,

  // Beat-Sync Velocity Punch
  beatVelocityPunch = false,

  // Transitions
  transitionType = 'auto',

  // Route
  showRouteMap = false,
  routeCoords,
  mapImageUrl,

  // Lottie Bus
  showLottieBus = true,

  // Cinematic Effects
  cinematicEffects = true,

  // Sticker-Pops
  stickersEnabled = false,

  // Sound-SFX
  sfxEnabled = false,
  sfxUrls,

  // Speed-Ramping
  speedRampEnabled = false,

  // Photo-Dump Layouts
  slideLayouts,

}) => {
  const { fps, durationInFrames } = useVideoConfig();

  const grade      = colorGrade || lifestyleToGrade(lifestyle);
  const images     = imageUrls.slice(0, 20);
  const imageCount = images.length;

  // ── Slides: layout-aware Gruppierung + extra Routen-Slide ─────────────
  // Bilder werden anhand slideLayouts in Gruppen aufgeteilt. Der Routen-Slide
  // wird als EXTRA Slide eingefügt und ersetzt kein Bild.
  const baseGroups = groupImagesIntoSlides(images, slideLayouts ?? []);
  const baseSlideCount = baseGroups.length;

  const hasRouteMap = showRouteMap && images.length >= 2;
  const routeVisualIndex = hasRouteMap ? findRouteSlideIndex(baseGroups) : -1;
  const totalSlideCount = baseSlideCount + (hasRouteMap ? 1 : 0);

  // Dynamische perSlide: perSlideArray vom Server (inkl. RouteMap), sonst fix
  const slidesSec = perSlideArray && perSlideArray.length === totalSlideCount
    ? perSlideArray
    : new Array(totalSlideCount).fill(secondsPerImage);
  const slidesFrames = slidesSec.map(s => Math.round(s * fps));

  const hookFrames = getHookSeconds(platform) * fps;
  const ctaFrames  = 6 * fps;

  // Route-Dauer aus slidesFrames (enthält bereits RouteMap an routeVisualIndex)
  const routeDurFrames = hasRouteMap
    ? (slidesFrames[routeVisualIndex] || Math.round(secondsPerImage * fps))
    : 0;

  // Slide-Definitionen: jeder Eintrag kann ein oder mehrere Bilder enthalten
  interface SlideDef {
    type: 'image' | 'route';
    imageIndices: number[];
    frames: number;
    layout?: import('./videoProps').SlideLayout;
  }

  const slideDefs: SlideDef[] = [];
  let framesIdx = 0;
  baseGroups.forEach((group, groupIdx) => {
    if (hasRouteMap && groupIdx === routeVisualIndex) {
      slideDefs.push({ type: 'route', imageIndices: [], frames: slidesFrames[framesIdx] ?? Math.round(secondsPerImage * fps) });
      framesIdx++;
    }
    slideDefs.push({
      type: 'image',
      imageIndices: group.imageIndices,
      frames: slidesFrames[framesIdx] ?? Math.round(secondsPerImage * fps),
      layout: group.layout,
    });
    framesIdx++;
  });
  if (hasRouteMap && routeVisualIndex >= baseGroups.length) {
    slideDefs.push({ type: 'route', imageIndices: [], frames: slidesFrames[framesIdx] ?? Math.round(secondsPerImage * fps) });
  }

  const totalSlides = slideDefs.length;
  const slideshowFrames = slideDefs.reduce((sum, s) => sum + s.frames, 0); // inkl. RouteMap

  const slideStartFrame = (idx: number) =>
    hookFrames + slideDefs.slice(0, idx).reduce((sum, s) => sum + s.frames, 0);

  // perSlide für Legacy
  const perSlide = Math.round((perSlideArray?.[0] || secondsPerImage) * fps);

  // ── Transition: 20 Frames (0.67s bei 30fps) — sanftes Überblenden
  const TRANSITION_FRAMES = Math.round(fps * 0.67); // ~20 Frames @ 30fps

  // Emoji standardmäßig AUS – roher Foster-Look. Das Bild + der Text sind der Hook,
  // ein Emoji darüber wirkt wie Template-Content und bricht die Authentizität.
  const hookEmoji = '';

  const hasCaptions = captionStyle !== 'off' && captions.length > 0;

  // ── Beat-Sync: Fallback-Beats vorberechnen ────────────────────────────
  const fallbackBeats = generateFallbackBeats(
    durationInFrames,
    fps,
    secondsPerImage,
    imageCount,
    hookFrames
  );

  // ── Routen-Koordinaten ────────────────────────────────────────────────
  const effectiveRouteCoords = routeCoords && routeCoords.length >= 2
    ? routeCoords
    : pickDemoRoute(country, location);

  // ── Cinematic Effects: Plattform-Matrix + Cut-Plan ─────────────────────
  // fx = was die Plattform erlaubt (TikTok: Punch+Flash, YouTube: Letterbox+Leak...)
  // cutFx[i] = Effekt am Cut VOR Slide i (Cut 0 = Übergang Hook→Slide 0)
  // matchCutMap = Slide-Paare mit durchgehender Zoom-Bewegung über den Schnitt
  const fx = cinematicEffects
    ? getPlatformEffects(platform)
    : { zoomPunchScale: 0, whipPan: false, flashColor: '', lightLeaks: false, letterboxPct: 0, matchCutZoom: false };
  const cutFx = slideDefs.map((_, i) => (cinematicEffects ? pickCutEffect(i, platform) : 'none'));
  const matchCutMap = fx.matchCutZoom ? buildMatchCutMap(slideDefs) : {};
  // WhipPan-Richtung pro Cut (deterministisch alternierend)
  const whipDir = (i: number): 'left' | 'right' => (i % 2 === 0 ? 'left' : 'right');

  // ── LocationBadge Top-Offset: unterhalb Letterbox-Balken (Reels 6% /
  // YouTube 8%) + Sicherheitsabstand, damit das Badge NIE mit dem
  // Cinematic-Letterbox oder der Hook-Titel-Zone kollidiert. TikTok hat
  // keine Letterbox → Standard-Abstand von der oberen Videokante.
  const locationBadgeTopPct = fx.letterboxPct > 0 ? fx.letterboxPct + 5 : 10;

  // ── Duck-Fenster für Musik/Atmo während Video-Slides ─────────────────
  // Nur aktiv wenn keepOriginalAudio=true: Für jeden Slide, der ein
  // Video-Clip ist, wird ein Duck-Fenster berechnet, in dem Musik und
  // Atmo auf 0 ausblenden. Hook-Vorschau (images[0]) und CTA-Hintergrund
  // (images[last]) werden NICHT geduckt — deren MediaRenderer-Aufrufe
  // bleiben stumm (kein allowAudio).
  const videoDuckWindows = keepOriginalAudio
    ? slideDefs
        .filter((d): d is typeof d & { type: 'image' } => d.type === 'image' && isVideo(images[d.imageIndices[0]]))
        .map((d) => {
          const sf = slideStartFrame(slideDefs.indexOf(d));
          return { startFrame: sf, endFrame: sf + d.frames };
        })
    : [];

  // ── Hook-Wort-Zoom: Fenster des per **...** markierten Wortes pro Slide ─
  // Reine Berechnung (keine Wirkung ohne den erweiterten punchHere-Check
  // unten in der Slideshow-Schleife). Nur Bild-Slides mit vorhandener
  // Caption werden geprüft; Route-Slides und fehlende Captions liefern null.
  const heroWordWindows = slideDefs
    .map((def, i) => {
      if (def.type !== 'image') return null;
      const captionText = captions[i];
      if (!captionText) return null;
      const win = findHeroWordWindow(captionText, slideStartFrame(i), def.frames);
      return win ? { slideIndex: i, ...win } : null;
    })
    .filter((w): w is { slideIndex: number; startFrame: number; endFrame: number } => w !== null);

  // ── Einfaches vorheriges Bild pro Slide (nur für cardFlip-Transition) ──────
  // Index 0 = Hook-Bild, danach das vorhergehende Bild (Route-Slides überspringen).
  const previousImageUrls = slideDefs.map((def, i) => {
    const firstImage = (d: typeof slideDefs[0]) => images[d.imageIndices[0]] || null;
    if (i === 0) {
      const firstImageSlide = slideDefs.find(d => d.type === 'image');
      return firstImageSlide ? firstImage(firstImageSlide) : null;
    }
    for (let j = i - 1; j >= 0; j--) {
      if (slideDefs[j].type === 'image') {
        return firstImage(slideDefs[j]);
      }
    }
    const firstImageSlide = slideDefs.find(d => d.type === 'image');
    return firstImageSlide ? firstImage(firstImageSlide) : null;
  });

  return (
    <AbsoluteFill style={{ background: '#000' }}>

      {/* Fonts */}
      <LoadFonts />

      {/* ══ SCHICHT 1+2: Bilder + Color Grade mit Beat Velocity Punch ═════ */}
      <BeatVelocityPunch
        enabled={beatVelocityPunch}
        musicUrl={musicUrl}
        beatThreshold={beatThreshold}
        strength={beatSyncStrength}
        fallbackBeats={fallbackBeats}
      >
        {/* ══ SCHICHT 1: Bilder mit Ken Burns + Transitions ══════════════════ */}
        <ColorGradeWrapper grade={grade}>

        {/* HOOK — erstes Bild, blendet am Ende aus */}
        {images[0] && (
          <Sequence from={0} durationInFrames={hookFrames + TRANSITION_FRAMES}>
            <FadeOut
              durationFrames={TRANSITION_FRAMES}
              totalFrames={hookFrames + TRANSITION_FRAMES}
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
          const seqDuration = isLastSlide ? thisSlideFrames : thisSlideFrames + TRANSITION_FRAMES;
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
                // AM CUT enden. seqDuration läuft TRANSITION_FRAMES darüber hinaus,
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
                    durationFrames={TRANSITION_FRAMES}
                    direction={i % 2 === 0 ? 'right' : 'left'}
                    previousChildren={previousImageUrls[i] ? <MediaRenderer src={previousImageUrls[i]} index={-1} /> : slideContent}
                  >
                    {slideContent}
                  </CardFlipTransition>
                ) : (
                  <FadeOut
                    durationFrames={TRANSITION_FRAMES}
                    totalFrames={seqDuration}
                  >
                    <CardFlipTransition
                      durationFrames={TRANSITION_FRAMES}
                      direction={i % 2 === 0 ? 'right' : 'left'}
                      previousChildren={previousImageUrls[i] ? <MediaRenderer src={previousImageUrls[i]} index={-1} /> : slideContent}
                    >
                      {slideContent}
                    </CardFlipTransition>
                  </FadeOut>
                )
              ) : isLastSlide ? (
                <TransitionWrapper
                  type={transitionType}
                  durationFrames={TRANSITION_FRAMES}
                  imageIndex={i}
                >
                  {slideContent}
                </TransitionWrapper>
              ) : (
                <FadeOut
                  durationFrames={TRANSITION_FRAMES}
                  totalFrames={seqDuration}
                >
                  <TransitionWrapper
                    type={transitionType}
                    durationFrames={TRANSITION_FRAMES}
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

      </ColorGradeWrapper>

      {/* ══ SCHICHT 2: Color Grade Overlay ══════════════════════════════════ */}
      <ColorGradeOverlay grade={grade} />
      </BeatVelocityPunch>

      {/* ══ SCHICHT 3: Hook Abdunkelung (nur während Hook-Slide) ══════════════
           Gleichmäßiges dunkles Overlay damit der Hook-Text auf jedem Bild
           gut lesbar ist. Opacity 0.40 = Bild bleibt als visueller Hook wirksam,
           Text-Kontrast kommt zusätzlich vom radialen Gradient im HookTitle. */}
      <Sequence from={0} durationInFrames={hookFrames}>
        <HookDimOverlay opacity={0.40} fps={fps} hookFrames={hookFrames} />
      </Sequence>

      {/* ══ SCHICHT 4: Hook Titel (plattformabhängige Dauer) ═══════════════════
           fromFrame=0: Text muss SOFORT lesbar sein – die erste halbe Sekunde
           entscheidet ob der Zuschauer bleibt (Hook-Fenster TikTok: 0,8-1,2s). */}
      <Sequence from={0} durationInFrames={hookFrames}>
        <HookTitle
          title={title}
          subtitle={location || lifestyle.toUpperCase()}
          caption={hookCaption}
          emoji={hookEmoji}
          fromFrame={0}
          toFrame={hookFrames - 5}
          accentColor={accentColor}
        />
      </Sequence>

      {/* ══ SCHICHT 5: Location Badge ════════════════════════════════════════
           Liegt OBEN im Bild (top-left) statt unten – dort überlappt es sich
           NIE mit der PerSlideCaption (liegt bei bottom: 18-25%, je Plattform)
           und bleibt auch bei aktivem Cinematic-Letterbox (Reels/YouTube)
           unterhalb des Balkens gut lesbar. */}
      {location && imageCount >= 2 && (
        <Sequence from={slideStartFrame(1)} durationInFrames={slideDefs.slice(1, 3).reduce((a, b) => a + b.frames, 0) || perSlide * 2}>
          <LocationBadge
            location={location}
            country={country}
            fromFrame={10}
            toFrame={(slidesFrames[1] + slidesFrames[2] || perSlide * 2) - 10}
            position="top-left"
            topOffsetPct={locationBadgeTopPct}
          />
        </Sequence>
      )}

      // ── Auto-Captions ══════════════════════════════════════════
      {/* ══ SCHICHT 6: Per-Slide Captions (dynamisch, synchron) ════════════════ */}
      {hasCaptions && (
        <PerSlideCaption
          captions={(() => {
            // Server liefert captions slide-indiziert (inkl. RouteMap) wenn
            // slideLayouts gesetzt sind, sonst bild-indiziert. Wir normalisieren
            // hier auf die finale Slide-Anzahl inkl. RouteMap.
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

      {/* ══ SCHICHT 7: Summary Subtitle (Mitte, ohne Captions) ═══════════════ */}
      {summary && imageCount >= 3 && !hasCaptions && (
        <Sequence
          from={slideStartFrame(Math.floor(totalSlides / 2))}
          durationInFrames={slidesFrames[Math.floor(totalSlides / 2)] || perSlide}
        >
          <StoryCaption
            text={summary.slice(0, 80)}
            fromFrame={10}
            toFrame={perSlide - 10}
            position="bottom"
            style="subtitle"
            accentColor={accentColor}
          />
        </Sequence>
      )}

      {/* ══ SCHICHT 8: Manuelle Captions (wenn kein AutoCaption) ═════════════ */}
      {!hasCaptions && captions.map((caption, i) => {
        if (!caption) return null;
        const slideDef = slideDefs[i];
        if (!slideDef || slideDef.type === 'route') return null; // Route-Slide überspringen
        const sf = slideStartFrame(i) + Math.round(fps * 0.5);
        const ef = slideStartFrame(i) + (slideDef.frames) - Math.round(fps * 0.5);
        return (
          <StoryCaption
            key={`cap-${i}`}
            text={caption}
            fromFrame={sf}
            toFrame={ef}
            position="bottom"
            style="minimal"
            accentColor={accentColor}
          />
        );
      })}

      {/* ══ SCHICHT 9: CTA Endkarte ══════════════════════════════════════════ */}
      <Sequence from={hookFrames + slideshowFrames} durationInFrames={ctaFrames}>
        <MojoBusCTA
          lifestyle={lifestyle}
          websiteUrl={websiteUrl}
          handle={handle}
          accentColor={accentColor}
          ctaText={ctaText}
        />
      </Sequence>

      {/* ══ NEU SCHICHT 9b: Lottie Bus in CTA ═══════════════════════════════ */}
      {showLottieBus && (
        <Sequence
          from={hookFrames + slideshowFrames + Math.round(fps * 0.3)}
          durationInFrames={ctaFrames}
        >
          <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <LottieBusIcon
              size={175}
              accentColor={accentColor}
              driveIn={true}
              driveInPath="curve-down"
              position="bottom-center"
              platform={platform}
            />
          </AbsoluteFill>
        </Sequence>
      )}

      {/* ══ NEU SCHICHT 9c: Cinematic Letterbox (Reels 6% / YouTube 8%) ══════
           Balken fahren beim Hook rein (1s) und zur CTA raus (0.8s).
           Liegt UNTER der ProgressBar – die Bar bleibt auf dem Balken sichtbar. */}
      {fx.letterboxPct > 0 && (
        <CinematicLetterbox
          barPct={fx.letterboxPct}
          enterFrames={Math.round(fps * 1.0)}
          exitStartFrame={hookFrames + slideshowFrames}
          exitFrames={Math.round(fps * 0.8)}
        />
      )}

      {/* ══ SCHICHT 10: Progress Bar ══════════════════════════════════════════ */}
      <ProgressBar
        color={accentColor}
        height={3}
        position="top"
        startFrame={hookFrames}
        endFrame={hookFrames + slideshowFrames}
      />

      {/* ══ NEU SCHICHT 10b: Waveform Bar (optional) ═════════════════════════ */}
      {showWaveformBar && musicUrl && (
        <Sequence from={hookFrames} durationInFrames={slideshowFrames}>
          <AudioWaveformBar
            musicUrl={musicUrl}
            accentColor={accentColor}
            numberOfBars={48}
            position="bottom"
            height={40}
            opacity={0.45}
          />
        </Sequence>
      )}

      {/* ══ SCHICHT 11: Audio (Musik) ════════════════════════════════════════ */}
      {musicUrl && (
        <AudioLayer
          src={musicUrl}
          volume={0.34}
fadeInSec={0.3}
          duckWindows={videoDuckWindows}
        />
      )}

      {/* ══ SCHICHT 11b: Audio (Voiceover) – startet mit Slideshow, nicht Hook ═══
           Voiceover enthält nur Body-Sätze (kein Hook-Text).
           startFrom=hookFrames: Audio startet synchron mit Slide 0 der Slideshow.
           Hook-Slide (0-4s): kein Voiceover, nur HookTitle-Text auf dem Screen. */}
      {voiceoverUrl && (
        <Sequence from={hookFrames}>
          <AudioLayer
            src={voiceoverUrl}
            volume={voiceoverVolume}
            fadeInSec={0.1}
            fadeOutSec={0.5}
          />
        </Sequence>
      )}

      {/* ══ SCHICHT 11c: Audio (Ambient/Atmo) – leise im Hintergrund ════ */}
      {ambientUrl && (
        <AudioLayer
          src={ambientUrl}
          volume={0.15}
          fadeInSec={0.5}
          fadeOutSec={3}
          duckWindows={videoDuckWindows}
        />
      )}

      {/* ══ NEU SCHICHT 12: Beat-Sync Flash Effekt ═══════════════════════════ */}
      {beatSyncStrength > 0 && (
        <Sequence from={hookFrames} durationInFrames={slideshowFrames}>
          <BeatSyncLayer
            musicUrl={musicUrl}
            beatThreshold={beatThreshold}
            accentColor={accentColor}
            flashOpacity={0.15}
            strength={beatSyncStrength}
            fallbackBeats={fallbackBeats}
          />
        </Sequence>
      )}

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
          cues={buildSfxCues(cutFx, slideDefs.map((_, i) => slideStartFrame(i)))}
          sfxUrls={sfxUrls}
          volume={0.5}
        />
      )}

    </AbsoluteFill>
  );
};
