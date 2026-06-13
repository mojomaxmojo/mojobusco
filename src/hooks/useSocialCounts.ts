import { NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Hook to fetch all social interaction counts for an event in a single query
 * Returns counts for comments, likes, and reposts
 */
export function useSocialCounts(root: NostrEvent | null | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['social-counts', root?.id],
    queryFn: async ({ signal }) => {
      // Query all relevant event types in a single query
      // Kind 7: Reactions (including likes)
      // Kind 6: Repost
      // Kind 16: Generic Repost
      // Kind 1111: Comments
      if (!root) return { likes: 0, reposts: 0, comments: 0 };
      const events = await nostr.query([
        {
          kinds: [6, 7, 16, 1111],
          '#e': [root.id],
          limit: 1000,
        }
      ], {
        signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]),
      });

      // Count unique users for each interaction type
      const likeUsers = new Set<string>();
      const repostUsers = new Set<string>();
      const commentUsers = new Set<string>();

      events.forEach(event => {
        switch (event.kind) {
          case 7: // Reaction
            // Count only ❤️ as likes
            if (event.content === '❤️' && !likeUsers.has(event.pubkey)) {
              likeUsers.add(event.pubkey);
            }
            break;
          case 6: // Repost
          case 16: // Generic Repost
            if (!repostUsers.has(event.pubkey)) {
              repostUsers.add(event.pubkey);
            }
            break;
          case 1111: // Comment
            if (!commentUsers.has(event.pubkey)) {
              commentUsers.add(event.pubkey);
            }
            break;
        }
      });

      return {
        likes: likeUsers.size,
        reposts: repostUsers.size,
        comments: commentUsers.size,
      };
    },
    enabled: !!root?.id,
    staleTime: 60000, // 1 minute
  });
}
