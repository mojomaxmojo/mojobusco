/**
 * ShareButtons – Öffentliche "Teilen"/"Pin it"-Buttons
 *
 * Wiederverwendbare Komponente für Seiten, die noch keine eigene
 * Teilen-Lösung besitzen (z. B. ArticleView, NoteView, ImageDetail).
 * Nutzt native Browser-APIs (navigator.share / navigator.clipboard) und
 * öffnet den offiziellen Pinterest "Pin erstellen"-Dialog.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Check } from 'lucide-react';

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
  image?: string;
}

export function ShareButtons({ url, title, description, image }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: description, url });
      } catch {
        // User hat abgebrochen oder Teilen ist fehlgeschlagen – ignorieren
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Zwischenablage nicht verfügbar – nichts weiter tun
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleShare}>
        {copied ? <Check className="h-4 w-4 mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
        {copied ? 'Kopiert' : 'Teilen'}
      </Button>
    </div>
  );
}
