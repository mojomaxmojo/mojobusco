import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';

/**
 * useEditData — Lädt ein existierendes Event zum Bearbeiten
 *
 * Unterstützte Edit-Referenzen (edit=URL-Parameter):
 * - note1… / nevent1… → Abfrage per Event-ID (kind 1 Notes, Media)
 * - naddr1…           → addressable Events (kind 30023 Berichte/Plätze):
 *   Abfrage per authors + kinds + #d (d-Tag-Identifier)
 * - Raw Hex-ID        → Abfrage per Event-ID (Fallback, altes Verhalten)
 *
 * Ohne naddr-Support schlug die IDs-Query für kind-30023-Events (Berichte)
 * stumm fehl → editEvent blieb null → Republish erzeugte einen
 * Duplikat-Artikel mit neuem d-Tag statt ein Update.
 */
export function useEditData(editEventId: string | null) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['edit-event', editEventId],
    queryFn: async ({ signal }) => {
      if (!editEventId) return null;

      const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(5000)]);

      try {
        const decoded = nip19.decode(editEventId);

        if (decoded.type === 'note') {
          const events = await nostr.query(
            [{ ids: [decoded.data], limit: 1 }],
            { signal: abortSignal }
          );
          return events[0] || null;
        }

        if (decoded.type === 'nevent') {
          const events = await nostr.query(
            [{ ids: [decoded.data.id], limit: 1 }],
            { signal: abortSignal }
          );
          return events[0] || null;
        }

        if (decoded.type === 'naddr') {
          const { kind, pubkey, identifier } = decoded.data;
          const events = await nostr.query(
            [
              {
                kinds: [kind],
                authors: [pubkey],
                '#d': [identifier],
                limit: 1,
              },
            ],
            { signal: abortSignal }
          );
          return events[0] || null;
        }

        // npub/nprofile/nsec sind keine bearbeitbaren Content-Events
        return null;
      } catch {
        // Kein gültiger bech32-Identifier → als Raw-Hex-Event-ID behandeln
        const events = await nostr.query(
          [{ ids: [editEventId], limit: 1 }],
          { signal: abortSignal }
        );
        return events[0] || null;
      }
    },
    enabled: !!editEventId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}