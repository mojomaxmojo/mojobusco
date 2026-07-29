/**
 * Zentrale Konfiguration für Longform-Teaser-Notes (Kind 1).
 *
 * Alle Teaser für Artikel, Plätze und Trips verwenden diese Werte,
 * damit das Verhalten im Nostr-Feed (Primal, Amethyst, Damus) konsistent ist.
 */

/** Relay-Hint, der im `a`-Tag auf das Original-Event verweist. */
export const DEFAULT_TEASER_RELAY = 'wss://relay.mojobus.co' as const;

/** Maximale Länge der zusammengefassten Teaser-Beschreibung. */
export const MAX_TEASER_SUMMARY_LENGTH = 150 as const;

/** Maximale Anzahl thematischer `t`-Tags pro Teaser. */
export const MAX_TEASER_TAGS = 8 as const;

/** Tags, die in Teasern nicht verwendet werden sollen (zu generisch/eigenbezogen). */
export const BANNED_TEASER_TAGS = new Set([
  'artikel',
  'article',
  'mojobus',
  'medien',
  'media',
  'bilder',
  'images',
  'notes',
  'note',
  'location',
  'places',
  'place',
  'trip',
  'reisen',
  'bericht',
]);

/** Unterstützte Inhaltstypen für Teaser. */
export type LongformTeaserType = 'article' | 'place' | 'trip' | 'video';

/** Basis-Hashtags pro Inhaltstyp (werden nur ergänzt, wenn nicht bereits vorhanden). */
export const DEFAULT_TEASER_TAGS: Record<LongformTeaserType, string[]> = {
  article: ['vanlife'],
  place: ['camping', 'vanlife'],
  trip: ['reisen', 'vanlife'],
  video: ['video', 'vanlife'],
};
