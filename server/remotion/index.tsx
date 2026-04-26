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

// Social-Media optimierte FPS:
// 25fps: PAL-Standard, -17% Frames vs 30fps, reicht für Slideshows
// 30fps: NTSC/USA, nur nötig wenn Musik-BPM-Sync wichtig ist
const FPS = 25;

const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 16:9 — YouTube / Standard
          1280×720 statt 1920×1080:
          - YouTube komprimiert sowieso auf 720p für die meisten Geräte
          - ~45% weniger Pixel → ~45% kleinere Datei
          - Render-Zeit: ~40% schneller */}
      <Composition
        id="MojoBusVideo-16-9"
        component={MojoBusVideo}
        fps={FPS}
        width={1280}
        height={720}
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

      {/* 9:16 — Instagram Reels / TikTok
          1080×1920 bleibt — das ist der native Standard für Reels/TikTok.
          Kleinere Auflösung würde sichtbar schlechter aussehen. */}
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

      {/* 1:1 — Instagram Feed
          1080×1080 bleibt — Instagram Feed Standard.
          Könnte auf 720×720 reduziert werden aber 1080 ist der offizielle Standard. */}
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
