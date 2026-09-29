import {
  BANNED_TEASER_TAGS,
  DEFAULT_TEASER_RELAY,
  DEFAULT_TEASER_TAGS,
  MAX_TEASER_SUMMARY_LENGTH,
  MAX_TEASER_TAGS,
  type LongformTeaserType,
} from '@/config/longformTeaser';
import { canonicalUrl, articleUrl, placeUrl, tripUrl, videoUrl } from '@/lib/canonicalUrl';
import { nip19 } from 'nostr-tools';

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
  /** Sprache der Teaser-Version (für `/en/`-canonical-URLs). Default: 'de'. */
  lang?: 'de' | 'en';
}

export interface LongformTeaserResult {
  content: string;
  tags: string[][];
  naddr: string;
}

/**
 * Gibt ein zum Inhaltstyp passendes Emoji zurück (für den dezenten Abschluss-Hinweis).
 */
function typeEmoji(type: LongformTeaserType): string {
  switch (type) {
    case 'place': return '📍';
    case 'trip': return '🧭';
    case 'video': return '🎥';
    case 'article':
    default: return '📖';
  }
}

/**
 * Erzeugt eine saubere Plaintext-Summary aus Markdown/HTML.
 */
function buildSummary(body: string, explicitSummary?: string): string {
  const base = (explicitSummary ?? body)
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Markdown-Links → nur der Link-Text. Ohne diesen Schritt landeten bei
    // Artikeln ohne Summary-Feld URL-Reste wie „Anleitung (https://…)" in
    // der 150-Zeichen-Teaser-Summary und fraßen das Zeichenbudget auf.
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
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
 *
 * Fix (SEO, AGENTS Regel 2): OHNE Relay-Hints kodiert — das naddr landet in
 * der `r`-Tag-URL, die die kanonische Seiten-URL sein muss (identisch zu
 * Sitemap + Prerender-Datei). Hinted-naddrs ändern den kompletten Bech32-
 * String und würden Duplicate-URLs erzeugen (der Server müsste sie erst per
 * 301 auflösen). Der Relay-Hint bleibt bewusst im `a`-Tag (3. Wert) — dort
 * ist er Standard und beeinflusst keine URL.
 */
function buildNaddr(kind: number, pubkey: string, dTag: string): string {
  return nip19.naddrEncode({
    kind,
    pubkey,
    identifier: dTag,
  });
}

/**
 * Ermittelt die canonical URL für den Teaser basierend auf dem Inhaltstyp.
 */
function buildCanonicalUrl(type: LongformTeaserType, naddr: string, lang: 'de' | 'en' = 'de'): string {
  switch (type) {
    case 'place':
      return canonicalUrl(placeUrl(naddr, lang));
    case 'trip':
      return canonicalUrl(tripUrl(naddr, lang));
    case 'video':
      return canonicalUrl(videoUrl(naddr, lang));
    case 'article':
    default:
      return canonicalUrl(articleUrl(naddr, lang));
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
 *   <Video-URL alleinstehend, optional>
 *
 *   <Emoji> mojobus.co   (dezenter Hinweis, ohne https:// → keine Link-Preview-Karte)
 *
 * Die canonical URL landet zusätzlich als 'r'-Tag im Event.
 */
export function createLongformTeaser(input: LongformTeaserInput): LongformTeaserResult {
  const naddr = buildNaddr(input.kind, input.pubkey, input.dTag);
  const canonical = buildCanonicalUrl(input.type, naddr, input.lang ?? 'de');
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

  contentLines.push(`${typeEmoji(input.type)} mojobus.co`);

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
