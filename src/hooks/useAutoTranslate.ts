import { useState } from 'react';

import { nip19 } from 'nostr-tools';

import { DEFAULT_TEASER_RELAY } from '@/config/longformTeaser';
import { buildTranslatedDTag } from '@/config/translation';
import {
  buildLanguageTags,
  buildTranslationRefTag,
} from '@/lib/translationTags';
import {
  createLongformTeaser,
  type LongformTeaserType,
} from '@/lib/createLongformTeaser';

import { useNostrPublish } from './useNostrPublish';
import { useToast } from './useToast';

/**
 * Ermittelt die API-Basis-URL. Unter Capacitor (Android-APK, `file://`
 * Kontext) wird die feste Domain verwendet, im Browser ein leerer String
 * (relativer Pfad). Muster wie in den bestehenden Komponenten.
 */
function getApiBaseUrl(): string {
  try {
    const cap = (window as { Capacitor?: { isNative?: boolean; getPlatform?: () => string } }).Capacitor;
    const isNative =
      cap?.isNative === true ||
      (window as { __Capacitor?: { isNative?: boolean } }).__Capacitor?.isNative === true ||
      cap?.getPlatform?.() === 'android' ||
      cap?.getPlatform?.() === 'ios';
    if (isNative) return 'https://mojobus.co';
  } catch {
    /* ignore */
  }
  return '';
}

/** Eingabe für `translateAndPublish()`. */
export interface TranslateAndPublishInput {
  type: 'article' | 'place' | 'trip' | 'note';
  kind: number;
  originalDTag?: string;
  originalEventId?: string;
  pubkey: string;
  title: string;
  summary?: string;
  content: string;
  baseTags: string[][];
  publishTeaser?: boolean;
  teaserImageUrl?: string;
  teaserCountry?: string;
}

/** Antwortstruktur von `/api/translate-content`. */
interface TranslateApiResponse {
  success: boolean;
  title?: string;
  summary?: string;
  content?: string;
  error?: string;
}

/** Ergebnis der EN-Event-Konstruktion. */
interface EnContentEvent {
  tags: string[][];
  dTag?: string;
  naddr?: string;
}

/**
 * Baut das EN-Content-Event für addressable (Artikel/Platz/Trip) bzw.
 * nicht-addressable (Note) Inhalte.
 */
function buildEnContentEvent(input: TranslateAndPublishInput, translated: { title: string; summary: string }): EnContentEvent {
  // Addressable Events (Artikel/Platz/Trip): eigener d-Tag + Sprach-/Referenz-Tags
  if (input.type !== 'note') {
    const dTag = buildTranslatedDTag(input.originalDTag ?? '', 'en');
    const naddr = nip19.naddrEncode({
      kind: input.kind,
      pubkey: input.pubkey,
      identifier: dTag,
      relays: [DEFAULT_TEASER_RELAY],
    });

    // Original-Tags übernehmen, außer d/title/summary (werden durch übersetzte Werte ersetzt)
    const base = input.baseTags.filter(([name]) => name !== 'd' && name !== 'title' && name !== 'summary');

    const tags: string[][] = [
      ...base,
      ['d', dTag],
    ];

    if (translated.title.trim()) tags.push(['title', translated.title.trim()]);
    if (translated.summary.trim()) tags.push(['summary', translated.summary.trim()]);

    tags.push(...buildLanguageTags('en'));
    tags.push(buildTranslationRefTag('en', naddr));

    return { tags, dTag, naddr };
  }

  // Note (Kind 1, nicht addressable): kein d-Tag, Markierung über e-Tag
  const tags: string[][] = [
    ...input.baseTags,
    ...buildLanguageTags('en'),
    ['e', input.originalEventId ?? '', '', 'translation-of'],
  ];

  return { tags };
}

/**
 * Übersetzt einen veröffentlichten Inhaltsinhalt im Hintergrund ins
 * Englische und veröffentlicht die EN-Version als eigenständiges Event.
 *
 * Blockiert nie den Rückgabewert: Fehler werden nur geloggt und als
 * Warn-/Fehler-Toast angezeigt.
 */
export function useAutoTranslate() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { toast } = useToast();
  const [isTranslating, setIsTranslating] = useState(false);

  const translateAndPublish = async (input: TranslateAndPublishInput): Promise<void> => {
    setIsTranslating(true);
    toast({ title: '🇬🇧 Übersetzung läuft...', description: 'Dein Inhalt wird ins Englische übersetzt.' });

    try {
      // 1. DE→EN-Übersetzung vom Server holen
      const response = await fetch(`${getApiBaseUrl()}/api/translate-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: input.title,
          summary: input.summary ?? '',
          content: input.content,
          type: input.type,
        }),
      });

      const data = (await response.json()) as TranslateApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Übersetzung fehlgeschlagen.');
      }

      const translatedTitle = (data.title ?? input.title) as string;
      const translatedSummary = (data.summary ?? input.summary ?? '') as string;
      const translatedContent = data.content as string;

      // 2. EN-Content-Event bauen und veröffentlichen
      const enEvent = buildEnContentEvent(input, { title: translatedTitle, summary: translatedSummary });

      await publishEvent({
        kind: input.kind,
        content: translatedContent,
        tags: enEvent.tags,
      });

      // 3. Optional zusätzlich englische Teaser-Note (Kind 1) veröffentlichen
      if (input.publishTeaser) {
        const teaserType: LongformTeaserType = input.type === 'note' ? 'article' : input.type;
        const teaser = createLongformTeaser({
          type: teaserType,
          title: translatedTitle,
          body: translatedContent,
          summary: translatedSummary.trim() ? translatedSummary : undefined,
          pubkey: input.pubkey,
          dTag: enEvent.dTag ?? '',
          kind: input.kind,
          imageUrl: input.teaserImageUrl || null,
          country: input.teaserCountry || null,
          lang: 'en',
        });

        await publishEvent({ kind: 1, content: teaser.content, tags: teaser.tags });
      }

      toast({ title: '✅ Englische Version veröffentlicht' });
    } catch (error) {
      console.error('[useAutoTranslate] Übersetzung fehlgeschlagen:', error);
      toast({
        title: '⚠️ Übersetzung fehlgeschlagen',
        description: 'Der Original-Inhalt wurde veröffentlicht, aber die englische Version konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    } finally {
      setIsTranslating(false);
    }
  };

  return { translateAndPublish, isTranslating };
}
