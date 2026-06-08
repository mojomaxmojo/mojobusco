import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { RelaySelector } from '@/components/RelaySelector';
import { Button } from '@/components/ui/button';
import { SocialBar } from '@/components/SocialBar';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { useState, useMemo, memo, useEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { Calendar, User, Eye, Camera, Trash2, Loader2 } from 'lucide-react';
import { NOSTR_CONFIG } from '@/config/nostr';
import { useAuthor } from '@/hooks/useAuthor';
import { filterEventsByCountry, countries } from '@/lib/countryDetection';
import { MAIN_MENU } from '@/config/menu';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrDelete } from '@/hooks/useNostrDelete';
import { useToast } from '@/hooks/useToast';
import { generateSrcset, generateSizes, getGalleryThumbnailUrl, getImagePlaceholder } from '@/lib/imageUtils';
import { useState, useMemo, memo, useEffect, useRef } from 'react';
import { nip19 } from 'nostr-tools';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
// @ts-nocheck
// @ts-ignore
import { useHead } from '@unhead/react';
import { DEFAULT_PERFORMANCE_CONFIG } from '@/config/performance';

interface ImageEvent {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
  tags: string[][];
}

function Images() {
  const { country } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [visibleCount, setVisibleCount] = useState(30);
  const { ref, inView } = useInView({ threshold: 0.1, rootMargin: '200px' });

  useEffect(() => {
    if (inView) setVisibleCount(prev => prev + 30);
  }, [inView]);

  useEffect(() => {
    setVisibleCount(30);
  }, [country]);

  // Prüfe ob es ein Länderparameter ist
  const currentCountry = country ? countries[country as keyof typeof countries] : null;

  // Prüfe ob es ein Natur-Parameter ist (/bilder/natur/:category)
  const isNatureRoute = location.pathname.includes('/bilder/natur/');
  const natureCategory = isNatureRoute && country ? country : null;

  const { nostr } = useNostr();

  const { data: events, isLoading, error } = useQuery({
    queryKey: ['images', country],
    staleTime: DEFAULT_PERFORMANCE_CONFIG.cache.staleTime,
    gcTime: DEFAULT_PERFORMANCE_CONFIG.cache.gcTime,
    queryFn: async ({ signal }) => {
      const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(DEFAULT_PERFORMANCE_CONFIG.relay.queryTimeout)]);

      const allEvents = await nostr.query([
        {
          kinds: [1, 30023],
          authors: NOSTR_CONFIG.authorPubkeys,
          '#t': ['medien', 'media', 'bilder', 'images'],
          limit: DEFAULT_PERFORMANCE_CONFIG.relay.maxEventsPerBatch,
        }
      ], { signal: abortSignal });

      console.log('[Images Page] Image Events Query:', {
        total: allEvents.length,
        country,
      });

      const imageEvents = allEvents.filter((event: ImageEvent) => {
        const hasMediaType = event.tags.some(tag => tag[0] === 'type' && tag[1] === 'media');
        const content = event.content.toLowerCase();
        const hasImageUrls = content.includes('.jpg') ||
               content.includes('.jpeg') ||
               content.includes('.png') ||
               content.includes('.gif') ||
               content.includes('.webp') ||
               content.includes('.mp4') ||
               content.includes('.webm') ||
               content.includes('.mov') ||
               content.includes('.avi') ||
               content.includes('.mkv') ||
               content.includes('imgur.com') ||
               content.includes('i.imgur.com') ||
               content.includes('cdn.blossom') ||
               content.includes('nostr.build') ||
               content.includes('relay.mojobus.co') ||
               content.includes('relays.mojobus.co') ||
               content.includes('blossom.primal.net');
        return hasMediaType || hasImageUrls;
      });

      if (currentCountry) {
        return filterEventsByCountry(imageEvents, country);
      }

      if (isNatureRoute && natureCategory) {
        const natureFiltered = imageEvents.filter((event: ImageEvent) => {
          const hasNatureTag = event.tags.some(tag => tag[0] === 't' && tag[1] === natureCategory);
          const categoryConfig = MAIN_MENU.nature[natureCategory as keyof typeof MAIN_MENU.nature];
          if (categoryConfig && categoryConfig.tags) {
            const hasRelatedTag = event.tags.some(tag =>
              tag[0] === 't' &&
              (categoryConfig.tags.primary.includes(tag[1]) || categoryConfig.tags.secondary.includes(tag[1]))
            );
            return hasNatureTag || hasRelatedTag;
          }
          return hasNatureTag;
        });
        console.log('[Images Page] Gefiltert nach Natur-Kategorie:', { natureCategory, result: natureFiltered.length });
        return natureFiltered;
      }

      const sortedEvents = [...imageEvents].sort((a, b) => b.created_at - a.created_at);
      console.log('[Images Page] Sortierte Events:', sortedEvents.length);

      return sortedEvents;
    },
    onSuccess: (data) => {
      console.log('[Images Page] Events geladen:', {
        total: data.length,
        country,
      });
    },
  });

  const extractImages = (content: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|avi|mkv))/gi;
    const matches = content.match(urlRegex) || [];
    return matches;
  };

  // SEO Meta Tags
  const pageTitle = currentCountry
    ? `Bilder aus ${currentCountry.name} ${currentCountry.flag} - MojoBus`
    : natureCategory
      ? `${MAIN_MENU.nature[natureCategory as keyof typeof MAIN_MENU.nature]?.name} Bilder - MojoBus`
      : 'Bilder - MojoBus';

  const pageDescription = currentCountry
    ? `Fotografische Eindrücke und Momente aus ${currentCountry.name}.`
    : natureCategory
      ? `Unsere besten ${MAIN_MENU.nature[natureCategory as keyof typeof MAIN_MENU.nature]?.name} Fotografien.`
      : 'Unsere besten Momente und Eindrücke vom Leben auf Reisen.';

  useHead({
    title: pageTitle,
    meta: [
      { name: 'description', content: pageDescription },
      { name: 'keywords', content: 'Vanlife, Fotografie, Reisen, Portugal, Spanien, Frankreich, Belgien, Luxemburg, Deutschland' },
      { property: 'og:title', content: pageTitle },
      { property: 'og:description', content: pageDescription },
      { property: 'og:url', content: `https://mojobus.org/bilder${country ? '/' + country : ''}` },
      { property: 'og:type', content: 'website' }
    ],
    link: [
      { rel: 'canonical', href: `https://mojobus.org/bilder${country ? '/' + country : ''}` }
    ]
  });

  if (isLoading) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <Skeleton className="h-12 w-3/4 mx-auto" />
              <Skeleton className="h-6 w-1/2 mx-auto" />
            </div>
            <Card className="border-dashed">
              <CardContent className="py-16 px-8 text-center">
                <LoadingSpinner size="lg" text="Lade Bilder vom Relay..." />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold">
                <span className="flex items-center justify-center gap-3">
                  <Camera className="h-10 w-10 text-red-600" />
                  Fehler beim Laden
                </span>
              </h1>
              <p className="text-lg text-muted-foreground">
                Es ist ein Fehler aufgetreten beim Laden der Bilder.
              </p>
            </div>
            <div className="col-span-full">
              <Card className="border-dashed border-red-200 dark:border-red-900">
                <CardContent className="py-12 px-8 text-center">
                  <div className="max-w-sm mx-auto space-y-6">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h2 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-4">
                      Verbindungsfehler
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Die Verbindung zum Relay konnte nicht hergestellt werden oder ein Fehler ist aufgetreten.
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button onClick={() => window.location.reload()} className="w-full">
                        🔄 Seite neu laden
                      </Button>
                      <RelaySelector className="w-full" />
                      <Link to="/bilder">
                        <Button variant="outline" className="w-full">
                          Zurück zur Übersicht
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold">
                <span className="flex items-center justify-center gap-3">
                  <Camera className="h-10 w-10 text-ocean-600" />
                  {currentCountry ? (
                    <>
                      <span className="text-3xl">{currentCountry.flag}</span>
                      Bilder aus {currentCountry.name}
                    </>
                  ) : natureCategory ? (
                    <>
                      <span className="text-3xl">{MAIN_MENU.nature[natureCategory as keyof typeof MAIN_MENU.nature]?.emoji}</span>
                      {MAIN_MENU.nature[natureCategory as keyof typeof MAIN_MENU.nature]?.name} Bilder
                    </>
                  ) : (
                    'Bilder'
                  )}
                </span>
              </h1>
              <p className="text-lg text-muted-foreground">
                {currentCountry
                  ? `Fotografische Eindrücke und Momente aus ${currentCountry.name}`
                  : natureCategory
                    ? `Unsere besten ${MAIN_MENU.nature[natureCategory as keyof typeof MAIN_MENU.nature]?.name} Fotografien`
                  : 'Unsere besten Momente und Eindrücke vom Leben auf Reisen'
                }
              </p>
              <div className="flex justify-center items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="font-semibold">0</span>
                  <span>Bilder{
                    currentCountry ? ` aus ${currentCountry.name}` :
                    natureCategory ? ` ${MAIN_MENU.nature[natureCategory as keyof typeof MAIN_MENU.nature]?.name}` :
                    ''
                  }</span>
                </span>
                {(currentCountry || natureCategory) && (
                  <Link
                    to="/bilder"
                    className="text-ocean-600 hover:text-ocean-700 underline"
                  >
                    Alle Bilder anzeigen
                  </Link>
                )}
              </div>
            </div>
            <div className="col-span-full">
              <Card className="border-dashed">
                <CardContent className="py-12 px-8 text-center">
                  <div className="max-w-sm mx-auto space-y-6">
                    <div className="text-6xl mb-4">📷</div>
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                      {currentCountry ? `Keine Bilder aus ${currentCountry.name} gefunden` :
                       natureCategory ? `Keine ${MAIN_MENU.nature[natureCategory as keyof typeof MAIN_MENU.nature]?.name} Bilder gefunden` :
                       'Keine Bilder gefunden'}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {currentCountry
                        ? `Noch keine fotografischen Eindrücke aus ${currentCountry.name}.`
                        : natureCategory
                          ? `Noch keine ${MAIN_MENU.nature[natureCategory as keyof typeof MAIN_MENU.nature]?.name} gefunden.`
                          : 'Noch keine Bilder gefunden. Versuchen Sie einen anderen Relay?'
                      }
                    </p>
                    <div className="flex flex-col gap-2">
                      {currentCountry && (
                        <Link to="/bilder">
                          <Button variant="outline" className="w-full">
                            Alle Bilder anzeigen
                          </Button>
                        </Link>
                      )}
                      <RelaySelector className="w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredEvents = events;
  const visibleEvents = filteredEvents?.slice(0, visibleCount) || [];
  const hasMore = visibleEvents.length < (filteredEvents?.length || 0);

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
                  <span className="gradient-text">Bilder aus {currentCountry.name}</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-3">
                  <Camera className="h-10 w-10 text-primary" />
                  <span className="gradient-text">Bilder</span>
                </span>
              )}
            </h1>
            <p className="text-xl text-muted-foreground">
              {currentCountry
                ? `Fotografische Eindrücke und Momente aus ${currentCountry.name}`
                : 'Unsere besten Momente und Eindrücke vom Leben auf Reisen'
              }
            </p>
          </div>
        </div>
      </section>

      <div className="min-h-screen pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex justify-center items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="font-semibold">{filteredEvents.length}</span>
                <span>Bilder{currentCountry ? ` aus ${currentCountry.name}` : ''}</span>
              </span>
              {currentCountry && (
                <Link
                  to="/bilder"
                  className="text-ocean-600 hover:text-ocean-700 underline"
                >
                  Alle Bilder anzeigen
                </Link>
              )}
            </div>
          </div>

          {filteredEvents.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleEvents.map((event: ImageEvent) => {
                const images = extractImages(event.content);

                return (
                  <ImageCardComponent
                    key={event.id}
                    event={event}
                    images={images}
                    navigate={navigate}
                  />
                );
              })}
            </div>
              {hasMore && (
                <div ref={ref} className="py-8 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </>
          ) : (
            <div className="col-span-full">
              <Card className="border-dashed">
                <CardContent className="py-12 px-8 text-center">
                  <div className="max-w-sm mx-auto space-y-6">
                    <div className="text-6xl mb-4">📷</div>
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                      {currentCountry ? `Keine Bilder aus ${currentCountry.name} gefunden` : 'Keine Bilder gefunden'}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {currentCountry
                        ? `Noch keine fotografischen Eindrücke aus ${currentCountry.name}.`
                        : 'Noch keine Bilder gefunden. Versuchen Sie einen anderen Relay?'
                      }
                    </p>
                    <div className="flex flex-col gap-2">
                      {currentCountry && (
                        <Link to="/bilder">
                          <Button variant="outline" className="w-full">
                            Alle Bilder anzeigen
                          </Button>
                        </Link>
                      )}
                      <RelaySelector className="w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
           )}
        </div>
      </div>
    </>
  );
}

