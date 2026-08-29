import { Play } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { cn } from '@/lib/utils';
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
 * PERFORMANCE – IntersectionObserver-Gating:
 * Das <video preload="metadata"> erzeugt sofort einen Range-Request, auch wenn die
 * Card weit außerhalb des Viewports liegt (z. B. Video-Grids mit 12+ Cards).
 * Das video-Element wird deshalb erst gemountet, wenn die Card in Sichtweite
 * scrollt (rootMargin 200px, einmalig). Solange: neutraler Placeholder, der den
 * Container exakt füllt (gleiche Größen-Klassen) → kein Layout-Shift, keine
 * Requests für offscreen-Videos.
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
  // Vorschau erst laden, wenn die Card in Sichtweite kommt (einmalig)
  const { ref, inView } = useInView({
    rootMargin: '200px',
    triggerOnce: true,
  });

  return (
    <div ref={ref} className={cn('relative', className)}>
      {inView ? (
        <video
          src={`${url}#t=${videoConfig.preview.frameTime}`}
          className="pointer-events-none absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
          preload={videoConfig.preview.preload}
          tabIndex={-1}
          aria-hidden="true"
        />
      ) : (
        // Placeholder füllt denselben Raum wie das spätere Video (kein CLS)
        <div className="absolute inset-0 bg-muted/60" aria-hidden="true" />
      )}
      {showPlayOverlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/45 rounded-full p-3 shadow-lg">
            <Play className="h-8 w-8 text-white fill-white" />
          </div>
        </div>
      )}
    </div>
  );
}
