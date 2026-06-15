import { useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { usePreloadedData } from '@/hooks/usePreloadedData';
import { NOSTR_CONFIG } from '@/config/nostr';
import { DEFAULT_CACHE_CONFIG } from '@/config/cache';
import { DEFAULT_PERFORMANCE_CONFIG } from '@/config/performance';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Validiert ein Longform Artikel Event (NIP-23) oder Platz Event.
 *
 * Bewusst LIBERAL gehalten damit externe Clients (Amethyst, Primal, Yakihonne)
 * und MojoBus-eigene Artikel gleichermaßen angezeigt werden.
 *
 * Pflicht (NIP-23 Standard):
 *   - kind 30023
 *   - d-Tag vorhanden
 *   - content nicht leer
 *
 * Optional (erhöht Qualität, aber kein hartes Filter):
 *   - title-Tag empfohlen → wird notfalls aus Content extrahiert
 */
function validateLongformArticle(event: NostrEvent): boolean {
  if (!event) return false;
  if (event.kind !== NOSTR_CONFIG.kinds.longform) return false;

  // d-Tag ist Pflicht (NIP-23 addressable event)
  const d = event.tags.find(([name]) => name === 'd')?.[1];
  if (!d) return false;

  // Content darf nicht leer sein
  const content = event.content || '';
  if (content.trim().length === 0) return false;

  // title-Tag ODER name-Tag ODER extrahierbarer Titel aus Content
  const title = event.tags.find(([name]) => name === 'title')?.[1] ||
                event.tags.find(([name]) => name === 'name')?.[1] ||
                extractTitleFromContent(content);
  if (!title) return false;

  return true;
}

/**
 * Prüft ob ein Event ein Platz ist (hat type=place, #t place, #t places, oder identifier beginnt mit "place-")
 */
function isPlaceEvent(event: NostrEvent): boolean {
  if (!event || !event.tags) return false;

  const typeTag = event.tags.find(([name]) => name === 'type')?.[1];
  const placeTag = event.tags.some(([name, value]) => name === 't' && ['place', 'places'].includes(value));
  const identifier = event.tags.find(([name]) => name === 'd')?.[1] || '';
  const hasPlaceIdentifier = identifier && identifier.startsWith('place-');

  return typeTag === 'place' || placeTag || hasPlaceIdentifier;
}

/**
 * Extrahiert Metadaten aus einem Longform Artikel oder Platz
 */
export function extractArticleMetadata(event: NostrEvent) {
  const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
  const content = event.content || '';

  const title = event.tags.find(([name]) => name === 'title')?.[1] ||
                event.tags.find(([name]) => name === 'name')?.[1] ||
                extractTitleFromContent(content) || 'Ohne Titel';

  // Versuche summary-Tag zu extrahieren, wenn nicht vorhanden, generiere aus Content
  let summary = event.tags.find(([name]) => name === 'summary')?.[1] || '';

  // Wenn kein summary-Tag existiert, generiere aus dem Content (nach dem Titel)
  if (!summary && content) {
    let contentToExtract = content;

    // Schritt 1: Entferne HTML-Elemente mit strukturierten Daten
    // H1 Titel
    contentToExtract = contentToExtract.replace(/<h1[^>]*>.*?<\/h1>/gis, '');

    // H2 Überschriften (Bilder etc.)
    contentToExtract = contentToExtract.replace(/<h2[^>]*>.*?<\/h2>/gis, '');

    // Strukturierte Absätze mit fettgedruckten Labels (HTML-Format)
    // z.B. <p><strong>Kategorie:</strong> wildcamping</p>
    const structuredPatterns = [
      /<p><strong>Kategorie:<\/strong>.*?<\/p>/gis,
      /<p><strong>Bewertung:<\/strong>.*?<\/p>/gis,
      /<p><strong>Standort:<\/strong>.*?<\/p>/gis,
      /<p><strong>Koordinaten:<\/strong>.*?<\/p>/gis,
      /<p><strong>Einrichtungen:<\/strong>.*?<\/p>/gis,
      /<p><strong>Geeignet für:<\/strong>.*?<\/p>/gis,
      /<p><strong>Preis:<\/strong>.*?<\/p>/gis,
    ];

    structuredPatterns.forEach(pattern => {
      contentToExtract = contentToExtract.replace(pattern, '');
    });

    // Schritt 2: Entferne alle verbleibenden HTML-Tags
    // Das entfernt auch <p>, </p>, <strong>, </strong> etc.
    contentToExtract = contentToExtract.replace(/<[^>]+>/g, '');

    // Schritt 3: Entferne HTML-Entities
    contentToExtract = contentToExtract.replace(/&nbsp;/g, ' ');
    contentToExtract = contentToExtract.replace(/&amp;/g, '&');
    contentToExtract = contentToExtract.replace(/&lt;/g, '<');
    contentToExtract = contentToExtract.replace(/&gt;/g, '>');

    // Schritt 4: Entferne Markdown-formatierte Zeilen (Fallback für alte Events)
    const cleanedContent = contentToExtract
      .replace(/^\*\*[^:]+:\*\*.*$/gm, '') // **Kategorie:** etc.
      .replace(/^## .+$/gm, '')           // ## Bilder etc.
      .replace(/!\[.*?\]\(.*?\)/g, '')   // Bilder-Markdown
      .replace(/\n\s*\n/g, '\n')          // Entferne doppelte Zeilenumbrüche
      .trim();

    // Schritt 5: Nimm die ersten 200 Zeichen als summary
    if (cleanedContent.length > 0) {
      summary = cleanedContent.length > 200
        ? cleanedContent.substring(0, 197) + '...'
        : cleanedContent;
    }
  }

  // Fallback: Falls die Summary immer noch HTML enthält, nochmal bereinigen
  if (summary && summary.includes('<')) {
    summary = summary
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  const image = event.tags.find(([name]) => name === 'image')?.[1] || '';
  const published_at = event.tags.find(([name]) => name === 'published_at')?.[1];
  const tags = event.tags.filter(([name]) => name === 't').map(([, value]) => value);

  return {
    identifier: d,
    title,
    summary,
    image,
    publishedAt: published_at ? parseInt(published_at) : event.created_at,
    tags,
    content,
  };
}

/**
 * Extrahiert Titel aus dem Content (für Markdown-Format mit # Titel)
 */
function extractTitleFromContent(content: string): string | null {
  if (!content || typeof content !== 'string') {
    return null;
  }

  const lines = content.split('\n');
  const firstLine = lines[0]?.trim();

  if (firstLine?.startsWith('# ')) {
    return firstLine.slice(2).trim();
  }

  return null;
}

/**
 * Hook zum Laden von Longform Artikeln mit optionalen Filtern (NIP-23, kind 30023)
 * Deprecated: Verwende useInfiniteLongformArticles für bessere Performance
 */
export function useLongformArticles(options?: {
  kinds?: number[];
  '#t'?: string[];
  authors?: string[];
  limit?: number;
}) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['longform-articles', NOSTR_CONFIG.authorPubkeys, options?.['#t']],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(DEFAULT_PERFORMANCE_CONFIG.relay.queryTimeout * 2.5)]);

      const filter: any = {
        kinds: options?.kinds || [NOSTR_CONFIG.kinds.longform],
        authors: options?.authors || NOSTR_CONFIG.authorPubkeys,
        limit: options?.limit || 100,
      };

      // Füge Tag-Filter hinzu wenn vorhanden
      if (options?.['#t'] && options['#t'].length > 0) {
        filter['#t'] = options['#t'];
      }

      const events = await nostr.query([filter], { signal });

      // Validiere und filtere Artikel (Plätze ausschließen)
      const validArticles = events.filter(event => {
        const isValid = validateLongformArticle(event);
        const isPlace = isPlaceEvent(event);
        return isValid && !isPlace;
      });

      // Sortiere nach Datum (neueste zuerst)
      return validArticles.sort((a, b) => b.created_at - a.created_at);
    },
    staleTime: DEFAULT_CACHE_CONFIG.lists.staleTime, // 24 Stunden
    gcTime: DEFAULT_CACHE_CONFIG.lists.gcTime, // 3 Tage
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hook zum Laden von Longform Artikeln mit Infinite Scroll für bessere Performance
 * Lädt Artikel in Batches (30 pro Seite) bei Bedarf
 *
 * PERFORMANCE OPTIMIERUNG:
 * - Limit: 30 Events pro Query (statt 15) um mehr Artikel zu erhalten
 * - Timeout: 7500ms (3s * 2.5) für bessere Zuverlässigkeit
 * - Logging: Konsolenausgaben zur Fehlersuche
 */
