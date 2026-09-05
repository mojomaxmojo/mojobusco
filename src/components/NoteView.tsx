import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { RelaySelector } from '@/components/RelaySelector';
import { lazy, Suspense } from 'react';

// Lazy loaded NoteContent für Performance-Optimierung
const NoteContent = lazy(() => import('@/components/NoteContent'));

import { SocialBar } from '@/components/SocialBar';
import { extractNoteTags, extractNoteImages } from '@/hooks/useNotes';
import { canonicalUrl as getCanonicalUrl, noteUrl, profileUrl, ogImageUrl } from '@/lib/canonicalUrl';
import { Calendar, ArrowLeft, Hash, Edit, Trash2, MapPin, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import NotFound from '@/pages/NotFound';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { useHead } from '@unhead/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { nip19 } from 'nostr-tools';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ShareButtons } from '@/components/ShareButtons';
import { PinImageButton } from '@/components/PinImageButton';

interface NoteViewProps {
  eventId: string;
}

// Parse position string to detect GPS coordinates
const parsePosition = (position: string) => {
  // GPS coordinate patterns
  const gpsPatterns = [
    /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/, // 13.7563, 100.5018
    /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/,  // 13.7563 100.5018
  ];

  for (const pattern of gpsPatterns) {
    const match = position.match(pattern);
    if (match) {
      const [, lat, lng] = match.map(parseFloat);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng, isGPS: true };
      }
    }
  }

  return { lat: null, lng: null, isGPS: false };
};

// Generate OpenStreetMap URL for GPS coordinates
const generateOSMUrl = (lat: number, lng: number) => {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15`;
};

// Generate OpenStreetMap search URL for text locations
const generateOSMSearchUrl = (position: string) => {
  // Clean and encode the position for search
  const searchQuery = encodeURIComponent(position);
  return `https://www.openstreetmap.org/search?query=${searchQuery}`;
};

