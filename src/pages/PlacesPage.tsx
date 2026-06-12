import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { useHead } from '@unhead/react';

const PlacesPage = () => {
  const { nostr } = useNostr();

  const { data: events, isLoading } = useQuery({
    queryKey: ['places'],
    queryFn: async () => {
      try {
        // Query both events with #place tag and type=place tag for maximum compatibility
        const filters = [
          { kinds: [30023], '#t': ['place'], limit: 100 }
        ];
        const results = await nostr.query(filters);
        console.log('[PlacesPage] Queried events:', results?.length);
        console.log('[PlacesPage] Filter:', filters);

        // Filter events by checking for either #place tag or type=place tag
        const filteredResults = (results || []).filter((event: any) => {
          const hasPlaceTag = event.tags?.some((tag: any) => tag[0] === 't' && tag[1] === 'place');
          const hasTypeTag = event.tags?.some((tag: any) => tag[0] === 'type' && tag[1] === 'place');
          return hasPlaceTag || hasTypeTag;
        });

        console.log('[PlacesPage] Filtered events:', filteredResults.length);

        return filteredResults;
      } catch (error) {
        console.error('[PlacesPage] Error querying places:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const places = useMemo(() => {
    if (!events || !Array.isArray(events)) return [];

    console.log('[PlacesPage] Processing events:', events.length);

    return events.map((event: any) => {
      const titleTag = event.tags.find((tag: any) => tag[0] === 'title');
      const imageTag = event.tags.find((tag: any) => tag[0] === 'image');
      const locationTag = event.tags.find((tag: any) => tag[0] === 'location');
      const typeTag = event.tags.find((tag: any) => tag[0] === 'type');

      const place = {
        id: event.id,
        title: titleTag?.[1] || 'Unbenannt',
        image: imageTag?.[1] || '',
        location: locationTag?.[1] || '',
        created_at: event.created_at,
        author: event.pubkey,
        type: typeTag?.[1]
      };

      console.log('[PlacesPage] Processed place:', place);

      return place;
    });
  }, [events]);

  useHead({
    title: 'Plätze - MojoBus Perpetual Travelers Blog',
    meta: [
      { name: 'description', content: 'Alle Plätze sortiert nach Erstellungsdatum.' },
      { name: 'keywords', content: 'orte' },
      { property: 'og:title', content: 'Plätze - MojoBus' },
{ property: 'og:url', content: 'https://mojobus.co/plaetze' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:title', content: pageTitle },
      { name: 'twitter:description', content: pageDescription },
    ],
    link: [{ rel: 'canonical', href: 'https://mojobus.co/plaetze' }]
  });

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
            <h1 className="text-4xl md:text-6xl font-bold"><span className="gradient-text">Plätze</span></h1>
            <p className="text-xl text-muted-foreground">Unsere Lieblingsplätze</p>
          </div>
        </div>
      </section>

      <div className="min-h-screen pb-12">
        <div className="container mx-auto px-4">

        {isLoading && (
          <div className="text-center py-20">
            <div className="text-2xl">Lade Plätze...</div>
          </div>
        )}

        {!isLoading && places.length === 0 && (
          <div className="text-center py-20">
            <div className="text-2xl">Noch keine Plätze vorhanden</div>
            <p>
              <Link to="/veroeffentlichen?tab=place">Ersten Ort erstellen</Link>
            </p>
          </div>
        )}

        {!isLoading && places.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {places.map((place) => (
              <div key={place.id} className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
                {place.image && (
                  <img
                    src={place.image}
                    alt={place.title}
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                )}
                <h3 className="font-bold text-xl mb-2">{place.title}</h3>
                {place.location && (
                  <p className="text-gray-600 mb-2">📍 {place.location}</p>
                )}
                <p className="text-sm text-gray-500 mb-4">
                  Erstellt am: {new Date(place.created_at * 1000).toLocaleDateString()}
                </p>
                <Link
                  to={`/naddr1${place.id}`}
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Details
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default PlacesPage;