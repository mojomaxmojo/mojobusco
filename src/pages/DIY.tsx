import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useInfiniteLongformArticles, extractArticleMetadata } from '@/hooks/useLongformArticles';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { getAuthorRelayConfigByPubkey } from '@/config/relays';
import { Wrench, Loader2 } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import { memo, useState } from 'react';
import { getListThumbnailUrl, getImagePlaceholder, generateSrcset, generateSizes } from '@/lib/imageUtils';
import { DEFAULT_PERFORMANCE_CONFIG } from '@/config/performance';
import { useHead } from '@unhead/react';

export function DIY() {
  // SEO Meta Tags
  useHead({
    title: 'DIY Vanlife Umbau & Solar - MojoBus',
    meta: [
      { name: 'description', content: 'DIY-Anleitungen für den Vanlife-Umbau: Solaranlage, Innenausbau, Reparaturen und Selbstbau-Projekte für Wohnmobil und Camper.' },
      { name: 'keywords', content: 'DIY, Vanlife Umbau, Solaranlage, Wohnmobil Selbstbau, Camper Ausbau, Reparatur, Offgrid' },
      { property: 'og:title', content: 'DIY Vanlife Umbau & Solar - MojoBus' },
      { property: 'og:description', content: 'DIY-Anleitungen für den Vanlife-Umbau: Solaranlage, Innenausbau, Reparaturen und Selbstbau-Projekte.' },
      { property: 'og:url', content: 'https://mojobus.co/artikel/diy' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:title', content: 'DIY Vanlife Umbau & Solar - MojoBus' },
      { name: 'twitter:description', content: 'DIY-Anleitungen für den Vanlife-Umbau: Solaranlage, Innenausbau, Reparaturen und Selbstbau-Projekte.' },
    ],
    link: [
      { rel: 'canonical', href: 'https://mojobus.co/artikel/diy' }
    ]
  });

  const [searchQuery, setSearchQuery] = useState('');
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteLongformArticles({
    '#t': ['diy'],
    limit: DEFAULT_PERFORMANCE_CONFIG.infiniteScroll.itemsPerPage,
  });

  const flattenData = data?.pages.flat() || [];
  const [searchParams] = useSearchParams();

  // Parse Suchparameter aus URL
  useEffect(() => {
    const search = searchParams.get('search');
    if (search) {
      setSearchQuery(search);
    }
  }, [searchParams]);

  // Filtere Suchergebnisse
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) {
      return flattenData;
    }

    const query = searchQuery.toLowerCase();
    return flattenData.filter(article => {
      const metadata = extractArticleMetadata(article);

      // Suchfilter (case-insensitive für Titel, Summary und Content)
      return (
        metadata.title.toLowerCase().includes(query) ||
        metadata.summary.toLowerCase().includes(query) ||
        metadata.content.toLowerCase().includes(query)
      );
    });
  }, [flattenData, searchQuery]);

  const articleCount = filteredArticles.length;

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
              <Wrench className="h-16 w-16 text-orange-600" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold">
              <span className="gradient-text">DIY Anleitungen</span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Vanlife Ausbau, Reparatur und Mods für unseren RV und das Leben am Meer.
            </p>
          </div>
        </div>
      </section>

      <div className="min-h-screen pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex justify-center items-center gap-4 text-sm text-muted-foreground">
              <span className="font-semibold">{filteredArticles.length}</span>
              <span>Anleitungen</span>
              {articleCount > filteredArticles.length && (
                <span className="text-xs text-muted-foreground">
                  (von {articleCount} insgesamt)
                </span>
              )}
            </div>
            <div className="flex justify-center items-center gap-4 text-sm text-muted-foreground">
              <span className="font-semibold">{filteredArticles.length}</span>
              <span>Anleitungen</span>
              {articleCount > filteredArticles.length && (
                <span className="text-xs text-muted-foreground">
                  (von {articleCount} insgesamt)
                </span>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="relative flex-1 w-full md:w-auto">
              <Input
                type="search"
                placeholder="DIY Anleitungen durchsuchen..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
          </div>

          {/* Articles Grid */}
          {isLoading ? (
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
          ) : filteredArticles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map((article) => (
                <DIYArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 px-8 text-center">
                <div className="space-y-6">
                  <div className="text-6xl mb-4">🛠️</div>
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                    Keine DIY Anleitungen gefunden
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {searchQuery
                      ? `Für deine Suche nach "${searchQuery}" wurden keine DIY Anleitungen gefunden.`
                      : 'Noch keine DIY Anleitungen veröffentlicht. Schau bald wieder vorbei!'
                    }
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Hier findest du bald nützliche Anleitungen für:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-400 px-3 py-1 rounded-full text-sm">
                        Solaranlagen
                      </span>
                      <span className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-400 px-3 py-1 rounded-full text-sm">
                        RV-Ausbau
                      </span>
                      <span className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-400 px-3 py-1 rounded-full text-sm">
                        Offgrid-Systeme
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Infinite Scroll Loader */}
          {hasNextPage && (
            <div className="py-8 flex justify-center">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Lade mehr Anleitungen...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const DIYArticleCard = memo(function DIYArticleCard({ article }: { article: NostrEvent }) {
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
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : (
          <ImagePlaceholder variant="diy" title={metadata.title} />
        )}
        <CardHeader className="flex-1">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <CardTitle className="line-clamp-2">{metadata.title}</CardTitle>
              {metadata.summary && (
                <CardDescription className="line-clamp-3">{metadata.summary}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{authorName}</span>
            <span>•</span>
            <time>{new Date(metadata.publishedAt * 1000).toLocaleDateString('de-DE', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}</time>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
});
