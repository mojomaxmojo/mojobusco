import { Link, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePreloadedArticles, extractArticleMetadata } from '@/hooks/useLongformArticles';
import { useAuthors } from '@/hooks/useAuthors';
import { genUserName } from '@/lib/genUserName';
import { RelaySelector } from '@/components/RelaySelector';
import { filterEventsByCountry } from '@/lib/countryDetection';
import { getEventLanguage } from '@/lib/translationTags';
import { useLanguage } from '@/hooks/useLanguage';
import { COUNTRIES } from '@/config';
import { Search, Calendar, User, Wrench, Dog, MapPin, Loader2, Waves } from 'lucide-react';
import { useState, useMemo, memo, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { nip19 } from 'nostr-tools';
import type { NostrEvent, NostrMetadata } from '@nostrify/nostrify';
import { AUTHORS } from '@/config/nostr';
import { getAuthorRelayConfigByPubkey } from '@/config/relays';
import { getListThumbnailUrl, getImagePlaceholder, generateSrcset, generateSizes } from '@/lib/imageUtils';
import { MAIN_MENU } from '@/config/menu';
import { SocialBar } from '@/components/SocialBar';
import { canonicalUrl } from '@/lib/canonicalUrl';
// @ts-nocheck
// @ts-ignore
import { useHead } from '@unhead/react';

function Articles() {
  const { country } = useParams();
  const { data: articles, isLoading } = usePreloadedArticles();
  const { lang } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [visibleCount, setVisibleCount] = useState(30);

  // Infinite Scroll trigger
  const { ref, inView } = useInView({ threshold: 0.1, rootMargin: '200px' });

  useEffect(() => {
    if (inView) {
      setVisibleCount(prev => prev + 30);
    }
  }, [inView]);

  // Zurücksetzen der sichtbaren Anzahl bei Filter-Änderung
  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, selectedTag, selectedAuthor, country]);

  const currentCountry = country ? COUNTRIES[country] : null;

  // 🔥 OPTIMIZATION: Extrahiere alle unique pubkeys für Batching
  const uniquePubkeys = useMemo(() => {
    const set = new Set<string>();
    articles.forEach(article => {
      if (article.pubkey) {
        set.add(article.pubkey);
      }
    });
    return Array.from(set);
  }, [articles]);

  // 🔥 OPTIMIZATION 1: Batch-Abruf aller Autoren-Profile (statt pro Artikel)
  const authorsQuery = useAuthors(uniquePubkeys);
  const authors = authorsQuery.data || new Map();

  // Filter articles mit intelligenter Ländererkennung
  const filteredArticles = useMemo(() => {
    let filtered = [...articles].filter(a => getEventLanguage(a) === lang);

    // Country filter mit intelligenter Erkennung
    if (currentCountry) {
      filtered = filterEventsByCountry(filtered, country);
    }

    // Author filter (auch wenn keine Suche!)
    if (selectedAuthor) {
      filtered = filtered.filter(article => article.pubkey === selectedAuthor);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(article => {
        const metadata = extractArticleMetadata(article);

        // Tag filter (case-insensitive)
        if (selectedTag && !metadata.tags.some(tag => tag.toLowerCase() === selectedTag.toLowerCase())) {
          return false;
        }

        // Search filter (content nicht mehr in JSON-Dumps – Titel/Summary/Tags reichen)
        return (
          metadata.title.toLowerCase().includes(query) ||
          metadata.summary.toLowerCase().includes(query) ||
          metadata.tags.some(tag => tag.toLowerCase().includes(query))
        );
      });
    }

    return filtered.sort((a, b) => b.created_at - a.created_at);
  }, [articles, searchQuery, selectedTag, selectedAuthor, currentCountry, country, lang]);

  // 🔥 OPTIMIZATION 2: Cache Artikel-Metadata um Duplikate zu vermeiden
  // Wird für jedes ArticleCard wiederverwendet statt neu berechnet
  const articlesMetadata = useMemo(() => {
    const map = new Map();
    filteredArticles.forEach(article => {
      map.set(article.id, extractArticleMetadata(article));
    });
    return map;
  }, [filteredArticles]);

  const articleCount = articles.length;

  // Nur sichtbare Artikel rendern (Infinite Scroll)
  const visibleArticles = filteredArticles.slice(0, visibleCount);
  const hasMore = visibleArticles.length < filteredArticles.length;

  // Simple SEO Meta Tags
  const pageTitle = currentCountry
    ? `Artikel aus ${currentCountry.name} ${currentCountry.flag} (${filteredArticles.length}) - MojoBus`
    : `Artikel (${filteredArticles.length}) - MojoBus`;

  const pageDescription = currentCountry
    ? `Entdecke ${filteredArticles.length} Reiseberichte und Geschichten aus ${currentCountry.name}.`
    : `Entdecke ${filteredArticles.length} Reiseberichte und Geschichten vom Leben am Meer.`;

  useHead({
    title: pageTitle,
    meta: [
      { name: 'description', content: pageDescription },
      { name: 'keywords', content: 'Vanlife, Camping, Perpetual Travelers, Nostr, Reiseberichte, Geschichten, Portugal, Spanien, Frankreich, Belgien, Luxemburg, Deutschland' },
      { property: 'og:title', content: pageTitle },
      { property: 'og:description', content: pageDescription },
      { property: 'og:url', content: canonicalUrl(`/artikel${country ? '/' + country : ''}`) },
      { property: 'og:type', content: 'website' }
    ],
    link: [
      { rel: 'canonical', href: canonicalUrl(`/artikel${country ? '/' + country : ''}`) }
    ]
  });

  if (isLoading) {
    return (
      <>
        {/* Page Header Skeleton */}
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

  const hasContent = filteredArticles.length > 0;

  return (
    <>
      {/* Page Header mit Gradient Background */}
      <section className="relative py-12 overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold">
              {currentCountry ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="text-3xl">{currentCountry.flag}</span>
                  <span className="gradient-text">Artikel aus {currentCountry.name}</span>
                </span>
              ) : (
                <span className="gradient-text">Artikel</span>
              )}
            </h1>
            <p className="text-xl text-muted-foreground">
              {currentCountry
                ? `Geschichten, Tipps und Einblicke aus unseren Reisen in ${currentCountry.name}`
                : 'Geschichten, Tipps und Einblicke aus unserem Leben als Perpetual Travelers'
              }
            </p>
          </div>
        </div>
      </section>

      <div className="min-h-screen pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Article Count */}
            <div className="flex justify-center items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="font-semibold">{filteredArticles.length}</span>
                <span>Artikel{currentCountry ? ` aus ${currentCountry.name}` : ''}</span>
              </span>
              {articleCount > filteredArticles.length && (
                <span className="text-xs text-muted-foreground">
                  (von {articleCount} insgesamt)
                </span>
              )}
              {currentCountry && (
                <Link
                  to="/artikel"
                  className="text-ocean-600 hover:text-ocean-700 underline"
                >
                  Alle Artikel anzeigen
                </Link>
              )}
            </div>

            {/* Search */}
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

            {/* Artikel-Kategorien Untermenü (nur auf Hauptseite anzeigen) */}
            {!currentCountry && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* DIY */}
                <Link to="/artikel/diy" className="group">
                  <Card className="hover:shadow-md transition-all hover:border-ocean-300">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg group-hover:bg-orange-200 dark:group-hover:bg-orange-800 transition-colors">
                          <Wrench className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            DIY Anleitungen
                          </h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Solar, Batterie, Reparatur, Ausbau
                          </p>
                        </div>
                        <svg className="h-4 w-4 text-gray-400 group-hover:text-ocean-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {/* RV Life */}
                <Link to="/artikel/rvlife" className="group">
                  <Card className="hover:shadow-md transition-all hover:border-ocean-300">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                          <MapPin className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            🚐 RV Life
                          </h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Küche & Essen, Ausstattung, Freeliving, Lifestyle
                          </p>
                        </div>
                        <svg className="h-4 w-4 text-gray-400 group-hover:text-ocean-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {/* Strand/Ort */}
                <Link to="/artikel/strand-ort" className="group">
                  <Card className="hover:shadow-md transition-all hover:border-ocean-300">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-100 dark:bg-cyan-900 rounded-lg group-hover:bg-cyan-200 dark:group-hover:bg-cyan-800 transition-colors">
                          <Waves className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            🏖️ Strand/Ort
                          </h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Strand, Berg, Wald, Meer, Ort
                          </p>
                        </div>
                        <svg className="h-4 w-4 text-gray-400 group-hover:text-ocean-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {/* Leon */}
                <Link to="/artikel/leon" className="group">
                  <Card className="hover:shadow-md transition-all hover:border-ocean-300">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg group-hover:bg-amber-200 dark:group-hover:bg-amber-800 transition-colors">
                          <Dog className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            🦁 Leon Stories
                          </h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Abenteuer unseres Hundes
                          </p>
                        </div>
                        <svg className="h-4 w-4 text-gray-400 group-hover:text-ocean-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            )}

            {/* Articles Grid */}
            {hasContent ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visibleArticles.map((article) => (
                  <ArticleCard key={article.id} article={article} authorsMap={authors} articlesMetadata={articlesMetadata} />
                ))}
              </div>

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
                      Für deine Suche wurden keine Artikel gefunden.
                    </p>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {currentCountry
                          ? `Keine Artikel aus ${currentCountry.name} gefunden. Versuche andere Suchbegriffe oder blättere alle Artikel.`
                          : 'Keine Artikel gefunden. Versuche andere Suchbegriffe oder stelle sicher, dass du mit dem richtigen Relay verbunden bist.'
                        }
                      </p>
                      <div className="flex flex-col gap-2">
                        {currentCountry && (
                          <Link to="/artikel">
                            <Button variant="outline" className="w-full">
                              Alle Artikel anzeigen
                            </Button>
                          </Link>
                        )}
                        <div className="flex gap-2">
                          <Button onClick={() => window.location.href = '/veroeffentlichen'}>
                            <span className="mr-2">Artikel</span>
                            schreiben
                          </Button>
                          <RelaySelector className="w-full" />
                        </div>
                      </div>
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

const ArticleCard = memo(function ArticleCard({
  article,
  authorsMap,
  articlesMetadata,
}: {
  article: NostrEvent;
  authorsMap: Map<string, { event?: NostrEvent; metadata?: NostrMetadata }>;
  articlesMetadata: Map<string, any>;
}) {
  // 🔥 OPTIMIZATION 2: Gecachte Metadata statt neu berechnet
  const metadata = articlesMetadata.get(article.id) || extractArticleMetadata(article);

  // 🔥 OPTIMIZATION 1: Autoren aus Batching-Map statt separatem Query
  const author = authorsMap.get(article.pubkey);
  const authorName = author?.metadata?.name || genUserName(article.pubkey);

  // ✅ DYNAMISCHES RELAY basierend auf Autor (aus relays.ts)
  const authorRelayConfig = getAuthorRelayConfigByPubkey(article.pubkey);
  const relay = authorRelayConfig?.activeRelay || 'wss://relay.mojobus.co';

  // Generate naddr identifier for article
  const naddr = nip19.naddrEncode({
    kind: article.kind,
    pubkey: article.pubkey,
    identifier: metadata.identifier,
    relays: [relay]
  });

  // Optimized thumbnail URL (200px, quality 80) with srcset
  const thumbnailUrl = metadata.image ? getListThumbnailUrl(metadata.image) : null;
  const srcset = metadata.image ? generateSrcset(metadata.image) : undefined;
  const sizes = generateSizes('card');
  const placeholderColor = metadata.image ? getImagePlaceholder(metadata.image) : undefined;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col h-full">
      <Link to={`/${naddr}`} className="flex flex-col h-full">
        {thumbnailUrl ? (
          <div
            className="aspect-video overflow-hidden bg-muted"
            style={{
              backgroundColor: placeholderColor,
            }}
          >
            <img
              src={thumbnailUrl}
              srcSet={srcset}
              sizes={sizes}
              alt={metadata.title}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : (
          <ImagePlaceholder variant="article" title={metadata.title} />
        )}
      </Link>
      <CardContent className="p-4">
        <div className="space-y-3">
          <Link to={`/${naddr}`}>
            <h3 className="font-bold text-lg hover:text-primary transition-colors line-clamp-2">
              {metadata.title}
            </h3>
          </Link>
          {metadata.summary && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {metadata.summary}
            </p>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              <time>{new Date(article.created_at * 1000).toLocaleDateString('de-DE', { year: 'numeric', month: 'short', day: 'numeric' })}</time>
            </div>
            <div className="flex items-center gap-2">
              {authorName && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{authorName}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {metadata.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
      <SocialBar event={article} compact />
    </Card>
  );
});

export default Articles;
