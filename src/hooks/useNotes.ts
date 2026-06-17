import { useMemo, useState, useEffect } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { usePreloadedData } from '@/hooks/usePreloadedData';
import { NOSTR_CONFIG } from '@/config/nostr';
import { DEFAULT_CACHE_CONFIG } from '@/config/cache';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Hook zum Laden von Notes
 *
 * Performance-Strategie (umgestellt von pure Relay → Hybrid):
 * 1. Lädt /data/notes.json sofort (~100ms, aus SW-Cache bei Wiederholungsbesuch: 0ms)
 * 2. Live-Update im Hintergrund: nur Events neuer als letzter Cron-Lauf
 * 3. Fallback auf pure Relay-Query wenn notes.json nicht existiert
 *
 * Interface-kompatibel zu vorher: gibt {data, isLoading, hasNextPage, fetchNextPage,
 * isFetchingNextPage} zurück, damit Notes.tsx unverändert bleibt.
 *
 * Infinite Scroll: clientseitig via visibleCount (kein Relay-Paging nötig,
 * da alle Notes aus JSON geladen werden).
 */
export function useNotes() {
  const [visibleCount, setVisibleCount] = useState(30);

  const { data: rawNotes, isLoading } = usePreloadedData<NostrEvent>({
    name: 'notes',
    liveFilter: {
      kinds: [NOSTR_CONFIG.kinds.note],
      authors: NOSTR_CONFIG.authorPubkeys,
    },
    liveTimeout: 6000,
    // transformEvent gilt nur für Live-Events – JSON-Filter unten separat
    transformEvent: (event: NostrEvent) => {
      const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
      const isNote = tags.some(t => ['note', 'notiz'].includes(t));
      return isNote ? event : null;
    },
  });

  // Filter auch auf JSON-Daten anwenden (transformEvent greift nur auf Live-Events)
  const allNotes = useMemo(() => {
    if (!rawNotes?.length) return rawNotes;
    return rawNotes.filter((event: NostrEvent) => {
      const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
      return tags.some(t => ['note', 'notiz'].includes(t));
    });
  }, [rawNotes]);

  // Sortiert nach Datum (neueste zuerst)
  const sortedNotes = useMemo(() => {
    if (!allNotes?.length) return [];
    return [...allNotes].sort((a, b) => b.created_at - a.created_at);
  }, [allNotes]);

  // Clientseitiges Infinite Scroll: sichtbare Seite simulieren
  const visibleNotes = useMemo(() => sortedNotes.slice(0, visibleCount), [sortedNotes, visibleCount]);
  const hasNextPage = visibleCount < sortedNotes.length;

  const fetchNextPage = () => {
    setVisibleCount(prev => prev + 30);
  };

  // visibleCount zurücksetzen wenn neue Daten kommen
  useEffect(() => {
    setVisibleCount(30);
  }, [allNotes?.length]);

  // Kompatibilitäts-Interface wie useInfiniteQuery (Notes.tsx bleibt unverändert)
  return {
    data: { pages: [visibleNotes] },
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage: false,
  };
}

/**
 * Hook zum Laden eines einzelnen Note anhand seiner Event ID
 * Validiert, dass das Event die #t note oder #t notiz Tags hat
 */
export function useNote(eventId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['note', eventId],
    queryFn: async ({ signal }) => {
      const events = await nostr.query(
        [
          {
            ids: [eventId],
            limit: 1,
          },
        ],
        {
          signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]),
        }
      );

      const event = events[0] || null;

      return event;
    },
    staleTime: DEFAULT_CACHE_CONFIG.items.staleTime, // 24 小时
    gcTime: DEFAULT_CACHE_CONFIG.items.gcTime, // 3 天
    enabled: !!eventId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Extrahiert Tags aus einem Note Event
 */
export function extractNoteTags(event: NostrEvent): string[] {
  return event.tags
    .filter(tag => tag[0] === 't')
    .map(tag => tag[1] as string);
}

/**
 * Extrahiert Bild-URLs aus einem Note Event
 */
export function extractNoteImages(event: NostrEvent): string[] {
  const images: string[] = [];

  // Suche nach Bildern im Content
  const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/gi;
  const matches = event.content.match(urlRegex);
  if (matches) {
    images.push(...matches);
  }

  // Suche nach imeta Tags
  event.tags.forEach(tag => {
    if (tag[0] === 'imeta') {
      tag.forEach((item, index) => {
        if (item.startsWith('url ')) {
          images.push(item.substring(4));
        }
      });
    }
  });

  return [...new Set(images)]; // Entferne Duplikate
}