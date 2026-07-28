/**
 * useNIP89 – Hook für NIP-89 Application Handler Registration
 *
 * Publiziert:
 *   kind:31990 – Handler-Registrierung (welche Kinds kann mojobus.co verarbeiten)
 *   kind:31989 – Eigene Empfehlung der App für die registrierten Kinds
 *
 * Spec: https://github.com/nostr-protocol/nips/blob/master/89.md
 */

import { useNostr } from '@nostrify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import { useToast } from './useToast';
import { canonicalUrl } from '@/lib/canonicalUrl';

// ============================================================================
// KONFIGURATION
// ============================================================================

const APP_URL = canonicalUrl();
const APP_NAME = 'MojoBus';
const APP_ABOUT = 'Perpetual Travelers Blog – Artikel, Notes, Profile & Video';
const APP_PICTURE = canonicalUrl('/mojobuslogo.png');
const HANDLER_D_TAG = 'mojobus-handler-v1';

/** Relays auf denen die Handler-Events publiziert werden */
const PUBLISH_RELAYS = [
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
  'wss://nostr.mom',
  'wss://relay.nos.social',
  'wss://relay.nosflare.com',
  'wss://relay.mojobus.co',
];

/**
 * Event-Kinds die MojoBus verarbeiten kann:
 *   0     – Profile (npub / nprofile)
 *   1     – Short Notes
 *   30023 – Long-form Articles (NIP-23)
 */
const SUPPORTED_KINDS = [0, 1, 30023];

// ============================================================================
// TYPEN
// ============================================================================

export interface NIP89Status {
  handler: {
    exists: boolean;
    eventId?: string;
    createdAt?: number;
  };
  recommendation: {
    exists: boolean;
    eventId?: string;
    createdAt?: number;
  };
}

// ============================================================================
// HOOK
// ============================================================================

