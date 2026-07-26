import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';

import { BeatSyncLayer, AudioWaveformBar } from '../components/BeatSyncLayer';
import { BeatVelocityPunch } from '../components/BeatVelocityPunch';
import { LottieBusIcon } from '../components/LottieBusIcon';
import { PerSlideCaption } from '../components/Captions';
import {
  LOTTE_BUS_HOOK_SIZE,
  LOTTE_BUS_CTA_SIZE,
  AUDIO_WAVEFORM_BARS,
  AUDIO_WAVEFORM_HEIGHT,
  AUDIO_WAVEFORM_OPACITY,
  BEAT_SYNC_FLASH_OPACITY,
} from '../config/renderConfig';
import type { SlideDef } from '../slidePlan';

interface ShortsLayerProps {
  children: React.ReactNode;
  title: string;
  summary?: string;
  location?: string;
  country?: string;
  lifestyle: string;
  musicUrl?: string;
  platform: string;
  accentColor: string;
  hookFrames: number;
  hookCaption?: string;
  ctaFrames: number;
  slideshowFrames: number;
  hasCaptions: boolean;
  captions: string[];
  captionStyle: string;
  totalSlideCount: number;
  routeVisualIndex: number;
  showRouteMap: boolean;
  slideDefs: SlideDef[];
  slideStartFrame: (index: number) => number;
  slidesFrames: number[];
  fps: number;
  beatSyncStrength: number;
  beatThreshold: number;
  showWaveformBar: boolean;
  beatVelocityPunch: boolean;
  fallbackBeats: any[];
  beatFrames: number[];
  lottieData?: unknown;
  lottieBeatPulse: boolean;
  lottieBeatPulseScale: number;
  lottieBeatPulseDuration: number;
  lottieBeatPulseIntensity: number;
  showLottieBus: boolean;
}

export const ShortsLayer: React.FC<ShortsLayerProps> = (props) => {
  const {
    children,
    title,
    summary,
    location,
    country,
    lifestyle,
    musicUrl,
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
    slideStartFrame,
    slidesFrames,
    fps,
    beatSyncStrength,
    beatThreshold,
    showWaveformBar,
    beatVelocityPunch,
    fallbackBeats,
    beatFrames,
    lottieData,
    lottieBeatPulse,
    lottieBeatPulseScale,
    lottieBeatPulseDuration,
    lottieBeatPulseIntensity,
    showLottieBus,
  } = props;

  return (
    <>
      <BeatVelocityPunch
        enabled={beatVelocityPunch}
        musicUrl={musicUrl}
        beatThreshold={beatThreshold}
        strength={beatSyncStrength}
        fallbackBeats={fallbackBeats}
      >
        {children}
      </BeatVelocityPunch>

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
    </>
  );
};
