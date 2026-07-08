import { SEOHead } from '@/components/SEOHead';
import { websiteJsonLd } from '@/lib/jsonld';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useLongformArticles, usePlaces, extractArticleMetadata } from '@/hooks/useLongformArticles';
import { useNotes } from '@/hooks/useNotes';
import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NOSTR_CONFIG } from '@/config/nostr';
import { Compass, Sun, Anchor, RefreshCw } from 'lucide-react';
import { lazy, Suspense } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useTrips, type Trip } from '@/hooks/useTrips';
import { getGalleryThumbnailUrl } from '@/lib/imageUtils';
import { useHead } from '@unhead/react';
import { DEFAULT_PERFORMANCE_CONFIG } from '@/config/performance';
import { useToast } from '@/hooks/useToast';
import type { ContentItem } from '@/components/ContentCard';

const ContentCard = lazy(() => import('@/components/ContentCard').then(m => ({ default: m.ContentCard })));

/** Simple Bild-URL-Extraktion (lokal, kein schwerer Import nötig) */
function extractFirstImageUrl(content: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|avi|mkv))/gi;
  const matches = content.match(urlRegex);
  return matches && matches.length > 0 ? matches[0] : null;
}

function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('.mp4') ||
         lower.includes('.webm') ||
         lower.includes('.mov') ||
         lower.includes('.avi') ||
         lower.includes('.mkv');
}

