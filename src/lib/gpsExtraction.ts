/**
 * GPS Extraction from Image EXIF Data
 *
 * This module provides functions to extract GPS coordinates from image files
 * using the exifr library. Supports JPEG and other EXIF-enabled formats.
 * Includes support for XMP GPS data used by Google Camera (GCam).
 */

import exifr from 'exifr';

/**
 * GPS data structure extracted from image
 */
export interface GpsData {
  /** Latitude in decimal degrees (e.g., 37.7749) */
  latitude: number;
  /** Longitude in decimal degrees (e.g., -122.4194) */
  longitude: number;
  /** Altitude in meters (optional, if available in EXIF) */
  altitude?: number;
  /** GPS precision level based on available data */
  precision: 'high' | 'medium' | 'low';
}

/**
 * GPS status for tracking extraction state
 */
export type GpsStatus = 'detected' | 'not_found' | 'manual' | 'error';

/**
 * Extract GPS coordinates from an image file
 *
 * Supports multiple GPS data sources:
 * - Standard EXIF GPS tags
 * - XMP GPS metadata (used by Google Camera/Google Photos)
 * - Android-specific GPS tags
 *
 * @param file - Image file to extract GPS from
 * @returns Promise with GPS data or null if no GPS found
 *
 * @example
 * ```typescript
 * const gps = await extractGpsFromImage(imageFile);
 * if (gps) {
 *   console.log(`Lat: ${gps.latitude}, Lon: ${gps.longitude}`);
 * }
 * ```
 */
