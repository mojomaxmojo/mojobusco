import { useMemo } from 'react';
import { usePreloadedData } from '@/hooks/usePreloadedData';
import { NOSTR_CONFIG } from '@/config/nostr';
import { isTeaserForLongform } from '@/lib/nostrEventUtils';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Hook für den Home-Seiten "Notes"-Block.
 *
 * Performance-Strategie:
 * 1. Lädt /data/notes.json sofort (statischer Dump, ~100 ms)
 * 2. Live-Update im Hintergrund: nur Events neuer als letzter Cron-Lauf
 * 3. Fallback auf pure Relay-Query wenn notes.json nicht existiert
 *
 * Filter bleibt identisch zur vorherigen Home.tsx-Implementierung:
 * - kind 1
 * - #t enthält 'note' oder 'notiz'
 */
export function useHomeNotes() {
  const { data: rawNotes, isLoading } = usePreloadedData<NostrEvent>({
    name: 'notes',
    liveFilter: {
      kinds: [NOSTR_CONFIG.kinds.note],
      authors: NOSTR_CONFIG.authorPubkeys,
    },
    liveTimeout: 6000,
    transformEvent: (event: NostrEvent) => {
      // Teaser-Notes für Longform-Inhalte sollen auf der Home-Seite nicht
      // zusätzlich als eigenständige Notes erscheinen.
      if (isTeaserForLongform(event)) return null;
      const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
      const isNote = tags.some(t => ['note', 'notiz'].includes(t));
      return isNote ? event : null;
    },
  });

  const data = useMemo(() => {
    if (!rawNotes?.length) return [];

    return rawNotes
      .filter((event: NostrEvent) => {
        if (isTeaserForLongform(event)) return false;
        const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
        return tags.some(t => ['note', 'notiz'].includes(t));
      })
      .sort((a, b) => b.created_at - a.created_at);
  }, [rawNotes]);

  return { data, isLoading };
}
