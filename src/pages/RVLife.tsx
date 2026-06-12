import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useLongformArticles, extractArticleMetadata } from '@/hooks/useLongformArticles';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { getAuthorRelayConfigByPubkey } from '@/config/relays';
import { DEFAULT_PERFORMANCE_CONFIG } from '@/config/performance';
import { Search, Calendar, User, Home, ChefHat, Compass, Truck, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { RV_LIFE_CONFIG } from '@/config/rvlife';
import { getListThumbnailUrl, getImagePlaceholder, generateSrcset, generateSizes } from '@/lib/imageUtils';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import { memo, useState } from 'react';
import { useHead } from '@unhead/react';

export function RVLife() {
  // SEO Meta Tags
  useHead({
    title: 'RV Life & Wohnmobil Reisen - MojoBus',
    meta: [
      { name: 'description', content: 'RV Life, Wohnmobil Reisen und Camper Abenteuer. Tipps, Geschichten und Inspiration fürs Leben auf Rädern – von Portugal bis Europa.' },
      { name: 'keywords', content: 'RV Life, Wohnmobil, Camper, Vanlife, Reisen, Camping, Roadtrip, Europa, Portugal, Spanien' },
      { property: 'og:title', content: 'RV Life & Wohnmobil Reisen - MojoBus' },
      { property: 'og:description', content: 'RV Life, Wohnmobil Reisen und Camper Abenteuer. Tipps, Geschichten und Inspiration fürs Leben auf Rädern.' },
      { property: 'og:url', content: 'https://mojobus.co/artikel/rvlife' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:title', content: 'RV Life & Wohnmobil Reisen - MojoBus' },
      { name: 'twitter:description', content: 'RV Life, Wohnmobil Reisen und Camper Abenteuer. Tipps, Geschichten und Inspiration fürs Leben auf Rädern.' },
    ],
    link: [
      { rel: 'canonical', href: 'https://mojobus.co/artikel/rvlife' }
    ]
  });

  const { category } = useParams<{ category: string }>();
  const [searchTerm, setSearchTerm] = useState('');

  // Alle RV Life Artikel mit relevanten Tags abrufen
  const { data: articles, isLoading, error } = useLongformArticles({
    kinds: [30023],
    limit: 50
  });

  // Automatische RV Life Tags
  const autoTags = RV_LIFE_CONFIG.autoTags;

  // Filtere Artikel, die RV Life Kategorien haben
  const displayArticles = articles?.filter(article => {
    const metadata = extractArticleMetadata(article);

    // Extrahiere Tags aus Nostr-Event für bessere Filterung
    const eventTags = article.tags.filter(([name]) => name === 't').map(([, value]) => value);

    // Prüfe ob der Artikel mindestens ein RV Life Auto-Tag hat
    const hasRVLifeTag = eventTags.some(tag => autoTags.includes(tag));

    if (!hasRVLifeTag) return false;

    // Wenn Kategorie spezifiziert, filtere danach
    if (category) {
      // Prüfe Kategorie-Key und zugehörige Tags
      const categoryConfig = Object.values(RV_LIFE_CONFIG.categories).find(cat => cat.id === category.toLowerCase());
      if (categoryConfig) {
        const categoryTags = [...categoryConfig.tags.primary, ...categoryConfig.tags.optional];
        return eventTags.some(tag => categoryTags.includes(tag));
      }
      return eventTags.includes(category);
    }

    // Zeige alle Artikel mit RV Life Tags
    return true;
  }) || [];

  const isDemoMode = !displayArticles || displayArticles.length === 0;

  const currentCategory = category
    ? Object.values(RV_LIFE_CONFIG.categories).find(cat => cat.id === category.toLowerCase())
    : null;

  // Icon mapping for RV Life categories
  const getRVLifeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Cooking': return ChefHat;
      case 'Home': return Home;
      case 'Compass': return Compass;
      case 'Sparkles': return Sparkles;
      default: return Truck;
    }
  };

  // Artikel filtern basierend auf Suchbegriff
  const filteredArticles = displayArticles?.filter(article => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    const metadata = extractArticleMetadata(article);

    return (
      metadata.title.toLowerCase().includes(searchLower) ||
      metadata.summary.toLowerCase().includes(searchLower) ||
      metadata.content.toLowerCase().includes(searchLower) ||
      metadata.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }) || [];

  if (category && !currentCategory) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Kategorie nicht gefunden
          </h1>
          <Link to="/artikel/rvlife">
            <Button variant="outline">
              Zurück zur RV Life Übersicht
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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
              <div className="p-4 bg-orange-100 dark:bg-orange-900 rounded-full">
                <Truck className="h-12 w-12 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold">
              <span className="gradient-text">
                {currentCategory ? currentCategory.name : '🚐 RV Life'}
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              {currentCategory
                ? currentCategory.description
                : 'Leben im Wohnmobil - Küche & Essen, Ausstattung, Freeliving'
              }
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-8">
        {/* Back Link */}
        <div className="mb-4">
          <Link to="/artikel" className="text-ocean-600 hover:text-ocean-700 dark:text-ocean-400 dark:hover:text-ocean-300 text-sm">
            ← Zurück zu Artikel
          </Link>
        </div>

        {/* Kategorienübersicht (nur auf Hauptseite) */}
        {!category && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Kategorien</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(RV_LIFE_CONFIG.categories).map((cat) => {
                const Icon = getRVLifeIcon(cat.icon);
                return (
                  <Link key={cat.id} to={cat.path}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${cat.color.bg} ${cat.color.light}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                              {cat.name}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {cat.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
            <Separator className="my-8" />
          </div>
        )}

        {/* Suche */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="RV Life Artikel durchsuchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Artikel Liste */}
        <div className="space-y-6">
          {isLoading && (
            <Card className="border-dashed">
              <CardContent className="py-16 px-8 text-center">
                <LoadingSpinner size="lg" text="Lade RV Life Artikel vom Relay..." />
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-dashed">
              <CardContent className="py-12 px-8 text-center">
                <div className="max-w-sm mx-auto space-y-6">
                  <div className="text-6xl mb-4">⚠️</div>
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                    Fehler beim Laden
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Die Verbindung zum Relay konnte nicht hergestellt werden oder ein Fehler ist aufgetreten.
                  </p>
                  <Link to="/artikel/rvlife">
                    <Button>
                      Erneut versuchen
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {isDemoMode && !isLoading && !error && (
            <Card className="border-dashed border-orange-200 dark:border-orange-900">
              <CardContent className="py-8 px-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-2xl">🎭</div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      Demo-Modus
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Zeige alle Artikel - keine RV Life Kategorien gefunden
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Articles Grid */}
          {filteredArticles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map((article) => (
                <RVLifeArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const RVLifeArticleCard = memo(function RVLifeArticleCard({ article }: { article: NostrEvent }) {
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

  // Optimized thumbnail URL via images.weserv.nl
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
          <ImagePlaceholder variant="rvlife" title={metadata.title} />
        )}
        <CardHeader className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs">
              🚐 RV Life
            </Badge>
            {metadata.tags.slice(0, 2).map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
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