export function Home() {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // SEO Meta Tags
  <SEOHead
    title="Startseite"
    description="Vanlife, Reisen und Abenteuer mit dem MojoBus. Perpetual Travelers – Geschichten, Orte und Tipps von unterwegs."
    url="https://mojobus.co/"
    type="website"
    jsonLd={websiteJsonLd()}
  />
  useHead({
    title: 'MojoBus - Perpetual Travelers Blog',
    meta: [
      { name: 'description', content: 'Perpetual Travelers Blog. Unser Leben am Meer, vanlife, offgrid und Reisen. Geschichten, Tipps und Einblicke vom Strand.' },
      { name: 'keywords', content: 'Vanlife, Reisen, Portugal, Spanien, Frankreich, Offgrid, Solar, RV' },
      { property: 'og:title', content: 'MojoBus - Perpetual Travelers Blog' },
      { property: 'og:description', content: 'Perpetual Travelers Blog. Unser Leben am Meer, vanlife, offgrid und Reisen.' },
      { property: 'og:type', content: 'website' }
    ],
      link: [
        { rel: 'canonical', href: 'https://mojobus.co' }
      ]
  });

  // PERFORMANCE-OPTIMIERUNG: Home-Spezifische Limits
  // Wir zeigen nur 6 Elemente auf der Home-Seite, laden aber:
  // VORHER: 230 Events (50 Artikel + 60 Plätze + 20 Notes + 100 Bilder) ❌
  // NACHHER: ~60 Events (15 Artikel + 15 Plätze + 15 Notes + 15 Bilder) ✅
  // Das spart ~74% Bandbreite und Ladezeit!
  // Die dedizierten Seiten (/artikel, /plaetze) nutzen ihre eigenen Limits.

  // Refresh-Funktion: Invalidiere und hole alle Daten neu
  const handleRefresh = async () => {
    try {
      toast({
        title: 'Aktualisiere Inhalte...',
        description: 'Lade frische Daten von Nostr',
      });

      // Invalidiere alle relevanten Queries
      await queryClient.invalidateQueries({
        queryKey: ['longform-articles'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['places'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['home-notes'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['home-media'],
      });

      toast({
        title: '✅ Inhalte aktualisiert',
        description: 'Frühe Inhalte werden angezeigt',
      });
    } catch (error) {
      toast({
        title: '❌ Aktualisierung fehlgeschlagen',
        description: 'Bitte versuche es erneut',
        variant: 'destructive',
      });
    }
  };

  const { data: articles, isLoading: articlesLoading } = useLongformArticles({
    kinds: [30023],
    limit: 15, // Optimiert für Home-Seite (nur 6 Elemente werden angezeigt)
  });

  const { data: places, isLoading: placesLoading } = usePlaces({
    limit: 15, // Optimiert für Home-Seite (nur 6 Elemente werden angezeigt)
  });

  const { data: noteEvents = [] } = useQuery({
    queryKey: ['home-notes', NOSTR_CONFIG.authorPubkeys],
    queryFn: async ({ signal }) => {
      const events = await nostr.query([
        {
          kinds: [NOSTR_CONFIG.kinds.note],
          authors: NOSTR_CONFIG.authorPubkeys,
          '#t': ['note', 'notiz'],
          limit: 15, // Optimiert für Home-Seite (nur 6 Elemente werden angezeigt)
        }
      ], { signal: AbortSignal.any([signal!, AbortSignal.timeout(DEFAULT_PERFORMANCE_CONFIG.relay.queryTimeout)]) });
      return events;
    },
    staleTime: DEFAULT_PERFORMANCE_CONFIG.cache.staleTime,
  });

  const tripsQuery = useTrips();
  const { data: tripsData = [] } = tripsQuery;
  const { data: imageEvents = [] } = useQuery({
    queryKey: ['home-media', NOSTR_CONFIG.authorPubkeys],
    queryFn: async ({ signal }) => {
      const events = await nostr.query([
        {
          kinds: [1, 30023], // Text notes und longform articles
          authors: NOSTR_CONFIG.authorPubkeys,
          '#t': ['medien', 'media', 'bilder', 'images'],
          limit: 15, // Optimiert für Home-Seite (nur 6 Elemente werden angezeigt)
        }
      ], { signal: AbortSignal.any([signal!, AbortSignal.timeout(DEFAULT_PERFORMANCE_CONFIG.relay.queryTimeout)]) }); // Aus Performance-Konfiguration

      console.log('[Home Page] Image Events Query:', {
        total: events.length,
        limit: 15,
        timeout: DEFAULT_PERFORMANCE_CONFIG.relay.queryTimeout,
        optimization: 'Home-Spezifisches Limit (vorher 100 Events)',
      });

      return events.filter((event) => {
        const content = event.content.toLowerCase();
        return content.includes('.jpg') ||
               content.includes('.jpeg') ||
               content.includes('.png') ||
               content.includes('.gif') ||
               content.includes('.webp') ||
               content.includes('.mp4') ||
               content.includes('.webm') ||
               content.includes('.mov') ||
               content.includes('imgur.com') ||
               content.includes('i.imgur.com') ||
               content.includes('cdn.blossom') ||
               content.includes('nostr.build') ||
               content.includes('relay.mojobus.co') ||
               content.includes('relays.mojobus.co') ||
               content.includes('blossom.primal.net');
      });
    },
    staleTime: DEFAULT_PERFORMANCE_CONFIG.cache.staleTime,
  });

  const isLoading = articlesLoading || placesLoading || tripsQuery.isLoading;

  const contentItems: ContentItem[] = [];

  if (articles && Array.isArray(articles)) {
    articles.forEach((event) => {
      const metadata = extractArticleMetadata(event);
      contentItems.push({
        type: 'article',
        event,
        date: event.created_at,
        thumbnailUrl: metadata.image ? getGalleryThumbnailUrl(metadata.image) : undefined
      });
    });
  }

  if (places && Array.isArray(places)) {
    places.forEach((event) => {
      const metadata = extractArticleMetadata(event);
      contentItems.push({
        type: 'place',
        event,
        date: event.created_at,
        thumbnailUrl: metadata.image ? getGalleryThumbnailUrl(metadata.image) : undefined
      });
    });
  }

  if (noteEvents && Array.isArray(noteEvents)) {
    noteEvents.forEach((event) => {
      const imageUrl = extractFirstImageUrl(event.content);
      contentItems.push({
        type: 'note',
        event,
        date: event.created_at,
        thumbnailUrl: imageUrl ? (isVideoUrl(imageUrl) ? imageUrl : getGalleryThumbnailUrl(imageUrl)) : undefined
      });
    });
  }

  if (tripsData && Array.isArray(tripsData)) {
    tripsData.forEach((trip: Trip) => {
      contentItems.push({
        type: 'trip' as const,
        event: trip.event,
        date: trip.createdAt,
        thumbnailUrl: trip.image ? getGalleryThumbnailUrl(trip.image) : undefined,
        parsedData: trip
      });
    });
  }

  if (imageEvents && Array.isArray(imageEvents)) {
    imageEvents.forEach((event) => {
      const imageUrl = extractFirstImageUrl(event.content);
      contentItems.push({
        type: 'image',
        event,
        date: event.created_at,
        thumbnailUrl: imageUrl ? (isVideoUrl(imageUrl) ? imageUrl : getGalleryThumbnailUrl(imageUrl)) : undefined
      });
    });
  }

  const recentItems = contentItems
    .sort((a, b) => b.date - a.date)
    .slice(0, 6);

  return (
    <div className="min-h-screen">
      {/* Hero Section with Modern Design */}
      <section className="relative min-h-[auto] py-6 flex items-center justify-center overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center space-y-5">
            <div className="space-y-4">
              <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-tight">
                <span className="gradient-text">Perpetual Travelers</span>
              </h1>
              <h2 className="text-3xl md:text-5xl font-serif text-muted-foreground leading-relaxed">
                Unser Leben am Meer
              </h2>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Geschichten, Tipps und Einblicke in unser Leben zwischen Sand und Horizont
              </p>
            </div>

            <div className="pt-6 flex flex-wrap justify-center gap-5">
              <Button
                asChild
                size="lg"
                className="gap-3 shadow-lg text-base px-8 py-6 rounded-xl"
              >
                <Link to="/artikel">
                  <Compass className="h-6 w-6" />
                  Entdecke unsere Geschichten
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleRefresh}
                className="gap-3 hover:bg-primary/10 hover:border-primary transition-all duration-300 text-base px-8 py-6 rounded-xl"
                title="Inhalte aktualisieren"
              >
                <RefreshCw className="h-6 w-6" />
                Aktualisieren
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Content Section with Modern Design */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto min-h-[500px]">
            {/* Loading: Skeleton-Grid mit exakten Card-Dimensionen für CLS-Freiheit */}

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
                    <Card className="overflow-hidden border-2 border-primary/20 rounded-2xl flex flex-col">
                      {/* Image skeleton: exact aspect ratio wie ContentCard */}
                      <div className="aspect-[4/3] bg-muted animate-pulse" />
                      {/* CardHeader skeleton: title + summary */}
                      <div className="space-y-4 pt-6 px-6">
                        <div className="h-6 bg-muted animate-pulse rounded-md w-3/4" />
                        <div className="space-y-2">
                          <div className="h-4 bg-muted animate-pulse rounded-md w-full" />
                          <div className="h-4 bg-muted animate-pulse rounded-md w-5/6" />
                        </div>
                      </div>
                      {/* CardContent skeleton: author + date */}
                      <div className="flex-1 pb-6 px-6 pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-24 bg-muted animate-pulse rounded-md" />
                            <span className="text-muted-foreground/50">•</span>
                            <div className="h-4 w-20 bg-muted animate-pulse rounded-md" />
                          </div>
                        </div>
                      </div>
                      {/* SocialBar skeleton */}
                      <div className="px-6 pb-6 pt-0">
                        <div className="h-8 bg-muted animate-pulse rounded-lg w-full" />
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            ) : recentItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {recentItems.map((item, index) => (
                  <div key={item.event.id} className="fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>
                    <Suspense fallback={<Card className="border-2 border-primary/20 rounded-2xl"><CardContent className="py-16 text-center"><LoadingSpinner size="sm" text="" /></CardContent></Card>}>
                      <ContentCard item={item} />
                    </Suspense>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-2 border-primary/30">
                <CardContent className="py-20 text-center">
                  <p className="text-muted-foreground text-lg">
                    Noch keine Inhalte veröffentlicht. Schau bald wieder vorbei! 🌊
                  </p>
                </CardContent>
              </Card>
            )}

            {!isLoading && recentItems.length > 0 && (
              <div className="text-center mt-16 fade-in-up">
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="hover:bg-primary hover:text-primary-foreground transition-all duration-300 px-10 py-7 rounded-xl shadow-md hover:shadow-xl"
                >
                  <Link to="/artikel">Alle Inhalte anzeigen</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feature Cards Section with Modern Design */}
      <section className="py-24 md:py-32 bg-gradient-to-b from-background via-primary/5 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="group border-2 border-primary/20 hover:border-primary transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl bg-gradient-to-br from-background to-primary/5 fade-in-up">
                <CardHeader className="space-y-6 pt-8">
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/15 rounded-full blur-2xl group-hover:bg-primary/25 transition-all duration-500 scale-110" />
                      <Sun className="h-20 w-20 text-primary relative z-10 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                  </div>
                  <CardTitle className="text-center text-2xl font-bold group-hover:text-primary transition-colors">Freiheit</CardTitle>
                </CardHeader>
                <CardContent className="pb-8">
                  <p className="text-center text-muted-foreground text-lg leading-relaxed">
                    Das Rauschen der Wellen ist unser Wecker, Sonnenuntergänge sind unser Alltag.
                  </p>
                </CardContent>
              </Card>

              <Card className="group border-2 border-primary/20 hover:border-primary transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl bg-gradient-to-br from-background to-primary/5 fade-in-up delay-100">
                <CardHeader className="space-y-6 pt-8">
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/15 rounded-full blur-2xl group-hover:bg-primary/25 transition-all duration-500 scale-110" />
                      <Compass className="h-20 w-20 text-primary relative z-10 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                  </div>
                  <CardTitle className="text-center text-2xl font-bold group-hover:text-primary transition-colors">Abenteuer</CardTitle>
                </CardHeader>
                <CardContent className="pb-8">
                  <p className="text-center text-muted-foreground text-lg leading-relaxed">
                    Jeder Tag bringt neue Orte, neue Begegnungen und das Gefühl, wirklich frei zu sein.
                  </p>
                </CardContent>
              </Card>

              <Card className="group border-2 border-primary/20 hover:border-primary transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl bg-gradient-to-br from-background to-primary/5 fade-in-up delay-200">
                <CardHeader className="space-y-6 pt-8">
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/15 rounded-full blur-2xl group-hover:bg-primary/25 transition-all duration-500 scale-110" />
                      <Anchor className="h-20 w-20 text-primary relative z-10 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                  </div>
                  <CardTitle className="text-center text-2xl font-bold group-hover:text-primary transition-colors">Einfachheit</CardTitle>
                </CardHeader>
                <CardContent className="pb-8">
                  <p className="text-center text-muted-foreground text-lg leading-relaxed">
                    Minimalistisch unterwegs mit Solarstrom – autark und unabhängig.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-10 fade-in-up">
            <div className="space-y-6">
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
                <span className="gradient-text">Vielleicht ruft es auch dich</span>
              </h2>
              <p className="text-2xl md:text-3xl text-muted-foreground font-serif leading-relaxed">
                Nach Abenteuer, Einfachheit und Freiheit. 🌊🚐✨
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
                Auf Nostr teilen wir unsere Reise – dezentral, zensurresistent und direkt.
              </p>
            </div>
            <div className="pt-4">
              <Button
                asChild
                size="lg"
                variant="outline"
                className="hover:bg-primary hover:text-primary-foreground transition-all duration-300 shadow-lg hover:shadow-2xl px-10 py-7 rounded-xl text-lg"
              >
                <Link to="/about">Mehr über uns erfahren</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
