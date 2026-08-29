import { websiteJsonLd } from '@/lib/jsonld';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardSkeleton } from '@/components/CardSkeleton';
import { usePreloadedArticles, usePlaces, extractArticleMetadata } from '@/hooks/useLongformArticles';
import { useHomeNotes } from '@/hooks/useHomeNotes';
import { useHomeMedia } from '@/hooks/useHomeMedia';
import { useQueryClient } from '@tanstack/react-query';
import { Compass, Sun, Anchor, RefreshCw } from 'lucide-react';
import { lazy, Suspense, useMemo } from 'react';
import { useTrips, type Trip } from '@/hooks/useTrips';
import { getGalleryThumbnailUrl } from '@/lib/imageUtils';
import { useHead } from '@unhead/react';
import { canonicalUrl, ogImageUrl } from '@/lib/canonicalUrl';
import { useToast } from '@/hooks/useToast';
import { FIRST_PAINT_CONFIG } from '@/config/performance';
import type { ContentItem } from '@/components/ContentCard';
import { useLanguage } from '@/hooks/useLanguage';
import { translateHome } from '@/config/i18n/home';
import { getEventLanguage } from '@/lib/translationTags';
import { SocialBatchProvider } from '@/hooks/useBatchedSocialCounts';

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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang, localizePath } = useLanguage();
  const th = (key: string) => translateHome(lang, key);

  // SEO Meta Tags – EINE Quelle der Wahrheit via useHead (@unhead).
  // (Vorher stand hier ein toter <SEOHead />-Ausdruck, der nie gemountet
  // wurde – seine Tags kamen nie an. Die fehlenden OG-/Twitter-/JSON-LD-
  // Teile sind jetzt hier integriert, inkl. SearchAction aus websiteJsonLd.)
  useHead({
    title: th('seo_title'),
    meta: [
      { name: 'description', content: th('seo_description') },
      { name: 'keywords', content: th('seo_keywords') },
      { property: 'og:title', content: th('seo_title') },
      { property: 'og:description', content: th('seo_og_description') },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: canonicalUrl(localizePath('/')) },
      { property: 'og:image', content: ogImageUrl() },
      { property: 'og:site_name', content: 'MojoBus – Perpetual Travelers' },
      { property: 'og:locale', content: lang === 'de' ? 'de_DE' : 'en_US' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: th('seo_title') },
      { name: 'twitter:description', content: th('seo_og_description') },
      { name: 'twitter:image', content: ogImageUrl() },
    ],
    link: [
      { rel: 'canonical', href: canonicalUrl(localizePath('/')) }
    ],
    script: [
      {
        type: 'application/ld+json',
        // WebSite + SearchAction (Sitelinks-Searchbox-Signal für Google)
        innerHTML: JSON.stringify(websiteJsonLd()),
      },
    ],
  });

  // PERFORMANCE-OPTIMIERUNG: First-Paint-Strategie für Erstbesucher ohne Cache
  // - Artikel/Plätze/Notes/Bilder kommen primär aus JSON-Dumps (/data/*.json, ~100 ms)
  // - Fehlt ein Dump, greift ein 2s-Fast-Fallback (statt bisher 6–10s); der Rest
  //   lädt progressiv im Hintergrund nach (siehe usePreloadedData)
  // - Trips blockieren den First Paint nicht (zweistufiger Hook, siehe useTrips)
  // - Gerendert werden nur 3 Cards (FIRST_PAINT_CONFIG.homeCardCount) – dafür
  //   reichen die ersten Relay-Events, da Relays neueste zuerst liefern
  // Die dedizierten Seiten (/artikel, /plaetze) nutzen ihre eigenen Hooks/Limits.

  // Refresh-Funktion: Invalidiere und hole alle Daten neu
  const handleRefresh = async () => {
    try {
      toast({
        title: th('toast_refreshing_title'),
        description: th('toast_refreshing_desc'),
      });

      // Invalidiere alle relevanten Queries
      await queryClient.invalidateQueries({
        queryKey: ['preloaded', 'articles'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['preloaded', 'places'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['preloaded', 'notes'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['preloaded', 'bilder'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['trips'],
      });

      toast({
        title: th('toast_success_title'),
        description: th('toast_success_desc'),
      });
    } catch (error) {
      toast({
        title: th('toast_error_title'),
        description: th('toast_error_desc'),
        variant: 'destructive',
      });
    }
  };

  // Hybrid-Hook: /data/articles.json sofort, Relay nur für neue Events (siehe usePreloadedData)
  const { data: articles, isLoading: articlesLoading } = usePreloadedArticles();

  const { data: places, isLoading: placesLoading } = usePlaces();

  const { data: noteEvents = [], isLoading: notesLoading } = useHomeNotes();

  const tripsQuery = useTrips();
  const { data: tripsData = [] } = tripsQuery;
  const { data: imageEvents = [], isLoading: mediaLoading } = useHomeMedia();

  // First-Paint: Trips blockieren den Render bewusst NICHT – sie laufen
  // zweistufig im Hintergrund nach und werden beim Eintreffen einsortiert.
  const isLoading = articlesLoading || placesLoading || notesLoading || mediaLoading;

  // Memoized: Aufbau + Sortierung lief bisher bei JEDEM Render erneut
  // (5 Datenquellen resolven zeitversetzt → ~5–6 Vollberechnungen mit
  // extractArticleMetadata/Regex/Sortierung mitten im First-Paint-Fenster).
  // Jetzt nur noch neu berechnen, wenn sich eine Datenquelle ändert.
  const recentItems = useMemo(() => {
    const contentItems: ContentItem[] = [];

    if (articles && Array.isArray(articles)) {
      articles.forEach((event) => {
        if (getEventLanguage(event) !== lang) return;
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
        if (getEventLanguage(event) !== lang) return;
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
        if (getEventLanguage(event) !== lang) return;
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
        if (getEventLanguage(trip.event) !== lang) return;
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
        if (getEventLanguage(event) !== lang) return;
        const imageUrl = extractFirstImageUrl(event.content);
        contentItems.push({
          type: 'image',
          event,
          date: event.created_at,
          thumbnailUrl: imageUrl ? (isVideoUrl(imageUrl) ? imageUrl : getGalleryThumbnailUrl(imageUrl)) : undefined
        });
      });
    }

    return contentItems
      .sort((a, b) => b.date - a.date)
      .slice(0, FIRST_PAINT_CONFIG.homeCardCount);
  }, [articles, places, noteEvents, tripsData, imageEvents, lang]);

  // Events für den Social-Count-Batch (eine Relay-Query für alle Cards
  // statt 4 Queries pro Card – siehe useBatchedSocialCounts)
  const recentEvents = useMemo(
    () => recentItems.map((item) => item.event),
    [recentItems],
  );

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
                {th('hero_subtitle')}
              </h2>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                {th('hero_tagline')}
              </p>
            </div>

            <div className="pt-6 flex flex-wrap justify-center gap-5">
              <Button
                asChild
                size="lg"
                className="gap-3 shadow-lg text-base px-8 py-6 rounded-xl"
              >
                <Link to={localizePath('/artikel')}>
                  <Compass className="h-6 w-6" />
                  {th('cta_discover')}
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleRefresh}
                className="gap-3 hover:bg-primary/10 hover:border-primary transition-all duration-300 text-base px-8 py-6 rounded-xl"
                title={th('refresh_tooltip')}
              >
                <RefreshCw className="h-6 w-6" />
                {th('refresh_button')}
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
                {Array.from({ length: FIRST_PAINT_CONFIG.homeCardCount }, (_, i) => i + 1).map(i => (
                  <div key={i} className="fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
                    <CardSkeleton />
                  </div>
                ))}
              </div>
            ) : recentItems.length > 0 ? (
              <SocialBatchProvider events={recentEvents}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {recentItems.map((item, index) => (
                    <div key={item.event.id} className="fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>
                      <Suspense fallback={<CardSkeleton />}>
                        <ContentCard item={item} />
                      </Suspense>
                    </div>
                  ))}
                </div>
              </SocialBatchProvider>
            ) : (
              <Card className="border-dashed border-2 border-primary/30">
                <CardContent className="py-20 text-center">
                  <p className="text-muted-foreground text-lg">
                    {th('empty_state')}
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
                  <Link to={localizePath('/artikel')}>{th('view_all')}</Link>
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
                  <CardTitle className="text-center text-2xl font-bold group-hover:text-primary transition-colors">{th('pillar_freedom_title')}</CardTitle>
                </CardHeader>
                <CardContent className="pb-8">
                  <p className="text-center text-muted-foreground text-lg leading-relaxed">
                    {th('pillar_freedom_text')}
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
                  <CardTitle className="text-center text-2xl font-bold group-hover:text-primary transition-colors">{th('pillar_adventure_title')}</CardTitle>
                </CardHeader>
                <CardContent className="pb-8">
                  <p className="text-center text-muted-foreground text-lg leading-relaxed">
                    {th('pillar_adventure_text')}
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
                  <CardTitle className="text-center text-2xl font-bold group-hover:text-primary transition-colors">{th('pillar_simplicity_title')}</CardTitle>
                </CardHeader>
                <CardContent className="pb-8">
                  <p className="text-center text-muted-foreground text-lg leading-relaxed">
                    {th('pillar_simplicity_text')}
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
                <span className="gradient-text">{th('cta2_heading')}</span>
              </h2>
              <p className="text-2xl md:text-3xl text-muted-foreground font-serif leading-relaxed">
                {th('cta2_tagline')}
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
                {th('cta2_text')}
              </p>
            </div>
            <div className="pt-4">
              <Button
                asChild
                size="lg"
                variant="outline"
                className="hover:bg-primary hover:text-primary-foreground transition-all duration-300 shadow-lg hover:shadow-2xl px-10 py-7 rounded-xl text-lg"
              >
                <Link to={localizePath('/about')}>{th('cta2_link')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
