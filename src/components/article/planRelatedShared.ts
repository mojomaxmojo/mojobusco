/**
 * planRelatedShared.ts — geteilte Typen/Helper für die Plan-Artikel-Logik
 *
 * Von PlanRelatedArticles.tsx (dynamische Liste, WP1) und HubStatusBlock.tsx
 * (Frische-Check, WP2) genutzt — eine Quelle statt Duplikate.
 * Prerender-Gegenstück: extractLinkedNaddrsFromContent in
 * scripts/prerender-helpers.js (Pipeline importiert kein src/).
 */

import { nip19 } from 'nostr-tools';
import type { AddressPointer } from 'nostr-tools/nip19';
import { canonicalNaddr } from '@/lib/canonicalUrl';

/** Eintrag aus articles.json (stripArticle, generate-site-data.js) — ohne Content */
export interface SiteDataArticle {
  id: string;
  pubkey: string;
  kind: number;
  created_at: number;
  tags: string[][];
}

/** Defensiver Type-Guard für Dump-Einträge (fremde JSON, nie crashen) */
export function isSiteDataArticle(raw: unknown): raw is SiteDataArticle {
  if (typeof raw !== 'object' || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return typeof r.id === 'string'
    && typeof r.pubkey === 'string'
    && typeof r.kind === 'number'
    && typeof r.created_at === 'number'
    && Array.isArray(r.tags);
}

/** Sprache aus dem l-Tag (Spiegel von getEventLanguage, lib/translationTags.ts) */
export function langOfTags(tags: string[][]): 'de' | 'en' {
  const l = tags.find(([name]) => name === 'l')?.[1];
  return l?.toLowerCase() === 'en' ? 'en' : 'de';
}

/** Erster Wert eines Tags (oder leerer String) */
export function tagValue(tags: string[][], name: string): string {
  return tags.find(([n]) => n === name)?.[1] || '';
}

/** Ein Listeneintrag der dynamischen Reiseziel-Liste (WP1) */
export interface PlanRelatedItem {
  title: string;
  naddr: string;
  /** Pfad inkl. Sprache (/… oder /en/…) */
  path: string;
}

/** Kanonischer naddr eines Dump-Eintrags (kind-30023-Artikel) */
export function canonicalNaddrOf(a: SiteDataArticle): string {
  return canonicalNaddr({ kind: 30023, pubkey: a.pubkey, identifier: tagValue(a.tags, 'd') });
}

/**
 * Kern-Regel (User-Anforderung, PLAN_PILLAR_LINKS.md): Extrahiert alle
 * naddr1…-Strings aus dem Content-Markdown — prefix-unabhängig
 * (https://mojobus.co/naddr1…, nostr:naddr1…, bare). Jeder Treffer wird
 * zusätzlich kanonisch normalisiert (nip19.decode → canonicalNaddr), damit
 * auch Relay-Hint-Varianten erkannt werden. Rückgabe: Set der kanonischen
 * naddr-Strings (lowercase) + der Rohtreffer.
 */
export function extractLinkedNaddrs(content: string): Set<string> {
  const linked = new Set<string>();
  for (const match of content.matchAll(/naddr1[0-9a-z]+/gi)) {
    const raw = match[0].toLowerCase();
    linked.add(raw);
    try {
      const decoded = nip19.decode(match[0]);
      if (decoded.type === 'naddr') {
        const p = decoded.data as AddressPointer;
        linked.add(
          canonicalNaddr({ kind: p.kind, pubkey: p.pubkey, identifier: p.identifier }).toLowerCase()
        );
      }
    } catch {
      // kein valides naddr — Rohtreffer bleibt trotzdem im Set (konservativ)
    }
  }
  return linked;
}
