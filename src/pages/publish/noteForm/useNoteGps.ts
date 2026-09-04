/**
 * useNoteGps.ts — GPS-Logik des Note-Formulars (State imageGpsData/
 * imageGpsStatuses, GPS-Editor-Funktionen, Reverse-Geocoding-Automatik)
 * — 1:1 aus NoteForm.tsx verschoben (PLAN5.md Schritt 5). Reines
 * Verschieben, keine Logik-Änderungen.
 */

import { useState, useEffect } from "react";
import { reverseGeocode, mapCountryCode, type GpsData, type GpsStatus } from "@/lib/gpsExtraction";
import type { Dispatch, SetStateAction } from "react";

interface UseNoteGpsParams {
  selectedCountry: string;
  setLocation: Dispatch<SetStateAction<string>>;
  setSelectedCountry: Dispatch<SetStateAction<string>>;
}

export function useNoteGps({ selectedCountry, setLocation, setSelectedCountry }: UseNoteGpsParams) {
  const [imageGpsData, setImageGpsData] = useState<Record<number, GpsData>>({});
  const [imageGpsStatuses, setImageGpsStatuses] = useState<Record<number, GpsStatus>>({});
  const [editingGpsImage, setEditingGpsImage] = useState<number | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // GPS editing functions for Note Form
  const openGpsEditor = (imageIndex: number) => {
    setEditingGpsImage(imageIndex);
  };

  const closeGpsEditor = () => {
    setEditingGpsImage(null);
    setShowMapPicker(false);
  };

  const saveGps = async (imageIndex: number, gps: GpsData) => {
    // Save GPS data
    setImageGpsData(prev => ({
      ...prev,
      [imageIndex]: gps
    }));
    setImageGpsStatuses(prev => ({
      ...prev,
      [imageIndex]: 'manual'
    }));

    // Auto-fill location and country using reverse geocoding
    try {
      console.log('[Note GPS Manual] Reverse geocoding for manual GPS...', gps);
      const locationData = await reverseGeocode(gps.latitude, gps.longitude);
      if (locationData) {
        // Set location to city + neighbourhood/suburb (no postcode)
        const locationParts = [
          locationData.city,
          locationData.neighbourhood,
          locationData.suburb
        ].filter(Boolean);
        const loc = locationParts.join(', ');
        setLocation(loc);
        console.log('[Note GPS Manual] Location found:', loc);

        // Auto-fill country if detected
        const country = mapCountryCode(locationData);
        if (country) {
          setSelectedCountry(country);
          console.log('[Note GPS Manual] Country auto-filled:', country);
        }
      }
    } catch (error) {
      console.error('[Note GPS Manual] Reverse geocoding failed:', error);
    }

    closeGpsEditor();
  };

  const removeGps = (imageIndex: number) => {
    setImageGpsData(prev => {
      const { [imageIndex]: _, ...rest } = prev;
      return rest;
    });
    setImageGpsStatuses(prev => ({
      ...prev,
      [imageIndex]: 'not_found'
    }));
    closeGpsEditor();
  };

  // Auto-fill location and country from GPS data (first image)
  useEffect(() => {
      const autoFillLocation = async () => {
        // Use GPS from first image if available
        const firstGpsData = Object.values(imageGpsData)[0];

        if (firstGpsData) {
          console.log('[Note GPS] GPS detected, reverse geocoding...');
          const locationData = await reverseGeocode(firstGpsData.latitude, firstGpsData.longitude);
          if (locationData) {
            // Set location to city + neighbourhood/suburb (no postcode)
            const locationParts = [
              locationData.city,
              locationData.neighbourhood,
              locationData.suburb
            ].filter(Boolean);
            const loc = locationParts.join(', ');
            setLocation(loc);
            console.log('[Note GPS] Location found:', loc);

            // Auto-fill country if detected
            const country = mapCountryCode(locationData);
            if (country && !selectedCountry) {
              setSelectedCountry(country);
              console.log('[Note GPS] Country auto-filled:', country);
            }
          }
        }
      };

      autoFillLocation();
    }, [imageGpsData]);

  return {
    imageGpsData, imageGpsStatuses, setImageGpsData, setImageGpsStatuses,
    editingGpsImage, showMapPicker, setShowMapPicker,
    openGpsEditor, closeGpsEditor, saveGps, removeGps,
  };
}