export function useNIP89() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // --------------------------------------------------------------------------
  // STATUS: Prüft ob kind:31990 und kind:31989 bereits publiziert wurden
  // --------------------------------------------------------------------------
  const statusQuery = useQuery({
    queryKey: ['nip89-status', user?.pubkey],
    enabled: !!user?.pubkey,
    staleTime: 1000 * 60 * 5,
    queryFn: async ({ signal }): Promise<NIP89Status> => {
      if (!user?.pubkey) {
        return { handler: { exists: false }, recommendation: { exists: false } };
      }

      const combined = AbortSignal.any([signal, AbortSignal.timeout(8000)]);

      const [handlerEvents, recommendationEvents] = await Promise.all([
        nostr.query(
          [{ kinds: [31990], authors: [user.pubkey], '#d': [HANDLER_D_TAG], limit: 1 }],
          { signal: combined }
        ).catch(() => [] as any[]),
        nostr.query(
          [{ kinds: [31989], authors: [user.pubkey], '#d': ['30023'], limit: 1 }],
          { signal: combined }
        ).catch(() => [] as any[]),
      ]);

      const handlerEvent = handlerEvents[0];
      const recommendationEvent = recommendationEvents[0];

      return {
        handler: {
          exists: !!handlerEvent,
          eventId: handlerEvent?.id,
          createdAt: handlerEvent?.created_at,
        },
        recommendation: {
          exists: !!recommendationEvent,
          eventId: recommendationEvent?.id,
          createdAt: recommendationEvent?.created_at,
        },
      };
    },
  });

  // --------------------------------------------------------------------------
  // PUBLISH: Publiziert kind:31990 + kind:31989 auf allen öffentlichen Relays
  // --------------------------------------------------------------------------
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Nicht eingeloggt');

      // Event 1: kind:31990 – Handler-Registrierung
      const handlerContent = JSON.stringify({
        name: APP_NAME,
        about: APP_ABOUT,
        picture: APP_PICTURE,
        website: APP_URL,
      });

      const handlerTags: string[][] = [
        ['d', HANDLER_D_TAG],
        ...SUPPORTED_KINDS.map((k) => ['k', String(k)]),
        ['web', `${APP_URL}/<bech32>`, 'naddr'],
        ['web', `${APP_URL}/<bech32>`, 'nevent'],
        ['web', `${APP_URL}/<bech32>`, 'note'],
        ['web', `${APP_URL}/<bech32>`, 'npub'],
        ['web', `${APP_URL}/<bech32>`, 'nprofile'],
      ];

      const handlerEvent = await user.signer.signEvent({
        kind: 31990,
        content: handlerContent,
        tags: handlerTags,
        created_at: Math.floor(Date.now() / 1000),
      });

      // Event 2: kind:31989 – Empfehlung pro unterstütztem Kind
      const recommendationEvents = await Promise.all(
        SUPPORTED_KINDS.map((kind) =>
          user.signer.signEvent({
            kind: 31989,
            content: '',
            tags: [
              ['d', String(kind)],
              ['a', `31990:${user.pubkey}:${HANDLER_D_TAG}`, 'wss://relay.mojobus.co', 'web'],
            ],
            created_at: Math.floor(Date.now() / 1000),
          })
        )
      );

      // Auf allen Relays publizieren via WebSocket
      const allEvents = [handlerEvent, ...recommendationEvents];

      const publishResults = await Promise.allSettled(
        PUBLISH_RELAYS.map(async (relayUrl) => {
          return new Promise<{ relay: string; success: boolean }>((resolve) => {
            try {
              const ws = new WebSocket(relayUrl);
              const timeout = setTimeout(() => {
                ws.close();
                resolve({ relay: relayUrl, success: false });
              }, 10000);

              ws.onopen = () => {
                try {
                  for (const event of allEvents) {
                    ws.send(JSON.stringify(['EVENT', event]));
                  }
                  setTimeout(() => {
                    clearTimeout(timeout);
                    ws.close();
                    resolve({ relay: relayUrl, success: true });
                  }, 1500);
                } catch {
                  clearTimeout(timeout);
                  ws.close();
                  resolve({ relay: relayUrl, success: false });
                }
              };

              ws.onerror = () => {
                clearTimeout(timeout);
                resolve({ relay: relayUrl, success: false });
              };
            } catch {
              resolve({ relay: relayUrl, success: false });
            }
          });
        })
      );

      const successCount = publishResults.filter(
        (r) => r.status === 'fulfilled' && r.value.success
      ).length;

      console.log('[NIP-89] Publish Ergebnisse:', publishResults);
      console.log(`[NIP-89] Erfolgreich auf ${successCount}/${PUBLISH_RELAYS.length} Relays`);

      if (successCount === 0) {
        throw new Error('Konnte auf keinem Relay publizieren. Bitte Verbindung prüfen.');
      }

      return { handlerEvent, recommendationEvents, successCount };
    },

    onSuccess: ({ successCount }) => {
      toast({
        title: 'NIP-89 erfolgreich registriert!',
        description: `MojoBus wurde auf ${successCount} Relays als App-Handler registriert.`,
      });
      queryClient.invalidateQueries({ queryKey: ['nip89-status'] });
    },

    onError: (error: Error) => {
      console.error('[NIP-89] Fehler:', error);
      toast({
        title: 'Fehler beim Registrieren',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // --------------------------------------------------------------------------
  // UPDATE: Republiziert (aktualisiert) die bestehenden Handler-Events
  // --------------------------------------------------------------------------
  const updateMutation = useMutation({
    mutationFn: async () => publishMutation.mutateAsync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nip89-status'] });
    },
  });

  return {
    status: statusQuery.data,
    isLoadingStatus: statusQuery.isLoading,
    isRegistered:
      statusQuery.data?.handler.exists && statusQuery.data?.recommendation.exists,
    publish: publishMutation.mutate,
    isPublishing: publishMutation.isPending,
    update: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    config: {
      appName: APP_NAME,
      appUrl: APP_URL,
      supportedKinds: SUPPORTED_KINDS,
      publishRelays: PUBLISH_RELAYS,
      handlerDTag: HANDLER_D_TAG,
    },
  };
}
