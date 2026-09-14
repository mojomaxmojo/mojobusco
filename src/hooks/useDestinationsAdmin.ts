/**
 * useDestinationsAdmin — Laden/Speichern der Reiseziele-Struktur
 *
 * Quelle: NIP-78 Event (kind 30078, d = co.mojobus.app.destinations) —
 * exakt dasselbe Muster wie die About-Seite (useAboutContent).
 *
 * Fallback-Kette (Editor-Basis):
 *   1. Struktur-Event vom Relay (aktuellste Version)
 *   2. /data/destinations.json (generierter Live-Stand)
 *   3. null (leerer Editor-Rahmen)
 *
 * generate-site-data.js schreibt aus dem Event die destinations.json —
 * Änderungen sind nach dem nächsten Cron-Lauf live (≤ 3 h).
 */

import { useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { getDataBaseUrl } from '@/lib/apiBase';
import { parseDestinations, type DestinationsFile } from '@/config/destinationsSchema';
import { DESTINATIONS_KIND, DESTINATIONS_DTAG } from '@/config/destinationsSchema';
import { AUTHORS } from '@/config/relays';

/** Prüft ob der eingeloggte User ein autorisierter Autor ist */
function isAuthorized(pubkey?: string): boolean {
  if (!pubkey) return false;
  return AUTHORS.some((a) => a.pubkey === pubkey);
}

export type DestinationsSource = 'event' | 'file' | 'empty';

interface UseDestinationsAdminResult {
  data: DestinationsFile | null;
  source: DestinationsSource;
  isLoading: boolean;
  canEdit: boolean;
  saving: boolean;
  save: (data: DestinationsFile) => Promise<boolean>;
  refetch: () => void;
}

export function useDestinationsAdmin(): UseDestinationsAdminResult {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const publishMutation = useNostrPublish();
  const { toast } = useToast();

  const canEdit = isAuthorized(user?.pubkey);

  // ── Laden: Event → JSON-Fallback → leer ────────────────────────────────
  const {
    data,
    isLoading,
  } = useQuery<{ data: DestinationsFile | null; source: DestinationsSource }>({
    queryKey: ['destinations-admin', DESTINATIONS_DTAG],
    queryFn: async ({ signal }) => {
      // 1) Struktur-Event (replaceable → Relay liefert das neueste je pubkey;
      //    über alle Autoren: neuestes gewinnt, siehe DestinationsAdmin-Header)
      try {
        const abortSignal = AbortSignal.any([
          signal,
          AbortSignal.timeout(5000),
        ]);
        const events = await nostr.query(
          [{ kinds: [DESTINATIONS_KIND], '#d': [DESTINATIONS_DTAG], limit: 10 }],
          { signal: abortSignal }
        );
        if (events && events.length > 0) {
          const newest = [...events].sort((a, b) => b.created_at - a.created_at)[0];
          const parsed = parseDestinations(JSON.parse(newest.content));
          if (parsed) {
            return { data: parsed, source: 'event' as const };
          }
        }
      } catch {
        // Timeout/Query-Fehler → JSON-Fallback
      }

      // 2) Generierter Live-Stand (Cron-Output)
      try {
        const res = await fetch(`${getDataBaseUrl()}/data/destinations.json`);
        if (res.ok) {
          const parsed = parseDestinations(await res.json());
          if (parsed) return { data: parsed, source: 'file' as const };
        }
      } catch {
        // Datei fehlt/kaputt → leer
      }

      return { data: null, source: 'empty' as const };
    },
    staleTime: 60 * 1000,
  });

  // ── Speichern: publish kind 30078 ──────────────────────────────────────
  const save = useCallback(
    async (fileData: DestinationsFile): Promise<boolean> => {
      if (!user?.pubkey) {
        toast({
          title: 'Nicht eingeloggt',
          description: 'Du musst eingeloggt sein um Änderungen zu speichern.',
          variant: 'destructive',
        });
        return false;
      }
      if (!isAuthorized(user.pubkey)) {
        toast({
          title: 'Keine Berechtigung',
          description: 'Nur Max und Susanne können die Reiseziele bearbeiten.',
          variant: 'destructive',
        });
        return false;
      }

      try {
        await publishMutation.mutateAsync({
          kind: DESTINATIONS_KIND,
          content: JSON.stringify(fileData, null, 2),
          tags: [
            ['d', DESTINATIONS_DTAG],
            ['t', 'destinations'],
            ['L', 'co.mojobus.app'],
            ['l', 'destinations', 'co.mojobus.app'],
          ],
          created_at: Math.floor(Date.now() / 1000),
        });

        queryClient.invalidateQueries({ queryKey: ['destinations-admin', DESTINATIONS_DTAG] });

        toast({
          title: '✅ Reiseziele gespeichert!',
          description: 'Live auf /reiseziele mit dem nächsten Cron-Lauf (≤ 3 h).',
        });
        return true;
      } catch (err) {
        toast({
          title: '❌ Speichern fehlgeschlagen',
          description: err instanceof Error ? err.message : 'Bitte erneut versuchen.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [user, publishMutation, queryClient, toast]
  );

  return {
    data: data?.data ?? null,
    source: data?.source ?? 'empty',
    isLoading,
    canEdit,
    saving: publishMutation.isPending,
    save,
    refetch: () =>
      queryClient.invalidateQueries({ queryKey: ['destinations-admin', DESTINATIONS_DTAG] }),
  };
}