export async function extractGpsFromImage(file: File): Promise<GpsData | null> {
  try {
    console.log('[GPS Extraction] Starting extraction for:', file.name);
    console.log('[GPS Extraction] File type:', file.type);
    console.log('[GPS Extraction] File size:', file.size, 'bytes');
    
    // Mobile Detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log('[GPS Extraction] Device type:', isMobile ? 'Mobile' : 'Desktop');

    // Check if file is an image type that supports EXIF
    if (!file.type.match(/^image\/(jpeg|jpg|tiff|heic|heif)$/i)) {
      console.log('[GPS Extraction] File type might not support EXIF:', file.type, '- trying anyway...');
    }

    console.log('[GPS Extraction] File type supported, extracting EXIF...');

    // === METHOD 1: Try exifr.gps() (standard EXIF GPS) ===
    let exifData;
    try {
      exifData = await exifr.gps(file, {
        exif: true,
        xmp: true,
        iptc: true,
      });
      console.log('[GPS Extraction] Method 1 - exifr.gps() result:', exifData);
    } catch (e1) {
      console.warn('[GPS Extraction] Method 1 failed:', e1);
    }

    // Check for valid GPS data from method 1
    if (exifData && exifData.latitude && exifData.longitude) {
      const latitude = exifData.latitude;
      const longitude = exifData.longitude;

      if (latitude !== 0 || longitude !== 0) {
        console.log('[GPS Extraction] ✓ Valid GPS from exifr.gps():', { latitude, longitude });
        return createGpsResult(latitude, longitude, exifData.altitude, file.name);
      }
    }

    // === METHOD 2: Try full EXIF parse with all options ===
    console.log('[GPS Extraction] Method 1 no GPS, trying full EXIF parse...');
    let fullExif;
    try {
      fullExif = await exifr.parse(file, {
        xmp: true,
        exif: true,
        gps: true,
        iptc: true,
        mergeOutput: false,
        chunked: true,  // Better for large files
      });
    } catch (e2) {
      console.warn('[GPS Extraction] Full parse failed:', e2);
    }

    console.log('[GPS Extraction] Method 2 - Full EXIF keys:', Object.keys(fullExif || {}));

    // Check exif sub-object if exists
    const exifBlock = fullExif?.exif || fullExif;
    const gpsBlock = fullExif?.gps || fullExif?.GPS;

    // XMP GPS tags
    const xmpLat = fullExif?.GPSLatitude ||
                   fullExif?.['GPS:Latitude'] ||
                   fullExif?.latitude ||
                   fullExif?.Latitude ||
                   exifBlock?.GPSLatitude;
                   
    const xmpLon = fullExif?.GPSLongitude ||
                   fullExif?.['GPS:Longitude'] ||
                   fullExif?.longitude ||
                   fullExif?.Longitude ||
                   exifBlock?.GPSLongitude;

    if (xmpLat && xmpLon && (xmpLat !== 0 || xmpLon !== 0)) {
      console.log('[GPS Extraction] ✓ Valid GPS from XMP/EXIF block:', { xmpLat, xmpLon });
      return createGpsResult(xmpLat, xmpLon, exifBlock?.GPSAltitude, file.name);
    }

    // === METHOD 3: Try raw EXIF with DMS conversion ===
    console.log('[GPS Extraction] Method 2 failed, trying raw GPS tags...');
    
    // GPS might be in different places
    const gpsLat = gpsBlock?.GPSLatitude || exifBlock?.GPSLatitude;
    const gpsLon = gpsBlock?.GPSLongitude || exifBlock?.GPSLongitude;
    const gpsLatRef = gpsBlock?.GPSLatitudeRef || exifBlock?.GPSLatitudeRef || 'N';
    const gpsLonRef = gpsBlock?.GPSLongitudeRef || exifBlock?.GPSLongitudeRef || 'E';

    console.log('[GPS Extraction] Raw GPS:', { gpsLat, gpsLon, gpsLatRef, gpsLonRef });

    if (gpsLat && gpsLon) {
      // Check if array (DMS format) or number (decimal)
      if (Array.isArray(gpsLat) && Array.isArray(gpsLon)) {
        const isLatZero = gpsLat.every((v: any) => v === 0);
        const isLonZero = gpsLon.every((v: any) => v === 0);

        if (!isLatZero || !isLonZero) {
          try {
            const latitude = convertDMSToDD(gpsLat, gpsLatRef);
            const longitude = convertDMSToDD(gpsLon, gpsLonRef);

            console.log('[GPS Extraction] ✓ Valid GPS from DMS:', { latitude, longitude });
            return createGpsResult(latitude, longitude, gpsBlock?.GPSAltitude || exifBlock?.GPSAltitude, file.name);
          } catch (convertError) {
            console.warn('[GPS Extraction] DMS conversion failed:', convertError);
          }
        }
      } else if (typeof gpsLat === 'number' && typeof gpsLon === 'number') {
        if (gpsLat !== 0 || gpsLon !== 0) {
          console.log('[GPS Extraction] ✓ Valid GPS from decimal:', { gpsLat, gpsLon });
          return createGpsResult(gpsLat, gpsLon, gpsBlock?.GPSAltitude || exifBlock?.GPSAltitude, file.name);
        }
      }
    }

    // === METHOD 4: ArrayBuffer fallback (better for mobile) ===
    console.log('[GPS Extraction] Method 3 failed, trying ArrayBuffer fallback...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const exifFromArray = await exifr.parse(arrayBuffer, {
        xmp: true,
        exif: true,
        gps: true,
      });
      
      console.log('[GPS Extraction] ArrayBuffer EXIF keys:', Object.keys(exifFromArray || {}));
      
      if (exifFromArray?.latitude && exifFromArray?.longitude) {
        if (exifFromArray.latitude !== 0 || exifFromArray.longitude !== 0) {
          console.log('[GPS Extraction] ✓ Valid GPS from ArrayBuffer:', exifFromArray);
          return createGpsResult(exifFromArray.latitude, exifFromArray.longitude, exifFromArray.altitude, file.name);
        }
      }
    } catch (arrayError) {
      console.warn('[GPS Extraction] ArrayBuffer method failed:', arrayError);
    }

    // === METHOD 5: Try with chunked reading for large files ===
    if (file.size > 5 * 1024 * 1024) { // > 5MB
      console.log('[GPS Extraction] Large file detected, trying chunked read...');
      try {
        // Read first 128KB which usually contains EXIF
        const chunk = file.slice(0, 128 * 1024);
        const chunkExif = await exifr.parse(chunk, {
          xmp: true,
          exif: true,
          gps: true,
        });
        
        if (chunkExif?.latitude && chunkExif?.longitude) {
          if (chunkExif.latitude !== 0 || chunkExif.longitude !== 0) {
            console.log('[GPS Extraction] ✓ Valid GPS from chunk:', chunkExif);
            return createGpsResult(chunkExif.latitude, chunkExif.longitude, chunkExif.altitude, file.name);
          }
        }
      } catch (chunkError) {
        console.warn('[GPS Extraction] Chunked read failed:', chunkError);
      }
    }

    console.log('[GPS Extraction] ✗ No valid GPS found in any method');
    return null;

  } catch (error) {
    console.error('[GPS Extraction] Error:', error);
    return null;
  }
}

/**
 * Create GPS result object from extracted coordinates
 */
function createGpsResult(
  latitude: number,
  longitude: number,
  altitude?: number | null,
  filename?: string
): GpsData {
  const precision: 'high' | 'medium' | 'low' = altitude !== undefined && altitude !== null ? 'high' : 'medium';

  const result: GpsData = {
    latitude,
    longitude,
    precision,
  };

  if (altitude !== undefined && altitude !== null) {
    result.altitude = parseFloat(String(altitude));
  }

  console.log('[GPS Extraction] Successfully extracted GPS:', {
    latitude: result.latitude,
    longitude: result.longitude,
    altitude: result.altitude,
    precision: result.precision,
    filename: filename || 'unknown',
  });

  return result;
}

