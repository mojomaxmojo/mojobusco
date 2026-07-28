/**
 * Trip Detail Page
 *
 * Displays a single trip with:
 * - Header with author info, title, stats
 * - Route map with numbered markers
 * - Photo gallery with descriptions
 * - Share buttons
 * - Edit/Delete (for trip author only)
 *
 * Note: Trips are Kind 30025 (Parameterized Replaceable Events)
 * - Editable: Publish new version with same d-tag
 * - Replaceable: Newer version replaces older
 * - Deletable: Via NIP-09 delete event
 */

import { SEOHead } from '@/components/SEOHead';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
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
} from '@/components/ui/alert-dialog';
import { useTrip, calculateTripDistance } from '@/hooks/useTrips';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { VanillaMap, type MapMarker, type MapPolyline } from '@/components/VanillaMap';
import { generateImageUrl } from '@/config/imageService';
import { canonicalUrl, tripUrl } from '@/lib/canonicalUrl';
import { 
  ArrowLeft, MapPin, Camera, Calendar, Navigation, Pencil, Trash2
} from '@/lib/icons';
import { formatDistanceToNow } from 'date-fns';

// Generate a user name from pubkey
function genUserName(pubkey: string): string {
  return `user_${pubkey.slice(0, 8)}`;
}

/**
 * Create numbered marker icon SVG
 */
