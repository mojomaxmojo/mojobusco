import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { AUTHORS } from '@/config/relays';
import { DEFAULT_CACHE_CONFIG } from '@/config/cache';

/**
 * Statische Autoren-Daten (aus der zentralen Autoren-Konfiguration).
 * Da mojobus.co ausschließlich Inhalte der beiden Autoren zeigt, dient
 * dieser Fallback als sofort verfügbare Reserve, wenn ein Relay kein
 * kind:0-Profil liefert (Timeout, Relay-Ausfall). Dadurch:
 * - kein Error-State pro Card
 * - kein Retry-Sturm (früher retry: 3 → bis zu 4 Queries pro Autor)
 * - Name rendert sofort, Avatar folgt sobald das Profil vom Relay kommt
 */
const STATIC_AUTHOR_METADATA = new Map<string, { name: string; nip05: string }>(
  AUTHORS.map((a) => [a.pubkey, { name: a.name, nip05: a.nip05 }]),
);

export function useAuthor(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<{ event?: NostrEvent; metadata?: NostrMetadata }>({
    queryKey: ['author', pubkey ?? ''],
    queryFn: async ({ signal }) => {
      if (!pubkey) {
        return {};
      }

      try {
        const [event] = await nostr.query(
          [{ kinds: [0], authors: [pubkey!], limit: 1 }],
          { signal: AbortSignal.any([signal, AbortSignal.timeout(1500)]) },
        );

        if (event) {
          try {
            const metadata = n.json().pipe(n.metadata()).parse(event.content);
            return { metadata, event };
          } catch {
            return { event };
          }
        }
      } catch {
        // Timeout oder Relay-Fehler → fällt auf statischen Fallback durch
      }

      // Kein Profil vom Relay erhalten → bekannte Autoren statisch bedienen
      // (statt zu werfen: ein Throw würde Error-State + evtl. Retry auslösen).
      const staticAuthor = STATIC_AUTHOR_METADATA.get(pubkey!);
      if (staticAuthor) {
        return { metadata: staticAuthor as unknown as NostrMetadata };
      }

      throw new Error('No event found');
    },
    // PERFORMANCE: retry: false – ein fehlgeschlagener kind:0-Lookup wird
    // nicht 3× wiederholt. Bei den zwei Seiten-Autoren greift ohnehin der
    // statische Fallback; fremde Profile (Mentions) brauchen keinen Retry.
    retry: false,
    // Profile ändern sich extrem selten → 7 Tage im Cache (wie useAuthors).
    // spart kind:0-Queries bei wiederholten Feed-Aufrufen massiv.
    staleTime: DEFAULT_CACHE_CONFIG.profile.staleTime,
    gcTime: DEFAULT_CACHE_CONFIG.profile.gcTime,
  });
}
