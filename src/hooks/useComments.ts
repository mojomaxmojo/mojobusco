import { NKinds, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

// Public relays that support NIP-22 comments
const COMMENT_RELAYS = [
  'wss://relay.mojobus.co',
  'wss://relay.primal.net',
  'wss://relay.damus.io',
  'wss://nos.lol',
];

export function useComments(root: NostrEvent | URL | null | undefined, limit?: number) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['comments', root instanceof URL ? root.toString() : root?.id, limit],
    queryFn: async (c) => {
      if (!root) return { allComments: [], topLevelComments: [], getDescendants: () => [], getDirectReplies: () => [] };
      const filters: NostrFilter[] = [];
      
      // Build filters to catch comments using different tag formats
      // Support both NIP-22 (kind:1111) and NIP-10 (kind:1 replies)
      if (root instanceof URL) {
        filters.push({ kinds: [1111], '#I': [root.toString()] });
        filters.push({ kinds: [1111], '#i': [root.toString()] });
      } else if (NKinds.addressable(root.kind)) {
        const d = root.tags.find(([name]) => name === 'd')?.[1] ?? '';
        const addressable = `${root.kind}:${root.pubkey}:${d}`;
        
        // NIP-22 (kind:1111) - uppercase and lowercase 'a' tags, as well as 'e' tags
        filters.push({ kinds: [1111], '#A': [addressable] });
        filters.push({ kinds: [1111], '#a': [addressable] });
        filters.push({ kinds: [1111], '#E': [root.id] });
        filters.push({ kinds: [1111], '#e': [root.id] });
        
        // NIP-10 (kind:1) - replies with e tags
        filters.push({ kinds: [1], '#e': [root.id] });
      } else if (NKinds.replaceable(root.kind)) {
        const addressable = `${root.kind}:${root.pubkey}:`;
        
        // NIP-22 (kind:1111) - uppercase and lowercase 'a' tags, as well as 'e' tags
        filters.push({ kinds: [1111], '#A': [addressable] });
        filters.push({ kinds: [1111], '#a': [addressable] });
        filters.push({ kinds: [1111], '#E': [root.id] });
        filters.push({ kinds: [1111], '#e': [root.id] });
        
        // NIP-10 (kind:1) - replies with e tags
        filters.push({ kinds: [1], '#e': [root.id] });
      } else {
        // For regular events, query both NIP-22 and NIP-10 formats
        filters.push({ kinds: [1111], '#E': [root.id] });
        filters.push({ kinds: [1111], '#e': [root.id] });
        // NIP-10 (kind:1) - replies with e tags
        filters.push({ kinds: [1], '#e': [root.id] });
      }

      if (typeof limit === 'number') {
        filters.forEach(f => f.limit = limit);
      }

      // Query for all comments using all filter variations
      // Use a relay group with public relays that support NIP-22 and NIP-10
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);
      const commentRelayGroup = nostr.group(COMMENT_RELAYS);
      
      const allEvents = await Promise.all(
        filters.map(filter => commentRelayGroup.query([filter], { signal }))
      );
      
      // Flatten and deduplicate events by ID
      const eventMap = new Map<string, NostrEvent>();
      for (const events of allEvents) {
        for (const event of events) {
          eventMap.set(event.id, event);
        }
      }
      const events = Array.from(eventMap.values());

      // Helper function to get tag value (case-insensitive)
      const getTagValue = (event: NostrEvent, tagName: string): string | undefined => {
        const tag = event.tags.find(([name]) => name === tagName);
        return tag?.[1];
      };
      
      // Helper function to check if event has a tag with a specific value (checks both cases)
      const hasTagValue = (event: NostrEvent, tagName: string, value: string): boolean => {
        return event.tags.some(([name, val]) => 
          (name === tagName || name === tagName.toUpperCase() || name === tagName.toLowerCase()) && 
          val === value
        );
      };
      
      // Helper to check if a kind:1 event is a root-level reply (NIP-10)
      const isNIP10RootReply = (event: NostrEvent, rootId: string): boolean => {
        if (event.kind !== 1) return false;
        
        // Find e tags that reference the root event
        const eTags = event.tags.filter(([name]) => name === 'e');
        
        // Check if any e tag has "root" marker or is the only e tag pointing to root
        return eTags.some(tag => {
          const [, eventId, , marker] = tag;
          // Either has explicit "root" marker or points to root event
          return eventId === rootId && (marker === 'root' || eTags.length === 1);
        });
      };

      // Filter top-level comments (those with lowercase OR uppercase tag matching the root)
      const topLevelComments = events.filter(comment => {
        // NIP-22 (kind:1111) - check tags
        if (comment.kind === 1111) {
          if (root instanceof URL) {
            return hasTagValue(comment, 'i', root.toString()) || hasTagValue(comment, 'I', root.toString());
          } else if (NKinds.addressable(root.kind)) {
            const d = getTagValue(root, 'd') ?? '';
            const addressable = `${root.kind}:${root.pubkey}:${d}`;
            // Check for 'a' or 'A' tag, or fallback to 'e'/'E' tag for root matching
            return hasTagValue(comment, 'a', addressable) || 
                   hasTagValue(comment, 'A', addressable) ||
                   (hasTagValue(comment, 'e', root.id) && !getTagValue(comment, 'a') && !getTagValue(comment, 'A'));
          } else if (NKinds.replaceable(root.kind)) {
            const addressable = `${root.kind}:${root.pubkey}:`;
            // Check for 'a' or 'A' tag, or fallback to 'e'/'E' tag for root matching
            return hasTagValue(comment, 'a', addressable) || 
                   hasTagValue(comment, 'A', addressable) ||
                   (hasTagValue(comment, 'e', root.id) && !getTagValue(comment, 'a') && !getTagValue(comment, 'A'));
          } else {
            return hasTagValue(comment, 'e', root.id) || hasTagValue(comment, 'E', root.id);
          }
        }
        
        // NIP-10 (kind:1) - check for root replies
        if (comment.kind === 1 && !(root instanceof URL)) {
          return isNIP10RootReply(comment, root.id);
        }
        
        return false;
      });

      // Helper to check if a kind:1 event is a reply to specific event (NIP-10)
      const isNIP10ReplyTo = (event: NostrEvent, parentId: string): boolean => {
        if (event.kind !== 1) return false;
        
        const eTags = event.tags.filter(([name]) => name === 'e');
        
        // Check if any e tag references the parent with "reply" marker
        return eTags.some(tag => {
          const [, eventId, , marker] = tag;
          return eventId === parentId && (marker === 'reply' || marker === undefined);
        });
      };
      
      // Helper function to get all descendants of a comment
      const getDescendants = (parentId: string): NostrEvent[] => {
        const directReplies = events.filter(comment => {
          // NIP-22 (kind:1111) - check both lowercase and uppercase 'e' tags
          if (comment.kind === 1111) {
            return hasTagValue(comment, 'e', parentId) || hasTagValue(comment, 'E', parentId);
          }
          // NIP-10 (kind:1) - check for reply marker
          if (comment.kind === 1) {
            return isNIP10ReplyTo(comment, parentId);
          }
          return false;
        });

        const allDescendants = [...directReplies];
        
        // Recursively get descendants of each direct reply
        for (const reply of directReplies) {
          allDescendants.push(...getDescendants(reply.id));
        }

        return allDescendants;
      };

      // Create a map of comment ID to its descendants
      const commentDescendants = new Map<string, NostrEvent[]>();
      for (const comment of events) {
        commentDescendants.set(comment.id, getDescendants(comment.id));
      }

      // Sort top-level comments by creation time (newest first)
      const sortedTopLevel = topLevelComments.sort((a, b) => b.created_at - a.created_at);

      return {
        allComments: events,
        topLevelComments: sortedTopLevel,
        getDescendants: (commentId: string) => {
          const descendants = commentDescendants.get(commentId) || [];
          // Sort descendants by creation time (oldest first for threaded display)
          return descendants.sort((a, b) => a.created_at - b.created_at);
        },
        getDirectReplies: (commentId: string) => {
          const directReplies = events.filter(comment => {
            // NIP-22 (kind:1111) - check both lowercase and uppercase 'e' tags
            if (comment.kind === 1111) {
              return hasTagValue(comment, 'e', commentId) || hasTagValue(comment, 'E', commentId);
            }
            // NIP-10 (kind:1) - check for reply marker
            if (comment.kind === 1) {
              return isNIP10ReplyTo(comment, commentId);
            }
            return false;
          });
          // Sort direct replies by creation time (oldest first for threaded display)
          return directReplies.sort((a, b) => a.created_at - b.created_at);
        }
      };
    },
    enabled: !!root && (root instanceof URL ? !!root.toString() : !!root.id),
  });
}