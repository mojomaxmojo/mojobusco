/**
 * useAboutContent.ts – Lädt/speichert About-Inhalte via Nostr (kind 30078)
 *
 * Datenhaltung: Replaceable Event mit d-tag "co.mojobus.app.about-page"
 * Fallback: DEFAULT_ABOUT_DATA aus src/config/about.ts
 *
 * Analog zu: TikTok-History (kind 30078)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';

import {
  type AboutData,
  DEFAULT_ABOUT_DATA,
  ABOUT_KIND,
  ABOUT_DTAG,
} from '@/config/about';
import { AUTHORS } from '@/config/relays';

/** Prüft ob der eingeloggte User ein autorisierter Autor ist */
function isAuthorized(pubkey?: string): boolean {
  if (!pubkey) return false;
  return AUTHORS.some((a) => a.pubkey === pubkey);
}

export function useAboutContent() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const publishMutation = useNostrPublish();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const canEdit = isAuthorized(user?.pubkey);

  // ── Laden des About-Events ──────────────────────────────────────────────
  const {
    data: aboutData,
    isLoading,
    error,
  } = useQuery<AboutData>({
    queryKey: ['about-content', ABOUT_DTAG],
    queryFn: async ({ signal }): Promise<AboutData> => {
      try {
        const abortSignal = AbortSignal.any([
          signal,
          AbortSignal.timeout(5000),
        ]);

        const events = await nostr.query(
          [
            {
              kinds: [ABOUT_KIND],
              '#d': [ABOUT_DTAG],
              limit: 1,
            },
          ],
          { signal: abortSignal }
        );

        if (events && events.length > 0) {
          const event = events[0];
          try {
            const parsed = JSON.parse(event.content);
            // Validiere: muss ein Objekt mit den Kernfeldern sein
            if (parsed && typeof parsed === 'object' && parsed.hero) {
              return parsed as AboutData;
            }
          } catch {
            // JSON-Parsing fehlgeschlagen → Fallback
          }
        }
      } catch {
        // Query fehlgeschlagen (Timeout o.ä.) → Fallback
      }

      return DEFAULT_ABOUT_DATA;
    },
    staleTime: 5 * 60 * 1000, // 5 Minuten Cache
    placeholderData: DEFAULT_ABOUT_DATA,
  });

  // ── Speichern ───────────────────────────────────────────────────────────
  const saveAboutContent = useCallback(
    async (data: AboutData): Promise<boolean> => {
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
          description: 'Nur Mojo und Susanne können die About-Seite bearbeiten.',
          variant: 'destructive',
        });
        return false;
      }

      setSaving(true);
      try {
        await publishMutation.mutateAsync({
          kind: ABOUT_KIND,
          content: JSON.stringify(data, null, 2),
          tags: [
            ['d', ABOUT_DTAG],
            ['t', 'about-page'],
            ['L', 'co.mojobus.app'],
            ['l', 'about-page', 'co.mojobus.app'],
          ],
          created_at: Math.floor(Date.now() / 1000),
        });

        // Cache invalidieren → About-Seite zeigt sofort neue Daten
        queryClient.invalidateQueries({ queryKey: ['about-content', ABOUT_DTAG] });

        toast({
          title: '✅ About-Seite gespeichert!',
          description: 'Die Änderungen sind jetzt live auf mojobus.co/about.',
        });

        return true;
      } catch (err: any) {
        toast({
          title: '❌ Speichern fehlgeschlagen',
          description: err?.message || 'Bitte erneut versuchen.',
          variant: 'destructive',
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [user, publishMutation, queryClient, toast]
  );

  return {
    data: aboutData || DEFAULT_ABOUT_DATA,
    isLoading,
    error,
    canEdit,
    saving,
    saveAboutContent,
    refetch: () =>
      queryClient.invalidateQueries({ queryKey: ['about-content', ABOUT_DTAG] }),
  };
}