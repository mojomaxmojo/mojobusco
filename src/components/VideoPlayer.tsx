import React, { useRef, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { videoConfig } from '@/config/video';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  /** Zusätzliche Klassen direkt auf dem <video>-Element (z.B. object-fit/max-height Overrides). */
  videoClassName?: string;
  title?: string;
  aspectRatio?: string;
}

/**
 * HTML5 Video Player Komponente
 * Unterstützt alle gängigen Video-Formate
 *
 * Bug-Fix (Skeleton blinkt endlos / Player springt erst nach Klick an):
 * - preload="none" (siehe videoConfig.player) verhinderte, dass loadstart/
 *   canplay je automatisch feuern → das Loading-Skeleton pulsierte für
 *   immer, bis ein Klick (der eigentlich dem darunterliegenden nativen
 *   Play-Button galt) das Laden nachträglich anstieß.
 * - Fix: preload="metadata" (in videoConfig) + zusätzlich auf
 *   "loadedmetadata" lauschen (feuert zuverlässiger/früher als "canplay")
 *   + Sicherheits-Timeout, der das Overlay in jedem Fall ausblendet.
 * - Poster-Frame: Wenn kein explizites poster übergeben wird, wird im
 *   Hintergrund per verstecktem <video>+<canvas> ein Snapshot bei
 *   videoConfig.preview.frameTime Sekunden erzeugt und als poster gesetzt.
 *   Das startet die eigentliche Wiedergabe weiterhin bei 0s (im Gegensatz
 *   zu einem Media-Fragment auf der Haupt-src, das die Startposition
 *   verschieben würde). Schlägt der Snapshot fehl (z.B. CORS), bleibt der
 *   Player ohne Poster funktionsfähig (stiller Fallback).
 */
export function VideoPlayer({ 
  src, 
  poster, 
  className = '', 
  videoClassName = '',
  title,
  aspectRatio = '16/9'
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoPoster, setAutoPoster] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setError(null);

    const handleLoadStart = () => setIsLoading(true);
    const handleLoadedMetadata = () => setIsLoading(false);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = () => {
      setError('Video konnte nicht geladen werden');
      setIsLoading(false);
    };

    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    // Sicherheits-Timeout: Falls aus irgendeinem Grund (langsames Netz,
    // exotischer Codec, Browser-Eigenheit) weder loadedmetadata noch
    // canplay feuert, darf das Skeleton nicht ewig pulsieren.
    const timeoutId = window.setTimeout(() => {
      setIsLoading(false);
    }, videoConfig.player.loadingTimeoutMs);

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      window.clearTimeout(timeoutId);
    };
  }, [src]);

  // Automatischer Poster-Snapshot bei videoConfig.preview.frameTime Sekunden,
  // falls kein explizites poster übergeben wurde. Läuft komplett im
  // Hintergrund über ein unsichtbares <video> + <canvas>-Snapshot, ohne die
  // Startposition des sichtbaren Players zu beeinflussen.
  useEffect(() => {
    if (poster) {
      setAutoPoster(null);
      return;
    }

    let cancelled = false;
    const probe = document.createElement('video');
    probe.crossOrigin = 'anonymous';
    probe.preload = 'metadata';
    probe.muted = true;
    probe.playsInline = true;
    probe.src = src;

    const handleLoadedMetadata = () => {
      if (cancelled) return;
      const target = Math.min(videoConfig.preview.frameTime, Math.max(probe.duration - 0.1, 0));
      try {
        probe.currentTime = Number.isFinite(target) ? target : 0;
      } catch {
        // Manche Browser werfen bei ungültigem currentTime – Snapshot einfach auslassen.
      }
    };

    const handleSeeked = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = probe.videoWidth;
        canvas.height = probe.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx || canvas.width === 0 || canvas.height === 0) return;
        ctx.drawImage(probe, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setAutoPoster(dataUrl);
      } catch {
        // CORS-getaintete Canvas oder anderer Fehler → einfach ohne Poster fortfahren.
      }
    };

    probe.addEventListener('loadedmetadata', handleLoadedMetadata);
    probe.addEventListener('seeked', handleSeeked);

    return () => {
      cancelled = true;
      probe.removeEventListener('loadedmetadata', handleLoadedMetadata);
      probe.removeEventListener('seeked', handleSeeked);
      probe.src = '';
    };
  }, [src, poster]);

  const effectivePoster = poster ?? autoPoster ?? undefined;

  if (error) {
    return (
      <div className={`border rounded-lg p-4 text-center text-muted-foreground ${className}`}>
        <p className="text-sm">{error}</p>
        <a 
          href={src} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline text-sm mt-2 inline-block"
        >
          Video extern öffnen
        </a>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${className}`}>
      {/* Loading Skeleton – pointer-events-none, damit Klicks auf den nativen
          Play-Button des darunterliegenden <video controls> durchgereicht
          werden. Dank preload="metadata" + poster-Fallback feuert
          loadedmetadata/canplay jetzt zuverlässig automatisch, zusätzlich
          sichert ein Timeout (videoConfig.player.loadingTimeoutMs) ab,
          dass das Skeleton nie endlos pulsiert. */}
      {isLoading && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          <Skeleton className="w-full h-full rounded-lg" />
        </div>
      )}

      {/* Video Container mit Aspect Ratio */}
      <div className="relative w-full overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          src={src}
          poster={effectivePoster}
          title={title}
          className={`w-full h-full object-cover ${videoClassName}`}
          controls={videoConfig.player.controls}
          autoPlay={videoConfig.player.autoplay}
          muted={videoConfig.player.muted}
          loop={videoConfig.player.loop}
          playsInline={videoConfig.player.playsInline}
          preload={videoConfig.player.preload}
        />
      </div>

      {/* Video Info */}
      {title && (
        <div className="mt-2 text-sm text-muted-foreground">
          📹 {title}
        </div>
      )}
    </div>
  );
}