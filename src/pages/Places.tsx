import { useState, useMemo, memo, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useInView } from 'react-intersection-observer';
import { MapPin, Search, Calendar, User, Loader2 } from 'lucide-react';
import { usePlaces, extractArticleMetadata } from '@/hooks/useLongformArticles';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { getAuthorRelayConfigByPubkey } from '@/config/relays';
import { getListThumbnailUrl, getImagePlaceholder, generateSrcset, generateSizes } from '@/lib/imageUtils';
import { filterEventsByCountry, countries } from '@/lib/countryDetection';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import { MAIN_MENU } from '@/config/menu';
import { SocialBar } from '@/components/SocialBar';
// @ts-nocheck
// @ts-ignore
import { useHead } from '@unhead/react';

function Places() {
  const { country } = useParams();
  const { data: events, isLoading } = usePlaces();
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(30);

  const { ref, inView } = useInView({ threshold: 0.1, rootMargin: '200px' });

  useEffect(() => {
    if (inView) setVisibleCount(prev => prev + 30);
  }, [inView]);

  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, country]);

  const currentCountry = country ? countries[country as keyof typeof countries] : null;

  // Filter Events nach Country
  const filteredEvents = currentCountry
    ? filterEventsByCountry(events || [], currentCountry)
    : events || [];

  // Filter Events nach Search Query
  const searchedEvents = searchQuery
    ? filteredEvents.filter(event => {
        const metadata = extractArticleMetadata(event);
        const title = metadata.title?.toLowerCase() || '';
        const summary = metadata.summary?.toLowerCase() || '';
        const tags = metadata.tags?.map(t => t.toLowerCase()).join(' ') || '';
        const content = metadata.content?.toLowerCase() || '';
        return (
          title.includes(searchQuery.toLowerCase()) ||
          summary.includes(searchQuery.toLowerCase()) ||
          tags.includes(searchQuery.toLowerCase()) ||
          content.includes(searchQuery.toLowerCase())
        );
      })
    : filteredEvents;

  // Sortiere Events nach Datum (neueste zuerst)
  const sortedEvents = useMemo(() => {
    return [...searchedEvents].sort((a, b) => b.created_at - a.created_at);
  }, [searchedEvents]);

  const visibleEvents = sortedEvents.slice(0, visibleCount);
  const hasMore = visibleEvents.length < sortedEvents.length;

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
              <MapPin className="h-16 w-16 text-primary" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold">
              {currentCountry ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="text-3xl">{currentCountry.flag}</span>
                  <span className="gradient-text">{currentCountry.name}</span>
                </span>
              ) : (
                <span className="gradient-text">Wilde Orte</span>
              )}
            </h1>
            <p className="text-xl text-muted-foreground">
              {currentCountry
                ? `Perfekte Camping- und Stellplätze in ${currentCountry.name}`
                : 'Unser liebste Orte zum Vanlife und Wildcampen'
              }
            </p>
          </div>
        </div>
      </section>

      <div className="min-h-screen pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex-1 w-full">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Orte suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {country && (
                  <Button
                    asChild
                    variant="outline"
                    className="flex-shrink-0"
                  >
                    <Link to="/plaetze">
                      Alle Orte
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {/* Country Selector */}
            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                variant={!country ? 'default' : 'outline'}
                className="flex-shrink-0"
              >
                <Link to="/plaetze">Alle</Link>
              </Button>
              {Object.entries(countries).map(([code, countryData]) => (
                <Button
                  key={code}
                  asChild
                  variant={country === code ? 'default' : 'outline'}
                  className="flex-shrink-0"
                >
                  <Link to={`/plaetze/${code}`}>
                    {countryData.flag} {countryData.name}
                  </Link>
                </Button>
              ))}
            </div>
          </div>

          {/* Places Grid */}
          {isLoading ? (
            <Card className="border-dashed">
              <CardContent className="py-16 px-8 text-center">
                <LoadingSpinner size="lg" text="Lade Orte vom Relay..." />
              </CardContent>
            </Card>
          ) : sortedEvents.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {visibleEvents.map((event) => (
                  <PlaceCard key={event.id} place={event} />
                ))}
              </div>
              {hasMore && (
                <div ref={ref} className="py-8 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <MapPin className="h-12 w-12 text-muted mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery
                    ? `Keine Orte gefunden für "${searchQuery}"`
                    : 'Noch keine Orte veröffentlicht. Schau bald wieder vorbei! 🌊'
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

const PlaceCard = memo(function PlaceCard({ place }: { place: NostrEvent }) {
  const metadata = extractArticleMetadata(place);
  const author = useAuthor(place.pubkey);
  const authorName = author.data?.metadata?.name || genUserName(place.pubkey);

  const authorRelayConfig = getAuthorRelayConfigByPubkey(place.pubkey);
  const relay = authorRelayConfig?.activeRelay || 'wss://relay.mojobus.co';

  // Generate naddr identifier for place
  const naddr = nip19.naddrEncode({
    kind: place.kind,
    pubkey: place.pubkey,
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
          <ImagePlaceholder variant="place" title={metadata.title} />
        )}

        <CardHeader className="flex-1">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <CardTitle className="line-clamp-2">{metadata.title}</CardTitle>
              {metadata.summary && (
                <CardDescription className="line-clamp-3">{metadata.summary}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{authorName}</span>
              <span>•</span>
              <time>{new Date(place.created_at * 1000).toLocaleDateString('de-DE')}</time>
            </div>

            {metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {metadata.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>

        <SocialBar event={place} compact />
      </Link>
    </Card>
  );
});

export default Places;
