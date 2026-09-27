/**
 * ImageHero.tsx
 *
 * Hero-Bild der Detailseite (/bild/{note}) randlos oben — Redesign Phase 1.
 * Feste Aspect-Ratio (kein CLS), weichgezeichnete Rückwand + vollständig
 * sichtbares Hauptbild (object-contain), fetchPriority=high + async decoding
 * für schnelles First Paint (Phase 3). Videos: preload="metadata".
 *
 * Orientierungs-adaptiv: Querformat → breites Hero (16/10 bzw. 16/9).
 * Hochformat → zentriertes Hochformat-Frame (4/5 bzw. 3/4, Höhe max.
 * ~85vh) vor vollflächiger Blur-Rückwand — kein schmaler Streifen mit
 * riesigen Rändern. Gemessen wird am schnell ladenden Thumbnail
 * (onLoad), Fallback-Messung am Hauptbild, Videos an loadedMetadata.
 */

import { useState } from 'react';
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

/** Frame-Klassen je Orientierung (Hochformat: zentrierte Card, Höhe ~85vh max.) */
const LANDSCAPE_FRAME = 'w-full aspect-[16/10] lg:aspect-[16/9]';
const PORTRAIT_FRAME = 'w-full max-w-[min(100%,64vh)] mx-auto aspect-[4/5] sm:aspect-[3/4]';

export function ImageHero({ media, description, hashtags, onBack, onOpenFullscreen }: ImageHeroProps) {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const isVideo = isVideoUrl(media);

  /** Aus natürlichen Bildmaßen die Hero-Orientierung ableiten (Quadrat ≈ Hochformat-Frame) */
  const measure = (width: number | undefined, height: number | undefined) => {
    if (!width || !height) return;
    setOrientation(width / height < 1.05 ? 'portrait' : 'landscape');
  };

  const frameClass = orientation === 'portrait' ? PORTRAIT_FRAME : LANDSCAPE_FRAME;

  return (
    <div className="relative w-full overflow-hidden bg-muted group">
      {/* Zurück-Button als Overlay am oberen Rand (bleibt auch beim zentrierten
          Hochformat-Frame in der Ecke) */}
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
        <div className={frameClass}>
          <video
            src={media}
            controls
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full bg-gray-950"
            onLoadedMetadata={(e) => measure(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
          />
        </div>
      ) : media ? (
        <>
          {/* Weichgezeichnete Rückwand: vollflächig hinter dem Frame, füllt
              alle Ränder (bei Hochformat die seitlichen Bereiche). Lädt als
              kleines Thumbnail zuerst → frühe Orientierungs-Messung. */}
          <div className="absolute inset-0" aria-hidden="true">
            <img
              src={getGalleryThumbnailUrl(media)}
              alt=""
              className="w-full h-full object-cover blur-2xl scale-110 opacity-40"
              loading="eager"
              decoding="async"
              onLoad={(e) => measure(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
            />
          </div>

          {/* Frame: definiert die Hero-Höhe. Transparent → die Blur-Rückwand
              scheint in den Contain-Rändern durch. */}
          <div className={`relative ${frameClass}`}>
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
              onLoad={(e) => measure(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
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
          </div>
        </>
      ) : (
        /* Media-Event ohne Bild-URL im Content */
        <div className="relative w-full aspect-[16/10] lg:aspect-[16/9] flex items-center justify-center">
          <Camera className="h-16 w-16 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}