export function useInfiniteLongformArticles(options?: {
  kinds?: number[];
  '#t'?: string[];
  authors?: number[];
}) {
  const { nostr } = useNostr();

  return useInfiniteQuery({
    queryKey: ['infinite-longform-articles', NOSTR_CONFIG.authorPubkeys, options?.['#t']],
    queryFn: async ({ pageParam, signal }) => {
      const abortSignal = AbortSignal.any([signal!, AbortSignal.timeout(DEFAULT_PERFORMANCE_CONFIG.relay.queryTimeout * 2.5)]);

      const filter: any = {
        kinds: options?.kinds || [NOSTR_CONFIG.kinds.longform],
        authors: options?.authors || NOSTR_CONFIG.authorPubkeys,
        limit: DEFAULT_PERFORMANCE_CONFIG.infiniteScroll.itemsPerPage * 2, // 30 Events statt 15
      };

      // Timestamp-basierte Pagination
      if (pageParam) {
        filter.until = pageParam;
      }

      // Füge Tag-Filter hinzu wenn vorhanden
      if (options?.['#t'] && options['#t'].length > 0) {
        filter['#t'] = options['#t'];
      }

      // Logging: Query starten
      if (pageParam) {
        console.log('🔄 Articles Infinite Scroll: Fetching next page', { until: pageParam });
      } else {
        console.log('📄 Articles Infinite Scroll: Fetching first page');
      }

      const events = await nostr.query([filter], { signal: abortSignal });

      console.log('📦 Articles Infinite Scroll: Received', events.length, 'events from relay (limit was', filter.limit + ')');

      // Validiere und filtere Artikel (Plätze ausschließen)
      const validArticles = events.filter(event => {
        const isValid = validateLongformArticle(event);
        const isPlace = isPlaceEvent(event);
        return isValid && !isPlace;
      });

      const filteredCount = events.length - validArticles.length;
      console.log(`✅ Articles Infinite Scroll: ${validArticles.length} valid articles, ${filteredCount} filtered out`);

      if (events.length > 0 && validArticles.length === 0) {
        console.warn('⚠️ Articles Infinite Scroll: All events were filtered out (no valid articles)');
      }

      // Sortiere nach Datum (neueste zuerst)
      return validArticles.sort((a, b) => b.created_at - a.created_at);
    },
    getNextPageParam: (lastPage, allPages) => {
      // Wenn keine Artikel mehr zurückgegeben wurden, sind wir fertig
      if (lastPage.length === 0) {
        console.log('🚫 Articles Infinite Scroll: No more articles (empty page)');
        return undefined;
      }

      // Berechne nächsten Timestamp (1 Sekunde vor dem letzten Event)
      const lastCreated = lastPage[lastPage.length - 1].created_at;
      const totalPages = allPages.length;
      const totalArticles = allPages.flat().length;

      console.log('➡️ Articles Infinite Scroll: Next page', {
        page: totalPages + 1,
        until: lastCreated - 1,
        totalArticlesSoFar: totalArticles
      });

      return lastCreated - 1;
    },
    initialPageParam: undefined,
    staleTime: DEFAULT_CACHE_CONFIG.lists.staleTime, // 24 Stunden
    gcTime: DEFAULT_CACHE_CONFIG.lists.gcTime, // 3 Tage
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hook zum Laden von Plätzen (nur Events mit type=place oder #t place)
 */
export function usePlaces(options?: { limit?: number }) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['places', NOSTR_CONFIG.authorPubkeys, options?.limit],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(DEFAULT_PERFORMANCE_CONFIG.relay.queryTimeout * 2.5)]);

      const events = await nostr.query(
        [
          {
            kinds: [NOSTR_CONFIG.kinds.longform],
            authors: NOSTR_CONFIG.authorPubkeys,
            limit: options?.limit || DEFAULT_PERFORMANCE_CONFIG.infiniteScroll.itemsPerPage * 4,
          },
        ],
        { signal }
      );

      // Validiere und filtere Plätze
      const validPlaces = events.filter(event => {
        const isValid = validateLongformArticle(event);
        const isPlace = isPlaceEvent(event);
        return isValid && isPlace;
      });

      // Sortiere nach Datum (neueste zuerst)
      return validPlaces.sort((a, b) => b.created_at - a.created_at);
    },
    staleTime: DEFAULT_CACHE_CONFIG.lists.staleTime, // 24 Stunden
    gcTime: DEFAULT_CACHE_CONFIG.lists.gcTime, // 3 Tage
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hook zum Laden eines einzelnen Longform Artikels
 */
export function useLongformArticle(identifier: string, authorPubkey: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['longform-article', identifier, authorPubkey],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(DEFAULT_PERFORMANCE_CONFIG.relay.queryTimeout * 2.5)]);

      const events = await nostr.query(
        [
          {
            kinds: [NOSTR_CONFIG.kinds.longform],
            authors: [authorPubkey],
            '#d': [identifier],
            limit: 1,
          },
        ],
        { signal }
      );

      const article = events[0];
      if (!article || !validateLongformArticle(article)) {
        return null;
      }

      return article;
    },
    staleTime: DEFAULT_CACHE_CONFIG.items.staleTime, // 24 小时
    gcTime: DEFAULT_CACHE_CONFIG.items.gcTime, // 3 天
    enabled: !!identifier && !!authorPubkey,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

