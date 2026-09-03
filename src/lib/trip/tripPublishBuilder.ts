import { calculateDistance } from '@/lib/trip/tripGeoUtils';
import type { TripStation, TripData } from '@/lib/trip/tripTypes';
import { getCountryTag } from '@/components/CountrySelector';

// Build waypoint tags (for route visualization)
// Format: ['waypoint', index, lat, lon, name, date, image, description]
export function buildWaypointTags(gpsStations: TripStation[]): string[][] {
  return gpsStations.map((s, index) => [
    'waypoint',
    (index + 1).toString(),
    s.gps!.latitude.toString(),
    s.gps!.longitude.toString(),
    s.title || s.location || `Station ${index + 1}`,
    s.date || '',
    s.uploadedUrl!,
    s.description || ''
  ]);
}

// Build image tags (with GPS for map display) - mojotravel format
export function buildImageTags(uploadedStations: TripStation[]): string[][] {
  return uploadedStations
    .filter(s => s.uploadedUrl)
    .map((s, index) => {
      if (s.gps) {
        return ['image', s.uploadedUrl!, s.gps.latitude.toString(), s.gps.longitude.toString(), s.date || ''];
      }
      return ['image', s.uploadedUrl!];
    });
}

// Calculate total distance
export function calculateTotalDistance(gpsStations: TripStation[]): number {
  let totalDistance = 0;
  for (let i = 1; i < gpsStations.length; i++) {
    const prev = gpsStations[i - 1];
    const curr = gpsStations[i];
    totalDistance += calculateDistance(
      prev.gps!.latitude, prev.gps!.longitude,
      curr.gps!.latitude, curr.gps!.longitude
    );
  }
  return totalDistance;
}

// Build station content
export function buildTripContent(uploadedStations: TripStation[], tripData: TripData): string {
  const stationContent = uploadedStations
    .filter(s => s.uploadedUrl)
    .map((s, index) => {
      let content = `## Station ${index + 1}: ${s.title || s.location || 'Unbenannt'}\n\n`;
      if (s.description) content += `${s.description}\n\n`;
      content += `![${s.title || `Station ${index + 1}`}](${s.uploadedUrl})\n`;
      return content;
    })
    .join('\n---\n\n');

  return `# ${tripData.title}\n\n${tripData.summary}\n\n${stationContent}`;
}

// Build tags
export function buildTripTags(
  dTag: string,
  tripData: TripData,
  waypointTags: string[][],
  imageTags: string[][],
  totalDistance: number,
  slideshowVideoUrl: string | null
): string[][] {
  const tags: string[][] = [
    ['d', dTag],
    ['title', tripData.title],
    ['summary', tripData.summary],
    ['type', 'trip'],
    ['t', 'trip'],
    ['t', 'mojobus'],
    ...waypointTags,
    ...imageTags,
  ];

  // Add distance
  if (totalDistance > 0) {
    tags.push(['distance', Math.round(totalDistance).toString()]);
    tags.push(['distance_unit', 'km']);
  }

  // Add trip type tag
  if (tripData.tripType) {
    tags.push(['t', tripData.tripType]);
    tags.push(['trip_type', tripData.tripType]);
    tags.push(['category', tripData.tripType]);
  }

  // Add country tags
  if (tripData.country) {
    const countryTags = getCountryTag(tripData.country);
    countryTags.forEach(tag => tags.push(['t', tag]));
    tags.push(['country', tripData.country]);
  }

  // Slideshow-Video URL einbinden (wenn generiert)
  if (slideshowVideoUrl) {
    tags.push(['video', slideshowVideoUrl]);
    console.log('[Trip Publish] Slideshow-Video wird eingebunden:', slideshowVideoUrl);
  }

  return tags;
}
