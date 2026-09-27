/**
 * ImageHero.tsx
 *
 * Hero-Bild der Detailseite (/bild/{note}) randlos oben — Redesign Phase 1.
 * Feste Aspect-Ratio (kein CLS), weichgezeichnete Rückwand + vollständig
 * sichtbares Hauptbild (object-contain), fetchPriority=high + async decoding
 * für schnelles First Paint (Phase 3). Videos: preload="metadata".
 */

import { Button } from '@/components/ui/button';
import { ArrowLeft, ZoomIn, Camera } from 'lucide-react';
import { PinImageButton } from '@/components/PinImageButton';
import { isVideoUrl } from './ImageViewer';
import { generateSrcset, getGalleryThumbnailUrl, getArticleHeaderUrl } from '@/lib/imageUtils';

interface ImageHeroProps {
  /** Erstes Medium aus dem Event-Content (Bild- oder Video-URL), kann fehlen */
  media: string | undefined;
  /** Event-Content (für PinImageButton-Beschreibung) */
  description: string;
  hashtags: string[];
  onBack: () => void;
  onOpenFullscreen: () => void;
}

export function ImageHero({ media, description, hashtags, onBack, onOpenFullscreen }: ImageHeroProps) {
  const isVideo = isVideoUrl(media);

  return (
    <div className="relative w-full aspect-[4/5] sm:aspect-[16/10] lg:aspect-[16/9] overflow-hidden bg-muted group">
      {/* Zurück-Button als Overlay auf dem Hero */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 left-4 z-20 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
        onClick={onBack}
        aria-label="Zurück zu Bilder"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      {media && isVideo ? (
        <video
          src={media}
          controls
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full bg-gray-950"
        />
      ) : media ? (
        <>
          {/* Weichgezeichnete Rückwand (kleines Thumbnail, füllt schmale Ränder) */}
          <img
            src={getGalleryThumbnailUrl(media)}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-40"
            loading="eager"
            decoding="async"
          />
          {/* Hauptbild: vollständig sichtbar (contain), sofort mit hoher Priorität */}
          <img
            src={getArticleHeaderUrl(media)}
            srcSet={generateSrcset(media, 'gallery')}
            sizes="100vw"
            fetchPriority="high"
            alt="Reisebild"
            className="absolute inset-0 w-full h-full object-contain cursor-pointer"
            loading="eager"
            decoding="async"
            onClick={onOpenFullscreen}
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 dark:bg-gray-800/90 rounded-lg p-4 flex flex-col items-center gap-2">
              <ZoomIn className="h-8 w-8 text-gray-800 dark:text-white" />
              <div className="text-gray-800 dark:text-white font-medium">
                Klick für Vollbild
              </div>
            </div>
          </div>
          <PinImageButton
            imageUrl={media}
            pageUrl={window.location.href}
            title="Bild von MojoBus"
            description={description}
            hashtags={hashtags}
            className="absolute bottom-4 right-4 z-20"
          />
        </>
      ) : (
        /* Media-Event ohne Bild-URL im Content */
        <div className="absolute inset-0 flex items-center justify-center">
          <Camera className="h-16 w-16 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}
