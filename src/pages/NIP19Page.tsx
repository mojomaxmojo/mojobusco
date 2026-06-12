import { nip19 } from 'nostr-tools';
import { useParams } from 'react-router-dom';
import { ArticleView } from '@/components/ArticleView';
import { NoteView } from '@/components/NoteView';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { lazy, Suspense } from 'react';

// Lazy loaded NoteContent für Performance-Optimierung
const NoteContent = lazy(() => import('@/components/NoteContent'));

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useHead } from '@unhead/react';
import { AUTHORS } from '@/config/nostr';
import NotFound from './NotFound';

// Profile view component
const ProfileView = ({ pubkey }: { pubkey: string }) => {
  const author = useAuthor(pubkey);

  useHead(() => {
    const metadata = author.data?.metadata;
    const name = metadata?.name || genUserName(pubkey);
    const displayName = metadata?.display_name || name;

    return {
      title: `${displayName} - MojoBus Profile`,
      meta: [
        { name: 'description', content: metadata?.about || `Profil von ${displayName} auf MojoBus` },
        { property: 'og:title', content: `${displayName} - MojoBus Profile` },
        { property: 'og:description', content: metadata?.about || `Profil von ${displayName} auf MojoBus` },
        { property: 'og:type', content: 'profile' },
        { property: 'og:image', content: metadata?.picture || 'https://mojobus.co/mojobuslogo.png' },
        { property: 'profile:username', content: name },
      ],
      link: [
        { rel: 'canonical', href: `https://mojobus.co/${nip19.npubEncode(pubkey)}` }
      ]
    };
  });

  if (author.isLoading) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-8">
            <Skeleton className="h-10 w-32" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const metadata = author.data?.metadata;
  const name = metadata?.name || genUserName(pubkey);
  const displayName = metadata?.display_name || name;
  const about = metadata?.about;
  const picture = metadata?.picture;
  const banner = metadata?.banner;
  const nip05 = metadata?.nip05;
  const website = metadata?.website;

  // Check if this is one of our authors
  const isAuthor = AUTHORS.some(author => author.pubkey === pubkey);

  return (
    <div className="min-h-screen py-12">
      {banner && (
        <div className="h-48 w-full">
          <img
            src={banner}
            alt={`${displayName}'s banner`}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Zurück zur Startseite
              </Link>
            </Button>

            {isAuthor && (
              <div className="text-sm text-muted-foreground">
                ✅ MojoBus Autor
              </div>
            )}
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  {picture && <AvatarImage src={picture} alt={displayName} />}
                  <AvatarFallback className="text-lg">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold">{displayName}</h1>
                  {name !== displayName && (
                    <p className="text-muted-foreground">@{name}</p>
                  )}
                  {nip05 && (
                    <p className="text-sm text-muted-foreground">✓ {nip05}</p>
                  )}
                </div>
              </div>

              {about && (
                <div>
                  <h3 className="font-semibold mb-2">Über mich</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{about}</p>
                </div>
              )}

              {website && (
                <div>
                  <h3 className="font-semibold mb-2">Website</h3>
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ocean-600 hover:text-ocean-700 underline"
                  >
                    {website}
                  </a>
                </div>
              )}

              <div className="pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  <p><strong>Public Key:</strong> <code className="bg-muted px-2 py-1 rounded text-xs">{pubkey}</code></p>
                  <p className="mt-1"><strong>NPUB:</strong> <code className="bg-muted px-2 py-1 rounded text-xs break-all">{nip19.npubEncode(pubkey)}</code></p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Generic event view component
const EventView = ({ eventId, authorPubkey }: { eventId: string; authorPubkey?: string }) => {
  const { nostr } = useNostr();

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
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

  const author = useAuthor(event?.pubkey || '');

  if (isLoading) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-8">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Card className="border-dashed">
              <CardContent className="py-12 px-8 text-center">
                <p className="text-muted-foreground">
                  Event nicht gefunden.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link to="/">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Zurück zur Startseite
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const authorName = author.data?.metadata?.name || genUserName(event.pubkey);
  const authorAvatar = author.data?.metadata?.picture;

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Zurück zur Startseite
              </Link>
            </Button>
            <Badge variant="secondary">Kind: {event.kind}</Badge>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  {authorAvatar && <AvatarImage src={authorAvatar} alt={authorName} />}
                  <AvatarFallback>{authorName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{authorName}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(event.created_at * 1000).toLocaleDateString('de-DE', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>

              {event.content && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Content</h3>
                  <div className="whitespace-pre-wrap break-words text-sm bg-muted p-4 rounded">
                    <Suspense fallback={<Skeleton className="h-12 w-full" />}>
                      <NoteContent event={event} />
                    </Suspense>
                  </div>
                </div>
              )}

              {event.tags.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Tags</h3>
                  <div className="bg-muted p-4 rounded">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(event.tags, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-2">Event Details</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>ID:</strong> <code className="bg-muted px-2 py-1 rounded text-xs break-all">{event.id}</code></p>
                  <p><strong>Public Key:</strong> <code className="bg-muted px-2 py-1 rounded text-xs break-all">{event.pubkey}</code></p>
                  <p><strong>Kind:</strong> {event.kind}</p>
                  <p><strong>Created:</strong> {new Date(event.created_at * 1000).toISOString()}</p>
                  <p><strong>Signature:</strong> <code className="bg-muted px-2 py-1 rounded text-xs break-all">{event.sig}</code></p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export function NIP19Page() {
  const { nip19: identifier } = useParams<{ nip19: string }>();

  if (!identifier) {
    return <NotFound />;
  }

  let decoded;
  try {
    decoded = nip19.decode(identifier);
  } catch {
    return <NotFound />;
  }

  const { type } = decoded;

  switch (type) {
    case 'npub':
      const npubData = decoded.data as string;
      return <ProfileView pubkey={npubData} />;

    case 'nprofile':
      const nprofileData = decoded.data as { pubkey: string; relays?: string[] };
      return <ProfileView pubkey={nprofileData.pubkey} />;

    case 'note':
      // Note view (kind 1)
      const noteId = decoded.data as string;
      return <NoteView eventId={noteId} />;

    case 'nevent':
      // Generic event view
      const neventData = decoded.data as { id: string; relays?: string[]; author?: string };
      return <EventView eventId={neventData.id} authorPubkey={neventData.author} />;

    case 'naddr':
      // Addressable event view (articles)
      const naddr = decoded.data as nip19.AddressPointer;
      return <ArticleView naddr={naddr} />;

    default:
      return <NotFound />;
  }
}