/**
 * Convert GPS DMS (Degrees, Minutes, Seconds) to Decimal Degrees (DD)
 *
 * @param dms - GPS coordinate in DMS format from EXIF [degrees, minutes, seconds]
 * @param ref - Hemisphere reference ('N', 'S', 'E', 'W')
 * @returns Decimal degrees
 *
 * EXIF stores GPS as separate arrays and refs:
 * - GPSLatitude: [degrees, minutes, seconds]
 * - GPSLatitudeRef: 'N' or 'S'
 * - GPSLongitude: [degrees, minutes, seconds]
 * - GPSLongitudeRef: 'E' or 'W'
 */
function convertDMSToDD(dms: any, ref: 'N' | 'S' | 'E' | 'W'): number {
  if (!Array.isArray(dms)) {
    console.warn('[GPS] DMS is not an array:', dms);
    throw new Error('DMS is not an array');
  }

  console.log('[GPS] Converting DMS:', {
    dms,
    ref,
    dmsType: typeof dms,
    dmsLength: dms.length
  });

  // Handle different DMS formats
  // Some EXIF data has [degrees, minutes, seconds] as numbers
  // Others have [[degrees, 1], [minutes, 1], [seconds, 1]] as rationals
  const parseValue = (val: any): number => {
    if (typeof val === 'number') return val;
    if (Array.isArray(val) && val.length >= 2) {
      // Rational format: [numerator, denominator]
      return parseFloat(val[0]) / parseFloat(val[1] || 1);
    }
    return parseFloat(val) || 0;
  };

  const degrees = parseValue(dms[0]);
  const minutes = parseValue(dms[1] || 0);
  const seconds = parseValue(dms[2] || 0);

  // Validate values
  if (isNaN(degrees) || degrees === 0) {
    console.error('[GPS] Degrees is NaN or zero:', dms[0], '->', degrees);
    throw new Error('Degrees is NaN or zero');
  }

  console.log('[GPS] Parsed DMS:', { degrees, minutes, seconds });

  let dd = degrees + minutes / 60 + seconds / 3600;

  // Adjust for hemisphere
  if (ref === 'S' || ref === 'W') {
    dd = -dd;
  }

  console.log('[GPS] Final DD:', { dd, ref });

  return dd;
}

/**
 * Validate GPS coordinates
 *
 * @param latitude - Latitude in decimal degrees
 * @param longitude - Longitude in decimal degrees
 * @returns True if coordinates are valid
 */
function isValidCoordinate(latitude: number, longitude: number): boolean {
  // Latitude must be between -90 and 90
  if (latitude < -90 || latitude > 90) {
    return false;
  }

  // Longitude must be between -180 and 180
  if (longitude < -180 || longitude > 180) {
    return false;
  }

  // Check for NaN
  if (isNaN(latitude) || isNaN(longitude)) {
    return false;
  }

  // Check for 0,0 coordinates (Null Island - likely extraction error)
  // Real photos at exactly 0,0 are extremely rare
  if (latitude === 0 && longitude === 0) {
    return false;
  }

  return true;
}

/**
 * Format GPS coordinates for display
 *
 * @param latitude - Latitude in decimal degrees
 * @param longitude - Longitude in decimal degrees
 * @returns Formatted coordinate string (e.g., "37.7749° N, 122.4194° W")
 *
 * @example
 * ```typescript
 * const formatted = formatCoordinates(37.7749, -122.4194);
 * // Returns: "37.7749° N, 122.4194° W"
 * ```
 */
export function formatCoordinates(latitude: number, longitude: number): string {
  const latDirection = latitude >= 0 ? 'N' : 'S';
  const lonDirection = longitude >= 0 ? 'E' : 'W';

  const absLat = Math.abs(latitude);
  const absLon = Math.abs(longitude);

  return `${absLat.toFixed(4)}° ${latDirection}, ${absLon.toFixed(4)}° ${lonDirection}`;
}

/**
 * Format GPS coordinates for input fields (simple decimal format)
 *
 * @param latitude - Latitude in decimal degrees
 * @param longitude - Longitude in decimal degrees
 * @returns Simple coordinate string (e.g., "37.7749, -122.4194")
 */
