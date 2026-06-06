import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RelaySelector } from '@/components/RelaySelector';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Download, Share2, Heart, MessageSquare, X, ZoomIn, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { useAuthor } from '@/hooks/useAuthor';

import { CommentsSection } from '@/components/comments/CommentsSection';

// Lazy loaded NoteContent für Performance-Optimierung
const NoteContent = lazy(() => import('@/components/NoteContent'));

import { SocialBar } from '@/components/SocialBar';
import { ZapButton } from '@/components/ZapButton';
import { NOSTR_CONFIG } from '@/config/nostr';
import { nip19 } from 'nostr-tools';
import { generateSrcset, generateSizes, getGalleryThumbnailUrl, getArticleHeaderUrl } from '@/lib/imageUtils';

interface ImageEvent {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
  tags: string[][];
}

export function ImageDetail() {
  const { nip19: noteId } = useParams();
  const navigate = useNavigate();
  const { nostr } = useNostr();
  const [isImageFullscreen, setIsImageFullscreen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Decode nip19 to get event ID
  let eventId = noteId;
  try {
    if (noteId?.startsWith('note1')) {
      const decoded = nip19.decode(noteId);
      eventId = decoded.data;
    }
  } catch (error) {
    console.error('Error decoding nip19:', error);
    navigate('/bilder');
  }

  const { data: events, isLoading, error } = useQuery({
    queryKey: ['image-detail', eventId],
    queryFn: async ({ signal }) => {
      if (!eventId) return null;

      const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(3000)]);

      console.log('Querying for event with ID:', eventId);

      const allEvents = await nostr.query([
        {
          ids: [eventId],
          authors: NOSTR_CONFIG.authorPubkeys,
        }
      ], { signal: abortSignal });

      console.log('Found events:', allEvents.length);
      console.log('Events data:', allEvents);

      const event = allEvents[0];

      if (!event) {
        console.log('No event found with ID:', eventId);
        return null;
      }

      return event;
    },
    enabled: !!eventId,
  });

  const author = useAuthor(events?.pubkey);
  const metadata = author.data?.metadata;

  const extractImages = (content: string): string[] => {
    if (!content) return [];

    // Match image URLs with extensions OR from known image hosting services
    const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|avi|mkv)|https?:\/\/i\.imgur\.com\/[^\s]+|https?:\/\/cdn\.blossom\.social\/[^\s]+|https?:\/\/blossom\.primal\.net\/[^\s]+|https?:\/\/nostr\.build\/[^\s]+|https?:\/\/imgur\.com\/[^\s]+)/gi;
    const matches = content.match(urlRegex) || [];

    // Filter out URLs that are not actually image or video files
    const mediaUrls = matches.filter(url => {
      const lower = url.toLowerCase();
      return lower.includes('.jpg') ||
             lower.includes('.jpeg') ||
             lower.includes('.png') ||
             lower.includes('.gif') ||
             lower.includes('.webp') ||
             lower.includes('.mp4') ||
             lower.includes('.webm') ||
             lower.includes('.mov') ||
             lower.includes('.avi') ||
             lower.includes('.mkv') ||
             lower.includes('imgur.com') ||
             lower.includes('blossom');
    });

    return mediaUrls;
  };

  const extractTags = (event: ImageEvent): string[] => {
    if (!event?.tags) return [];
    return event.tags
      ?.filter(tag => tag[0] === 't')
      ?.map(tag => tag[1]) || [];
  };

  // Only compute these if events is loaded
  const images = events ? extractImages(events.content) : [];
  const tags = events ? extractTags(events) : [];

  // Determine if this should be treated as an image event
  // Only check if we're not loading and have an event
  const isValidImageEvent = !isLoading && events && (
    images.length > 0 ||
    tags.some(tag =>
      ['medien', 'media', 'bilder', 'images', 'photo', 'image', 'video', 'audio'].includes(tag)
    )
  );

  // Determine if a URL is a video
  const isVideoUrl = (url: string) => {
    const lower = url.toLowerCase();
    return lower.includes('.mp4') ||
           lower.includes('.webm') ||
           lower.includes('.mov') ||
           lower.includes('.avi') ||
           lower.includes('.mkv');
  };

  console.log('Image validation:', {
    isLoading,
    eventExists: !!events,
    imagesCount: images.length,
    tagsFound: tags,
    isValid: isValidImageEvent
  });

  // Handle keyboard navigation for fullscreen
  useEffect(() => {
    if (!isImageFullscreen) return;

    // Deaktiviere Tastaturnavigation für Videos
    if (isVideoUrl(images[currentImageIndex])) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsImageFullscreen(false);
      } else if (e.key === 'ArrowLeft') {
        setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImageFullscreen, images.length, currentImageIndex]);

  // Prevent body scroll when fullscreen
  useEffect(() => {
    if (isImageFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isImageFullscreen]);

  const openFullscreen = (index: number) => {
    setCurrentImageIndex(index);
    setIsImageFullscreen(true);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  // Only show invalid image error if NOT loading and NOT an image event
  if (!isLoading && !isValidImageEvent) {
    console.log('Event does not contain images or media tags, showing error');
    console.log('Debug info:', {
      event: events,
      imagesCount: images.length,
      tags: tags,
      isValid: isValidImageEvent
    });
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/bilder')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zu Bilder
          </Button>

          <Card className="border-dashed">
            <CardContent className="py-12 px-8 text-center">
              <div className="max-w-sm mx-auto space-y-6">
                <h3 className="text-lg font-semibold text-red-600">
                  Kein gültiges Bild
                </h3>
                <p className="text-muted-foreground mb-4">
                  Dieses Event wurde nicht als Bild-Ereignis klassifiziert.
                </p>
                <p className="text-sm text-gray-600">
                  Bitte navigieren Sie zur Bildergalerie, um gültige Bilder zu finden.
                </p>
                <div className="space-y-2">
                  <Button onClick={() => navigate('/bilder')}>
                    Zur Bildergalerie
                  </Button>
                  <RelaySelector className="w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/bilder')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zu Bilder
          </Button>

          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !events) {
    console.log('Error or no events found');
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/bilder')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zu Bilder
          </Button>

          <Card className="border-dashed">
            <CardContent className="py-12 px-8 text-center">
              <div className="max-w-sm mx-auto space-y-6">
                <h3 className="text-lg font-semibold text-red-600">
                  Bild nicht gefunden
                </h3>
                <p className="text-muted-foreground mb-4">
                  Das angegebene Bild konnte nicht geladen werden oder wurde bereits gelöscht.
                </p>
                <p className="text-sm text-gray-600">
                  Möglicherweise ist die ID ungültig oder das Bild wurde entfernt.
                </p>
                <div className="space-y-2">
                  <Button onClick={() => navigate('/bilder')}>
                    Zurück zur Bildergalerie
                  </Button>
                  <RelaySelector className="w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <SEOHead
        title="Bild"
        description="Bildergalerie auf MojoBus – Perpetual Travelers"
        type="article"
      />
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/bilder')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück zu Bilder
        </Button>

        <div className="max-w-4xl mx-auto">
           {/* Main Content */}
           <div className="space-y-6">
            {/* Image Display with Author Info */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {/* Author Info */}
                <div className="flex items-center gap-3 p-4 border-b">
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
                    <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold">{metadata?.name || 'Anonymous'}</h3>
                    <p className="text-sm text-muted-foreground">
                      {metadata?.nip05 || 'Kein NIP-05'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ZapButton
                      target={events}
                      className="text-xs"
                      showCount={false}
                      label="Tip Autor"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0"
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share?.({
                            title: 'Bild von MojoBus',
                            text: events.content,
                            url: window.location.href
                          });
                        }
                      }}
                    >
                      <Share2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                 {/* Image/Video */}
                 <div
                   className={`relative group ${isVideoUrl(images[0]) ? 'cursor-default' : 'cursor-pointer'}`}
                   onClick={() => !isVideoUrl(images[0]) && openFullscreen(0)}
                 >
                   {isVideoUrl(images[0]) ? (
                     <video
                       src={images[0]}
                       controls
                       className="w-full bg-gray-100 dark:bg-gray-900 max-h-[800px]"
                       loading="eager"
                     />
                   ) : (
                     <img
                       src={getArticleHeaderUrl(images[0])}
                       srcSet={generateSrcset(images[0], 'gallery')}
                       sizes={generateSizes('header')}
                       alt="Reisebild"
                       className="w-full object-cover bg-gray-100 dark:bg-gray-900 max-h-[800px]"
                       loading="eager"
                       decoding="sync"
                     />
                   )}

                   {/* Hover overlay - nur für Bilder */}
                   {!isVideoUrl(images[0]) && (
                     <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <div className="bg-white/90 dark:bg-gray-800/90 rounded-lg p-4 flex flex-col items-center gap-2">
                         <ZoomIn className="h-8 w-8 text-gray-800 dark:text-white" />
                         <div className="text-gray-800 dark:text-white font-medium">
                           Klick für Vollbild
                         </div>
                       </div>
                     </div>
                   )}
                 </div>
              </CardContent>
            </Card>

             {/* Multiple Images/Videos Gallery */}
             {images.length > 1 && (
               <Card>
                 <CardHeader>
                   <CardTitle>Weitere Medien ({images.length - 1})</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                     {images.slice(1).map((img, index) => (
                       <div
                         key={index}
                         className={`relative rounded-lg overflow-hidden ${isVideoUrl(img) ? 'bg-gray-900' : 'cursor-pointer'}`}
                         onClick={() => !isVideoUrl(img) && openFullscreen(index + 1)}
                       >
                         {isVideoUrl(img) ? (
                           <video
                             src={img}
                             className="w-full h-32 object-cover"
                             controls
                             loading="lazy"
                           />
                         ) : (
                           <>
                             <img
                               src={getGalleryThumbnailUrl(img)}
                               srcSet={generateSrcset(img, 'card')}
                               sizes={generateSizes('card')}
                               alt={`Bild ${index + 2}`}
                               className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                               loading="lazy"
                             />

                             {/* Hover overlay - nur für Bilder */}
                             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <div className="flex flex-col items-center gap-1">
                                 <ZoomIn className="h-6 w-6 text-white" />
                                 <span className="text-xs text-white">Vollbild</span>
                               </div>
                             </div>
                           </>
                         )}
                       </div>
                     ))}
                   </div>
                 </CardContent>
               </Card>
             )}

             {/* Content and Description */}
                <Card>
                   <CardContent>
                     <div className="mb-4">
                       <Suspense fallback={<Skeleton className="h-20 w-full" />}>
                         <NoteContent event={events} className="text-base" hideImageLinks={true} />
                       </Suspense>
                     </div>
                     <SocialBar event={events} />
                   </CardContent>
                 </Card>

              {/* Tags and Comments */}
              <Card>
                <CardContent className="pt-0">
                  {tags.length > 0 && (
                    <div className="mb-6 pt-6">
                      <div className="flex flex-wrap gap-2">
                        {tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="gap-1">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <CommentsSection root={events} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Fullscreen Image Viewer */}
      {isImageFullscreen && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
            onClick={() => setIsImageFullscreen(false)}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Image counter */}
          <div className="absolute top-4 left-4 z-50 text-white bg-black/50 px-3 py-1 rounded-md">
            {currentImageIndex + 1} / {images.length}
          </div>

          {/* Previous button */}
          {images.length > 1 && !isVideoUrl(images[currentImageIndex]) && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
              onClick={(e) => {
                e.stopPropagation();
                prevImage();
              }}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}

          {/* Next button */}
          {images.length > 1 && !isVideoUrl(images[currentImageIndex]) && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
              onClick={(e) => {
                e.stopPropagation();
                nextImage();
              }}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          )}

          {/* Main image/video */}
          {isVideoUrl(images[currentImageIndex]) ? (
            <video
              src={images[currentImageIndex]}
              controls
              className="w-full h-full max-w-[99vw] object-contain"
              onClick={() => setIsImageFullscreen(false)}
            />
          ) : (
            <img
              src={getArticleHeaderUrl(images[currentImageIndex])}
              srcSet={generateSrcset(images[currentImageIndex], 'gallery')}
              sizes="99vw"
              alt={`Bild ${currentImageIndex + 1}`}
              className="w-full h-full max-w-[99vw] object-contain"
              onClick={() => setIsImageFullscreen(false)}
            />
          )}

          {/* Keyboard hint */}
          {!isVideoUrl(images[currentImageIndex]) && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 text-white/70 text-sm bg-black/50 px-4 py-2 rounded-md">
              ESC zum Schließen {images.length > 1 && '• ← → zum Navigieren'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
