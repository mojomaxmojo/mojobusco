/**
 * Remotion Root — Entry Point
 * Muss registerRoot() aufrufen — das ist Pflicht für @remotion/bundler.
 */

import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { MojoBusVideo, calculateDuration, type MojoBusVideoProps } from './MojoBusVideo';

// Standard-Props für Studio-Preview
const DEFAULT_PROPS: MojoBusVideoProps = {
  imageUrls: [
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920',
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1920',
  ],
  title: 'Portugal · Van Life',
  summary: 'Drei Wochen Westküste. Kein Plan, kein Zeitdruck.',
  location: 'Sagres, Portugal',
  country: 'portugal',
  lifestyle: 'mojobus',
  secondsPerImage: 5,
  aspectRatio: '16:9',
  accentColor: '#F59E0B',
  captionStyle: 'tiktok',
  motionBlurStrength: 1,
};

const FPS = 30;

const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 16:9 — YouTube / Standard */}
      <Composition
        id="MojoBusVideo-16-9"
        component={MojoBusVideo}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={calculateDuration(
          DEFAULT_PROPS.imageUrls.length,
          FPS,
          DEFAULT_PROPS.secondsPerImage ?? 5
        ).totalFrames}
        defaultProps={DEFAULT_PROPS}
        calculateMetadata={({ props }) => {
          const { totalFrames } = calculateDuration(
            props.imageUrls.length,
            FPS,
            props.secondsPerImage ?? 5
          );
          return { durationInFrames: totalFrames };
        }}
      />

      {/* 9:16 — Instagram Reels / TikTok */}
      <Composition
        id="MojoBusVideo-9-16"
        component={MojoBusVideo}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={calculateDuration(
          DEFAULT_PROPS.imageUrls.length,
          FPS,
          DEFAULT_PROPS.secondsPerImage ?? 5
        ).totalFrames}
        defaultProps={{ ...DEFAULT_PROPS, aspectRatio: '9:16' }}
        calculateMetadata={({ props }) => {
          const { totalFrames } = calculateDuration(
            props.imageUrls.length,
            FPS,
            props.secondsPerImage ?? 5
          );
          return { durationInFrames: totalFrames };
        }}
      />

      {/* 1:1 — Instagram Feed */}
      <Composition
        id="MojoBusVideo-1-1"
        component={MojoBusVideo}
        fps={FPS}
        width={1080}
        height={1080}
        durationInFrames={calculateDuration(
          DEFAULT_PROPS.imageUrls.length,
          FPS,
          DEFAULT_PROPS.secondsPerImage ?? 5
        ).totalFrames}
        defaultProps={{ ...DEFAULT_PROPS, aspectRatio: '1:1' }}
        calculateMetadata={({ props }) => {
          const { totalFrames } = calculateDuration(
            props.imageUrls.length,
            FPS,
            props.secondsPerImage ?? 5
          );
          return { durationInFrames: totalFrames };
        }}
      />
    </>
  );
};

// ✅ Pflicht: registerRoot() muss im Entry-Point aufgerufen werden
registerRoot(RemotionRoot);
