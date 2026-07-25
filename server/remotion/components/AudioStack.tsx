import React from 'react';
import { Sequence, useVideoConfig } from 'remotion';
import { AudioLayer } from './AudioLayer';
import { IntroAudioLayer } from './IntroAudioLayer';
import {
  MUSIC_VOLUME,
  AMBIENT_VOLUME,
} from '../config/renderConfig';

interface AudioStackProps {
  musicUrl?: string;
  voiceoverUrl?: string;
  ambientUrl?: string;
  introStingUrl?: string;
  introBedUrl?: string;
  voiceoverVolume?: number;
  introStingVolume?: number;
  introBedVolume?: number;
  introBedFadeOutSec?: number;
  hookFrames: number;
  slideshowFrames: number;
  videoDuckWindows: { startFrame: number; endFrame: number }[];
}

export const AudioStack: React.FC<AudioStackProps> = ({
  musicUrl,
  voiceoverUrl,
  ambientUrl,
  introStingUrl,
  introBedUrl,
  voiceoverVolume = 1.0,
  introStingVolume = 0.8,
  introBedVolume = 0.5,
  introBedFadeOutSec = 0.3,
  hookFrames,
  videoDuckWindows,
}) => {
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <>
      {/* ══ SCHICHT 11: Audio (Musik) ════════════════════════════════════════ */}
      {musicUrl && (
        <AudioLayer
          src={musicUrl}
          volume={MUSIC_VOLUME}
          fadeInSec={0.4}
          duckWindows={[
            // Wenn ein Hook Bed aktiv ist, wird die Haupt-Musik während des
            // Hooks geduckt. Der Audio-Track bleibt für Beat-Sync-Analyse ab
            // Frame 0 erhalten, ist aber im Hook-Bereich nicht hörbar.
            ...(introBedUrl ? [{ startFrame: 0, endFrame: hookFrames }] : []),
            ...videoDuckWindows,
          ]}
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
          volume={AMBIENT_VOLUME}
          fadeInSec={0.5}
          fadeOutSec={3}
          duckWindows={videoDuckWindows}
        />
      )}

      {/* ══ NEU SCHICHT 11d: Hook Intro Audio (Sting + Bed) ═══════════════════ */}
      {introStingUrl && (
        <Sequence from={0} durationInFrames={Math.min(6 * fps, durationInFrames)}>
          <IntroAudioLayer
            src={introStingUrl}
            volume={introStingVolume}
            fadeOutStartFrame={1 * fps}
            fadeOutDurationFrames={5 * fps}
          />
        </Sequence>
      )}
      {introBedUrl && (
        <Sequence from={0} durationInFrames={hookFrames}>
          <IntroAudioLayer
            src={introBedUrl}
            volume={introBedVolume}
            fadeOutStartFrame={Math.max(0, hookFrames - Math.round(introBedFadeOutSec * fps))}
            fadeOutDurationFrames={Math.round(introBedFadeOutSec * fps)}
            loop
          />
        </Sequence>
      )}
    </>
  );
};
