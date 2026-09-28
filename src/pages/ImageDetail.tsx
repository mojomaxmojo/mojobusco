import { SEOHead } from '@/components/SEOHead';
import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useInView } from 'react-intersection-observer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RelaySelector } from '@/components/RelaySelector';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Share2, ZoomIn, User } from 'lucide-react';
import { useAuthor } from '@/hooks/useAuthor';

import { CommentsSection } from '@/components/comments/CommentsSection';
import { ShareButtons } from '@/components/ShareButtons';
import { ImageViewer, isVideoUrl } from '@/components/image/ImageViewer';
import { ImageHero } from '@/components/image/ImageHero';

// Lazy loaded NoteContent für Performance-Optimierung
const NoteContent = lazy(() => import('@/components/NoteContent'));

import { SocialBar } from '@/components/SocialBar';
import { ZapButton } from '@/components/ZapButton';
import { NOSTR_CONFIG } from '@/config/nostr';
import { nip19 } from 'nostr-tools';
import { generateSrcset, generateSizes, getGalleryThumbnailUrl } from '@/lib/imageUtils';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { canonicalUrl, imageUrl } from '@/lib/canonicalUrl';

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

  // Kommentare erst mounten, wenn sie in den Viewport kommen (Phase-3-Tempo:
  // die Relay-Queries von useComments blockieren den Seitenaufbau nicht mehr)
  const { ref: commentsRef, inView: commentsInView } = useInView({ threshold: 0.1, rootMargin: '600px' });

  // Decode nip19 to get event ID
  let eventId = noteId;
  try {
    if (noteId?.startsWith('note1')) {
      const decoded = nip19.decode(noteId);
      if (decoded.type === 'note') {
        eventId = decoded.data;
      }
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

      const allEvents = await nostr.query([
        {
          ids: [eventId],
          authors: NOSTR_CONFIG.authorPubkeys,
        }
      ], { signal: abortSignal });

      return allEvents[0] ?? null;
    },
    enabled: !!eventId,
  });

  const author = useAuthor(events?.pubkey);
  const metadata = author.data?.metadata;

  const extractImages = (content: string): string[] => {
    if (!content) return [];

    // Match image URLs with extensions OR from known image hosting services
    const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|avi|mkv)|https?:\/\/i\.imgur\.com\/[^\s]+|https?:\/\/cdn\.blossom\.social\/[^\s]+|https?:\/\/blossom\.primal\.net\/[^\s]+|https?:\/\/nostr\.build\/[^\s]+|https?:\/\/imgur\.com\/[^\s]+)/gi;
    const matches: string[] = content.match(urlRegex) || [];

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

  // JSON-LD BreadcrumbList
  useEffect(() => {
    if (!events || !noteId) return
    const ld = breadcrumbJsonLd([
      { name: 'Home', url: canonicalUrl() },
      { name: 'Bilder', url: canonicalUrl('/bilder') },
      { name: 'Bild', url: canonicalUrl(imageUrl(noteId)) },
    ])
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(ld)
    script.id = 'image-breadcrumb-json-ld'

    const existing = document.getElementById('image-breadcrumb-json-ld')
    if (existing) existing.remove()
    document.head.appendChild(script)

    return () => {
      const el = document.getElementById('image-breadcrumb-json-ld')
      if (el) el.remove()
    }
  }, [events, noteId])

  const openFullscreen = (index: number) => {
    setCurrentImageIndex(index);
    setIsImageFullscreen(true);
  };

  // Only show invalid image error if NOT loading and NOT an image event
  if (!isLoading && !isValidImageEvent) {
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
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="w-full h-[320px] rounded-lg" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !events) {
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

  const firstMedia = images[0];

  return (
    <div className="min-h-screen py-8">
      <SEOHead
        title="Bild"
        description="Bildergalerie auf MojoBus – Perpetual Travelers"
        type="article"
      />
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            {/* Bild oben (klassische Darstellung) — Zurück als schwebender
                Overlay-Button auf dem Bild, Bild beginnt ganz oben */}
            <ImageHero
              media={firstMedia}
              description={events.content}
              hashtags={tags}
              onBack={() => navigate('/bilder')}
              onOpenFullscreen={() => openFullscreen(0)}
            />

            {/* Content unten */}
          {/* Autor-Zeile kompakt unter dem Bild */}
          <div className="flex items-center gap-3">
            {metadata?.picture ? (
              <div className="w-11 h-11 flex-shrink-0 relative overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <img
                  src={getGalleryThumbnailUrl(metadata.picture)}
                  alt={metadata.name || 'Autor'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ) : (
              <div className="w-11 h-11 flex-shrink-0 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <User className="h-5 w-5 text-gray-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{metadata?.name || 'Anonymous'}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {new Date(events.created_at * 1000).toLocaleDateString('de-DE', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  {metadata?.nip05 ? ` · ${metadata.nip05}` : ''}
                </span>
              </div>
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
                aria-label="Teilen"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Beschreibung → Weitere Medien → SocialBar + Share — eine aufgeräumte Card */}
          <Card>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <Suspense fallback={<Skeleton className="h-20 w-full" />}>
                <NoteContent event={events} className="text-base" hideImageLinks={true} />
              </Suspense>

              {/* Galerie-Streifen: direkt unter dem Content, über der SocialBar;
                  mobil wischbar, Desktop-Grid; Thumbs klein + lazy */}
              {images.length > 1 && (
                <section aria-label="Weitere Medien">
                  <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                    Weitere Medien ({images.length})
                  </h2>
                  <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
                    {images.map((img, index) => (
                      <button
                        key={`${img}-${index}`}
                        type="button"
                        className={`relative shrink-0 snap-start w-28 h-28 md:w-auto md:h-auto md:aspect-square rounded-lg overflow-hidden transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 ${
                          isVideoUrl(img) ? 'bg-gray-900' : 'bg-muted'
                        }`}
                        onClick={() => !isVideoUrl(img) && openFullscreen(index)}
                        aria-label={isVideoUrl(img) ? `Video ${index + 1}` : `Bild ${index + 1} im Vollbild öffnen`}
                      >
                        {isVideoUrl(img) ? (
                          <video
                            src={img}
                            className="w-full h-full object-cover"
                            preload="metadata"
                            playsInline
                            muted
                          />
                        ) : (
                          <>
                            <img
                              src={getGalleryThumbnailUrl(img)}
                              srcSet={generateSrcset(img, 'card')}
                              sizes={generateSizes('card')}
                              alt={`Bild ${index + 1}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                            {/* Hover overlay - nur für Bilder */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ZoomIn className="h-6 w-6 text-white" />
                            </div>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <SocialBar event={events} />
              <ShareButtons
                url={window.location.href}
                title="Bild von MojoBus"
                description={events.content}
                image={firstMedia}
              />
            </CardContent>
          </Card>

          {/* Tags und Kommentare (Kommentare lazy gemountet) */}
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
              <div ref={commentsRef}>
                {commentsInView ? (
                  <CommentsSection root={events} />
                ) : (
                  <div className="space-y-3 py-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>

      {/* Vollbild-Viewer — erst gemountet/geöffnet, wenn benötigt */}
      {isImageFullscreen && (
        <ImageViewer
          images={images}
          currentIndex={currentImageIndex}
          onClose={() => setIsImageFullscreen(false)}
          onNavigate={setCurrentImageIndex}
          title="Bild von MojoBus"
          description={events.content}
          hashtags={tags}
        />
      )}
    </div>
  );
}
