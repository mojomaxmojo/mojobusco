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

export function TeaserPreviewBox({
  preview,
  buttonLabel = '🚀 Im Nostr-Feed teilen',
  publishedLabel = '✅ Teaser-Note veröffentlicht!',
  infoText = 'Erscheint bei Primal, Amethyst & Damus — NICHT auf mojobus.co',
  onSuccess,
  isPublished = false,
}: TeaserPreviewBoxProps) {
  const { toast } = useToast();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="p-4 border-2 rounded-lg border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xl">📢</span>
        <div>
          <p className="font-semibold text-sm text-green-700 dark:text-green-300">
            Teaser-Note im Nostr-Feed teilen
          </p>
          <p className="text-xs text-muted-foreground">{infoText}</p>
        </div>
      </div>

      {/* Preview des Teaser-Inhalts */}
      <div className="bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800 rounded-lg p-3 text-xs text-gray-700 dark:text-gray-300 space-y-1.5">
        {preview.hasImage && (
          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <span>🖼️</span>
            <span className="text-xs">Titelbild wird angezeigt</span>
          </div>
        )}
        {preview.hasVideo && (
          <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
            <span>🎬</span>
            <span className="text-xs">Video wird eingebettet</span>
          </div>
        )}
        <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed break-words">
          {preview.content}
        </pre>
        <div className="flex flex-wrap gap-1 pt-1">
          {preview.tags.filter(t => t[0] === 't').map(t => (
            <span key={t[1]} className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">
              #{t[1]}
            </span>
          ))}
        </div>
      </div>

      {/* Buttons / Status */}
      {isPublished ? (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
          <CheckCircle className="h-4 w-4" />
          <span>{publishedLabel}</span>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
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
        </div>
      )}

      {/* Fehler-Anzeige */}
      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-2">
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
  );
}
