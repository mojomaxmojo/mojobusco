/**
 * useTrips Hook
 *
 * Loads Trip events (Kind 30025) from Nostr
 * Parses waypoint tags and returns structured Trip data
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { nip19 } from 'nostr-tools';
import { DEFAULT_CACHE_CONFIG } from '@/config/cache';
import { FIRST_PAINT_CONFIG } from '@/config/performance';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Trip Waypoint - represents one station in a trip
 */
export interface TripWaypoint {
  /** Station number (1-based) */
  index: number;
  /** Latitude */
  lat: number;
  /** Longitude */
  lon: number;
  /** Location name */
  name: string;
  /** Date of visit */
  date?: string;
  /** Image URL */
  image?: string;
  /** Description */
  description?: string;
}

/**
 * Parse waypoint tag
 * Format: ['waypoint', index, lat, lon, name, date?, image?, description?]
 */
function parseWaypointTag(tag: string[]): TripWaypoint | null {
  if (tag[0] !== 'waypoint' || tag.length < 5) return null;

  const index = parseInt(tag[1]);
  const lat = parseFloat(tag[2]);
  const lon = parseFloat(tag[3]);
  const name = tag[4];
  const date = tag[5] || undefined;
  const image = tag[6] || undefined;
  const description = tag[7] || undefined;

  // Validate
  if (isNaN(index) || isNaN(lat) || isNaN(lon) || !name) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  return {
    index,
    lat,
    lon,
    name,
    date,
    image,
    description,
  };
}

/**
 * Trip - represents a complete trip with multiple waypoints
 */
export interface Trip {
  /** Event ID */
  id: string;
  /** Event coordinate (naddr) */
  naddr?: string;
  /** d-tag identifier */
  identifier?: string;
  /** Trip title */
  title: string;
  /** Trip summary */
  summary?: string;
  /** Cover image */
  image?: string;
  /** Trip type/category */
  category?: string;
  /** Trip type emoji */
  categoryEmoji?: string;
  /** Country */
  country?: string;
  /** Author pubkey */
  author: string;
  /** Created timestamp */
  createdAt: number;
  /** Distance */
  distance?: string;
  /** Distance unit */
  distanceUnit?: string;
  /** Waypoints (ordered) */
  waypoints: TripWaypoint[];
  /** All photos */
  photos: string[];
  /** Slideshow video URL (optional) */
  video?: string;
  /** Full event object */
  event: NostrEvent;
}

// Category emoji mapping
const CATEGORY_EMOJIS: Record<string, string> = {
  spaziergang: '🚶',
  radfahren: '🚴',
  roadtrip: '🚗',
  eisenbahn: '🚂',
  boot: '⛵',
  flug: '✈️',
  laufen: '🏃',
  wandern: '🥾',
  klettern: '🧗',
  walk: '🚶',
  hike: '🥾',
  cycling: '🚴',
  trip: '🗺️',
};

/**
 * Parse Trip event
 */
function parseTripEvent(event: NostrEvent): Trip | null {
  // Must be kind 30025
  if (event.kind !== 30025) return null;

  // Extract d-tag
  const identifier = event.tags.find(([name]) => name === 'd')?.[1];
  if (!identifier) return null;

  // Extract title
  const title = event.tags.find(([name]) => name === 'title')?.[1] ||
    event.tags.find(([name]) => name === 'd')?.[1] ||
    'Unbenannter Trip';

  // Extract summary
  const summary = event.tags.find(([name]) => name === 'summary')?.[1];

  // Extract cover image (first image tag or first waypoint image)
  const image = event.tags.find(([name]) => name === 'image')?.[1];

  // Extract category/trip type
  const category = event.tags.find(([name]) => name === 'trip_type')?.[1] ||
    event.tags.find(([name]) => name === 'category')?.[1] ||
    'trip';
  
  const categoryEmoji = CATEGORY_EMOJIS[category] || '🗺️';

  // Extract distance
  const distance = event.tags.find(([name]) => name === 'distance')?.[1];
  const distanceUnit = event.tags.find(([name]) => name === 'distance_unit')?.[1] || 'km';

  // Extract country
  const country = event.tags.find(([name]) => name === 'country')?.[1];

  // Parse waypoints
  const waypoints = event.tags
    .filter(([name]) => name === 'waypoint')
    .map(parseWaypointTag)
    .filter((w): w is TripWaypoint => w !== null)
    .sort((a, b) => a.index - b.index);

  // Get all photos
  const photos = event.tags
    .filter(([name]) => name === 'image')
    .map(tag => tag[1]);

  // Must have at least 1 photo
  if (photos.length === 0) return null;

  // Get slideshow video URL (optional)
  const video = event.tags.find(([name]) => name === 'video')?.[1];

  // Generate naddr
  let naddr: string | undefined;
  try {
    naddr = nip19.naddrEncode({
      kind: event.kind,
      pubkey: event.pubkey,
      identifier,
    });
  } catch (e) {
    console.warn('[Trip] Failed to encode naddr:', e);
  }

  return {
    id: event.id,
    naddr,
    identifier,
    title,
    summary,
    image,
    category,
    categoryEmoji,
    country,
    author: event.pubkey,
    createdAt: event.created_at,
    distance,
    distanceUnit,
    waypoints,
    photos,
    video,
    event,
  };
}

