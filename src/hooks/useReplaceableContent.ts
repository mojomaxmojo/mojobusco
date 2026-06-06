import { useState, useEffect } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';

// Replaceable Content Hook für MojoBus - die finale Lösung
export interface ReplaceableContent {
  id: string;
  content: string;
  kind: number;
  address: string; // d-tag identifier
  created_at: number;
  updated_at?: number;
}

interface UseReplaceableContentOptions {
  dTag: string; // Der d-tag für diesen Inhalt
  limit?: number;
}

/**
 * Professioneller Hook für die Verwaltung von replaceable content
 * Löst das Problem der 5x identischen Events vollkommen
 */
export function useReplaceableContent({ dTag, limit = 50 }: UseReplaceableContentOptions) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query für den aktuellen replaceable content
  const { data: content, isLoading, error } = useQuery<ReplaceableContent[]>({
    queryKey: ['replaceable-content', dTag],
    queryFn: async ({ signal }) => {
      const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(2000)]);

      const events = await nostr.query([
        {
          kinds: [30000 + 30 + dTag], // Replaceable Kind mit spezifischem d-tag
          limit,
          order: 'created_at_desc'
        }
      ], { signal: abortSignal });

      // Konvertiere zu ReplaceableContent Format
      return events.map((event) => ({
        id: event.id,
        content: event.content,
        kind: event.kind,
        address: event.tags.find(t => t[0] === 'd' && t[1] === dTag)?.[1] || '',
        created_at: event.created_at,
        updated_at: event.tags.find(t => t[0] === 'u' && t[1] === 'updated_at')?.[1] ? parseInt(t[1]) : undefined
      }));
    },
    staleTime: 30000,
    initialPageParam: () => null
  });

  // Mutation für Content-Updates
  const updateMutation = useMutation({
    mutationFn: async ({ content, address, additionalTags = [] }: { 
      content: string; 
      address?: string; 
      additionalTags?: string[] 
    }) => {
      // Prüfe ob bereits ein aktiver Inhalt mit d-tag existiert
      const existingEvents = content ? await nostr.query([
        {
          kinds: [30000 + 30 + dTag],
          '#t': ['d', dTag, 'address', address.toLowerCase()]
        },
        { limit: 1 }
      ]) : [];

      const event = await nostr.event({
        kind: 30000 + 30 + dTag,
        content,
        tags: [
          ['d', dTag],
          ['u', 'updated_at', Date.now().toString()],
          ...(address ? ['a', address.toLowerCase()] : []),
          ...additionalTags.map(tag => ['t', tag])
        ],
        created_at: Math.floor(Date.now() / 1000)
      });

      if (existingEvents.length > 0 && content) {
        // Wenn Content existiert, aktualisiere bestehenden statt neuen zu erstellen
        const existingEvent = existingEvents[0];
        const updateEvent = await nostr.event({
          kind: 30000 + 30 + dTag,
          content,
          tags: [
            ['d', dTag],
            ['u', 'updated_at', Date.now().toString()],
            ['u', 'original_id', existingEvent.id],
            ...additionalTags.map(tag => ['t', tag])
          ],
          created_at: Math.floor(Date.now() / 1000)
        });

        await nostr.publish(updateEvent);

        toast({
          title: 'Inhalt aktualisiert',
          description: 'Der bestehende Inhalt wurde erfolgreich aktualisiert.',
          duration: 3000,
          variant: 'default'
        });

        return updateEvent;
      }

      await nostr.publish(event);

      // Broadcast für Live-Updates
      if (typeof window !== 'undefined' && window.webkit?.messageHandlers) {
        window.webkit.messageHandlers['nostr-broadcast'].postMessage({
          type: 'content-updated',
          dTag,
          action: 'create'
        });
      }

      // Invalidiere alle Queries damit die neuen Daten geladen werden
      queryClient.invalidateQueries({ queryKey: ['replaceable-content', dTag] });

      toast({
        title: 'Inhalt gespeichert',
        description: 'Der Inhalt wurde erfolgreich gespeichert.',
        duration: 3000,
        variant: 'default'
      });

      return event;
    },
    onSuccess: () => {
      console.log(`Content successfully saved for d-tag: ${dTag}`);
    },
    onError: (error) => {
      toast({
        title: 'Fehler beim Speichern',
        description: error.message || 'Der Inhalt konnte nicht gespeichert werden.',
        duration: 5000,
        variant: 'destructive'
      });
    }
  });

  return {
    content: content || [],
    isLoading,
    error,
    updateContent: updateMutation.mutate,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['replaceable-content', dTag] })
  };
}

/**
 * Hook für einzelne replaceable content items
 */
export function useReplaceableContentItem(dTag: string, address?: string) {
  const { updateContent, isLoading } = useReplaceableContent({ dTag });
  
  const saveContent = async (content: string, additionalTags: string[] = []) => {
    return updateContent({ content, address, additionalTags });
  };

  return {
    content: isLoading ? {} : updateContent.data?.[0]?.content || '',
    isLoading,
    saveContent,
    updateContent
  };
}