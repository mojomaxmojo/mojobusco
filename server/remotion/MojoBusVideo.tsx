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

import { ColorGradeOverlay, ColorGradeWrapper, lifestyleToGrade } from './components/ColorGradeOverlay';
import { HookTitle } from './components/HookTitle';
import { LocationBadge } from './components/LocationBadge';
import { MojoBusCTA } from './components/MojoBusCTA';
import { ProgressBar } from './components/ProgressBar';
import { StoryCaption } from './components/StoryCaption';
import { LoadFonts } from './components/Fonts';
import { HookDimOverlay } from './components/HookDimOverlay';
import { isVideo } from './components/MediaRenderer';
import { getHookSeconds } from './duration';
import { buildSlidePlan } from './slidePlan';
import { buildCutEffectsPlan } from './cutEffectsPlan';
import { buildHeroWordWindows, buildPreviousImageUrls } from './slideHelpers';
import { AudioStack } from './components/AudioStack';
import { CutEffectsLayer } from './components/CutEffectsLayer';
import { SlideshowLayer } from './components/SlideshowLayer';
export { calculateDuration } from './duration';

import {
  generateFallbackBeats,
  useBeats,
} from './components/BeatSyncLayer';
import { pickDemoRoute } from './components/RouteMapLine';

import {
  TRANSITION_DURATION_SEC,
  CTA_DURATION_SEC,
  HOOK_EMOJI,
  HOOK_DIM_OPACITY,
  PROGRESS_BAR_HEIGHT,
} from './config/renderConfig';

import { MojoBusVideoProps } from './videoProps';
export { MojoBusVideoProps } from './videoProps';

import { ShortsLayer } from './flows/ShortsLayer';
import { LongformLayer } from './flows/LongformLayer';

// ── Haupt-Komponent ────────────────────────────────────────────────────────────

