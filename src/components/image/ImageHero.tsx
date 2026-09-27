/**
 * ImageHero.tsx
 *
 * Bild-Card der Detailseite (/bild/{note}) — klassische Darstellung oben
 * (Wunsch: Hero-Bild ohne Redesign): Card, object-cover, max-h-[800px],
 * Hover-Zoom-Overlay + Pin-Button, wie vor dem Redesign. Behaltene
 * Phase-3-Optimierungen: fetchPriority="high" + decoding="async"
 * (optisch identisch, schnelleres First Paint). Videos: preload="none".
 * Die Autor-Zeile bleibt unten im Content-Bereich (Aufteilung unverändert).
 */

import { Card, CardContent } from '@/components/ui/card';
import { ZoomIn, Camera } from 'lucide-react';
import { PinImageButton } from '@/components/PinImageButton';
import { isVideoUrl } from './ImageViewer';
import { generateSrcset, generateSizes, getArticleHeaderUrl } from '@/lib/imageUtils';

interface ImageHeroProps {
  /** Erstes Medium aus dem Event-Content (Bild- oder Video-URL), kann fehlen */
  media: string | undefined;
  /** Event-Content (für PinImageButton-Beschreibung) */
  description: string;
  hashtags: string[];
  onOpenFullscreen: () => void;
}

export function ImageHero({ media, description, hashtags, onOpenFullscreen }: ImageHeroProps) {
  const isVideo = isVideoUrl(media);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Image/Video (klassisch: object-cover, max-h-[800px]) */}
        <div
          className={`relative group ${media && isVideo ? 'cursor-default' : 'cursor-pointer'}`}
          onClick={() => media && !isVideo && onOpenFullscreen()}
        >
          {media && isVideo ? (
            <video
              src={media}
              controls
              preload="none"
              playsInline
              className="w-full bg-gray-100 dark:bg-gray-900 max-h-[800px]"
            />
          ) : media ? (
            <img
              src={getArticleHeaderUrl(media)}
              srcSet={generateSrcset(media, 'gallery')}
              sizes={generateSizes('header')}
              fetchPriority="high"
              alt="Reisebild"
              className="w-full object-cover bg-gray-100 dark:bg-gray-900 max-h-[800px]"
              loading="eager"
              decoding="async"
            />
          ) : (
            /* Media-Event ohne Bild-URL im Content */
            <div className="w-full aspect-[16/9] bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
              <Camera className="h-16 w-16 text-muted-foreground/40" />
            </div>
          )}

          {/* Hover overlay - nur für Bilder: schlichte +Lupe (ohne Text) */}
          {media && !isVideo && (
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <div className="bg-white/90 rounded-full p-4 shadow-lg">
                <ZoomIn className="h-8 w-8 text-gray-800" />
              </div>
            </div>
          )}

          {media && !isVideo && (
            <PinImageButton
              imageUrl={media}
              pageUrl={window.location.href}
              title="Bild von MojoBus"
              description={description}
              hashtags={hashtags}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
