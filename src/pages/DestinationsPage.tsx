/**
 * DestinationsPage — Reiseziele-Hub (/reiseziele)
 *
 * Zentrale Index-Seite, die alle Reiseziel-Pillars aus den Contentplänen
 * bündelt. Datenquelle: public/data/destinations.json (gepflegt nach dem
 * Publish jedes Pillar-Artikels, siehe destinationsSchema.ts).
 *
 * - pillarNaddr gesetzt  → Link auf den Pillar-Artikel (/{naddr})
 * - pillarNaddr null     → Badge „bald", kein Link
 * - regionGuide gesetzt  → zusätzlicher Link auf den Region-Reiseführer
 *
 * AGENTS-Regeln: Skeleton (kein Spinner) für strukturierten Content,
 * getDataBaseUrl() für Capacitor-safe Fetch, Datei < 300 Zeilen.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SEOHead } from '@/components/SEOHead';
import { canonicalUrl } from '@/lib/canonicalUrl';
import { getDataBaseUrl } from '@/lib/apiBase';
import {
  parseDestinations,
  type DestinationsFile,
  type DestinationEntry,
  type DestinationRegion,
} from '@/config/destinationsSchema';

// ── JSON-LD: ItemList mit Regionen als Gruppen ──────────────────────────────

function buildDestinationsJsonLd(data: DestinationsFile): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Reiseziele — MojoBus',
    url: canonicalUrl('/reiseziele'),
    itemListElement: data.regions.map((region: DestinationRegion) => ({
      '@type': 'ItemList',
      name: region.region,
      itemListElement: region.destinations.map((d, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: d.pillarTitle,
        ...(d.pillarNaddr ? { url: canonicalUrl(`/${d.pillarNaddr}`) } : {}),
      })),
    })),
  };
}

// ── Destination-Link (oder „bald"-Badge) ────────────────────────────────────

function DestinationItem({ dest }: { dest: DestinationEntry }) {
  const link = dest.pillarNaddr ? `/${dest.pillarNaddr}` : null;
  return (
    <li className="py-2 border-b border-border/40 last:border-0">
      {link ? (
        <Link to={link} className="group flex flex-col gap-0.5">
          <span className="font-medium text-primary group-hover:underline">
            {dest.pillarTitle}
          </span>
          {dest.ort && (
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {dest.ort}
            </span>
          )}
        </Link>
      ) : (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground flex items-center gap-2 flex-wrap">
            {dest.pillarTitle}
            <Badge variant="secondary">bald</Badge>
          </span>
          {dest.ort && (
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {dest.ort}
            </span>
          )}
        </div>
      )}
      {dest.regionGuide && (
        <Link
          to={`/${dest.regionGuide}`}
          className="text-sm text-primary hover:underline mt-1 inline-block"
        >
          Region-Guide →
        </Link>
      )}
    </li>
  );
}

// ── Regions-Card ────────────────────────────────────────────────────────────

function RegionCard({ region }: { region: DestinationRegion }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <span className="text-2xl" aria-hidden="true">{region.flag}</span>
          <span>{region.region}</span>
          {region.land && (
            <span className="text-sm font-normal text-muted-foreground">{region.land}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border/40">
          {region.destinations.map((d) => (
            <DestinationItem key={d.planId} dest={d} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function DestinationsPage() {
  const [data, setData] = useState<DestinationsFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getDataBaseUrl()}/data/destinations.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const parsed = parseDestinations(await res.json());
        if (!parsed) throw new Error('destinations.json kaputt');
        if (!cancelled) setData(parsed);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Reiseziele nicht ladbar');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const jsonLd = useMemo(
    () => (data ? buildDestinationsJsonLd(data) : undefined),
    [data]
  );

  const description =
    'Unsere Reiseziele: Guides, Strände, Orte und Erlebnisse – der zentrale Hub für alle Regionen, in denen MojoBus unterwegs war.';

  return (
    <div className="min-h-screen">
      <SEOHead
        title="Reiseziele"
        description={description}
        url={canonicalUrl('/reiseziele')}
        type="website"
        jsonLd={jsonLd}
      />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <span aria-hidden="true">🗺️</span> Reiseziele
          </h1>
          <p className="text-muted-foreground mb-8">{description}</p>

          {isLoading && (
            <div className="space-y-6">
              {[0, 1, 2].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-7 w-64" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && error && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Erster Reiseziel-Guide folgt bald.
              </CardContent>
            </Card>
          )}

          {!isLoading && !error && data && (
            <div className="space-y-6">
              {data.regions.map((region) => (
                <RegionCard key={region.id} region={region} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}