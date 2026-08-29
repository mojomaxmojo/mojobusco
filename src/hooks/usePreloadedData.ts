/**
 * usePreloadedData.ts – Generischer Hybrid-Hook für preloaded Data + Live-Update
 *
 * 1. Lädt statisches JSON von /data/{name}.json UND /data/index.json PARALLEL
 * 2. Holt im Hintergrund neue Events seit letztem Cron via Relay-Query
 * 3. Merged beides → sofort vollständig + live aktuell
 * 4. Fallback wenn JSON fehlt (zweistufig, First-Paint-Strategie):
 *    a) FAST: kurzer Timeout (2s), kleines Limit → Rendern mit dem, was ank
 *    b) FULL: voller Timeout, limit 1000 → progressives Nachladen im Hintergrund
 *
 * Performance-Fix: Promise.all() für parallele Fetches statt sequentiell
 * Spart ~200–350ms beim ersten Seitenaufruf
 */

import { useState, useEffect, useMemo } from 'react';
import { useNostr } from '@/hooks/useNostr';
import { useQuery } from '@tanstack/react-query';
import { FIRST_PAINT_CONFIG } from '@/config/performance';
import { getDataBaseUrl } from '@/lib/apiBase';

interface PreloadedDataOptions {
  /** Name der JSON-Datei (ohne .json) – z.B. 'articles' → /data/articles.json */
  name: string;
  /** Falls verfügbar: Relay-Filter für Live-Updates */
  liveFilter?: {
    kinds: number[];
    authors?: string[];
  };
  /** Timeout für Live-Query (default: 8000ms) */
  liveTimeout?: number;
  /** Timeout für die Fast-Fallback-Query beim First Paint (default: 2000ms) */
  firstPaintTimeout?: number;
  /** Limit der Fast-Fallback-Query – Relays liefern neueste Events zuerst (default: 15) */
  firstPaintLimit?: number;
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
  const {
    name,
    liveFilter,
    liveTimeout = 8000,
    firstPaintTimeout = FIRST_PAINT_CONFIG.firstPaintTimeout,
    firstPaintLimit = FIRST_PAINT_CONFIG.firstPaintLimit,
    transformEvent,
  } = options;
  const { nostr } = useNostr();
  const [cronTimestamp, setCronTimestamp] = useState<number | undefined>(undefined);

  // ── 1. Statisches JSON + index.json PARALLEL laden ───────────────────
  // Vorher: sequentiell → articles.json erst laden, DANN index.json → +200-350ms
  // Jetzt:  Promise.all → beide gleichzeitig → spart ~200-350ms
  const staticQuery = useQuery({
    queryKey: ['preloaded', name],
    queryFn: async () => {
      try {
        // Beide Fetches parallel starten (Capacitor: absolute URL via getDataBaseUrl())
        const [dataRes, idxRes] = await Promise.all([
          fetch(`${getDataBaseUrl()}/data/${name}.json`),
          fetch(`${getDataBaseUrl()}/data/index.json`),
        ]);

        // index.json auswerten (Cron-Timestamp für Live-Update)
        if (idxRes.ok) {
          try {
            const idx = await idxRes.json();
            if (idx?.generatedAtUnix) {
              setCronTimestamp(idx.generatedAtUnix);
            }
          } catch { /* index nicht parsebar → kein Problem */ }
        }

        // Hauptdaten auswerten
        if (!dataRes.ok) throw new Error(`HTTP ${dataRes.status}`);
        const data = await dataRes.json();
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

  // ── 2. Live-Update (nur wenn statisch verfügbar + Filter + Timestamp) ─
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

  // ── 3a. Fallback FAST: kurzer First-Paint-Timeout (Erstbesucher) ──────
  // Läuft nur wenn das statische JSON fertig geladen wurde UND nicht verfügbar
  // ist. Nach max. firstPaintTimeout (2s) wird mit dem gerendert, was ank –
  // Relays streamen neueste Events zuerst, das reicht für die ersten Cards.
  const fallbackFastQuery = useQuery({
    queryKey: ['preloaded-fallback-fast', name],
    queryFn: async ({ signal }) => {
      if (!liveFilter) return [];
      const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(firstPaintTimeout)]);

      const filter: any = {
        kinds: liveFilter.kinds,
        limit: firstPaintLimit,
      };
      if (liveFilter.authors) filter.authors = liveFilter.authors;

      const events = await nostr.query([filter], { signal: abortSignal });
      if (!events || events.length === 0) return [];

      if (transformEvent) {
        return events.map(transformEvent).filter(Boolean);
      }
      return events;
    },
    enabled: staticQuery.isFetched && !isPreloaded && !!liveFilter,
    staleTime: 1000 * 60 * 30,  // 30 Min
    gcTime: 1000 * 60 * 60,     // 1h
    retry: false,               // kein Retry – Geschwindigkeit zählt, Full-Query folgt
  });

  // ── 3b. Fallback FULL: progressives Nachladen im Hintergrund ──────────
  // Startet erst nach der Fast-Query und lädt den vollständigen Bestand nach.
  // Blockiert niemals den First Paint (nicht Teil von isLoading).
  const fallbackFullQuery = useQuery({
    queryKey: ['preloaded-fallback-full', name],
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
    enabled: !isPreloaded && !!liveFilter && fallbackFastQuery.isFetched,
    staleTime: 1000 * 60 * 30,  // 30 Min
    gcTime: 1000 * 60 * 60,     // 1h
    retry: true,
  });

  // ── 4. Merged Result ─────────────────────────────────────────────────
  const data = useMemo(() => {
    if (isPreloaded) {
      const staticData = (staticQuery.data as T[]) || [];
      const liveData = (liveQuery.data as T[]) || [];

      if (liveData.length === 0) return staticData;

      // Merge: Live-Events überschreiben/ergänzen statische (nach id deduplizieren)
      const seen = new Map<string, T>();
      for (const item of staticData) {
        const key = (item as any)?.id || (item as any)?.identifier;
        if (key) seen.set(key, item);
      }
      for (const item of liveData) {
        const key = (item as any)?.id || (item as any)?.identifier;
        if (key) seen.set(key, item);
      }
      return Array.from(seen.values());
    }

    // Fallback: Fast- + Full-Query progressive mergen (Dedupe per id/identifier)
    const fastData = (fallbackFastQuery.data as T[]) || [];
    const fullData = (fallbackFullQuery.data as T[]) || [];
    if (fullData.length === 0) return fastData;
    if (fastData.length === 0) return fullData;

    const seen = new Map<string, T>();
    for (const item of [...fullData, ...fastData]) {
      const key = (item as any)?.id || (item as any)?.identifier;
      if (key) seen.set(key, item);
    }
    return Array.from(seen.values());
  }, [isPreloaded, staticQuery.data, liveQuery.data, fallbackFastQuery.data, fallbackFullQuery.data]);

  // First-Paint: nur statisches JSON + Fast-Fallback blockieren den Render.
  // Die Full-Query läuft bewusst im Hintergrund nach.
  const isLoading = staticQuery.isLoading || fallbackFastQuery.isLoading;
  const error = staticQuery.error || liveQuery.error || fallbackFastQuery.error || fallbackFullQuery.error || null;

  return {
    data,
    isLoading: isLoading && data.length === 0,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    isPreloaded,
    generatedAt: cronTimestamp,
  };
}