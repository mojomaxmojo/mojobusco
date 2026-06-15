import React, { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { useInfiniteLongformArticles, extractArticleMetadata } from '@/hooks/useLongformArticles';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { getAuthorRelayConfigByPubkey } from '@/config/relays';
import { DEFAULT_PERFORMANCE_CONFIG } from '@/config/performance';
import { getListThumbnailUrl, getImagePlaceholder, generateSrcset, generateSizes } from '@/lib/imageUtils';
import { LEON_CONFIG } from '@/config/leon';
import { Search, Calendar, User, Dog, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import { useInView } from 'react-intersection-observer';
import { useHead } from '@unhead/react';

export function Leon() {
  const [searchTerm, setSearchTerm] = useState('');

  // Alle Leon-Artikel abrufen mit Infinite Scroll
  const { data: articles, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteLongformArticles({
    kinds: [30023],
    '#t': ['leon'],
    limit: DEFAULT_PERFORMANCE_CONFIG.infiniteScroll.itemsPerPage,
  });

  // Infinite Scroll trigger
  const { ref, inView } = useInView({
    threshold: 0.1,
    rootMargin: '100px',
  });

  // Fetch more articles when scroll trigger is visible
  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten all pages
  const allArticles = React.useMemo(() => {
    return articles?.pages.flat() || [];
  }, [articles]);

  // Filter Leon articles by tags (client-side filtering like RVLife)
  const leonArticles = React.useMemo(() => {
    return allArticles.filter(article => {
      const eventTags = article.tags.filter(([name]) => name === 't').map(([, value]) => value);
      // Prüfe ob der Artikel mindestens ein Leon-Tag hat
      return eventTags.some(tag => LEON_CONFIG.tags.includes(tag));
    });
  }, [allArticles]);

  // Filter articles by search term
  const filteredArticles = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return leonArticles;
    }

    const query = searchTerm.toLowerCase();
    return leonArticles.filter((article: NostrEvent) => {
      const metadata = extractArticleMetadata(article);
      return (
        metadata.title.toLowerCase().includes(query) ||
        metadata.summary.toLowerCase().includes(query) ||
        metadata.content.toLowerCase().includes(query) ||
        metadata.tags.some((tag: string) => tag.toLowerCase().includes(query))
      );
    });
  }, [leonArticles, searchTerm]);

  // Simple SEO Meta Tags
  const pageTitle = `Leon Stories (${filteredArticles.length}) - MojoBus`;
  const pageDescription = `Entdecke ${filteredArticles.length} Geschichten von Leon (Lionhunter) - unser Hund, unser Begleiter beim Vanlife.`;

  // Simple SEO Meta Tags
  useHead({
    title: pageTitle,
    meta: [
      { name: 'description', content: pageDescription },
      { name: 'keywords', content: 'Leon, Lionhunter, Hund, Vanlife, Hundegeschichten, MojoBus' },
      { property: 'og:title', content: pageTitle },
      { property: 'og:description', content: pageDescription },
      { property: 'og:url', content: 'https://mojobus.co/artikel/leon' },
      { property: 'og:type', content: 'website' }
    ],
    link: [
      { rel: 'canonical', href: 'https://mojobus.co/artikel/leon' }
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
                {[1, 2, 3, 4, 5, 6].map((i) => (
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
            <div className="flex justify-center mb-6">
              <Dog className="h-16 w-16 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold">
              <span className="gradient-text">Leon Stories 🦁</span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              {filteredArticles.length > 0
                ? `Abenteuer und Geschichten von Leon (Lionhunter) - unser treuer Begleiter beim Vanlife`
                : 'Keine Stories gefunden'}
            </p>
          </div>
        </div>
      </section>

      <div className="min-h-screen pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex justify-center items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="font-semibold">{filteredArticles.length}</span>
                <span>Stories</span>
              </span>
            </div>
            <div className="flex justify-center items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="font-semibold">{filteredArticles.length}</span>
                <span>Stories</span>
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="relative flex-1 w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Leon Stories durchsuchen..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
          </div>

          {/* Articles Grid */}
          {hasContent ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredArticles.map((article) => (
                  <LeonArticleCard key={article.id} article={article} />
                ))}
              </div>

              {/* Infinite Scroll Loader */}
              {hasNextPage && (
                <div ref={ref} className="py-8 flex justify-center">
                  {isFetchingNextPage && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Lade mehr Stories...</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20">
              <div className="max-w-md mx-auto">
                <Card className="border-dashed">
                  <CardContent className="py-12 px-8 text-center">
                    <div className="space-y-6">
                      <div className="flex justify-center mb-4">
                        <Dog className="h-16 w-16 text-muted-foreground" />
                      </div>
                      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                        Keine Leon Stories gefunden
                      </h2>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        {searchTerm
                          ? `Keine Stories gefunden für "${searchTerm}". Versuche andere Suchbegriffe.`
                          : 'Noch keine Stories von Leon veröffentlicht.'
                        }
                      </p>
                      <div className="space-y-2">
                        <Button onClick={() => window.location.href = '/veroeffentlichen'}>
                          <span className="mr-2">Story</span>
                          schreiben
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const LeonArticleCard = memo(function LeonArticleCard({ article }: { article: NostrEvent }) {
  const metadata = extractArticleMetadata(article);
  const author = useAuthor(article.pubkey);
  const authorName = author.data?.metadata?.name || genUserName(article.pubkey);

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
          <ImagePlaceholder variant="leon" title={metadata.title} />
        )}
        <CardHeader className="flex-1">
          <CardTitle className="line-clamp-2 hover:text-blue-600 transition-colors">
            {metadata.title}
          </CardTitle>
          <CardDescription className="line-clamp-3">
            {metadata.summary}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <User className="h-3 w-3" />
                <span className="truncate max-w-[120px]">{authorName}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-3 w-3" />
                <time>
                  {new Date(metadata.publishedAt * 1000).toLocaleDateString('de-DE', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              </div>
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
});