// ── Preloaded Articles (Hybrid: JSON + Live-Update) ─────────────────────────

/**
 * Nutzt preloaded Data (statisches JSON vom VPS) + Live-Update im Hintergrund.
 * Ersetzt useInfiniteLongformArticles auf Seiten mit Preloading-Verfügbarkeit.
 *
 * Vorteile:
 * - Alle Artikel sofort verfügbar (keine Pagination)
 * - Kein Relay-Timeout beim ersten Laden
 * - Live-Updates für neue Artikel im Hintergrund
 * - Fallback auf pure Relay-Queries wenn JSON fehlt
 */
export function usePreloadedArticles() {
  const result = usePreloadedData<NostrEvent>({
    name: 'articles',
    liveFilter: {
      kinds: [NOSTR_CONFIG.kinds.longform],
      authors: NOSTR_CONFIG.authorPubkeys,
    },
    liveTimeout: 8000,
    transformEvent: (event) => {
      if (!validateLongformArticle(event)) return null;
      if (isPlaceEvent(event)) return null;
      return event;
    },
  });

  // Sortieren (neueste zuerst)
  const sortedData = useMemo(() => {
    if (!result.data) return [];
    return [...result.data].sort((a, b) => b.created_at - a.created_at);
  }, [result.data]);

  return {
    ...result,
    data: sortedData,
  };
}