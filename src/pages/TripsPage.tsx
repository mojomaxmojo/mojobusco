/**
 * Trips Page
 *
 * Displays all published trips with route visualization
 * - World map at top showing all trip markers
 * - Trip cards grid below
 * - Hover highlights trip on map
 */

import { useMemo, useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTrips, calculateTripDistance, type Trip } from '@/hooks/useTrips';
import { useAuthor } from '@/hooks/useAuthor';
import { generateImageUrl } from '@/config/imageService';

// Generate a user name from pubkey
function genUserName(pubkey: string): string {
  return `user_${pubkey.slice(0, 8)}`;
}
import { VanillaMap, type MapMarker, type MapPolyline } from '@/components/VanillaMap';
import { 
  MapPin, RefreshCw, Map as MapIcon, Route, Camera, 
  Calendar, Globe, Navigation, Loader2
} from '@/lib/icons';
import { formatDistanceToNow } from 'date-fns';

/**
 * Trip Card Component
 */
function TripCard({ trip, onHover }: { trip: Trip; onHover?: (id: string | null) => void }) {
  const { data: authorData } = useAuthor(trip.author);
  const metadata = authorData?.metadata;
  
  const displayName = metadata?.name || genUserName(trip.author);
  const profileImage = metadata?.picture;
  
  const distance = trip.distance || calculateTripDistance(trip.waypoints);
  const gpsPoints = trip.waypoints.filter(w => w.lat && w.lon).length;
  
  // Optimize thumbnail URL via images.weserv.nl
  const optimizedThumbnail = trip.image ? generateImageUrl(trip.image, 400, 225, 85) : null;
  
  return (
    <Link 
      to={`/trip/${trip.naddr}`}
      onMouseEnter={() => onHover?.(trip.id)}
      onMouseLeave={() => onHover?.(null)}
      className="block"
    >
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group h-full">
        {/* Thumbnail */}
        {optimizedThumbnail ? (
          <div className="relative aspect-video overflow-hidden">
            <img
              src={optimizedThumbnail}
              alt={trip.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
              <Camera className="w-3 h-3 text-white" />
              <span className="text-xs text-white font-medium">{trip.photos.length}</span>
            </div>
          </div>
        ) : (
          <div className="aspect-video bg-muted flex items-center justify-center">
            <Camera className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        
        <CardContent className="p-4 space-y-3">
          {/* Author */}
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback>
                {displayName[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">{displayName}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDistanceToNow(new Date(trip.createdAt * 1000), { addSuffix: true })}
              </p>
            </div>
          </div>
          
          {/* Title */}
          <h3 className="font-semibold line-clamp-1">{trip.title}</h3>
          
          {/* Summary */}
          {trip.summary && (
            <p className="text-sm text-muted-foreground line-clamp-2">{trip.summary}</p>
          )}
          
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge 
              variant="outline" 
              className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 text-yellow-800 dark:text-yellow-200"
            >
              {trip.categoryEmoji} {trip.category?.charAt(0).toUpperCase() + trip.category?.slice(1)}
            </Badge>
            {distance > 0 && (
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 border-blue-300">
                <Navigation className="w-3 h-3 mr-1" />
                {distance} km
              </Badge>
            )}
            {gpsPoints > 0 && (
              <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 border-green-300">
                <MapPin className="w-3 h-3 mr-1" />
                GPS
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function TripSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-video w-full" />
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Main Trips Page Component
 */
export default function TripsPage() {
  const { data: trips = [], isLoading, error, refetch } = useTrips();
  const [hoveredTripId, setHoveredTripId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);
  const { ref, inView } = useInView({ threshold: 0.1, rootMargin: '200px' });

  useEffect(() => {
    if (inView) setVisibleCount(prev => prev + 30);
  }, [inView]);

  const visibleTrips = trips.slice(0, visibleCount);
  const hasMore = visibleTrips.length < trips.length;
  
  // Map markers from all trips
  const mapMarkers: MapMarker[] = useMemo(() => {
    return trips.flatMap(trip => 
      trip.waypoints.map((wp, idx) => ({
        id: `${trip.id}-${idx}`,
        lat: wp.lat,
        lng: wp.lon,
        title: wp.name,
        description: trip.title,
        isCurrent: false,
        type: 'trip' as const,
      }))
    );
  }, [trips]);
  
  // Map polylines from all trips
  const mapPolylines: MapPolyline[] = useMemo(() => {
    const colors = ['#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'];
    
    return trips.map((trip, idx) => {
      const isHovered = hoveredTripId === trip.id;
      const isDimmed = hoveredTripId && hoveredTripId !== trip.id;
      
      return {
        points: trip.waypoints.map(wp => [wp.lat, wp.lon] as [number, number]),
        color: isDimmed ? '#d1d5db' : colors[idx % colors.length],
        weight: isHovered ? 5 : 3,
        opacity: isDimmed ? 0.3 : 0.9,
      };
    });
  }, [trips, hoveredTripId]);
  
  // Stats
  const stats = useMemo(() => {
    const totalPhotos = trips.reduce((sum, t) => sum + t.photos.length, 0);
    const totalGpsPoints = trips.reduce((sum, t) => sum + t.waypoints.length, 0);
    const totalDistance = trips.reduce((sum, t) => sum + (t.distance ? parseInt(t.distance) : calculateTripDistance(t.waypoints)), 0);
    return { totalPhotos, totalGpsPoints, totalDistance };
  }, [trips]);
  
  // Handle loading state
  if (isLoading) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <Skeleton className="h-12 w-48 mb-2" />
              <Skeleton className="h-6 w-64" />
            </div>
            <Skeleton className="h-[400px] w-full rounded-lg mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <TripSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Handle error state
  if (error) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          <Card className="border-dashed p-8 max-w-md mx-auto">
            <div className="text-center space-y-6">
              <MapPin className="w-16 h-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-medium mb-2">Trips konnten nicht geladen werden</h3>
                <p className="text-muted-foreground">Bitte versuche es erneut.</p>
              </div>
              <Button onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Neu laden
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }
  
  // Handle empty state
  if (trips.length === 0) {
    return (
      <>
        {/* Page Header */}
        <section className="relative py-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
          <div className="relative z-10 container mx-auto px-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <MapPin className="w-8 h-8 text-yellow-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">🛣️ Trips</h1>
                <p className="text-muted-foreground">
                  Reise-Abenteuer mit Photos und GPS-Routen
                </p>
              </div>
            </div>
          </div>
        </section>
        
        <div className="container mx-auto px-4 py-8">
          <Card className="border-dashed p-8 max-w-md mx-auto">
            <div className="text-center space-y-6">
              <Route className="w-16 h-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-medium mb-2">Noch keine Trips vorhanden</h3>
                <p className="text-muted-foreground">
                  Es wurden noch keine Trips veröffentlicht.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </>
    );
  }
  
  return (
    <>
      {/* Page Header */}
      <section className="relative py-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
        
        <div className="relative z-10 container mx-auto px-4">
          <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <MapPin className="w-8 h-8 text-yellow-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">🛣️ Trips</h1>
                <p className="text-muted-foreground">
                  {trips.length} Reise-Abenteuer entdecken
                </p>
              </div>
            </div>
        </div>
      </section>
      
      <div className="container mx-auto px-4 pb-8 space-y-6">
        {/* World Map */}
        <Card className="overflow-hidden">
          <div className="p-4 bg-muted/50 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Travelers Around the World</h2>
                <p className="text-sm text-muted-foreground">
                  {stats.totalGpsPoints} GPS-Punkte in {trips.length} Trips
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          
          <div style={{ height: '400px' }}>
            <VanillaMap
              center={[20, 0]}
              zoom={2}
              minZoom={1}
              maxZoom={18}
              markers={mapMarkers}
              polylines={mapPolylines}
              height="400px"
              fitToMarkers={mapMarkers.length > 0}
            />
          </div>
        </Card>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{trips.length}</p>
            <p className="text-sm text-muted-foreground">Trips</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.totalPhotos}</p>
            <p className="text-sm text-muted-foreground">Photos</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.totalDistance.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">km gereist</p>
          </Card>
        </div>
        
        {/* Section Title */}
        <div>
          <h2 className="text-2xl font-bold">All Trips</h2>
          <p className="text-muted-foreground">Durchsuche Reise-Abenteuer der Community</p>
        </div>
        
        {/* Trip Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleTrips.map(trip => (
            <TripCard 
              key={trip.id} 
              trip={trip} 
              onHover={setHoveredTripId}
            />
          ))}
        </div>
        {hasMore && (
          <div ref={ref} className="py-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </>
  );
}
