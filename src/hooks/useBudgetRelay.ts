/**
 * Budget Relay Query
 * Verwendet den NostrProvider mit spezieller Budget-Relay-Konfiguration
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { BudgetEntry, isValidBudgetEntry } from '@/types/budget';
import { BUDGET_CONFIG } from '@/config/budget';
import { AUTHORS } from '@/config/nostr';
import { RELAY_PRESETS } from '@/config/relays';

interface BudgetRelayState {
  entries: BudgetEntry[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Stabile Konstante außerhalb des Hooks
const AUTHOR_PUBKEYS = AUTHORS.map(a => a.pubkey);

export function useBudgetRelay(): BudgetRelayState {
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { query } = useNostr();
  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  const fetchEntries = useCallback(async () => {
    // Verhindere parallele Fetches
    if (isFetchingRef.current) {
      console.log('[BudgetRelay] Already fetching, skipping...');
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      console.log('[BudgetRelay] Fetching budget entries from relay...');

      const events = await query([
        {
          kinds: [BUDGET_CONFIG.KINDS.ENTRY, BUDGET_CONFIG.LEGACY.ENTRY],
          authors: AUTHOR_PUBKEYS,
          limit: 1000,
        }
      ], {
        relayUrls: RELAY_PRESETS.budget.relayUrls,
        maxRelays: RELAY_PRESETS.budget.maxRelays,
        queryTimeout: RELAY_PRESETS.budget.queryTimeout,
      });

      console.log('[BudgetRelay] Received events:', events?.length || 0);

      if (!events || events.length === 0) {
        console.log('[BudgetRelay] No events received, setting empty entries');
        setEntries([]);
        setIsLoading(false);
        return;
      }

      // Map von entry.id -> entry (neueste Version gewinnt)
      const entryMap = new Map<string, BudgetEntry>();

      for (const event of events) {
        try {
          const content = JSON.parse(event.content);

          if (isValidBudgetEntry(content)) {
            // Wenn es bereits einen Eintrag mit dieser ID gibt, schaue welcher neuer ist
            const existing = entryMap.get(content.id);
            if (!existing || (content.updatedAt || content.createdAt) > (existing.updatedAt || existing.createdAt)) {
              entryMap.set(content.id, content);
            }
          }
        } catch (parseError) {
          console.warn('[BudgetRelay] Failed to parse event:', parseError);
        }
      }

      // Konvertiere Map zu Array und filtere gelöschte Einträge
      const parsedEntries = Array.from(entryMap.values())
        .filter(entry => !entry.deleted)
        .sort((a, b) => b.date - a.date);

      console.log('[BudgetRelay] Setting entries:', parsedEntries.length);
      setEntries(parsedEntries);
      setIsLoading(false);
    } catch (err) {
      console.error('[BudgetRelay] Failed to fetch entries:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch'));
      setIsLoading(false);
    } finally {
      isFetchingRef.current = false;
    }
  }, [query]);

  useEffect(() => {
    // Nur einmal beim Mount laden
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchEntries();
    }
  }, [fetchEntries]);

  return {
    entries,
    isLoading,
    error,
    refetch: fetchEntries,
  };
}

/**
 * Hook for budget entries with date filtering
 * Deduplication and deleted filtering already done in useBudgetRelay
 */
export function useBudgetEntriesFiltered(
  startDate?: number,
  endDate?: number,
  categories?: string[]
): BudgetRelayState {
  const { entries, isLoading, error, refetch } = useBudgetRelay();

  // Memoize filtered entries to prevent unnecessary re-renders
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // Date range filter
      if (startDate && entry.date < startDate) return false;
      if (endDate && entry.date > endDate) return false;

      // Category filter
      if (categories && categories.length > 0) {
        if (!categories.includes(entry.category)) return false;
      }

      return true;
    });
  }, [entries, startDate, endDate, categories]);

  return {
    entries: filteredEntries,
    isLoading,
    error,
    refetch,
  };
}
