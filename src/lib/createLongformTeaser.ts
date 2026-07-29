import {
  BANNED_TEASER_TAGS,
  DEFAULT_TEASER_RELAY,
  DEFAULT_TEASER_TAGS,
  MAX_TEASER_SUMMARY_LENGTH,
  MAX_TEASER_TAGS,
  type LongformTeaserType,
} from '@/config/longformTeaser';
import { canonicalUrl, articleUrl, placeUrl, tripUrl, videoUrl } from '@/lib/canonicalUrl';

export interface LongformTeaserInput {
  /** Art des Longform-Inhalts. */
  type: LongformTeaserType;
  /** Angezeigter Titel im Teaser-Post (ohne Präfixe). */
  title: string;
  /** Längerer Text, aus dem die Summary extrahiert wird. */
  body: string;
  /** Optional: vorgefertigte Summary (hat Vorrang vor automatisch generierter). */
  summary?: string;
  /** Öffentlicher Schlüssel des Autors. */
  pubkey: string;
  /** d-Tag des Original-Events. */
  dTag: string;
  /** Kind des Original-Events (z. B. 30023 oder 30025). */
  kind: number;
  /** URL des Titelbildes. */
  imageUrl?: string | null;
  /** URL eines optionalen Videos. */
  videoUrl?: string | null;
  /** Optionale Videodauer in Sekunden (für imeta-Tag). */
  videoDuration?: number | null;
  /** Optionale Video-Dimensionen wie "1080x1920" (für imeta-Tag). */
  videoDimensions?: string | null;
  /** Vom Nutzer gewählte Tags. */
  tags?: string[];
  /** Vom Nutzer gewähltes Land. */
  country?: string | null;
}

export interface LongformTeaserResult {
  content: string;
  tags: string[][];
  naddr: string;
}

/**
 * Erzeugt eine saubere Plaintext-Summary aus Markdown/HTML.
 */
function buildSummary(body: string, explicitSummary?: string): string {
  const base = (explicitSummary ?? body)
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*|__|\*|_|~~|`/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n+/g, ' ')
    .trim();

  if (!base) return '';

  if (base.length <= MAX_TEASER_SUMMARY_LENGTH) return base;

  const truncated = base.slice(0, MAX_TEASER_SUMMARY_LENGTH);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '…';
}

/**
 * Erzeugt ein NIP-19 naddr aus den Original-Event-Daten.
 */
function buildNaddr(kind: number, pubkey: string, dTag: string): string {
  const { nip19 } = require('nostr-tools');
  return nip19.naddrEncode({
    kind,
    pubkey,
    identifier: dTag,
    relays: [DEFAULT_TEASER_RELAY],
  });
}

/**
 * Ermittelt die canonical URL für den Teaser basierend auf dem Inhaltstyp.
 */
function buildCanonicalUrl(type: LongformTeaserType, naddr: string): string {
  switch (type) {
    case 'place':
      return canonicalUrl(placeUrl(naddr));
    case 'trip':
      return canonicalUrl(tripUrl(naddr));
    case 'video':
      return canonicalUrl(videoUrl(naddr));
    case 'article':
    default:
      return canonicalUrl(articleUrl(naddr));
  }
}

/**
 * Bereinigt und begrenzt thematische Tags.
 */
function buildThematicTags(
  type: LongformTeaserType,
  inputTags: string[],
  country: string | null
): string[] {
  const raw = [...DEFAULT_TEASER_TAGS[type], ...inputTags]
    .map((tag) => tag.replace(/^#/, '').trim().toLowerCase())
    .filter((tag) => tag.length > 0 && !BANNED_TEASER_TAGS.has(tag));

  const unique = Array.from(new Set(raw));

  if (country) {
    const normalizedCountry = country.trim().toLowerCase();
    if (normalizedCountry && !unique.includes(normalizedCountry)) {
      unique.push(normalizedCountry);
    }
  }

  return unique.slice(0, MAX_TEASER_TAGS);
}

/**
 * Erzeugt Content und Tags für eine konsistente Longform-Teaser-Note (Kind 1).
 *
 * Struktur des Contents:
 *   Titel
 *
 *   <Bild-URL alleinstehend>
 *
 *   <Summary>
 *
 *   <canonical URL>
 *
 *   nostr:<naddr>
 */
export function createLongformTeaser(input: LongformTeaserInput): LongformTeaserResult {
  const naddr = buildNaddr(input.kind, input.pubkey, input.dTag);
  const canonical = buildCanonicalUrl(input.type, naddr);
  const summary = buildSummary(input.body, input.summary);
  const country = input.country?.trim() || null;
  const thematicTags = buildThematicTags(input.type, input.tags ?? [], country);

  const contentLines: string[] = [];
  contentLines.push(input.title.trim());

  if (input.imageUrl?.trim()) {
    contentLines.push(input.imageUrl.trim());
  }

  if (summary) {
    contentLines.push(summary);
  }

  if (input.videoUrl?.trim()) {
    contentLines.push(input.videoUrl.trim());
  }

  contentLines.push(canonical);
  contentLines.push(`nostr:${naddr}`);

  const content = contentLines.join('\n\n');

  const tags: string[][] = [
    ['a', `${input.kind}:${input.pubkey}:${input.dTag}`, DEFAULT_TEASER_RELAY],
    ['r', canonical],
  ];

  if (input.imageUrl?.trim()) {
    tags.push([
      'imeta',
      `url ${input.imageUrl.trim()}`,
      'm image/jpeg',
      `alt ${input.title.trim()}`,
    ]);
  }

  if (input.videoUrl?.trim()) {
    const videoImeta: string[] = [
      'imeta',
      `url ${input.videoUrl.trim()}`,
      'm video/mp4',
      `alt ${input.title.trim()}`,
    ];
    if (input.videoDimensions?.trim()) {
      videoImeta.push(`dim ${input.videoDimensions.trim()}`);
    }
    if (input.videoDuration && input.videoDuration > 0) {
      videoImeta.push(`duration ${input.videoDuration}`);
    }
    tags.push(videoImeta);
  }

  for (const tag of thematicTags) {
    tags.push(['t', tag]);
  }

  return { content, tags, naddr };
}