export const MojoBusVideo: React.FC<MojoBusVideoProps> = ({
  imageUrls,
  title,
  summary,
  location,
  country,
  lifestyle = 'mojobus',
  aspectRatio = '16:9',
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

  // Dynamische Slide-Dauern + Voiceover / Atmo / Audio-Optionen
  perSlideArray,
  hookCaption,
  ctaText,
  keepOriginalAudio = false,
  voiceoverUrl,
  voiceoverVolume = 1.0,
  ambientUrl,

  // Beat-Sync
  beatSyncStrength = 0.6,
  beatThreshold = 0.60,
  showWaveformBar = false,

  // Beat-Sync Velocity Punch
  beatVelocityPunch = false,

  // Lottie Bus Beat-Puls
  lottieBeatPulse = true,
  lottieBeatPulseScale = 1.12,
  lottieBeatPulseDuration = 8,
  lottieBeatPulseIntensity = 0.85,
  lottieData,

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

  // Hook Intro Audio
  introStingUrl,
  introStingVolume = 0.8,
  introBedUrl,
  introBedVolume = 0.5,
  introBedFadeOutSec = 0.3,

}) => {
  const { fps, durationInFrames } = useVideoConfig();

  const grade      = colorGrade || lifestyleToGrade(lifestyle);
  const images     = imageUrls.slice(0, 20);
  const imageCount = images.length;

  const hookFrames = getHookSeconds(platform) * fps;
  const ctaFrames  = CTA_DURATION_SEC * fps;

  // ── Slides: layout-aware Gruppierung + extra Routen-Slide ─────────────
  const {
    baseGroups,
    baseSlideCount,
    hasRouteMap,
    routeVisualIndex,
    totalSlideCount,
    slidesSec,
    slidesFrames,
    slideDefs,
    totalSlides,
    slideshowFrames,
    slideStartFrame,
    routeDurFrames,
  } = buildSlidePlan({
    imageUrls: images,
    secondsPerImage,
    perSlideArray,
    showRouteMap,
    slideLayouts,
    hookFrames,
  }, fps);

  // perSlide für Legacy
  const perSlide = Math.round((perSlideArray?.[0] || secondsPerImage) * fps);

  // ── Transition: 20 Frames (0.67s bei 30fps) — sanftes Überblenden
  const TRANSITION_FRAMES = Math.round(fps * TRANSITION_DURATION_SEC); // ~20 Frames @ 30fps

  // Emoji standardmäßig AUS – roher Foster-Look. Das Bild + der Text sind der Hook,
  // ein Emoji darüber wirkt wie Template-Content und bricht die Authentizität.
  const hookEmoji = HOOK_EMOJI;

  const hasCaptions = captionStyle !== 'off' && captions.length > 0;

  // ── Beat-Sync: Fallback-Beats vorberechnen ────────────────────────────
  const fallbackBeats = generateFallbackBeats(
    durationInFrames,
    fps,
    secondsPerImage,
    imageCount,
    hookFrames
  );

  // ── Beat-Sync: Echte Audio-Beats für Lottie-Bus-Puls + Flash ──────────
  const effectiveBeats = useBeats(musicUrl, fps, durationInFrames, beatThreshold, fallbackBeats);
  const beatFrames = effectiveBeats.map(b => Math.round(b.frame));

  // ── Routen-Koordinaten ────────────────────────────────────────────────
  const effectiveRouteCoords = routeCoords && routeCoords.length >= 2
    ? routeCoords
    : pickDemoRoute(country, location);

  // ── Cinematic Effects: Plattform-Matrix + Cut-Plan ─────────────────────
  const { fx, cutFx, matchCutMap, whipDir, locationBadgeTopPct } = buildCutEffectsPlan(slideDefs, platform, cinematicEffects);

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

  // ── Hook-Wort-Zoom + vorheriges Bild für Transitions ───────────────────
  const heroWordWindows = buildHeroWordWindows(slideDefs, captions, slideStartFrame);
  const previousImageUrls = buildPreviousImageUrls(slideDefs, images);

  const mediaLayer = (
    <>
      <ColorGradeWrapper grade={grade}>
        <SlideshowLayer
          images={images}
          slideDefs={slideDefs}
          slideStartFrame={slideStartFrame}
          transitionType={transitionType}
          fx={fx}
          cutFx={cutFx}
          matchCutMap={matchCutMap}
          whipDir={whipDir}
          heroWordWindows={heroWordWindows}
          previousImageUrls={previousImageUrls}
          effectiveRouteCoords={effectiveRouteCoords}
          mapImageUrl={mapImageUrl}
          accentColor={accentColor}
          keepOriginalAudio={keepOriginalAudio}
          speedRampEnabled={speedRampEnabled}
          platform={platform}
          hookFrames={hookFrames}
          slideshowFrames={slideshowFrames}
          ctaFrames={ctaFrames}
          transitionFrames={TRANSITION_FRAMES}
          grade={grade}
        />
      </ColorGradeWrapper>
      <ColorGradeOverlay grade={grade} />
    </>
  );

  return (
    <AbsoluteFill style={{ background: '#000' }}>

      {/* Fonts */}
      <LoadFonts />

      {/* ══ PLATTFORMSPEZIFISCHE OVERLAYS ═══════════════════════════════════ */}
      {aspectRatio === '9:16' || aspectRatio === '1:1' ? (
        <ShortsLayer
          title={title}
          summary={summary}
          location={location}
          country={country}
          lifestyle={lifestyle}
          musicUrl={musicUrl}
          platform={platform}
          accentColor={accentColor}
          hookFrames={hookFrames}
          hookCaption={hookCaption}
          ctaFrames={ctaFrames}
          slideshowFrames={slideshowFrames}
          hasCaptions={hasCaptions}
          captions={captions}
          captionStyle={captionStyle}
          totalSlideCount={totalSlideCount}
          routeVisualIndex={routeVisualIndex}
          showRouteMap={showRouteMap}
          slideDefs={slideDefs}
          slideStartFrame={slideStartFrame}
          slidesFrames={slidesFrames}
          fps={fps}
          beatSyncStrength={beatSyncStrength}
          beatThreshold={beatThreshold}
          showWaveformBar={showWaveformBar}
          beatVelocityPunch={beatVelocityPunch}
          fallbackBeats={fallbackBeats}
          beatFrames={beatFrames}
          lottieData={lottieData}
          lottieBeatPulse={lottieBeatPulse}
          lottieBeatPulseScale={lottieBeatPulseScale}
          lottieBeatPulseDuration={lottieBeatPulseDuration}
          lottieBeatPulseIntensity={lottieBeatPulseIntensity}
          showLottieBus={showLottieBus}
        >
          {mediaLayer}
        </ShortsLayer>
      ) : (
        <LongformLayer
          platform={platform}
          accentColor={accentColor}
          hookFrames={hookFrames}
          ctaFrames={ctaFrames}
          slideshowFrames={slideshowFrames}
          hasCaptions={hasCaptions}
          captions={captions}
          captionStyle={captionStyle}
          totalSlideCount={totalSlideCount}
          routeVisualIndex={routeVisualIndex}
          showRouteMap={showRouteMap}
          slideDefs={slideDefs}
          fx={fx}
        >
          {mediaLayer}
        </LongformLayer>
      )}

      {/* ══ SCHICHT 3: Hook Abdunkelung (nur während Hook-Slide) ══════════════
           Gleichmäßiges dunkles Overlay damit der Hook-Text auf jedem Bild
           gut lesbar ist. Opacity 0.40 = Bild bleibt als visueller Hook wirksam,
           Text-Kontrast kommt zusätzlich vom radialen Gradient im HookTitle. */}
      <Sequence from={0} durationInFrames={hookFrames}>
        <HookDimOverlay opacity={HOOK_DIM_OPACITY} fps={fps} hookFrames={hookFrames} />
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
          platform={platform}
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
            platform={platform}
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
            platform={platform}
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

      {/* ══ SCHICHT 10: Progress Bar ══════════════════════════════════════════ */}
      <ProgressBar
        color={accentColor}
        height={PROGRESS_BAR_HEIGHT}
        position="top"
        startFrame={hookFrames}
        endFrame={hookFrames + slideshowFrames}
      />

      {/* ══ SCHICHT 11: Audio Stack (Musik, Voiceover, Ambient, Intro) ═══════ */}
      <AudioStack
        musicUrl={musicUrl}
        voiceoverUrl={voiceoverUrl}
        ambientUrl={ambientUrl}
        introStingUrl={introStingUrl}
        introBedUrl={introBedUrl}
        voiceoverVolume={voiceoverVolume}
        introStingVolume={introStingVolume}
        introBedVolume={introBedVolume}
        introBedFadeOutSec={introBedFadeOutSec}
        hookFrames={hookFrames}
        slideshowFrames={slideshowFrames}
        videoDuckWindows={videoDuckWindows}
      />

      {/* ══ SCHICHT 13-15: Cut Effects (FlashCut, LightLeak, Sticker, SFX) ═ */}
      <CutEffectsLayer
        cutFx={cutFx}
        slideDefs={slideDefs}
        fx={fx}
        slideStartFrame={slideStartFrame}
        transitionType={transitionType}
        stickersEnabled={stickersEnabled}
        sfxEnabled={sfxEnabled}
        sfxUrls={sfxUrls}
      />

    </AbsoluteFill>
  );
};
