/**
 * ImageViewer.tsx
 *
 * Vollbild-Viewer der Bild-Detailseite (/bild/{note}) — aus ImageDetail.tsx
 * ausgelagert (Redesign Phase 1, < 500 Zeilen Regel). Lädt die Vollbild-
 * Variante erst beim Öffnen (Phasen-3-Tempo: kein Vorab-Load der großen
 * Versionen), inkl. Tastaturnavigation (ESC/←/→), Scroll-Lock, Zähler,
 * Pin-Button und Tastatur-Hinweis. Videos: Navigation deaktiviert.
 */

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { PinImageButton } from '@/components/PinImageButton';
import { generateSrcset, getArticleHeaderUrl } from '@/lib/imageUtils';

export function isVideoUrl(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('.mp4') ||
         lower.includes('.webm') ||
         lower.includes('.mov') ||
         lower.includes('.avi') ||
         lower.includes('.mkv');
}

interface ImageViewerProps {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  title: string;
  description: string;
  hashtags: string[];
}

export function ImageViewer({
  images, currentIndex, onClose, onNavigate, title, description, hashtags,
}: ImageViewerProps) {
  const current = images[currentIndex];
  const currentIsVideo = isVideoUrl(current);

  // Tastaturnavigation (für Videos deaktiviert)
  useEffect(() => {
    if (currentIsVideo) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        onNavigate(currentIndex > 0 ? currentIndex - 1 : images.length - 1);
      } else if (e.key === 'ArrowRight') {
        onNavigate(currentIndex < images.length - 1 ? currentIndex + 1 : 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, currentIsVideo, images.length, onClose, onNavigate]);

  // Body-Scroll sperren solange der Viewer offen ist
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Image counter */}
      <div className="absolute top-4 left-4 z-50 text-white bg-black/50 px-3 py-1 rounded-md">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Previous / Next buttons */}
      {images.length > 1 && !currentIsVideo && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(currentIndex > 0 ? currentIndex - 1 : images.length - 1);
            }}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(currentIndex < images.length - 1 ? currentIndex + 1 : 0);
            }}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </>
      )}

      {/* Main image/video — Vollbild-URL wird erst beim Öffnen geladen */}
      {currentIsVideo ? (
        <video
          src={current}
          controls
          className="w-full h-full max-w-[99vw] object-contain"
          onClick={onClose}
        />
      ) : (
        <>
          <img
            src={getArticleHeaderUrl(current)}
            srcSet={generateSrcset(current, 'gallery')}
            sizes="100vw"
            alt={`Bild ${currentIndex + 1}`}
            className="w-full h-full max-w-[99vw] object-contain"
            loading="eager"
            decoding="async"
            onClick={onClose}
          />
          <PinImageButton
            imageUrl={current}
            pageUrl={window.location.href}
            title={title}
            description={description}
            hashtags={hashtags}
            className="absolute bottom-6 right-6 z-50"
          />
        </>
      )}

      {/* Keyboard hint */}
      {!currentIsVideo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 text-white/70 text-sm bg-black/50 px-4 py-2 rounded-md">
          ESC zum Schließen {images.length > 1 && '• ← → zum Navigieren'}
        </div>
      )}
    </div>
  );
}
