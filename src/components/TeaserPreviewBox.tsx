/**
 * TeaserPreviewBox - Wiederverwendbare Komponente für Teaser-Note im Nostr-Feed
 * Verwendet in: Berichte (Publish.tsx), Trips (TripPublishForm.tsx), Plätze
 *
 * Zeigt Preview des Teaser-Inhalts (Kind 1 Note) mit Bild/Video und
 * ermöglicht manuelles Publizieren nach dem Haupt-Event.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle } from '@/lib/icons';
import { useToast } from '@/hooks/useToast';
import { useNostrPublish } from '@/hooks/useNostrPublish';

export interface TeaserPreviewData {
  content: string;
  tags: string[][];
  naddr?: string;
  hasImage: boolean;
  hasVideo: boolean;
}

interface TeaserPreviewBoxProps {
  /** Teaser-Inhalt der publiziert werden soll */
  preview: TeaserPreviewData;
  /** Label für den Publish-Button */
  buttonLabel?: string;
  /** Wird nach erfolgreichem Teaser-Publish aufgerufen */
  onSuccess?: () => void;
  /** Optional: Label wenn schon publiziert */
  publishedLabel?: string;
  /** Wenn true, zeigt "Published" statt Button */
  isPublished?: boolean;
  /** Optional: Zusätzliche Info-Zeile oben */
  infoText?: string;
}

/** Extrahiere die Bild-URL aus den imeta-Tags */
function extractImageUrl(tags: string[][]): string | null {
  const imetaImage = tags.find(t =>
    t[0] === 'imeta' && t.some(v => v.startsWith('m image/'))
  );
  if (imetaImage) {
    const urlEntry = imetaImage.find(v => v.startsWith('url '));
    if (urlEntry) return urlEntry.slice(4);
  }
  return null;
}

/** Extrahiere die Video-URL aus den imeta-Tags */
function extractVideoUrl(tags: string[][]): string | null {
  const imetaVideo = tags.find(t =>
    t[0] === 'imeta' && t.some(v => v.startsWith('m video/'))
  );
  if (imetaVideo) {
    const urlEntry = imetaVideo.find(v => v.startsWith('url '));
    if (urlEntry) return urlEntry.slice(4);
  }
  return null;
}

/** Rendert den Content-Text: URLs werden durch [Bild] / [Video] Platzhalter ersetzt */
function renderContentText(content: string, imageUrl: string | null, videoUrl: string | null): string {
  let text = content;
  if (imageUrl) text = text.replace(imageUrl, '').trim();
  if (videoUrl) text = text.replace(videoUrl, '').trim();
  // Mehrfache Leerzeilen bereinigen
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export function TeaserPreviewBox({
  preview,
  buttonLabel = '🚀 Im Nostr-Feed teilen',
  publishedLabel = '✅ Teaser-Note veröffentlicht!',
  infoText = 'Erscheint bei Primal, Amethyst & Damus',
  onSuccess,
  isPublished = false,
}: TeaserPreviewBoxProps) {
  const { toast } = useToast();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imageUrl = extractImageUrl(preview.tags);
  const videoUrl = extractVideoUrl(preview.tags);
  const displayText = renderContentText(preview.content, imageUrl, videoUrl);

  const handlePublish = async () => {
    setIsPublishing(true);
    setError(null);
    try {
      await publishEvent({
        kind: 1,
        content: preview.content,
        tags: preview.tags,
      });
      toast({
        title: '✅ Teaser-Note veröffentlicht!',
        description: 'Erscheint im Nostr-Feed bei Primal, Amethyst & Damus',
      });
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Unbekannter Fehler');
      toast({
        title: '❌ Teaser fehlgeschlagen',
        description: err.message || 'Unbekannter Fehler',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="border-2 rounded-lg border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <span className="text-xl">📢</span>
        <div>
          <p className="font-semibold text-sm text-green-700 dark:text-green-300">
            Teaser-Note im Nostr-Feed teilen
          </p>
          <p className="text-xs text-muted-foreground">{infoText}</p>
        </div>
      </div>

      {/* Nostr-Post Vorschau (wie auf Primal/Amethyst) */}
      <div className="mx-4 mb-3 bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800 rounded-lg overflow-hidden">

        {/* Text-Content (OHNE Media-URLs) */}
        <div className="px-3 pt-3 pb-2">
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed break-words text-gray-800 dark:text-gray-200">
            {displayText}
          </pre>
        </div>

        {/* Bild – wird direkt angezeigt (wie auf Primal) */}
        {imageUrl && (
          <div className="w-full">
            <img
              src={imageUrl}
              alt="Titelbild"
              className="w-full object-cover max-h-64"
              style={{ display: 'block' }}
            />
          </div>
        )}

        {/* Video – nativer Player (wie auf Primal/Amethyst) */}
        {videoUrl && (
          <div className="w-full bg-black">
            <video
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              className="w-full"
              style={{ display: 'block', maxHeight: '280px' }}
            >
              <source src={videoUrl} type="video/mp4" />
            </video>
            <div className="px-3 py-1.5 flex items-center gap-1.5">
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">🎬 video/mp4</span>
              <span className="text-xs text-muted-foreground truncate">{videoUrl}</span>
            </div>
          </div>
        )}

        {/* Hashtags */}
        {preview.tags.filter(t => t[0] === 't').length > 0 && (
          <div className="flex flex-wrap gap-1 px-3 pb-3 pt-1">
            {preview.tags.filter(t => t[0] === 't').map(t => (
              <span key={t[1]} className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs text-blue-600 dark:text-blue-400">
                #{t[1]}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Buttons / Status */}
      <div className="px-4 pb-4">
        {isPublished ? (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
            <CheckCircle className="h-4 w-4" />
            <span>{publishedLabel}</span>
          </div>
        ) : (
          <Button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {isPublishing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Wird veröffentlicht...
              </>
            ) : (
              buttonLabel
            )}
          </Button>
        )}

        {/* Fehler-Anzeige */}
        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-2 mt-2">
            <p className="text-xs text-red-600 dark:text-red-400">❌ Fehler: {error}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handlePublish}
              className="mt-1 text-xs h-6"
            >
              🔄 Erneut versuchen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