function createNumberedMarkerIcon(number: number): string {
  const svg = `
    <svg viewBox="0 0 40 60" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
          <feOffset dx="0" dy="2"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <path d="M20,0C8.95,0,0,8.95,0,20c0,11.05,20,40,20,40s20-28.95,20-40C40,8.95,31.05,0,20,0z" fill="#f59e0b"/>
        <circle cx="20" cy="20" r="12" fill="white"/>
        <text x="20" y="26" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold" fill="#000">${number}</text>
      </g>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Loading Skeleton
 */
function LoadingSkeleton() {
  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-10 w-32 mb-6" />
          <div className="flex items-start gap-4 mb-6">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="h-[500px] w-full rounded-lg mb-8" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="aspect-square" />
            <Skeleton className="aspect-square" />
            <Skeleton className="aspect-square" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Not Found State
 */
function NotFound() {
  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <Card className="border-dashed p-8">
            <div className="text-center space-y-6">
              <MapPin className="w-16 h-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-xl font-semibold mb-2">Trip nicht gefunden</h3>
                <p className="text-muted-foreground">
                  Dieser Trip existiert nicht oder konnte nicht geladen werden.
                </p>
              </div>
              <Link to="/map/trips">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Zurück zu Trips
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}



/**
 * Main Trip Detail Component
 */
export default function TripDetail() {
  const { naddr } = useParams<{ naddr: string }>();
  const navigate = useNavigate();
  const { data: trip, isLoading } = useTrip(naddr || '');
  const { data: authorData } = useAuthor(trip?.author || '');
  const metadata = authorData?.metadata;
  const { user } = useCurrentUser();
  const { mutate: publishEvent } = useNostrPublish();
  const { toast } = useToast();
  
  const displayName = metadata?.name || genUserName(trip?.author || '');
  const profileImage = metadata?.picture;
  
  // Check if current user is the trip author
  const isAuthor = user && trip && user.pubkey === trip.author;
  
  // Delete trip handler
  const handleDelete = () => {
    if (!trip || !user) return;
    
    // Publish NIP-09 delete event
    publishEvent({
      kind: 5, // Delete event
      content: 'Trip gelöscht',
      tags: [
        ['e', trip.id], // Delete this event
        ['k', '30025'], // Event kind
      ],
    }, {
      onSuccess: () => {
        toast({
          title: 'Trip gelöscht',
          description: 'Der Trip wurde erfolgreich gelöscht.',
        });
        navigate('/map/trips');
      },
      onError: (error) => {
        console.error('Delete error:', error);
        toast({
          title: 'Fehler',
          description: 'Der Trip konnte nicht gelöscht werden.',
          variant: 'destructive',
        });
      },
    });
  };
  
  // Prepare map data
  const mapMarkers: MapMarker[] = useMemo(() => {
    if (!trip) return [];
    
    return trip.waypoints.map((wp, idx) => ({
      id: `wp-${idx}`,
      lat: wp.lat,
      lng: wp.lon,
      title: wp.name || `Station ${idx + 1}`,
      description: `Photo ${idx + 1}`,
      isCurrent: false,
      type: 'trip' as const,
    }));
  }, [trip]);
  
  const mapPolylines: MapPolyline[] = useMemo(() => {
    if (!trip || trip.waypoints.length < 2) return [];
    
    return [{
      points: trip.waypoints.map(wp => [wp.lat, wp.lon] as [number, number]),
      color: '#f59e0b',
      weight: 4,
      opacity: 0.8,
    }];
  }, [trip]);
  
  // Calculate distance
  const distance = trip?.distance 
    ? parseInt(trip.distance) 
    : trip ? calculateTripDistance(trip.waypoints) : 0;
  
  // Loading state
  if (isLoading) {
    return <LoadingSkeleton />;
  }
  
  // Not found state
  if (!trip) {
    return <NotFound />;
  }

  const tripTitle = trip?.tripData?.title || 'Reise';
  const tripDesc = trip?.tripData?.summary || 'Reisebericht auf MojoBus';

  return (
    <div className="min-h-screen py-8">
      <SEOHead
        title={tripTitle}
        description={tripDesc}
        url={canonicalUrl(tripUrl(naddr || ''))}
        type="article"
      />
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Back Button and Actions */}
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <Link to="/map/trips">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück zu Trips
              </Button>
            </Link>
            
            {/* Edit/Delete Buttons (only for author) */}
            {isAuthor && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/veroeffentlichen?type=trip&edit=${naddr}`)}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Bearbeiten
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Löschen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Trip löschen</AlertDialogTitle>
                      <AlertDialogDescription>
                        Bist du sicher, dass du diesen Trip löschen möchtest?
                        Diese Aktion kann nicht rückgängig gemacht werden.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Löschen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
          
          {/* Trip Header */}
          <div className="mb-8">
            <div className="flex items-start gap-4 mb-6">
              <Avatar className="h-12 w-12">
                <AvatarImage src={profileImage} alt={displayName} />
                <AvatarFallback>
                  {displayName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-3xl md:text-4xl font-bold mb-2">{trip.title}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <span className="font-medium">{displayName}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDistanceToNow(new Date(trip.createdAt * 1000), { addSuffix: true })}
                  </span>
                </div>
                
                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge 
                    variant="outline" 
                    className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300"
                  >
                    {trip.categoryEmoji} {trip.category?.charAt(0).toUpperCase() + trip.category?.slice(1)}
                  </Badge>
                  {distance > 0 && (
                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 border-blue-300">
                      <Navigation className="w-3 h-3 mr-1" />
                      {distance} km
                    </Badge>
                  )}
                  <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 border-green-300">
                    <Camera className="w-3 h-3 mr-1" />
                    {trip.photos.length} Photo{trip.photos.length !== 1 ? 's' : ''}
                  </Badge>
                  {trip.waypoints.length > 0 && (
                    <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 border-green-300">
                      <MapPin className="w-3 h-3 mr-1" />
                      {trip.waypoints.length} GPS-Punkt{trip.waypoints.length !== 1 ? 'e' : ''}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
          </div>

          {/* Route Map – ganz oben */}
          {trip.waypoints.length > 0 && (
            <Card className="mb-8">
              <CardContent className="p-0 overflow-hidden rounded-lg">
                <VanillaMap
                  center={[trip.waypoints[0].lat, trip.waypoints[0].lon]}
                  zoom={10}
                  minZoom={2}
                  maxZoom={18}
                  markers={mapMarkers}
                  polylines={mapPolylines}
                  height="420px"
                  fitToMarkers={true}
                />
              </CardContent>
            </Card>
          )}

          {/* Haupt-Content-Block: Zusammenfassung → Video → Stationen als Geschichte */}
          <Card>
            <CardContent className="pt-8 pb-8 space-y-10">

              {/* Zusammenfassung */}
              {trip.summary && (
                <div className="prose prose-lg dark:prose-invert max-w-none">
                  <p className="text-lg leading-relaxed whitespace-pre-wrap text-foreground">
                    {trip.summary}
                  </p>
                </div>
              )}

              {/* Video nach der Zusammenfassung */}
              {trip.video && (
                <div>
                  <video
                    src={trip.video}
                    controls
                    autoPlay={false}
                    loop
                    playsInline
                    className="w-full rounded-xl shadow-md"
                    style={{ maxHeight: '560px' }}
                    onError={(e) => {
                      (e.currentTarget as HTMLVideoElement).style.display = 'none';
                    }}
                  >
                    <source src={trip.video} type="video/mp4" />
                  </video>
                </div>
              )}

              {/* Stationen als fließende Geschichte */}
              {trip.waypoints.length > 0 && (
                <div className="space-y-12">
                  {trip.waypoints.map((waypoint, index) => {
                    const photoUrl = trip.photos[index];
                    if (!photoUrl) return null;
                    const optimizedUrl = generateImageUrl(photoUrl, 900, 700, 85);
                    const isEven = index % 2 === 0;

                    return (
                      <div key={index}>
                        {/* Trennlinie außer vor erstem Element */}
                        {index > 0 && (
                          <div className="border-t border-muted mb-12" />
                        )}

                        <div className={`flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} gap-6 md:gap-10 items-start`}>

                          {/* Bild */}
                          <div className="w-full md:w-1/2 flex-shrink-0">
                            <div className="relative overflow-hidden rounded-xl">
                              <img
                                src={optimizedUrl}
                                alt={waypoint.name || `Station ${index + 1}`}
                                className="w-full object-cover"
                                style={{ maxHeight: '400px' }}
                                loading="lazy"
                              />
                              {/* Stations-Nummer */}
                              <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-yellow-500 text-white flex items-center justify-center text-sm font-bold shadow">
                                {index + 1}
                              </div>
                            </div>
                          </div>

                          {/* Text */}
                          <div className="w-full md:w-1/2 flex flex-col justify-center space-y-3">
                            {waypoint.name && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                                <span>{waypoint.name}</span>
                                {waypoint.date && (
                                  <>
                                    <span>·</span>
                                    <span>{waypoint.date}</span>
                                  </>
                                )}
                              </div>
                            )}
                            {waypoint.description ? (
                              <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
                                {waypoint.description}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">
                                Keine Beschreibung.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </CardContent>
          </Card>

          {/* Comments */}
          {trip.event && (
            <div className="mt-8">
              <CommentsSection root={trip.event} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
