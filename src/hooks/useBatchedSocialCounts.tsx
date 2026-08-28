/**
 * useBatchedSocialCounts – Batch-Ladung von Social-Counts für ganze Feeds
 *
 * Problem (vorher): Jede Feed-Card (SocialBar compact) startete eigene
 * Relay-Queries: useSocialCounts (kinds 6/7/16/1111), useZaps (9735) und
 * useComments (bis zu 6 Filter × 4 Relays, 8s Timeout). Bei 15 Cards pro
 * Feed = 50–500 offene Subscriptions pro Seitenaufruf + 60s-Zap-Polling.
 *
 * Lösung: Der SocialBatchProvider sammelt alle gerenderten Events einer
 * Feed-Seite und lädt ALLE Counts in EINER Relay-Query (Multiple Filters
 * in einem Query-Aufruf, NIP-01). SocialBar liest im Batch-Scope aus dem
 * Context statt eigene Queries zu starten – die per-Event-Hooks werden
 * über root=null sauber deaktiviert (enabled-Kette in den Hooks selbst).
 *
 * Invalidation bleibt vollständig erhalten:
 * - Like/Repost invalidieren ['social-counts'] (Prefix) → Count-Batch
 *   refetcht (siehe useSocialActions) → Zähler aktualisieren sich wie bisher
 * - Zap-Aktionen invalidieren ['zaps'] (Prefix) → Zap-Batch refetcht
 *
 * Counts-Semantik (Parität zu den bisherigen Hooks):
 * - likes:    eindeutige Pubkeys mit Kind-7-Reaktion '❤️' (useSocialCounts)
 * - reposts:  eindeutige Pubkeys, Kind 6/16 (useSocialCounts)
 * - comments: Anzahl Kind-1111-Events (wie allComments.length auf Detailseiten)
 * - zaps:     Anzahl Zap-Receipts, Kind 9735 (wie useZaps.zapCount)
 *
 * Fallback: Events, die (noch) nicht im Batch sind (z. B. kurz nach
 * Infinite-Scroll-Nachladen), liefern null → SocialBar fällt automatisch
 * auf ihre eigenen per-Event-Hooks zurück. Kein Deadlock, keine Lücke.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import type { NostrEvent } from '@nostrify/nostrify';

// ============================================================================
// Typen
// ============================================================================

/** Counts für ein Event im Batch-Scope (SocialBar-Verbrauchssicht) */
export interface BatchedCounts {
  likes: number;
  reposts: number;
  comments: number;
  zaps: number;
  loading: boolean;
}

interface CountResult {
  likes: number;
  reposts: number;
  comments: number;
}

type CountMap = Record<string, CountResult>;
type ZapMap = Record<string, number>;

interface SocialBatchContextValue {
  /** e-Tag-/a-Tag-Wert → Ziel-Event-ID */
  refLookup: Map<string, string>;
  counts: CountMap;
  zaps: ZapMap;
  isLoading: boolean;
}

// ============================================================================
// Konstanten
// ============================================================================

/** Relays limitieren Filtergrößen – max. 100 IDs pro Filter (NIP-01 Üblich) */
const MAX_REFS_PER_FILTER = 100;

/** Timeout für die Batch-Queries */
const BATCH_TIMEOUT = 5000;

/** Cache-Zeiten (Parität zu useSocialCounts/useZaps) */
const COUNTS_STALE_TIME = 60_000; // 1 Minute
const ZAPS_STALE_TIME = 30_000; // 30 Sekunden

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// ============================================================================
// Context
// ============================================================================

const SocialBatchContext = createContext<SocialBatchContextValue | null>(null);

// ============================================================================
// Zähl-Logik (gemeinsam für beide Queries)
// ============================================================================

interface Acc {
  likeUsers: Set<string>;
  repostUsers: Set<string>;
  comments: number;
  zaps: number;
}

