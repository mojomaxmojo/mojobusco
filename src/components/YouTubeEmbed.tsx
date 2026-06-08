import React, { useState, useRef, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import { videoConfig } from '@/config/video';

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
  className?: string;
  aspectRatio?: string;
  /** Iframe sofort laden (true = Detailseite, false = Click-to-Load) */
  autoLoad?: boolean;
}

/**
 * YouTube Video Embed Komponente
 * Privacy-First mit no-cookie Domain und Lazy Loading
 * - autoLoad=false: Thumbnail + Play-Button (Standard, für Listen)
 * - autoLoad=true: Iframe wird sofort geladen (für Detailseiten)
 */
export function YouTubeEmbed({ 
  videoId, 
  title,
  className = '',
  aspectRatio = '16/9',
  autoLoad = false,
}: YouTubeEmbedProps) {
  const [isLoaded, setIsLoaded] = useState(autoLoad);
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // YouTube Thumbnail URL
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const fallbackThumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  // YouTube Embed URL mit Privacy-Settings
  const embedUrl = videoConfig.youtube.noCookie
    ? `https://www.youtube-nocookie.com/embed/${videoId}`
    : `https://www.youtube.com/embed/${videoId}`;

  const embedParams = new URLSearchParams({
    rel: videoConfig.youtube.rel.toString(),
    modestbranding: videoConfig.youtube.modestbranding.toString(),
    autoplay: videoConfig.player.autoplay ? '1' : '0',
    controls: videoConfig.player.controls ? '1' : '0',
    mute: videoConfig.player.muted ? '1' : '0',
    playsinline: videoConfig.player.playsInline ? '1' : '0',
  });

  const handlePlayClick = () => {
    setIsLoading(true);
    setIsLoaded(true);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setError('YouTube Video konnte nicht geladen werden');
    setIsLoading(false);
  };

  if (error) {
    return (
      <div className={`border rounded-lg p-4 text-center text-muted-foreground ${className}`}>
        <p className="text-sm">{error}</p>
        <a 
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline text-sm mt-2 inline-block"
        >
          Auf YouTube ansehen
        </a>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${className}`}>
      {/* Placeholder mit Thumbnail - nur anzeigen wenn nicht geladen */}
      {!isLoaded && (
        <div className="relative w-full overflow-hidden rounded-lg bg-black">
          {/* Thumbnail */}
          <img
            src={thumbnailUrl}
            onError={(e) => {
              // Fallback zu kleinerem Thumbnail
              e.currentTarget.src = fallbackThumbnailUrl;
            }}
            alt={title || `YouTube Video ${videoId}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          
          {/* Overlay mit Play Button */}
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <Button
              size="lg"
              onClick={handlePlayClick}
              className="bg-red-600 hover:bg-red-700 text-white rounded-full p-6"
            >
              <Play className="w-8 h-8" fill="white" />
            </Button>
          </div>

          {/* YouTube Logo */}
          <div className="absolute bottom-4 right-4 opacity-50">
            <svg width="90" height="20" viewBox="0 0 90 20" fill="white">
              <path d="M11.35 0v20l7.8-10-7.8-10zm-2.7 0L0 10l8.65 10V0z"/>
              <text x="24" y="14" fontSize="12" fontFamily="Arial, sans-serif">YouTube</text>
            </svg>
          </div>
        </div>
      )}

      {/* YouTube Iframe - nur laden wenn geklickt */}
      {isLoaded && (
        <div className="relative w-full">
          {isLoading && (
            <div className="absolute inset-0 z-10">
              <Skeleton className="w-full h-full rounded-lg" />
            </div>
          )}
          
          <iframe
            ref={iframeRef}
            src={`${embedUrl}?${embedParams.toString()}`}
            title={title || `YouTube Video ${videoId}`}
            className="w-full rounded-lg"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            style={{ aspectRatio }}
          />
        </div>
      )}

      {/* Video Info */}
      {title && (
        <div className="mt-2 text-sm text-muted-foreground">
          📺 {title} (YouTube)
        </div>
      )}
    </div>
  );
}

/**
 * Hilfsfunktion um YouTube Video ID aus URL zu extrahieren
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}