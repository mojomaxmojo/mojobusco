/**
 * usePlaceGpsAutoFill.ts — GPS-Auto-Fill (Reverse-Geocoding) des
 * Ort-Formulars — 1:1 aus PlaceForm.tsx verschoben (PLAN4.md Schritt 6).
 * Reines Verschieben, keine Logik-Änderungen.
 */

import { useEffect } from "react";
import { reverseGeocode, mapCountryCode, type GpsData } from "@/lib/gpsExtraction";
import type { Dispatch, SetStateAction } from "react";

interface UsePlaceGpsAutoFillParams {
  imageGps: GpsData | null;
  selectedCountry: string;
  setLocation: (v: string) => void;
  setCoordinates: Dispatch<SetStateAction<{ lat: string; lng: string }>>;
  setSelectedCountry: (v: string) => void;
}

export function usePlaceGpsAutoFill({
  imageGps,
  selectedCountry,
  setLocation,
  setCoordinates,
  setSelectedCountry,
}: UsePlaceGpsAutoFillParams) {
    // Auto-fill location and country from GPS data
   useEffect(() => {
     const autoFillLocation = async () => {
       if (imageGps) {
         console.log('[Place GPS] GPS detected, reverse geocoding...');
         const locationData = await reverseGeocode(imageGps.latitude, imageGps.longitude);
         if (locationData) {
           // Set location to city + neighbourhood/suburb (no postcode)
           const locationParts = [
             locationData.city,
             locationData.neighbourhood,
             locationData.suburb
           ].filter(Boolean);
           const loc = locationParts.join(', ');
           setLocation(loc);
           console.log('[Place GPS] Location found:', loc);

           // Also set coordinates
           setCoordinates({ lat: imageGps.latitude.toString(), lng: imageGps.longitude.toString() });

           // Auto-fill country if detected
           const country = mapCountryCode(locationData);
           if (country && !selectedCountry) {
             setSelectedCountry(country);
             console.log('[Place GPS] Country auto-filled:', country);
           }
         }
       }
     };

      autoFillLocation();
    }, [imageGps]);
}