/**
 * Attribuiert Social-Events (Reactions/Reposts/Comments/Zap-Receipts) auf
 * die Ziel-Events anhand ihrer e/a-Tags. Events, die kein Ziel im Batch
 * referenzieren, werden ignoriert.
 */
function attribute(
  events: NostrEvent[],
  refLookup: Map<string, string>,
  accs: Map<string, Acc>,
): void {
  const seenEventIds = new Set<string>();

  for (const e of events) {
    // Dedupe: dasselbe Receipt kann per #e- UND #a-Filter ankommen
    if (seenEventIds.has(e.id)) continue;
    seenEventIds.add(e.id);

    // Alle Ziel-Events dieses Social-Events bestimmen (dedupliziert)
    const targetIds = new Set<string>();
    for (const [tagName, tagValue] of e.tags) {
      if ((tagName === 'e' || tagName === 'a') && tagValue) {
        const targetId = refLookup.get(tagValue);
        if (targetId) targetIds.add(targetId);
      }
    }
    if (targetIds.size === 0) continue;

    for (const targetId of targetIds) {
      let acc = accs.get(targetId);
      if (!acc) {
        acc = { likeUsers: new Set(), repostUsers: new Set(), comments: 0, zaps: 0 };
        accs.set(targetId, acc);
      }

      switch (e.kind) {
        case 7: // Reaction – nur ❤️ zählt als Like (wie useSocialCounts)
          if (e.content === '❤️') acc.likeUsers.add(e.pubkey);
          break;
        case 6: // Repost
        case 16: // Generic Repost
          acc.repostUsers.add(e.pubkey);
          break;
        case 1111: // NIP-22 Comment
          acc.comments += 1;
          break;
        case 9735: // Zap Receipt
          acc.zaps += 1;
          break;
      }
    }
  }
}

function accsToCountMap(accs: Map<string, Acc>): CountMap {
  const out: CountMap = {};
  for (const [id, acc] of accs) {
    out[id] = {
      likes: acc.likeUsers.size,
      reposts: acc.repostUsers.size,
      comments: acc.comments,
    };
  }
  return out;
}

function accsToZapMap(accs: Map<string, Acc>): ZapMap {
  const out: ZapMap = {};
  for (const [id, acc] of accs) {
    if (acc.zaps > 0) out[id] = acc.zaps;
  }
  return out;
}

// ============================================================================
// Provider
// ============================================================================