export function formatCoordinatesSimple(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

/**
 * Reverse geocode GPS coordinates to location information
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 *
 * @param latitude - Latitude in decimal degrees
 * @param longitude - Longitude in decimal degrees
 * @returns Promise with location data (city, country, full address)
 *
 * @example
 * ```typescript
 * const location = await reverseGeocode(37.7749, -122.4194);
 * console.log(location.city); // "San Francisco"
 * console.log(location.country); // "United States"
 * ```
 */
export interface LocationData {
  /** City, town, or village name */
  city?: string;
  /** Country name */
  country?: string;
  /** ISO country code (e.g., 'PT', 'ES') */
  countryCode?: string;
  /** Full formatted address */
  fullAddress?: string;
  /** Display name from Nominatim */
  display_name?: string;
  /** Suburb or district (for more precision) */
  suburb?: string;
  /** Neighborhood or quarter (very precise) */
  neighbourhood?: string;
  /** County or region */
  county?: string;
  /** Postal code */
  postcode?: string;
  /** First 3 parts of address (e.g., "Beach Name, Street Name, Suburb") */
  specificLocation?: string;
}

// Geocoding cache for performance optimization
const geocodeCache = new Map<string, LocationData>();
const CACHE_MAX_SIZE = 100; // Max entries in cache to prevent memory bloat

/**
 * Generate cache key from coordinates (rounded to 4 decimal places)
 * This provides ~11m precision which is sufficient for city-level geocoding
 */
function getCacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

/**
 * Clean up old cache entries when cache exceeds max size
 */
function cleanupCache() {
  if (geocodeCache.size > CACHE_MAX_SIZE) {
    // Remove oldest entries (first half of cache)
    const entries = Array.from(geocodeCache.entries());
    for (let i = 0; i < entries.length / 2; i++) {
      geocodeCache.delete(entries[i][0]);
    }
    console.log('[Geocode Cache] Cleaned up, size:', geocodeCache.size);
  }
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<LocationData | null> {
  const cacheKey = getCacheKey(latitude, longitude);

  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    console.log('[Geocode Cache] Cache hit for:', cacheKey);
    return geocodeCache.get(cacheKey)!;
  }

  try {
    // Rate limiting: Nominatim allows 1 request per second
    // User-Agent header is required by Nominatim policy
    // zoom=18 for maximum precision (street level)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=de,en`,
      {
        headers: {
          'User-Agent': 'MojoBus/1.0 (nostr:npub1f4vym2mu3q9fsz08muz8d469hl568l5358qx90qlaspyuz67ru0sfxvupf)'
        }
      }
    );

    if (!response.ok) {
      console.warn('[Reverse Geocoding] API request failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    // Extract relevant location information
    const address = data.address || {};
    const display_name = data.display_name || '';
    
    // Extract first 3 parts of the address (most specific location)
    // Example: "Rocha Baixinha Beach, Avenida Comendador André Jordan, Vilamoura, Quarteira, ..."
    // -> "Rocha Baixinha Beach, Avenida Comendador André Jordan, Vilamoura"
    let specificLocation = '';
    if (display_name) {
      const parts = display_name.split(',').map((p: string) => p.trim()).filter(Boolean);
      specificLocation = parts.slice(0, 3).join(', ');
      console.log('[Reverse Geocoding] Specific location (first 3 parts):', specificLocation);
    }
    
    const locationData: LocationData = {
      // Try to get most specific locality name
      city: address.city ||
            address.town ||
            address.village ||
            address.suburb ||
            address.hamlet ||
            address.locality,
      country: address.country,
      countryCode: address.country_code?.toUpperCase(),
      county: address.county,
      suburb: address.suburb,
      neighbourhood: address.neighbourhood,
      postcode: address.postcode,
      fullAddress: display_name,
      display_name: display_name,
      specificLocation
    };

    console.log('[Reverse Geocoding] Location found:', locationData);

    // Cache the result
    geocodeCache.set(cacheKey, locationData);
    cleanupCache();

    return locationData;
  } catch (error) {
    console.error('[Reverse Geocoding] Error:', error);
    return null;
  }
}

/**
 * Extract country code from location data and map to our internal country codes
 *
 * @param location - Location data from reverse geocoding
 * @returns Internal country code (e.g., 'portugal', 'spanien') or null
 */
export function mapCountryCode(location: LocationData | null): string | null {
  if (!location?.countryCode) return null;

  // Map ISO country codes to internal country codes
  const countryMapping: Record<string, string> = {
    PT: 'portugal',
    ES: 'spanien',
    FR: 'frankreich',
    BE: 'belgien',
    DE: 'deutschland',
    LU: 'luxemburg',
  };

  return countryMapping[location.countryCode.toUpperCase()] || null;
}
