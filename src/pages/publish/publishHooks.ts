import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';

/**
 * useEditData — Lädt ein existierendes Event zum Bearbeiten
 */
export function useEditData(editEventId: string | null) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['edit-event', editEventId],
    queryFn: async ({ signal }) => {
      if (!editEventId) return null;

      let eventId = editEventId;
      try {
        // Try to decode nip19 if it's encoded
        if (editEventId.startsWith('note1')) {
          const decoded = nip19.decode(editEventId);
          eventId = decoded.data;
        }
      } catch (error) {
        // If decoding fails, try using as raw hex ID
        eventId = editEventId;
      }

      const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(3000)]);

      const events = await nostr.query([
        {
          ids: [eventId],
          limit: 1
        }
      ], { signal: abortSignal });

      return events[0] || null;
    },
    enabled: !!editEventId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}