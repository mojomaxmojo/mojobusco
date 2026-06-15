import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { NOSTR_CONFIG } from '@/config/nostr';
import { DEFAULT_CACHE_CONFIG } from '@/config/cache';
import { getValidAuthorPubkeys } from '@/lib/authors';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Hook zum Laden von Notes mit Infinite Scroll
 * Filtert nur Notes mit #t note oder #t notiz Tags
 */
export function useNotes() {
  const { nostr } = useNostr();

  return useInfiniteQuery({
    queryKey: ['notes', NOSTR_CONFIG.authorPubkeys],
    queryFn: async ({ pageParam, signal }) => {
      const filter: any = {
        kinds: [NOSTR_CONFIG.kinds.note],
        '#t': ['note', 'notiz'], // Nur Notes mit #t note oder #t notiz
        limit: 30, // Reduziert - Relays geben oft mehr zurück als angefordert
        authors: NOSTR_CONFIG.authorPubkeys,
      };

      if (pageParam) {
        filter.until = pageParam;
        console.log('🔄 Notes Infinite Scroll: Fetching next page', { until: pageParam });
      } else {
        console.log('📄 Notes Infinite Scroll: Fetching first page');
      }

      const events = await nostr.query([filter], {
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      });

      console.log('📦 Notes Infinite Scroll: Received', events.length, 'events from relay (limit was 30)');

      // Wenn der Relay zu viele Events zurückgibt, auf max 30 pro Seite beschränken
      const MAX_PER_PAGE = 30;
      const paginatedEvents = events.slice(0, MAX_PER_PAGE);

      if (events.length > MAX_PER_PAGE) {
        console.log(`⚠️ Notes Infinite Scroll: Limiting to ${MAX_PER_PAGE} notes (received ${events.length})`);
      }

      return paginatedEvents;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.length === 0) {
        console.log('🚫 Notes Infinite Scroll: No more notes (empty page)');
        return undefined;
      }

      const lastCreated = lastPage[lastPage.length - 1].created_at;
      const nextPageParam = lastCreated - 1;

      console.log('➡️ Notes Infinite Scroll: Next page param', {
        lastPageLength: lastPage.length,
        lastCreated,
        nextPageParam
      });

      return nextPageParam;
    },
    initialPageParam: undefined,
    staleTime: DEFAULT_CACHE_CONFIG.lists.staleTime, // 24 小时
    gcTime: DEFAULT_CACHE_CONFIG.lists.gcTime, // 3 天
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
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