import { useMemo } from 'react';
import { usePreloadedData } from '@/hooks/usePreloadedData';
import { NOSTR_CONFIG } from '@/config/nostr';
import { isTeaserForLongform } from '@/lib/nostrEventUtils';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Prüft, ob der Event-Content oder Tags eine Bild-/Media-URL enthalten.
 * Entspricht exakt der Filterlogik aus der ursprünglichen Home.tsx.
 */
function hasMediaContent(event: NostrEvent): boolean {
  const content = event.content.toLowerCase();

  return (
    content.includes('.jpg') ||
    content.includes('.jpeg') ||
    content.includes('.png') ||
    content.includes('.gif') ||
    content.includes('.webp') ||
    content.includes('.mp4') ||
    content.includes('.webm') ||
    content.includes('.mov') ||
    content.includes('imgur.com') ||
    content.includes('i.imgur.com') ||
    content.includes('cdn.blossom') ||
    content.includes('nostr.build') ||
    content.includes('relay.mojobus.co') ||
    content.includes('relays.mojobus.co') ||
    content.includes('blossom.primal.net')
  );
}

/**
 * Hook für den Home-Seiten "Media"-Block.
 *
 * Performance-Strategie:
 * 1. Lädt /data/bilder.json sofort (statischer Dump, ~100 ms)
 * 2. Live-Update im Hintergrund: nur Events neuer als letzter Cron-Lauf
 * 3. Fallback auf pure Relay-Query wenn bilder.json nicht existiert
 *
 * Filter bleibt identisch zur vorherigen Home.tsx-Implementierung:
 * - kind 1 (bilder.json enthält nur kind 1)
 * - Content enthält Bild-/Video-URL oder bekannte Media-Domains
 */
export function useHomeMedia() {
  const { data: rawMedia, isLoading } = usePreloadedData<NostrEvent>({
    name: 'bilder',
    liveFilter: {
      kinds: [NOSTR_CONFIG.kinds.note],
      authors: NOSTR_CONFIG.authorPubkeys,
    },
    liveTimeout: 6000,
    transformEvent: (event: NostrEvent) => {
      // Teaser-Notes für Longform-Inhalte sollen auf der Home-Seite nicht
      // zusätzlich als eigenständige Media-Einträge erscheinen.
      if (isTeaserForLongform(event)) return null;
      return hasMediaContent(event) ? event : null;
    },
  });

  const data = useMemo(() => {
    if (!rawMedia?.length) return [];

    return rawMedia
      .filter((event: NostrEvent) => !isTeaserForLongform(event) && hasMediaContent(event))
      .sort((a, b) => b.created_at - a.created_at);
  }, [rawMedia]);

  return { data, isLoading };
}
