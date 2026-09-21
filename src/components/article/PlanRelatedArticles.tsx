/**
 * PlanRelatedArticles — Dynamische Liste „Mehr aus diesem Reiseziel"
 *
 * WP1 (PLAN_PILLAR_LINKS.md): Zeigt unter jedem kind-30023-Artikel mit
 * plan-Tag die übrigen Artikel desselben Contentplans. Quelle ist der
 * Site-Data-Dump (/data/articles.json, Cron ≤ 3 h) — kein Relay-Call.
 *
 * Kern-Regeln:
 *  - DEDUPE: Artikel, die im Fließtext des geöffneten Artikels bereits
 *    verlinkt sind (canonical URL, nostr:-Prefix oder mit Relay-Hints),
 *    werden AUSGEBLENDET — die Liste zeigt nur den Zuwachs.
 *  - Sprache: folgt dem geöffneten Artikel (l-Tag-Match, Entscheidung
 *    2026-09-21). Kandidaten ohne l-Tag gelten als de.
 *  - Cap 12, neueste zuerst (Entscheidung 2026-09-21).
 *  - Keine Places (type=place), nicht der Artikel selbst.
 *  - Überschrift aus destinations.json (planId → Destination); ohne
 *    Zuordnung generisch. Keine Treffer → Komponente rendert nichts.
 *
 * Prerender-Gegenstück: scripts/prerender-entity-templates.js rendert
 * dieselbe Liste ins Bot-HTML (Dedupe-Logik gespiegelt in
 * scripts/prerender-helpers.js — Pipeline importiert kein src/).
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { articleUrl } from '@/lib/canonicalUrl';
import { getDataBaseUrl } from '@/lib/apiBase';
import { parseDestinations, PLAN_TAG } from '@/config/destinationsSchema';
import {
  isSiteDataArticle,
  langOfTags,
  tagValue,
  canonicalNaddrOf,
  extractLinkedNaddrs,
} from './planRelatedShared';
import type { PlanRelatedItem } from './planRelatedShared';

/** Cap der Liste (Risiko 4, PLAN_PILLAR_LINKS.md) */
const MAX_ITEMS = 12;

interface PlanRelatedArticlesProps {
  /** kind-30023-Event des geöffneten Artikels (Tags + Content fürs Dedupe) */
  article: { tags: string[][]; content: string };
  /** kanonischer naddr des geöffneten Artikels (Selbst-Ausschluss) */
  selfNaddr: string;
  /** Sprache des geöffneten Artikels — steuert Liste + Überschrift */
  lang: 'de' | 'en';
}

export function PlanRelatedArticles({ article, selfNaddr, lang }: PlanRelatedArticlesProps) {
  const planId = tagValue(article.tags, PLAN_TAG);
  const linkedNaddrs = useMemo(
    () => extractLinkedNaddrs(article.content || ''),
    [article.content]
  );
  const [items, setItems] = useState<PlanRelatedItem[] | null>(null);
  const [destinationTitle, setDestinationTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    (async () => {
      try {
        const base = getDataBaseUrl();
        const [articlesRes, destinationsRes] = await Promise.all([
          fetch(`${base}/data/articles.json`),
          fetch(`${base}/data/destinations.json`).catch(() => null),
        ]);
        if (!articlesRes.ok) return;
        const rawArticles: unknown = await articlesRes.json();
        const destinations = destinationsRes && destinationsRes.ok
          ? parseDestinations(await destinationsRes.json())
          : null;
        if (cancelled) return;

        const destination = destinations?.regions
          .flatMap((r) => r.destinations)
          .find((d) => d.planId === planId) ?? null;

        const candidates = (Array.isArray(rawArticles) ? rawArticles : [])
          .filter(isSiteDataArticle)
          // nur Artikel (kind 30023, keine Places)
          .filter((a) => a.kind === 30023)
          .filter((a) => (tagValue(a.tags, 'type') || 'article') === 'article')
          // gleicher Contentplan
          .filter((a) => tagValue(a.tags, PLAN_TAG) === planId)
          // nicht der Artikel selbst (canonical Vergleich, SEO-Regel 2)
          .filter((a) => canonicalNaddrOf(a).toLowerCase() !== selfNaddr.toLowerCase())
          // Sprache folgt dem geöffneten Artikel (Entscheidung 2026-09-21)
          .filter((a) => langOfTags(a.tags) === lang)
          // ── DEDUPE: bereits verlinkte Artikel fliegen raus ──
          .filter((a) => !linkedNaddrs.has(canonicalNaddrOf(a).toLowerCase()))
          // neueste zuerst (published_at, Fallback created_at)
          .sort((a, b) => {
            const pa = parseFloat(tagValue(a.tags, 'published_at')) || a.created_at;
            const pb = parseFloat(tagValue(b.tags, 'published_at')) || b.created_at;
            return pb - pa;
          })
          // Cap 12 (Entscheidung 2026-09-21)
          .slice(0, MAX_ITEMS)
          .map<PlanRelatedItem>((a) => {
            const naddr = canonicalNaddrOf(a);
            return {
              naddr,
              title: tagValue(a.tags, 'title') || tagValue(a.tags, 'name') || 'Artikel',
              path: articleUrl(naddr, lang),
            };
          });

        if (cancelled) return;
        setItems(candidates);
        setDestinationTitle(destination?.title ?? null);
      } catch {
        // Dump fehlt/kaputt → Liste bleibt aus (kein Crash, kein Block)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, selfNaddr, lang, linkedNaddrs]);

  // Kein plan-Tag → nichts rendern (ArticleView mountet nur bei plan-Tag,
  // der interne Guard schützt gegen Direktnutzung)
  if (!planId) return null;

  // Ladezustand: Skeleton nur für den Listenbereich (AGENTS-Regel 6)
  if (items === null) {
    return (
      <div className="rounded-xl border bg-muted/30 p-5 space-y-3">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-full max-w-sm" />
        <Skeleton className="h-4 w-full max-w-xs" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    );
  }

  // Keine (weiteren) Artikel des Plans → Liste entfällt komplett
  if (items.length === 0) return null;

  const heading = destinationTitle
    ? (lang === 'en' ? `📍 More from “${destinationTitle}”` : `📍 Mehr aus „${destinationTitle}“`)
    : (lang === 'en' ? '📍 More from this destination' : '📍 Mehr aus diesem Reiseziel');
  const footerLabel = lang === 'en' ? 'All destinations' : 'Alle Reiseziele';
  const destinationsPath = lang === 'en' ? '/en/reiseziele' : '/reiseziele';

  return (
    <div className="rounded-xl border bg-muted/30 p-5">
      <p className="font-semibold mb-3">{heading}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.naddr}>
            <Link
              to={item.path}
              className="text-sm text-primary hover:underline"
            >
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to={destinationsPath}
        className="inline-block mt-3 text-xs text-muted-foreground hover:underline"
      >
        {footerLabel} →
      </Link>
    </div>
  );
}
