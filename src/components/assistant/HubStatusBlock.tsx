/**
 * HubStatusBlock — Frische-Check „🗺️ Hub-Status" im ContentPlanSheet
 *
 * WP2 (PLAN_PILLAR_LINKS.md): Zeigt pro Plan, wie viele Plan-Artikel der
 * Pillar bereits im Fließtext verlinkt — „Pillar verlinkt X von Y" + die
 * fehlende Liste. Button „Pillar-Update vorbereiten" öffnet den Pillar im
 * bestehenden Edit-Flow (/veroeffentlichen?edit=<event-id>&type=article);
 * WP3 übergibt dort das Vorschlags-Panel (SessionStorage-Handover).
 *
 * Daten:
 *  - Plan-Artikel + Pillar: /data/articles.json (Artikel mit plan=<planId>;
 *    Pillar = zusätzlich t=hub; DE-Sicht, l-Tag-Fallback 'de')
 *  - Pillar-Content: 1 Relay-Fetch (kind 30023, author + d-Tag, 5 s Timeout,
 *    Muster useEditData)
 *  - Dedupe-Extraktion: identische Logik wie die dynamische Liste
 *    (extractLinkedNaddrs aus planRelatedShared.ts)
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNostr } from '@/hooks/useNostr';
import { NOSTR_CONFIG } from '@/config/nostr';
import { getDataBaseUrl } from '@/lib/apiBase';
import { PLAN_TAG, HUB_TAG } from '@/config/destinationsSchema';
import {
  isSiteDataArticle,
  langOfTags,
  tagValue,
  canonicalNaddrOf,
  extractLinkedNaddrs,
} from '@/components/article/planRelatedShared';
import type { SiteDataArticle } from '@/components/article/planRelatedShared';

/** Relay-Timeout für den Pillar-Content-Fetch (Plan: 5 s) */
const PILLAR_FETCH_TIMEOUT_MS = 5000;

interface HubStatusBlockProps {
  /** planId des aktiven Plans */
  planId: string;
}

interface HubStatus {
  /** Pillar-Artikel aus dem Dump (id → Edit-Link); null = noch nicht published */
  pillar: SiteDataArticle | null;
  /** Y: Plan-Artikel (de) ohne den Pillar selbst */
  total: number;
  /** fehlende (nicht im Pillar verlinkte) Artikel */
  missing: Array<{ title: string; eventId: string }>;
}

/** Lädt den Pillar-Content (voller Markdown) per Relay-Query */
async function fetchPillarContent(
  nostr: ReturnType<typeof useNostr>['nostr'],
  pubkey: string,
  dTag: string
): Promise<string> {
  const filter: { kinds: number[]; authors: string[]; limit: number; '#d'?: string[] } = {
    kinds: [NOSTR_CONFIG.kinds.longform],
    authors: [pubkey],
    limit: 1,
  };
  if (dTag) filter['#d'] = [dTag];
  const events = await nostr.query([filter], {
    signal: AbortSignal.timeout(PILLAR_FETCH_TIMEOUT_MS),
  });
  return events[0]?.content || '';
}

export function HubStatusBlock({ planId }: HubStatusBlockProps) {
  const { nostr } = useNostr();
  const navigate = useNavigate();
  const [status, setStatus] = useState<HubStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1) Plan-Artikel + Pillar aus dem Dump (1 fetch)
        const res = await fetch(`${getDataBaseUrl()}/data/articles.json`);
        const raw: unknown = res.ok ? await res.json() : null;
        const inPlan = (Array.isArray(raw) ? raw : [])
          .filter(isSiteDataArticle)
          .filter((a) => a.kind === 30023)
          .filter((a) => (tagValue(a.tags, 'type') || 'article') === 'article')
          .filter((a) => tagValue(a.tags, PLAN_TAG) === planId)
          // DE-Sicht (der Pillar ist deutsch; EN-Pendant trägt l=en)
          .filter((a) => langOfTags(a.tags) === 'de');
        const pillar = inPlan.find(
          (a) => a.tags.some(([n, v]) => n === 't' && v === HUB_TAG)
        ) ?? null;

        if (!pillar) {
          if (!cancelled) {
            setStatus({ pillar: null, total: Math.max(inPlan.length - 1, 0), missing: [] });
          }
          return;
        }

        // 2) Pillar-Content + 3) Dedupe gegen Plan-Artikel
        const content = await fetchPillarContent(nostr, pillar.pubkey, tagValue(pillar.tags, 'd'));
        const linked = extractLinkedNaddrs(content);
        const missing: Array<{ title: string; eventId: string }> = [];
        let total = 0;
        for (const a of inPlan) {
          if (a.id === pillar.id) continue;
          total += 1;
          if (linked.has(canonicalNaddrOf(a).toLowerCase())) continue;
          missing.push({ title: tagValue(a.tags, 'title') || 'Artikel', eventId: a.id });
        }
        if (!cancelled) setStatus({ pillar, total, missing });
      } catch {
        // Dump/Relay-Fetch fehlgeschlagen → Block bleibt neutral (kein Crash)
        if (!cancelled) setStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, nostr]);

  if (!status) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    );
  }

  // Kein Pillar im Dump (noch nicht mit t=hub gepublished) → dezenter Hinweis
  if (!status.pillar) {
    if (status.total === 0) return null;
    return (
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-sm font-medium">🗺️ Hub-Status</p>
        <p className="text-xs text-muted-foreground mt-1">
          Noch kein Pillar veröffentlicht — den Haupt-Pillar mit dem Schalter
          „Pillar (Hub) dieses Plans" publishen.
        </p>
      </div>
    );
  }

  const linkedCount = status.total - status.missing.length;
  const allLinked = status.total > 0 && status.missing.length === 0;

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      <p className="text-sm font-medium">🗺️ Hub-Status</p>
      <p className="text-xs text-muted-foreground">
        Pillar verlinkt {linkedCount} von {status.total} Plan-Artikeln im
        Fließtext{allLinked ? ' — komplett ✅' : '.'}
      </p>
      {status.missing.length > 0 && (
        <ul className="space-y-1">
          {status.missing.map((m) => (
            <li key={m.eventId} className="text-xs text-muted-foreground">
              • {m.title}
            </li>
          ))}
        </ul>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={() => navigate(`/veroeffentlichen?edit=${status.pillar?.id}&type=article`)}
      >
        Pillar-Update vorbereiten
      </Button>
    </div>
  );
}