export function SocialBatchProvider({
  events,
  children,
  enabled = true,
}: {
  /** Alle currently gerenderten Events der Feed-Seite */
  events: NostrEvent[];
  children: ReactNode;
  enabled?: boolean;
}) {
  const { nostr } = useNostr();

  // Ziele sammeln: ID + optional a-Koordinate (addressable Events 30000–39999).
  // Dedupliziert & sortiert → stabiler Hash → keine Query-Churn bei Re-Renders.
  const targetList = useMemo(() => {
    if (!enabled) return [];
    const map = new Map<string, { id: string; coord?: string }>();
    for (const e of events) {
      if (!e?.id || map.has(e.id)) continue;
      let coord: string | undefined;
      if (e.kind >= 30000 && e.kind < 40000) {
        const d = e.tags.find(([n]) => n === 'd')?.[1] ?? '';
        coord = `${e.kind}:${e.pubkey}:${d}`;
      }
      map.set(e.id, { id: e.id, coord });
    }
    return Array.from(map.values());
  }, [events, enabled]);

  const refLookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of targetList) {
      m.set(t.id, t.id);
      if (t.coord) m.set(t.coord, t.id);
    }
    return m;
  }, [targetList]);

  const hash = useMemo(
    () => targetList.map((t) => t.id).sort().join(','),
    [targetList],
  );
  const coordHash = useMemo(
    () => targetList
      .map((t) => t.coord)
      .filter((c): c is string => !!c)
      .sort()
      .join(','),
    [targetList],
  );

  // ── Counts: Reactions, Reposts, Comments in EINER Query ──────────────────
  const countsQuery = useQuery({
    queryKey: ['social-counts', 'batch', hash, coordHash],
    queryFn: async ({ signal }) => {
      if (targetList.length === 0) return {};

      const ids = chunk(targetList.map((t) => t.id), MAX_REFS_PER_FILTER);
      const coords = chunk(
        targetList.map((t) => t.coord).filter((c): c is string => !!c),
        MAX_REFS_PER_FILTER,
      );

      const filters = [
        ...ids.map((idChunk) => ({ kinds: [6, 7, 16, 1111] as number[], '#e': idChunk })),
        ...coords.map((coordChunk) => ({ kinds: [1111] as number[], '#a': coordChunk })),
      ];

      const result = await nostr.query(filters, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(BATCH_TIMEOUT)]),
      });

      const accs = new Map<string, Acc>();
      attribute(result, refLookup, accs);
      return accsToCountMap(accs);
    },
    enabled: enabled && targetList.length > 0,
    staleTime: COUNTS_STALE_TIME,
    gcTime: 10 * 60_000,
    retry: false,
  });

  // ── Zaps: eigener Batch (eigener Invalidation-Prefix ['zaps']) ───────────
  const zapsQuery = useQuery({
    queryKey: ['zaps', 'batch', hash, coordHash],
    queryFn: async ({ signal }) => {
      if (targetList.length === 0) return {};

      const ids = chunk(targetList.map((t) => t.id), MAX_REFS_PER_FILTER);
      const coords = chunk(
        targetList.map((t) => t.coord).filter((c): c is string => !!c),
        MAX_REFS_PER_FILTER,
      );

      const filters = [
        ...ids.map((idChunk) => ({ kinds: [9735] as number[], '#e': idChunk })),
        ...coords.map((coordChunk) => ({ kinds: [9735] as number[], '#a': coordChunk })),
      ];

      const result = await nostr.query(filters, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(BATCH_TIMEOUT)]),
      });

      const accs = new Map<string, Acc>();
      attribute(result, refLookup, accs);
      return accsToZapMap(accs);
    },
    enabled: enabled && targetList.length > 0,
    staleTime: ZAPS_STALE_TIME,
    gcTime: 10 * 60_000,
    retry: false,
  });

  const value = useMemo<SocialBatchContextValue>(
    () => ({
      refLookup,
      counts: countsQuery.data ?? {},
      zaps: zapsQuery.data ?? {},
      isLoading: countsQuery.isLoading || zapsQuery.isLoading,
    }),
    [refLookup, countsQuery.data, zapsQuery.data, countsQuery.isLoading, zapsQuery.isLoading],
  );

  return (
    <SocialBatchContext.Provider value={value}>
      {children}
    </SocialBatchContext.Provider>
  );
}

// ============================================================================
// Consumer-Hooks (SocialBar)
// ============================================================================

/**
 * Counts für ein Event aus dem Batch-Scope.
 * null = Event nicht im Batch (kein Scope oder noch nicht geladen) →
 * SocialBar fällt dann auf ihre eigenen per-Event-Hooks zurück.
 */
export function useSocialBatchItem(eventId: string | undefined): BatchedCounts | null {
  const ctx = useContext(SocialBatchContext);

  return useMemo(() => {
    // Nicht im Scope oder Event nicht Teil des Batches → Fallback auf
    // per-Event-Hooks (SocialBar-Entscheidung).
    if (!ctx || !eventId || !ctx.refLookup.has(eventId)) {
      return null;
    }

    const c = ctx.counts[eventId];
    const z = ctx.zaps[eventId];
    return {
      likes: c?.likes ?? 0,
      reposts: c?.reposts ?? 0,
      comments: c?.comments ?? 0,
      zaps: z ?? 0,
      loading: ctx.isLoading,
    };
  }, [ctx, eventId]);
}

/** Befindet sich der Baum innerhalb eines SocialBatchProviders? */
export function useInSocialBatchScope(): boolean {
  return useContext(SocialBatchContext) !== null;
}
