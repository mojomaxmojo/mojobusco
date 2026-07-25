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
import { StoryCaption } from './components/StoryCaption';
import { PerSlideCaption } from './components/Captions';
import { LoadFonts } from './components/Fonts';
import { HookDimOverlay } from './components/HookDimOverlay';
import { isVideo } from './components/MediaRenderer';
import { getHookSeconds } from './duration';
import { buildSlidePlan, type SlideDef } from './slidePlan';
import { buildCutEffectsPlan } from './cutEffectsPlan';
import { buildHeroWordWindows, buildPreviousImageUrls } from './slideHelpers';
import { AudioStack } from './components/AudioStack';
import { CutEffectsLayer } from './components/CutEffectsLayer';
import { SlideshowLayer } from './components/SlideshowLayer';
export { calculateDuration } from './duration';

// ── NEU: 4 neue Skills ────────────────────────────────────────────────────
import {
  BeatSyncLayer,
  AudioWaveformBar,
  generateFallbackBeats,
  useBeats,
} from './components/BeatSyncLayer';
import { BeatVelocityPunch } from './components/BeatVelocityPunch';
import { pickDemoRoute } from './components/RouteMapLine';
import { LottieBusIcon } from './components/LottieBusIcon';

// ── NEU: Cinematic Effects (Letterbox) ───────────────────────────────────
import { CinematicLetterbox } from './components/CinematicEffects';
import {
  TRANSITION_DURATION_SEC,
  CTA_DURATION_SEC,
  HOOK_EMOJI,
  HOOK_DIM_OPACITY,
  LOTTE_BUS_HOOK_SIZE,
  LOTTE_BUS_CTA_SIZE,
  PROGRESS_BAR_HEIGHT,
  AUDIO_WAVEFORM_BARS,
  AUDIO_WAVEFORM_HEIGHT,
  AUDIO_WAVEFORM_OPACITY,
  MUSIC_VOLUME,
  AMBIENT_VOLUME,
  BEAT_SYNC_FLASH_OPACITY,
  SFX_VOLUME,
  CINEMATIC_LETTERBOX_ENTER_SEC,
  CINEMATIC_LETTERBOX_EXIT_SEC,
} from './config/renderConfig';

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

      {/* ══ SCHICHT 2: Color Grade Overlay ══════════════════════════════════ */}
      <ColorGradeOverlay grade={grade} />
      </BeatVelocityPunch>

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

      {/* ══ SCHICHT 4b: Lottie Bus im Hook (Beat-Puls Branding) ════════════════
           Bus fährt kurz nach Hook-Start im Beat ein, pulsiert synchron.
           Nur wenn genug Hook-Dauer vorhanden ist (>1s). */}
      {showLottieBus && hookFrames > fps && (
        <Sequence from={Math.round(fps * 0.4)} durationInFrames={hookFrames - Math.round(fps * 0.4)}>
          <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <LottieBusIcon
              size={LOTTE_BUS_HOOK_SIZE}
              accentColor={accentColor}
              driveIn={true}
              driveInPath="curve-down"
              position="bottom-center"
              platform={platform}
              lottieData={lottieData}
              lottieLoop={true}
              beatFrames={beatFrames}
              beatPulse={lottieBeatPulse}
              beatPulseScale={lottieBeatPulseScale}
              beatPulseDuration={lottieBeatPulseDuration}
              beatPulseIntensity={lottieBeatPulseIntensity}
            />
          </AbsoluteFill>
        </Sequence>
      )}

      {/* ══ Auto-Captions ══════════════════════════════════════════ */}
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

      {/* ══ NEU SCHICHT 9b: Lottie Bus in CTA ═══════════════════════════════ */}
      {showLottieBus && (
        <Sequence
          from={hookFrames + slideshowFrames + Math.round(fps * 0.3)}
          durationInFrames={ctaFrames}
        >
          <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <LottieBusIcon
              size={LOTTE_BUS_CTA_SIZE}
              accentColor={accentColor}
              driveIn={true}
              driveInPath="curve-down"
              position="bottom-center"
              platform={platform}
              lottieData={lottieData}
              lottieLoop={true}
              beatFrames={beatFrames}
              beatPulse={lottieBeatPulse}
              beatPulseScale={lottieBeatPulseScale}
              beatPulseDuration={lottieBeatPulseDuration}
              beatPulseIntensity={lottieBeatPulseIntensity}
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
          enterFrames={Math.round(fps * CINEMATIC_LETTERBOX_ENTER_SEC)}
          exitStartFrame={hookFrames + slideshowFrames}
          exitFrames={Math.round(fps * CINEMATIC_LETTERBOX_EXIT_SEC)}
        />
      )}

      {/* ══ SCHICHT 10: Progress Bar ══════════════════════════════════════════ */}
      <ProgressBar
        color={accentColor}
        height={PROGRESS_BAR_HEIGHT}
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
            numberOfBars={AUDIO_WAVEFORM_BARS}
            position="bottom"
            height={AUDIO_WAVEFORM_HEIGHT}
            opacity={AUDIO_WAVEFORM_OPACITY}
          />
        </Sequence>
      )}

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

      {/* ══ NEU SCHICHT 12: Beat-Sync Flash Effekt ═══════════════════════════ */}
      {beatSyncStrength > 0 && (
        <Sequence from={hookFrames} durationInFrames={slideshowFrames}>
          <BeatSyncLayer
            musicUrl={musicUrl}
            beatThreshold={beatThreshold}
            accentColor={accentColor}
            flashOpacity={BEAT_SYNC_FLASH_OPACITY}
            strength={beatSyncStrength}
            fallbackBeats={fallbackBeats}
          />
        </Sequence>
      )}

      {/* ══ NEU SCHICHT 13-15: Cut Effects (FlashCut, LightLeak, Sticker, SFX) ═ */}
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
