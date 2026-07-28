import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useHead } from '@unhead/react';
import { canonicalUrl } from '@/lib/canonicalUrl';
import {
  BarChart3,
  FileText,
  Home,
  Image,
  MessageCircle,
} from 'lucide-react';

type FilterType = 'all' | 'articles' | 'places' | 'images' | 'notes';

interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  title: string;
  type: 'media' | 'note' | 'place' | 'article';
  country: string;
  createdAt: number;
}

/**
 * Temporäre MapPage ohne Leaflet (UI nur)
 */
function MapPageTemp() {
  // Temporäre Daten (werden durch useGpsContent ersetzt)
  const [markers, setMarkers] = useState<MapMarker[]>([
    {
      id: '1',
      lat: 39.3999,
      lon: -8.2245,
      title: 'Lisbon, Portugal',
      type: 'place',
      country: 'Portugal',
      createdAt: Date.now() / 1000,
    },
    {
      id: '2',
      lat: 37.0902,
      lon: -7.8897,
      title: 'Algarve Coast',
      type: 'place',
      country: 'Portugal',
      createdAt: Date.now() / 1000 - 3600 * 24 * 7,
    },
    {
      id: '3',
      lat: 41.1579,
      lon: -8.6291,
      title: 'Porto, Portugal',
      type: 'place',
      country: 'Portugal',
      createdAt: Date.now() / 1000 - 3600 * 24 * 14,
    },
  ]);

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showRoute, setShowRoute] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Filter markers based on active filter
  const filteredMarkers = useMemo(() => {
    if (activeFilter === 'all') return markers;

    switch (activeFilter) {
      case 'articles':
        return markers.filter(m => m.type === 'article');
      case 'places':
        return markers.filter(m => m.type === 'place');
      case 'images':
        return markers.filter(m => m.type === 'media');
      case 'notes':
        return markers.filter(m => m.type === 'note');
      default:
        return markers;
    }
  }, [markers, activeFilter]);

  // Statistics based on filtered markers
  const stats = useMemo(() => {
    const countries = new Set<string>();

    filteredMarkers.forEach(m => {
      if (m.country) countries.add(m.country);
    });

    return {
      countries: countries.size,
      totalDays: 0,
      totalPhotos: filteredMarkers.filter(m => m.type === 'media').length,
      totalArticles: filteredMarkers.filter(m => m.type === 'article').length,
      totalPlaces: filteredMarkers.filter(m => m.type === 'place').length,
      totalNotes: filteredMarkers.filter(m => m.type === 'note').length,
    };
  }, [filteredMarkers]);

  // SEO Meta Tags
  useHead({
    title: 'Reise-Karte - MojoBus',
    meta: [
      { name: 'description', content: 'Interaktive Karte unserer Reiseroute durch Europa.' },
      { property: 'og:title', content: 'Reise-Karte - MojoBus' },
      { property: 'og:description', content: 'Folge unserer Reise auf der interaktiven Karte!' },
      { property: 'og:type', content: 'website' }
    ],
    link: [
      { rel: 'canonical', href: canonicalUrl('/map') }
    ]
  });

  return (
    <div className="min-h-screen">
      {/* Hero Section - 100px height */}
      <section className="relative h-[100px] flex items-center justify-center overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
              <span className="gradient-text">GPS-aktivierte Beiträge auf einer interaktiven Karte</span>
            </h1>
          </div>
        </div>
      </section>

      {/* Stats Section with Filter */}
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            {/* Filter Tabs - Icons with badges and Route Toggle */}
            <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
              <Button
                variant={activeFilter === 'all' ? 'default' : 'outline'}
                size="lg"
                onClick={() => setActiveFilter('all')}
                className="relative p-3"
              >
                <BarChart3 className="h-6 w-6" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {markers.length}
                </Badge>
              </Button>
              <Button
                variant={activeFilter === 'articles' ? 'default' : 'outline'}
                size="lg"
                onClick={() => setActiveFilter('articles')}
                className="relative p-3"
              >
                <FileText className="h-6 w-6" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {stats.totalArticles}
                </Badge>
              </Button>
              <Button
                variant={activeFilter === 'places' ? 'default' : 'outline'}
                size="lg"
                onClick={() => setActiveFilter('places')}
                className="relative p-3"
              >
                <Home className="h-6 w-6" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {stats.totalPlaces}
                </Badge>
              </Button>
              <Button
                variant={activeFilter === 'images' ? 'default' : 'outline'}
                size="lg"
                onClick={() => setActiveFilter('images')}
                className="relative p-3"
              >
                <Image className="h-6 w-6" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {stats.totalPhotos}
                </Badge>
              </Button>
              <Button
                variant={activeFilter === 'notes' ? 'default' : 'outline'}
                size="lg"
                onClick={() => setActiveFilter('notes')}
                className="relative p-3"
              >
                <MessageCircle className="h-6 w-6" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {stats.totalNotes}
                </Badge>
              </Button>

              {/* Separator */}
              <div className="w-px h-8 bg-border mx-2"></div>

              {/* Route Toggle */}
              <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                <Switch
                  id="show-route"
                  checked={showRoute}
                  onCheckedChange={setShowRoute}
                />
                <Label htmlFor="show-route" className="text-sm font-medium cursor-pointer whitespace-nowrap">
                  Route anzeigen
                </Label>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map Placeholder - Full Width */}
      <section className="h-[60vh] w-full bg-muted/20 border-t">
        <div className="h-full w-full flex flex-col items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="bg-primary/10 rounded-full p-6 mx-auto">
              <svg className="w-12 h-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-5.447a1 1 0 01-1.414 0L3 11V4a1 1 0 011-1V7h14a1 1 0 011-1v8a1 1 0 01-1.414 0L12.883 20H9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 0-2.47-1.12-4.57-3.06-4.57-1.64 0-3.08.84-4.3C12.92 2.77 14 1.79 14 0v.2H6a1 1 0 010-1V9a1 1 0 010-1h9c1.03 0 2.1.84 2.3 3.05 1.28 1.28 2.24 2.24 3.08 0 .84-.26-1.21-.25-1.8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold">Karte wird initialisiert...</h2>
            <p className="text-muted-foreground">
              GPS-Beiträge werden geladen und auf der Karte angezeigt.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-muted-foreground">Verfügbare GPS-Beiträge:</span>
                <Badge variant="secondary">{markers.length}</Badge>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-muted-foreground">Länder:</span>
                <Badge variant="secondary">{stats.countries}</Badge>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-muted-foreground">Orte:</span>
                <Badge variant="secondary">{stats.totalPlaces}</Badge>
              </div>
            </div>
            {isLoading && <LoadingSpinner size="sm" text="Lade GPS-Daten..." />}
          </div>
        </div>
      </section>

      {/* Recent Places List */}
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h3 className="text-xl font-semibold mb-4">📍 Letzte GPS-Beiträge</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMarkers.map((marker) => {
                const typeIcons: Record<string, string> = {
                  'media': '📸',
                  'note': '💬',
                  'place': '📍',
                  'article': '📝',
                };

                return (
                  <div key={marker.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 rounded-full p-2">
                        <span className="text-lg">{typeIcons[marker.type]}</span>
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="font-semibold">{marker.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(marker.createdAt * 1000).toLocaleDateString('de-DE')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {marker.lat.toFixed(4)}°, {marker.lon.toFixed(4)}°
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default MapPageTemp;