/**
 * Validate trip event - filter out placeholder content
 */
function validateTripEvent(event: NostrEvent): boolean {
  const title = event.tags.find(([name]) => name === 'title')?.[1] || '';
  const images = event.tags.filter(([name]) => name === 'image');
  
  if (images.length === 0) return false;
  
  // Filter placeholder content
  const lowerContent = (event.content || '').toLowerCase();
  const lowerTitle = title.toLowerCase();
  
  const placeholderKeywords = [
    'lorem ipsum',
    'placeholder',
    'template',
    'sample trip',
    'example trip',
    'test trip',
    'demo trip',
  ];
  
  return !placeholderKeywords.some(keyword => 
    lowerContent.includes(keyword) || lowerTitle.includes(keyword)
  );
}

/**
 * Hook to load all Trips from Nostr (Kind 30025)
 *
 * First-Paint-Strategie (Erstbesucher ohne Cache), zweistufig:
 * 1. FAST: kurzer Timeout (2s), kleines Limit – Relays liefern neueste Events
 *    zuerst, das reicht für die ersten Cards. Blockiert max. 2s.
 * 2. FULL: bisheriges Verhalten (10s, limit 100) lädt im Hintergrund nach
 *    und merged – blockiert niemals den First Paint.
 */
export function useTrips() {
  const { nostr } = useNostr();

  // Stufe 1: Fast-Query (First Paint)
  const fastQuery = useQuery({
    queryKey: ['trips', 'fast'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(FIRST_PAINT_CONFIG.firstPaintTimeout)]);

      const events = await nostr.query(
        [
          {
            kinds: [30025],
            limit: FIRST_PAINT_CONFIG.firstPaintLimit,
          },
        ],
        { signal }
      );

      return events
        .filter(validateTripEvent)
        .map(parseTripEvent)
        .filter((t): t is Trip => t !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    staleTime: DEFAULT_CACHE_CONFIG.lists.staleTime,
    gcTime: DEFAULT_CACHE_CONFIG.lists.gcTime,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false, // kein Retry – Geschwindigkeit zählt, Full-Query folgt
  });

  // Stufe 2: Full-Query (progressives Nachladen im Hintergrund)
  const fullQuery = useQuery({
    queryKey: ['trips'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);

      // Query for trip events (Kind 30025)
      const events = await nostr.query(
        [
          {
            kinds: [30025],
            limit: 100,
          },
        ],
        { signal }
      );

      console.log('🗺️ Trips: Loaded', events.length, 'events');

      // Parse, filter and sort trips
      const trips = events
        .filter(validateTripEvent)
        .map(parseTripEvent)
        .filter((t): t is Trip => t !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      console.log('✅ Trips: Parsed', trips.length, 'valid trips');

      return trips;
    },
    enabled: fastQuery.isFetched,
    staleTime: DEFAULT_CACHE_CONFIG.lists.staleTime,
    gcTime: DEFAULT_CACHE_CONFIG.lists.gcTime,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Merge: Fast + Full (Dedupe per Event-ID, neueste zuerst)
  const data = useMemo(() => {
    const fast = fastQuery.data ?? [];
    const full = fullQuery.data ?? [];
    if (full.length === 0) return fast;
    if (fast.length === 0) return full;

    const seen = new Map<string, Trip>();
    for (const trip of [...full, ...fast]) {
      seen.set(trip.id, trip);
    }
    return Array.from(seen.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [fastQuery.data, fullQuery.data]);

  return {
    ...fullQuery,
    data,
    // First-Paint: sobald die Fast-Query durch ist, gilt der Hook als geladen –
    // die Full-Query läuft bewusst nur im Hintergrund nach.
    isLoading: fastQuery.isLoading && data.length === 0,
  };
}

/**
 * Hook to load a single Trip by naddr
 */
export function useTrip(naddr: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['trip', naddr],
    queryFn: async (c) => {
      if (!naddr) return null;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);

      try {
        // Decode naddr
        const decoded = nip19.decode(naddr);
        
        if (decoded.type !== 'naddr') {
          throw new Error('Invalid naddr');
        }

        const { kind, pubkey, identifier } = decoded.data;

        // Query for the specific trip
        const events = await nostr.query(
          [
            {
              kinds: [kind],
              authors: [pubkey],
              '#d': [identifier],
              limit: 1,
            },
          ],
          { signal }
        );

        if (events.length === 0) return null;

        const event = events[0];
        
        if (!validateTripEvent(event)) return null;
        
        return parseTripEvent(event);
      } catch (error) {
        console.error('[Trip] Error fetching trip:', error);
        return null;
      }
    },
    enabled: !!naddr,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Get total distance of a trip (km)
 */
export function calculateTripDistance(waypoints: TripWaypoint[]): number {
  if (waypoints.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const from = waypoints[i - 1];
    const to = waypoints[i];
    totalDistance += calculateHaversineDistance(from.lat, from.lon, to.lat, to.lon);
  }

  return Math.round(totalDistance);
}

/**
 * Haversine formula for distance calculation
 */
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
