import { Play } from 'lucide-react';
import { videoConfig } from '@/config/video';

/**
 * VideoFramePreview – zeigt ein einzelnes Video-Frame als Vorschau in Cards/Feeds,
 * statt das ganze Video zu laden (oder bei preload="none" eine weiße Fläche zu zeigen).
 *
 * Funktionsweise:
 * - preload="metadata" → Browser lädt nur Metadaten + das benötigte Frame (wenige KB,
 *   kein Volldownload; unsere MP4s sind +faststart, das moov-Atom liegt vorne)
 * - Media-Fragment "#t={frameTime}" → Frame ab dem konfigurierten Zeitpunkt
 *   (aktuell 8s; kürzere Videos → letztes Frame; Safari ignoriert #t ggf. → erstes Frame)
 *
 * Bewusst KEINE controls: In Cards/Grids gehören Klicks dem umgebenden
 * Link/Click-Handler (Navigation zur Detailseite).
 */
export function VideoFramePreview({
  url,
  className,
  showPlayOverlay = true,
}: {
  /** Direkte Video-URL (mp4/webm/mov ...) */
  url: string;
  /** Größen-Klassen für das video-Element, z.B. "w-full h-full object-cover" */
  className?: string;
  /** Zentriertes Play-Icon anzeigen (default: true) */
  showPlayOverlay?: boolean;
}) {
  return (
    <>
      <video
        src={`${url}#t=${videoConfig.preview.frameTime}`}
        className={`pointer-events-none ${className ?? ''}`}
        muted
        playsInline
        preload={videoConfig.preview.preload}
        tabIndex={-1}
        aria-hidden="true"
      />
      {showPlayOverlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/45 rounded-full p-3 shadow-lg">
            <Play className="h-8 w-8 text-white fill-white" />
          </div>
        </div>
      )}
    </>
  );
}
