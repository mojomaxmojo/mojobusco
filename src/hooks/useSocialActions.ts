import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostr } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Hook to handle like actions (Kind 7 reactions)
 */
export function useLikeActions() {
  const { user } = useCurrentUser();
  const { mutate: publishEvent } = useNostrPublish();
  const { toast } = useToast();
  const { nostr } = useNostr();
  const queryClient = useQueryClient();

  /**
   * Check if user has already liked an event
   */
  const hasLiked = async (event: NostrEvent): Promise<boolean> => {
    if (!user) return false;

    const reactions = await nostr.query([
      {
        kinds: [7],
        '#e': [event.id],
        authors: [user.pubkey],
        limit: 1,
      }
    ], { signal: AbortSignal.timeout(2000) });

    return reactions.length > 0 && reactions[0]?.content === '❤️';
  };

  /**
   * Like an event (publish a Kind 7 reaction with ❤️)
   */
  const like = async (event: NostrEvent) => {
    if (!user) {
      toast({
        title: 'Nicht eingeloggt',
        description: 'Bitte logge dich ein, um zu liken.',
        variant: 'destructive',
      });
      return;
    }

    try {
      publishEvent({
        kind: 7,
        content: '❤️',
        tags: [['e', event.id]],
      }, {
        onSuccess: () => {
          toast({
            title: 'Geliked! ❤️',
            description: 'Du hast diesen Post geliked.',
          });
          // Invalidate social counts cache – Prefix-Invalidierung trifft auch
          // den Feed-Batch (['social-counts','batch',…]) aus useBatchedSocialCounts
          queryClient.invalidateQueries({ queryKey: ['social-counts'] });
        },
        onError: (error) => {
          toast({
            title: 'Fehler',
            description: 'Konnte nicht geliked werden. Bitte versuche es erneut.',
            variant: 'destructive',
          });
        },
      });
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  return { like, hasLiked };
}

/**
 * Hook to handle repost actions (Kind 6)
 */
export function useRepostActions() {
  const { user } = useCurrentUser();
  const { mutate: publishEvent } = useNostrPublish();
  const { toast } = useToast();
  const { nostr } = useNostr();
  const queryClient = useQueryClient();

  /**
   * Check if user has already reposted an event
   */
  const hasReposted = async (event: NostrEvent): Promise<boolean> => {
    if (!user) return false;

    const reposts = await nostr.query([
      {
        kinds: [6],
        '#e': [event.id],
        authors: [user.pubkey],
        limit: 1,
      }
    ], { signal: AbortSignal.timeout(2000) });

    return reposts.length > 0;
  };

  /**
   * Repost an event (publish a Kind 6 repost)
   */
  const repost = async (event: NostrEvent) => {
    if (!user) {
      toast({
        title: 'Nicht eingeloggt',
        description: 'Bitte logge dich ein, um zu reposten.',
        variant: 'destructive',
      });
      return;
    }

    try {
      publishEvent({
        kind: 6,
        content: '',
        tags: [
          ['e', event.id],
          ['p', event.pubkey],
        ],
      }, {
        onSuccess: () => {
          toast({
            title: 'Reposted! 🔄',
            description: 'Du hast diesen Post repostet.',
          });
          // Invalidate social counts cache – Prefix-Invalidierung trifft auch
          // den Feed-Batch (['social-counts','batch',…]) aus useBatchedSocialCounts
          queryClient.invalidateQueries({ queryKey: ['social-counts'] });
        },
        onError: (error) => {
          toast({
            title: 'Fehler',
            description: 'Konnte nicht reposten werden. Bitte versuche es erneut.',
            variant: 'destructive',
          });
        },
      });
    } catch (error) {
      console.error('Repost error:', error);
    }
  };

  return { repost, hasReposted };
}
