import { useNostr } from "@nostrify/react";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { useCurrentUser } from "./useCurrentUser";

import type { NostrEvent } from "@nostrify/nostrify";

interface PublishOptions {
  relayUrls?: string[];
  signal?: AbortSignal;
}

interface PublishEventInput extends Partial<Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>> {
  kind: number;
  content: string;
  tags: string[][];
  relayUrls?: string[];
}

export function useNostrPublish(): UseMutationResult<NostrEvent, Error, PublishEventInput> {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (t: PublishEventInput) => {
      if (user) {
        const tags = t.tags ?? [];

        // Add the client tag if it doesn't exist
        if (location.protocol === "https:" && !tags.some(([name]) => name === "client")) {
          tags.push(["client", location.hostname]);
        }

        const event = await user.signer.signEvent({
          kind: t.kind,
          content: t.content ?? "",
          tags,
          created_at: t.created_at ?? Math.floor(Date.now() / 1000),
        });

        console.log('[useNostrPublish] Publishing event to relays...');
        console.log('[useNostrPublish] Event:', JSON.stringify(event, null, 2));
        
        // Verwende das private Relay wenn angegeben, sonst Standard-Relays
        const result = await nostr.event(event, { signal: AbortSignal.timeout(15000) });
        
        console.log('[useNostrPublish] Publish result:', result);
        return event;
      } else {
        throw new Error("User is not logged in");
      }
    },
    onError: (error: any) => {
      console.error("[useNostrPublish] Failed to publish event:", error);
      console.error("[useNostrPublish] Error details:", {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        cause: error?.cause,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
    },
    onSuccess: (data) => {
      console.log("Event published successfully:", data);
    },
  });
}