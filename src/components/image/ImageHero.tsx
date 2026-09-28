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
import { Button } from '@/components/ui/button';
import { ZoomIn, Camera, ArrowLeft } from 'lucide-react';
import { PinImageButton } from '@/components/PinImageButton';
import { isVideoUrl } from './ImageViewer';
import { generateSrcset, generateSizes, getArticleHeaderUrl } from '@/lib/imageUtils';

interface ImageHeroProps {
  /** Erstes Medium aus dem Event-Content (Bild- oder Video-URL), kann fehlen */
  media: string | undefined;
  /** Event-Content (für PinImageButton-Beschreibung) */
  description: string;
  hashtags: string[];
  /** Schwebender Zurück-Button (Variante A): Bild beginnt ganz oben */
  onBack: () => void;
  onOpenFullscreen: () => void;
}

export function ImageHero({ media, description, hashtags, onBack, onOpenFullscreen }: ImageHeroProps) {
  const isVideo = isVideoUrl(media);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Image/Video (klassisch: object-cover, max-h-[800px]) */}
        <div
          className={`relative group ${media && isVideo ? 'cursor-default' : 'cursor-pointer'}`}
          onClick={() => media && !isVideo && onOpenFullscreen()}
        >
          {/* Schwebender Zurück-Button (Variante A) — Overlay oben links,
              halbtransparent wie die Pfeile im Vollbild-Viewer */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 left-4 z-20 rounded-full bg-black/40 backdrop-blur-[2px] text-white hover:bg-black/60 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation(); // nicht das Vollbild auslösen
              onBack();
            }}
            aria-label="Zurück zu Bilder"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

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

          {/* Hover overlay - nur für Bilder: schlichte +Lupe (transparenter) */}
          {media && !isVideo && (
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <div className="bg-white/40 rounded-full p-4 shadow-none backdrop-blur-[2px]">
                <ZoomIn className="h-8 w-8 text-gray-700/80" />
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
