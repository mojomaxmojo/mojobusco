/**
 * useTripGpsFill.ts – GPS-Speichern/Entfernen, Station-Feldupdates,
 * Auto-Fill (Reverse-Geocoding) und Karten-Marker
 * aus TripPublishForm.tsx (1:1 verschoben, PLAN6 Schritt 19).
 */

import { useEffect, useMemo } from 'react'
import { reverseGeocode, mapCountryCode, type GpsData, type GpsStatus } from '@/lib/gpsExtraction'
import type { MapMarker } from '@/components/VanillaMap'
import type { TripStation, TripData } from '@/lib/trip/tripTypes'

export function useTripGpsFill({
  stations,
  setStations,
  tripData,
  setTripData,
  setEditingStation,
  setShowMapPicker,
}: {
  stations: TripStation[]
  setStations: React.Dispatch<React.SetStateAction<TripStation[]>>
  tripData: TripData
  setTripData: React.Dispatch<React.SetStateAction<TripData>>
  setEditingStation: (v: string | null) => void
  setShowMapPicker: (v: boolean) => void
}) {
  // GPS editing
  const saveGps = async (stationId: string, gps: GpsData) => {
    // Update station
    setStations(prev => prev.map(s =>
      s.id === stationId
        ? { ...s, gps, gpsStatus: 'manual' as GpsStatus }
        : s
    ));

    // Reverse geocode for location
    try {
      const locationData = await reverseGeocode(gps.latitude, gps.longitude);
      if (locationData) {
        // Use specificLocation (first 3 parts of address) for more precision
        const loc = locationData.specificLocation ||
                    locationData.display_name?.split(',').slice(0, 3).join(', ') ||
                    [locationData.city, locationData.suburb].filter(Boolean).join(', ');

        setStations(prev => prev.map(s =>
          s.id === stationId
            ? { ...s, location: loc, title: s.title || loc }
            : s
        ));

        // Also update country if not set
        const country = mapCountryCode(locationData);
        if (country && !tripData.country) {
          setTripData(prev => ({ ...prev, country }));
        }
      }
    } catch (error) {
      console.error('[Trip GPS] Reverse geocoding failed:', error);
    }

    setEditingStation(null);
    setShowMapPicker(false);
  };

  const removeGps = (stationId: string) => {
    setStations(prev => prev.map(s => {
      if (s.id === stationId) {
        const updated = { ...s };
        delete updated.gps;
        updated.gpsStatus = 'not_found';
        delete (updated as { location?: string }).location;
        return updated;
      }
      return s;
    }));
    setEditingStation(null);
    setShowMapPicker(false);
  };

  // Update station fields
  const updateStation = (id: string, field: keyof TripStation, value: string) => {
    setStations(prev => prev.map(s =>
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  // Auto-fill trip metadata from first station
  useEffect(() => {
    const autoFill = async () => {
      const firstStationWithGps = stations.find(s => s.gps && s.gpsStatus === 'detected');
      if (firstStationWithGps?.gps && !tripData.country) {
        const locationData = await reverseGeocode(
          firstStationWithGps.gps.latitude,
          firstStationWithGps.gps.longitude
        );
        if (locationData) {
          const locationParts = [
            locationData.city,
            locationData.neighbourhood,
            locationData.suburb
          ].filter(Boolean);

          const loc = locationParts.join(', ');
          const country = mapCountryCode(locationData);

          // Update station with location
          setStations(prev => prev.map(s =>
            s.id === firstStationWithGps.id
              ? { ...s, location: loc }
              : s
          ));

          // Update trip data
          if (country && !tripData.country) {
            setTripData(prev => ({ ...prev, country }));
          }

          // Auto-generate title if empty
          if (!tripData.title && loc) {
            setTripData(prev => ({
              ...prev,
              title: `Trip nach ${loc}`,
              summary: `Eine Reise durch ${loc} und Umgebung.`
            }));
          }
        }
      }
    };

    autoFill();
  }, [stations, tripData.country, tripData.title]);

  // Calculate map markers
  const mapMarkers: MapMarker[] = useMemo(() => {
    return stations
      .filter(s => s.gps)
      .map((s, index) => ({
        id: s.id,
        lat: s.gps!.latitude,
        lng: s.gps!.longitude,
        title: s.title || s.location || `Station ${index + 1}`,
        description: s.location,
        isCurrent: false,
      }));
  }, [stations]);

  // Count stations with GPS
  const stationsWithGps = useMemo(() =>
    stations.filter(s => s.gps).length,
  [stations]);

  return {
    saveGps,
    removeGps,
    updateStation,
    mapMarkers,
    stationsWithGps,
  }
}