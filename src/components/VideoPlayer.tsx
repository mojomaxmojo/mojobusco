import React, { useRef, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { videoConfig } from '@/config/video';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  title?: string;
  aspectRatio?: string;
}

/**
 * HTML5 Video Player Komponente
 * Unterstützt alle gängigen Video-Formate
 */
export function VideoPlayer({ 
  src, 
  poster, 
  className = '', 
  title,
  aspectRatio = '16/9'
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = () => {
      setError('Video konnte nicht geladen werden');
      setIsLoading(false);
    };

    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [src]);

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
          werden. Ohne das blockiert der Overlay jeden Klick, und da
          preload="none" ist, feuert loadstart/canplay nie automatisch →
          das Skeleton würde für immer pulsieren, ohne dass das Video startet. */}
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
          poster={poster}
          title={title}
          className="w-full h-full object-cover"
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