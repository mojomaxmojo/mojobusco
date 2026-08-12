import React from 'react';
import { VideoPlayer } from './VideoPlayer';
import { YouTubeEmbed, extractYouTubeId } from './YouTubeEmbed';
import { videoConfig } from '@/config/video';

interface VideoEmbedProps {
  url: string;
  title?: string;
  className?: string;
  /** Iframe sofort laden (true = für Detailseiten, false = Click-to-Load) */
  autoLoad?: boolean;
  /** Optionales Poster-Bild. Ohne Angabe erzeugt VideoPlayer automatisch
   *  einen Snapshot aus dem Video (siehe videoConfig.preview.frameTime). */
  poster?: string;
}

export function VideoEmbed({ 
  url, 
  title, 
  className = '',
  autoLoad = false,
  poster,
}: VideoEmbedProps) {
  // Prüfen ob es eine YouTube URL ist
  const youtubeId = extractYouTubeId(url);

  // YouTube Video
  if (youtubeId && videoConfig.autoEmbed.youtube) {
    return (
      <YouTubeEmbed
        videoId={youtubeId}
        title={title}
        className={className}
        autoLoad={autoLoad}
      />
    );
  }

  // Direktes Video
  const isDirectVideo = isVideoUrl(url);
  if (isDirectVideo && videoConfig.autoEmbed.direct) {
    return (
      <VideoPlayer
        src={url}
        title={title}
        className={className}
        poster={poster}
      />
    );
  }

  // Fallback: Wenn Auto-Embed deaktiviert oder nicht unterstütztes Format
  return (
    <div className={`inline-block ${className}`}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline flex items-center gap-2"
      >
        <span className="text-lg">📹</span>
        <span>{title || url}</span>
      </a>
    </div>
  );
}

/**
 * Prüft ob eine URL zu einem direkten Video-File führt
 */
export function isVideoUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    // Prüfen ob die Endung unterstützt wird
    const extension = pathname.split('.').pop();
    if (videoConfig.supportedExtensions.includes(extension || '')) return true;

    // Blossom-URLs: Hash-Pfad ohne Endung aber mit Content-Type mp4/webm
    // z.B. https://relay.mojobus.co/<64-char-hex>.mp4 oder /<64-char-hex>
    // Erkennung: 64-stelliger Hex-Hash als letztes Pfadsegment
    const lastSegment = pathname.split('/').pop() || '';
    if (/^[a-f0-9]{64}(\.(mp4|webm|mov|m4v))?$/.test(lastSegment)) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Prüft ob eine URL ein Video enthält (YouTube oder direkt)
 */
export function isVideoContent(url: string): boolean {
  return isVideoUrl(url) || extractYouTubeId(url) !== null;
}