export function NoteView({ eventId }: NoteViewProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutate: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: note, isLoading } = useQuery({
    queryKey: ['note', eventId],
    queryFn: async ({ signal }) => {
      const events = await nostr.query(
        [
          {
            ids: [eventId],
            limit: 1,
          },
        ],
        {
          signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]),
        }
      );

      return events[0] || null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });

  const author = useAuthor(note?.pubkey || '');
  const isAuthor = user?.pubkey === note?.pubkey;

  // Extract location from note
  const locationTag = note?.tags.find(([name]) => name === 'location');
  const position = locationTag?.[1] || '';
  const { lat, lng, isGPS } = position ? parsePosition(position) : { lat: null, lng: null, isGPS: false };

  const authorName = author.data?.metadata?.name || author.data?.metadata?.display_name || genUserName(note?.pubkey || '');

  // Dynamic SEO Meta Tags mit JSON-LD
  // (IIFE-Objekt statt Getter-Funktion – @unhead/react v2 akzeptiert kein
  // Callback-Input; die Funktion würde still ignoriert und kein Meta gesetzt)
  useHead((() => {
    if (!note) return {};

    const title = `Note von ${authorName}`;
    const description = `${note.content.substring(0, 160)}${note.content.length > 160 ? '...' : ''}`;
    const tags = extractNoteTags(note);
    const keywords = [
      'vanlife', 'wohnmobil', 'camping', 'reisen', 'nomadenleben',
      'offgrid', 'camper', 'reiseblog', 'microblog', ...tags.slice(0, 10)
    ];
    
    const canonicalHref = getCanonicalUrl(noteUrl(nip19.noteEncode(eventId)));
    const pubDate = new Date(note.created_at * 1000).toISOString();
    const authorNpub = nip19.npubEncode(note.pubkey);
    const authorProfileUrl = getCanonicalUrl(profileUrl(authorNpub));

    // JSON-LD fuer Notes (BlogPosting)
    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      'headline': title,
      'description': description,
      'author': {
        '@type': 'Person',
        'name': authorName,
        'url': authorProfileUrl,
      },
      'publisher': {
        '@type': 'Organization',
        'name': 'MojoBus',
        'url': getCanonicalUrl(),
        'logo': {
          '@type': 'ImageObject',
          'url': ogImageUrl(),
          'width': 1200,
          'height': 630
        }
      },
      'datePublished': pubDate,
      'keywords': keywords.join(', '),
      'url': canonicalHref,
    };

    // Breadcrumb Schema
    const breadcrumbLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': getCanonicalUrl() },
        { '@type': 'ListItem', 'position': 2, 'name': 'Notes', 'item': getCanonicalUrl('/notes') },
        { '@type': 'ListItem', 'position': 3, 'name': title, 'item': canonicalHref }
      ]
    };

    // Extrahiere erstes Bild aus Note fuer OG Image
    const images = extractNoteImages(note);
    const ogImage = images[0] || ogImageUrl();

    return {
      title: `${title} - MojoBus`,
      meta: [
        { name: 'description', content: description },
        { name: 'keywords', content: keywords.join(', ') },
        { property: 'og:title', content: `${title} - MojoBus` },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'article' },
        { property: 'og:url', content: canonicalHref },
        { property: 'og:site_name', content: 'MojoBus Perpetual Travelers' },
        { property: 'og:locale', content: 'de_DE' },
        { property: 'og:image', content: ogImage },
        { property: 'og:image:alt', content: `Note von ${authorName}` },
        { property: 'article:author', content: authorName },
        { property: 'article:published_time', content: pubDate },
        ...tags.slice(0, 5).map(tag => ({ property: 'article:tag', content: tag })),
        { name: 'twitter:title', content: `${title} - MojoBus` },
        { name: 'twitter:description', content: description },
        { name: 'twitter:card', content: images.length > 0 ? 'summary_large_image' : 'summary' },
        { name: 'twitter:image', content: ogImage },
        { name: 'robots', content: 'index, follow' },
        { name: 'language', content: 'de-DE' },
      ],
      link: [
        { rel: 'canonical', href: canonicalHref },
        { rel: 'author', href: authorProfileUrl }
      ],
      script: [
        { type: 'application/ld+json', innerHTML: JSON.stringify(jsonLd) },
        { type: 'application/ld+json', innerHTML: JSON.stringify(breadcrumbLd) }
      ]
    };
  })());

  const handleDelete = async () => {
    if (!note) return;

    try {
      createEvent(
        {
          kind: 5, // Event deletion kind
          content: 'Note deleted',
          tags: [['e', note.id]],
        },
        {
          onSuccess: () => {
            toast({
              title: 'Erfolgreich gelöscht!',
              description: 'Die Note wurde von Nostr entfernt.',
            });
            setDeleteDialogOpen(false);
            window.location.href = '/notes';
          },
          onError: (error) => {
            toast({
              title: 'Fehler beim Löschen',
              description: error.message,
              variant: 'destructive',
            });
          },
        }
      );
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Die Note konnte nicht gelöscht werden.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-8">
            <Skeleton className="h-10 w-32" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Card className="border-dashed">
              <CardContent className="py-12 px-8 text-center">
                <div className="max-w-sm mx-auto space-y-6">
                  <p className="text-muted-foreground">
                    Note nicht gefunden. Versuche es mit einem anderen Relay?
                  </p>
                  <RelaySelector className="w-full" />
                  <Button asChild variant="outline">
                    <Link to="/notes">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Zurück zu den Notes
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Breadcrumbs */}
          <Breadcrumbs items={[
            { label: 'Home', href: '/' },
            { label: 'Notes', href: '/notes' },
            { label: `Note von ${authorName}` },
          ]} />

          <ShareButtons
            url={getCanonicalUrl(noteUrl(nip19.noteEncode(eventId)))}
            title={`Note von ${authorName}`}
            description={note.content.substring(0, 160)}
            image={extractNoteImages(note)[0] || ogImageUrl()}
          />

          <Button asChild variant="ghost" className="mb-4">
            <Link to="/notes">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück zu den Notes
            </Link>
          </Button>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 mb-4">
                <Link to={`/${nip19.npubEncode(note.pubkey)}`}>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={author.data?.metadata?.picture} alt={author.data?.metadata?.name} />
                    <AvatarFallback>{(author.data?.metadata?.name || genUserName(note.pubkey))[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link to={`/${nip19.npubEncode(note.pubkey)}`} className="font-semibold hover:underline">
                      {author.data?.metadata?.name || genUserName(note.pubkey)}
                    </Link>
                    {author.data?.metadata?.nip05 && (
                      <Badge variant="secondary" className="text-xs">
                        ✓
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(note.created_at * 1000).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                {isAuthor && (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/note/${eventId}/edit`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteDialogOpen(true)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="whitespace-pre-wrap break-words mb-4">
                <Suspense fallback={<Skeleton className="h-20 w-full" />}>
                  <NoteContent event={note} />
                </Suspense>
              </div>

              {extractNoteImages(note).length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {extractNoteImages(note).map((url, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={url}
                        alt={`Note image ${idx + 1}`}
                        className="rounded-lg w-full h-auto object-cover"
                        loading="lazy"
                      />
                      <PinImageButton
                        imageUrl={url}
                        pageUrl={getCanonicalUrl(noteUrl(nip19.noteEncode(eventId)))}
                        title={`Note von ${authorName}`}
                        description={note.content.substring(0, 160)}
                        hashtags={extractNoteTags(note)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Position Display */}
              {position && (
                <div className="bg-muted/50 rounded-lg p-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-ocean-600" />
                      <span className="font-medium">Position</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-6 px-2 text-xs"
                    >
                      <a
                        href={isGPS && lat !== null && lng !== null
                          ? generateOSMUrl(lat, lng)
                          : generateOSMSearchUrl(position)
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Karte
                      </a>
                    </Button>
                  </div>
                  <p className="mt-2 text-sm">{position}</p>
                </div>
              )}

              <SocialBar event={note} />

              <CommentsSection
                root={note}
                title="Kommentare"
                emptyStateMessage="Noch keine Kommentare"
                emptyStateSubtitle="Sei der Erste, der einen Kommentar hinterlässt!"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Note löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dies wird die Note permanent von Nostr entfernen. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}