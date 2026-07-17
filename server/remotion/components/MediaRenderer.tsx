/**
 * MediaRenderer — Wählt je nach URL-Typ KenBurnsImage oder Video
 *
 * WICHTIG: <Video> (=Html5Video), NICHT <OffthreadVideo>!
 * <OffthreadVideo> nutzt einen nativen Rust-"Compositor"-Binary
 * (@remotion/compositor-linux-x64-gnu), der gegen glibc 2.35 gelinkt ist.
 * AlmaLinux 9 / RHEL 9 (auch 9.7) haben nur glibc 2.34 → der Compositor
 * crasht sofort mit "version `GLIBC_2.35' not found" (glibc ist NICHT
 * abwärtskompatibel). Deshalb bleiben wir bei <Video>.
 *
 * Das eigentliche Timeout-Problem bei großen MP4s ("A delayRender() ...
 * was called but not cleared after 28000ms") kam NICHT von <Video>
 * selbst, sondern davon, dass der lokale Bild/Video-HTTP-Server
 * (startImageServer in render.js) keine Range-Requests (206 Partial
 * Content) unterstützt hat. Ohne Range-Support kann Chromes nativer
 * <video>-Tag bei größeren Dateien (>~10MB) nicht effizient innerhalb
 * der Datei seeken → der Seek hängt und läuft in den Timeout.
 * → Fix liegt in render.js (Accept-Ranges + 206-Handling), nicht hier.
 *
 * muted: Video-Clips liefern hier nur das Bild — Ton kommt ohnehin aus
 * Musik/Voiceover/Ambient (eigene AudioLayer). muted=true erspart das
 * Downloaden/Dekodieren der Audiospur zusätzlich Zeit UND verhindert,
 * dass Remotion die komplette Videodatei für die Audiospur laden muss.
 * speedRamp: Slow-Mo-Intro (0.6x) → Punch-Out (1.4x), siehe FEATURE-PLAN.md
 * Schritt 8. Remotion <Video> erlaubt nur einen STATISCHEN playbackRate pro
 * Element (keine dynamische Rampe) → die "Rampe" wird über zwei aufeinander-
 * folgende <Video>-Ausschnitte mit je fester Rate nachgebaut. slideFrames
 * = Dauer dieses Slides (ohne Transitions-Überlappung), Mitte = Trim-Punkt.
 */

import React from 'react';
import { AbsoluteFill, Sequence, Video } from 'remotion';
import { KenBurnsImage, pickDirection } from './KenBurnsImage';

export const isVideo = (url: string) => /\.(mp4|webm|mov|avi|mkv)(\?|#|$)/i.test(url);

export const MediaRenderer: React.FC<{ src: string; index: number; allowAudio?: boolean; speedRamp?: boolean; slideFrames?: number }> = ({ src, index, allowAudio = false, speedRamp = false, slideFrames = 0 }) => {
  if (isVideo(src)) {
    if (speedRamp && slideFrames > 0) {
      const midFrame = Math.round(slideFrames / 2);
      return (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Sequence from={0} durationInFrames={midFrame} layout="none">
            <Video
              src={src}
              muted={!allowAudio}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              delayRenderTimeoutInMilliseconds={45000}
              delayRenderRetries={3}
              trimAfter={midFrame}
              playbackRate={0.6}
              onError={(err) => {
                console.warn(`[MojoBusVideo] Video Fehler (Speed-Ramp Slow-Mo) bei ${src}:`, err);
              }}
            />
          </Sequence>
          <Sequence from={midFrame} durationInFrames={slideFrames - midFrame} layout="none">
            <Video
              src={src}
              muted={!allowAudio}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              delayRenderTimeoutInMilliseconds={45000}
              delayRenderRetries={3}
              trimBefore={midFrame}
              playbackRate={1.4}
              onError={(err) => {
                console.warn(`[MojoBusVideo] Video Fehler (Speed-Ramp Punch-Out) bei ${src}:`, err);
              }}
            />
          </Sequence>
        </AbsoluteFill>
      );
    }
    return (
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Video
          src={src}
          muted={!allowAudio}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          delayRenderTimeoutInMilliseconds={45000}
          delayRenderRetries={3}
          onError={(err) => {
            console.warn(`[MojoBusVideo] Video Fehler bei ${src}:`, err);
          }}
        />
      </AbsoluteFill>
    );
  }
  return (
    <KenBurnsImage
      src={src}
      direction={pickDirection(index)}
      intensity={0.10}
      motionBlurStrength={0}
      noiseSeed={index}
      gammaFade={index === 0 ? 'dark-in' : index === 1 ? 'warm-in' : 'none'}
    />
  );
};
