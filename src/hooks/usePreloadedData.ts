/**
 * usePreloadedData.ts – Generischer Hybrid-Hook für preloaded Data + Live-Update
 *
 * 1. Lädt statisches JSON von /data/{name}.json (50ms, keine Relay-Abhängigkeit)
 * 2. Holt im Hintergrund neue Events seit letztem Cron via Relay-Query
 * 3. Merged beides → sofort vollständig + live aktuell
 * 4. Fallback auf pure Live-Queries wenn JSON nicht existiert
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNostr } from '@/hooks/useNostr';
import { useQuery } from '@tanstack/react-query';

interface PreloadedDataOptions {
  /** Name der JSON-Datei (ohne .json) – z.B. 'articles' → /data/articles.json */
  name: string;
  /** Falls verfügbar: Relay-Filter für Live-Updates */
  liveFilter?: {
    kinds: number[];
    authors?: string[];
  };
  /** Timeout für Live-Query (default: 5000ms) */
  liveTimeout?: number;
  /** Transform-Funktion für Events → Data-Einträge */
  transformEvent?: (event: any) => any;
}

interface PreloadedDataResult<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  /** Ist das statische JSON geladen? (false = Fallback auf Live) */
  isPreloaded: boolean;
  /** Cron-Timestamp (für Live-Update: nur neuere Events) */
  generatedAt?: number;
}

export function usePreloadedData<T = any>(options: PreloadedDataOptions): PreloadedDataResult<T> {
  const { name, liveFilter, liveTimeout = 8000, transformEvent } = options;
  const { nostr } = useNostr();
  const [cronTimestamp, setCronTimestamp] = useState<number | undefined>(undefined);
  const hasAttemptedRef = useRef(false);

  // ── 1. Statisches JSON laden ──────────────────────────────────────────
  const staticQuery = useQuery({
    queryKey: ['preloaded', name],
    queryFn: async () => {
      try {
        const res = await fetch(`/data/${name}.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Cron-Timestamp aus index.json holen (einmalig)
        if (!hasAttemptedRef.current) {
          hasAttemptedRef.current = true;
          try {
            const idxRes = await fetch('/data/index.json');
            if (idxRes.ok) {
              const idx = await idxRes.json();
              setCronTimestamp(idx.generatedAtUnix);
            }
          } catch { /* index nicht verfügbar → kein Problem */ }
        }

        return Array.isArray(data) ? data : [];
      } catch {
        // JSON nicht verfügbar → Fallback auf Live-Query
        return null;
      }
    },
    staleTime: Infinity,     // Nie veralten (wird nur per Live-Update ergänzt)
    gcTime: 1000 * 60 * 60,  // 1h GC
    retry: 1,
  });

  const isPreloaded = staticQuery.data !== null && staticQuery.data !== undefined;

  // ── 2. Live-Update (nur wenn statisch verfügbar + Filter gesetzt) ─────
  const liveQuery = useQuery({
    queryKey: ['preloaded-live', name, cronTimestamp],
    queryFn: async ({ signal }) => {
      if (!liveFilter) return [];
      const since = cronTimestamp || Math.floor(Date.now() / 1000) - 86400; // 24h default
      const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(liveTimeout)]);

      const filter: any = {
        kinds: liveFilter.kinds,
        limit: 500,
        since,
      };
      if (liveFilter.authors) filter.authors = liveFilter.authors;

      const events = await nostr.query([filter], { signal: abortSignal });
      if (!events || events.length === 0) return [];

      // Transformieren falls vorhanden
      if (transformEvent) {
        return events.map(transformEvent).filter(Boolean);
      }
      return events;
    },
    enabled: isPreloaded && !!liveFilter && cronTimestamp !== undefined,
    staleTime: 1000 * 60 * 5,  // 5 Minuten
    gcTime: 1000 * 60 * 30,    // 30 Minuten
    retry: false,
  });

  // ── 3. Fallback: Pure Live-Query wenn kein statisches JSON ────────────
  const fallbackQuery = useQuery({
    queryKey: ['preloaded-fallback', name],
    queryFn: async ({ signal }) => {
      if (!liveFilter) return [];
      const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(liveTimeout)]);

      const filter: any = {
        kinds: liveFilter.kinds,
        limit: 1000,
      };
      if (liveFilter.authors) filter.authors = liveFilter.authors;

      const events = await nostr.query([filter], { signal: abortSignal });
      if (!events || events.length === 0) return [];

      if (transformEvent) {
        return events.map(transformEvent).filter(Boolean);
      }
      return events;
    },
    enabled: !isPreloaded && !!liveFilter,
    staleTime: 1000 * 60 * 30,  // 30 Min
    gcTime: 1000 * 60 * 60,     // 1h
    retry: true,
  });

  // ── 4. Merged Result ─────────────────────────────────────────────────
  const data = useMemo(() => {
    if (isPreloaded) {
      // Merge: Static + Live-Updates (nach id deduplizieren)
      const staticData = (staticQuery.data as T[]) || [];
      const liveData = (liveQuery.data as T[]) || [];

      if (liveData.length === 0) return staticData;

      const seen = new Map<string, T>();
      for (const item of staticData) {
        const key = (item as any)?.id || (item as any)?.identifier;
        if (key) seen.set(key, item);
      }
      for (const item of liveData) {
        const key = (item as any)?.id || (item as any)?.identifier;
        if (key) seen.set(key, item); // überschreibt/ergänzt
      }
      return Array.from(seen.values());
    }

    // Fallback: Pure Live-Daten
    return (fallbackQuery.data as T[]) || [];
  }, [isPreloaded, staticQuery.data, liveQuery.data, fallbackQuery.data]);

  const isLoading = staticQuery.isLoading || fallbackQuery.isLoading;
  const error = staticQuery.error || liveQuery.error || fallbackQuery.error || null;

  // Cleanup: hasAttemptedRef zurücksetzen bei Name-Änderung
  useEffect(() => {
    hasAttemptedRef.current = false;
  }, [name]);

  return {
    data,
    isLoading: isLoading && data.length === 0,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    isPreloaded,
    generatedAt: cronTimestamp,
  };
}

/**
 * Notes (kind 1) – lädt aus /data/notes.json + Live-Update im Hintergrund
 */
export function usePreloadedNotes() {
  return usePreloadedData({
    name: 'notes',
    liveFilter: { kinds: [1], authors: undefined },
    liveTimeout: 8000,
  });
}

/**
 * Places (kind 30023 mit type=place) – lädt aus /data/places.json + Live-Update
 */
export function usePreloadedPlaces() {
  return usePreloadedData({
    name: 'places',
    liveFilter: { kinds: [30023], authors: undefined },
    liveTimeout: 8000,
  });
}

/**
 * Media/Bilder (kind 1 mit media-Tags) – lädt aus /data/bilder.json + Live-Update
 */
export function usePreloadedMedia() {
  return usePreloadedData({
    name: 'bilder',
    liveFilter: { kinds: [1], authors: undefined },
    liveTimeout: 8000,
  });
}