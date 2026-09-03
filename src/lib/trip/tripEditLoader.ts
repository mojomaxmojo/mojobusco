import type { TripWaypoint } from '@/hooks/useTrips';
import type { TripStation } from '@/lib/trip/tripTypes';
import type { GpsStatus } from '@/lib/gpsExtraction';

// Create stations from waypoints
export function mapWaypointsToStations(waypoints: TripWaypoint[]): TripStation[] {
  return waypoints.map((wp, index) => ({
    id: `existing-${index}`,
    file: null as unknown as File, // No file needed for existing images
    preview: wp.image || '',
    uploaded: true,
    uploadedUrl: wp.image || '',
    gps: {
      latitude: wp.lat,
      longitude: wp.lon,
      precision: 'medium' as const,
    },
    gpsStatus: 'detected' as GpsStatus,
    location: wp.name || '',
    title: wp.name || '',
    description: wp.description || '',
    date: wp.date || new Date().toISOString().split('T')[0],
  }));
}