function ImageCardComponent({
  event,
  images,
  navigate
}: {
  event: ImageEvent;
  images: string[];
  navigate: (path: string) => void;
}) {
  const { data: author } = useAuthor(event.pubkey);
  const { user } = useCurrentUser();
  const { mutate: deleteNote } = useNostrDelete();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const metadata = author?.metadata;

  // Check if current user is author
  const isAuthor = user?.pubkey === event.pubkey;

  // Determine if a URL is a video
  const isVideoUrl = (url: string) => {
    const lower = url.toLowerCase();
    return lower.includes('.mp4') ||
           lower.includes('.webm') ||
           lower.includes('.mov') ||
           lower.includes('.avi') ||
           lower.includes('.mkv');
  };

  const handleImageClick = () => {
    // Create note19 identifier for detail view
    const noteId = nip19.noteEncode(event.id);
    navigate(`/bild/${noteId}`);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteNote({
        eventIds: [event.id],
        reason: "Echte Fehler: Delete Event (Kind 5) verwenden"
      });

      toast({
        title: "Erfolg!",
        description: "Bild wurde erfolgreich gelöscht.",
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Löschen fehlgeschlagen. Bitte versuche es erneut.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

   return (
     <div className="relative w-full">
       <Card className="overflow-hidden hover:shadow-lg transition-shadow group w-full rounded-b-none border-b-0">
         <div onClick={handleImageClick} className="cursor-pointer">
            {images.length > 0 && (
               <div className="w-full bg-gray-100 dark:bg-gray-800 relative min-h-[300px] md:min-h-[500px]">
                 {isVideoUrl(images[0]) ? (
                   <video
                     src={images[0]}
                     className="w-full h-full object-cover"
                     controls
                     loading="lazy"
                   />
                 ) : (
                   <>
                     <img
                       src={getGalleryThumbnailUrl(images[0])}
                       srcSet={generateSrcset(images[0], 'gallery')}
                       sizes={generateSizes('card')}
                       alt="Reisebild"
                       className="w-full h-full object-cover"
                       loading="lazy"
                       decoding="async"
                     />

                    {/* Hover overlay with eye icon - nur für Bilder */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <div className="bg-white/90 rounded-full p-4">
                        <Eye className="h-8 w-8 text-gray-800" />
                      </div>
                    </div>
                  </>
                )}
            </div>
          )}
           <CardHeader className="pb-3">
             <CardTitle className="text-xl md:text-2xl line-clamp-2 group-hover:text-ocean-600 transition-colors">
               {event.content.slice(0, 150).replace(/https?:\/\/[^\s]+/g, '').trim() || 'Bild ohne Titel'}
             </CardTitle>
             <div className="flex items-center gap-2 text-sm text-gray-500">
               <Calendar className="h-4 w-4" />
               {new Date(event.created_at * 1000).toLocaleDateString('de-DE', {
                 year: 'numeric',
                 month: 'long',
                 day: 'numeric',
               })}
             </div>
           </CardHeader>
           <CardContent className="pt-0">
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                 {metadata?.picture ? (
                   <div className="w-8 h-8 flex-shrink-0 relative overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                     <img
                       src={getGalleryThumbnailUrl(metadata.picture)}
                       alt={metadata.name || 'Autor'}
                       className="w-full h-full object-cover"
                       loading="lazy"
                     />
                   </div>
                 ) : (
                   <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                     <User className="h-4 w-4 text-gray-500" />
                   </div>
                 )}
                 <span className="text-sm text-gray-600 dark:text-gray-400 flex-1 truncate">
                   {metadata?.name || 'MojoBus Team'}
                 </span>
               </div>

             </div>
           </CardContent>
         </div>
       </Card>
       <SocialBar event={event} compact={true} className="rounded-b-lg border-x border-b bg-card" />

      {/* Delete Button - nur für den Autor sichtbar */}
      {isAuthor && (
        <div className="absolute top-2 right-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 w-8 p-0 opacity-80 hover:opacity-100"
                disabled={isDeleting}
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bild löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Bist du sicher, dass du dieses Bild löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.
                  <br /><br />
                  <strong>Grund:</strong> Echte Fehler: Delete Event (Kind 5) verwenden
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive hover:bg-destructive/90"
                  disabled={isDeleting}
                >
                  {isDeleting ? "Wird gelöscht..." : "Löschen"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

export default Images;
