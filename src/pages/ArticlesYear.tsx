/**
 * ArticlesYear.tsx – Artikel-Archiv nach Jahren (2012 – laufendes Jahr)
 *
 * Routen:
 *   /artikel/jahre      → Einstieg, Default = laufendes Jahr
 *   /artikel/jahr/:year → ein konkretes Jahr (eigene, teilbare URL für SEO)
 *
 * Ansicht identisch zu /artikel: gleiche ArticleCards (aus Articles.tsx
 * exportiert), Grid 1/2/3 Spalten, Suche, Infinite Scroll, DE/EN-Sprachfilter.
 * Jahr-Auswahl über eine Pill-Leiste (Switcher), Quelle: src/config/years.ts.
 *
 * SEO: Jedes Jahr hat eigene Canonical-URL (/artikel/jahr/{year}); die
 * Einstiegsseite /artikel/jahre zeigt denselben Inhalt wie das laufende
 * Jahr und bekommt dieselbe Canonical → kein Duplicate Content.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePreloadedArticles, extractArticleMetadata } from '@/hooks/useLongformArticles';
import { useAuthors } from '@/hooks/useAuthors';
import { RelaySelector } from '@/components/RelaySelector';
import { getEventLanguage } from '@/lib/translationTags';
import { useLanguage } from '@/hooks/useLanguage';
import { Search, Calendar, Loader2 } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { useHead } from '@unhead/react';
import { canonicalUrl, ogImageUrl } from '@/lib/canonicalUrl';
import { SocialBatchProvider } from '@/hooks/useBatchedSocialCounts';
import {
  getArchiveYears,
  isValidArchiveYear,
  yearArchivePath,
  YEARS_OVERVIEW_PATH,
  YEAR_ARCHIVE_START,
} from '@/config/years';
import { ArticleCard } from './Articles';

import type { NostrEvent, NostrMetadata } from '@nostrify/nostrify';

type AuthorsMap = Map<string, { event?: NostrEvent; metadata?: NostrMetadata }>;
type ArticleMetadata = ReturnType<typeof extractArticleMetadata>;

export function ArticlesYear() {
  const { year: yearParam } = useParams<{ year?: string }>();
  const { lang } = useLanguage();

  const years = useMemo(() => getArchiveYears(), []);
  const currentYear = new Date().getFullYear();

  // /artikel/jahre → Default = laufendes Jahr; /artikel/jahr/:year → Param
  const isOverview = !yearParam;
  const parsedYear = yearParam ? parseInt(yearParam, 10) : currentYear;
  const yearIsValid = isOverview || (/^\d{4}$/.test(yearParam) && isValidArchiveYear(parsedYear));

  const { data: articles, isLoading } = usePreloadedArticles();
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(30);

  // Infinite Scroll Trigger
  const { ref, inView } = useInView({ threshold: 0.1, rootMargin: '200px' });

  useEffect(() => {
    if (inView) {
      setVisibleCount(prev => prev + 30);
    }
  }, [inView]);

  // Sichtbare Anzahl zurücksetzen bei Filter-/Jahr-Wechsel
  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, parsedYear]);

  // Filter: Sprache (wie /artikel) + Jahr (nach created_at, wie auf der Card
  // angezeigt) + Suchbegriff
  const filteredArticles = useMemo(() => {
    let filtered = [...articles].filter(a => getEventLanguage(a) === lang);

    filtered = filtered.filter(a => new Date(a.created_at * 1000).getFullYear() === parsedYear);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(article => {
        const metadata = extractArticleMetadata(article);
        return (
          metadata.title.toLowerCase().includes(query) ||
          metadata.summary.toLowerCase().includes(query) ||
          metadata.tags.some(tag => tag.toLowerCase().includes(query))
        );
      });
    }

    return filtered.sort((a, b) => b.created_at - a.created_at);
  }, [articles, parsedYear, searchQuery, lang]);

  // Autoren-Batching (wie /artikel: 1 Query für alle sichtbaren Cards)
  const uniquePubkeys = useMemo(() => {
    const set = new Set<string>();
    filteredArticles.slice(0, visibleCount).forEach(article => {
      if (article.pubkey) set.add(article.pubkey);
    });
    return Array.from(set);
  }, [filteredArticles, visibleCount]);

  const authorsQuery = useAuthors(uniquePubkeys);
  const authors: AuthorsMap = authorsQuery.data || new Map();

  // Gecachte Metadata pro Artikel (wie /artikel)
  const articlesMetadata = useMemo(() => {
    const map = new Map<string, ArticleMetadata>();
    filteredArticles.forEach(article => {
      map.set(article.id, extractArticleMetadata(article));
    });
    return map;
  }, [filteredArticles]);

  const visibleArticles = filteredArticles.slice(0, visibleCount);
  const hasMore = visibleArticles.length < filteredArticles.length;

  // SEO – Canonical immer auf /artikel/jahr/{year} (auch für /artikel/jahre)
  const canonicalPath = yearArchivePath(parsedYear);
  const pageTitle = `Artikel ${parsedYear} — MojoBus`;
  const pageDescription = `Alle Reiseberichte und Geschichten aus dem Jahr ${parsedYear}. MojoBus Jahresarchiv ${YEAR_ARCHIVE_START}–heute.`;

  useHead({
    title: pageTitle,
    meta: [
      { name: 'description', content: pageDescription },
      { property: 'og:title', content: pageTitle },
      { property: 'og:description', content: pageDescription },
      { property: 'og:url', content: canonicalUrl(canonicalPath) },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: ogImageUrl() },
      { name: 'twitter:title', content: pageTitle },
      { name: 'twitter:description', content: pageDescription },
    ],
    link: [
      { rel: 'canonical', href: canonicalUrl(canonicalPath) },
    ],
  });

  // ── Ungültiges Jahr (z. B. /artikel/jahr/1999) ───────────────────────────
  if (!yearIsValid) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-md mx-auto space-y-6">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground" />
          <h1 className="text-3xl font-bold">Jahr nicht gefunden</h1>
          <p className="text-muted-foreground">
            Das Archiv umfasst die Jahre {YEAR_ARCHIVE_START}–{currentYear}.
          </p>
          <Link to={YEARS_OVERVIEW_PATH}>
            <Button variant="outline">Zum Jahresarchiv</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading-Skeleton (wie /artikel) ──────────────────────────────────────
  if (isLoading) {
    return (
      <>
        <section className="relative py-12 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
          <div className="relative z-10 container mx-auto px-4">
            <div className="text-center space-y-4">
              <Skeleton className="h-12 w-48 mx-auto rounded-lg" />
              <Skeleton className="h-6 w-72 mx-auto rounded-md" />
            </div>
          </div>
        </section>
        <div className="min-h-screen pb-12">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Card key={i} className="overflow-hidden border border-primary/20 rounded-2xl flex flex-col">
                    <div className="aspect-[4/3] bg-muted animate-pulse" />
                    <div className="p-4 space-y-3 flex-1">
                      <div className="h-5 bg-muted animate-pulse rounded-md w-3/4" />
                      <div className="space-y-2">
                        <div className="h-4 bg-muted animate-pulse rounded-md w-full" />
                        <div className="h-4 bg-muted animate-pulse rounded-md w-5/6" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Seite ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Page Header mit Gradient Background */}
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
        <div className="relative z-10 container mx-auto px-4">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold">
              <span className="flex items-center justify-center gap-3">
                <Calendar className="h-8 w-8 md:h-10 md:w-10" />
                <span className="gradient-text">Artikel {parsedYear}</span>
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Alle Reiseberichte und Geschichten aus dem Jahr {parsedYear}
            </p>
          </div>
        </div>
      </section>

      <div className="min-h-screen pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-8">

            {/* Artikel-Zähler */}
            <div className="flex justify-center items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="font-semibold">{filteredArticles.length}</span>
                <span>Artikel aus dem Jahr {parsedYear}</span>
              </span>
            </div>

            {/* Jahr-Switcher (alle Jahre aus der Config, absteigend) */}
            <div className="flex flex-wrap justify-center gap-2">
              {years.map(year => (
                <Link key={year} to={yearArchivePath(year)}>
                  <Badge
                    variant={year === parsedYear ? 'default' : 'outline'}
                    className="cursor-pointer px-3 py-1 text-sm"
                  >
                    {year}
                  </Badge>
                </Link>
              ))}
            </div>

            {/* Suche */}
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Artikel durchsuchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Articles Grid – gleiche Cards wie /artikel */}
            {filteredArticles.length > 0 ? (
              <>
                <SocialBatchProvider events={visibleArticles}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visibleArticles.map((article) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        authorsMap={authors}
                        articlesMetadata={articlesMetadata}
                      />
                    ))}
                  </div>
                </SocialBatchProvider>

                {/* Infinite Scroll Trigger */}
                {hasMore && (
                  <div ref={ref} className="py-8 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-16 px-8 text-center">
                  <div className="max-w-sm mx-auto space-y-6">
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                      Keine Artikel gefunden
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {searchQuery.trim()
                        ? 'Für deine Suche wurden keine Artikel gefunden.'
                        : `Aus dem Jahr ${parsedYear} gibt es noch keine Artikel.`}
                    </p>
                    <div className="flex flex-col gap-2">
                      {searchQuery.trim() && (
                        <Button variant="outline" onClick={() => setSearchQuery('')}>
                          Suche zurücksetzen
                        </Button>
                      )}
                      <Link to={YEARS_OVERVIEW_PATH}>
                        <Button variant="outline" className="w-full">
                          Alle Jahre anzeigen
                        </Button>
                      </Link>
                      <RelaySelector className="w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

export default ArticlesYear;
