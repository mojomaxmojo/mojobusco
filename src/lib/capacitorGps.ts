/**
 * Capacitor Native GPS & EXIF Abstraktion
 *
 * Erkennt zur Laufzeit ob die App im Capacitor-WebView läuft
 * und nutzt dann native Plugins für EXIF-GPS + Geräte-Standort.
 *
 * Falls Capacitor nicht verfügbar ist (Web), Fallback auf
 * navigator.geolocation + bestehende exifr-Logik.
 *
 * Plugins (auf CachyOS installiert):
 *   - @capacitor/geolocation     → GPS natives Geräte-GPS
 *   - @capacitor-community/exif  → Native EXIF inkl. GPS aus Bildern
 *   - @capawesome/capacitor-file-picker → Native Dateiauswahl
 */

import type { GpsData } from './gpsExtraction';

// =============================================================================
// Plattform-Erkennung
// =============================================================================

/**
 * Prüft ob die App im Capacitor Native WebView läuft
 */
export function isCapacitorNative(): boolean {
  try {
    const cap = (window as any).Capacitor;
    return !!(cap && cap.isNative);
  } catch {
    return false;
  }
}

/**
 * Prüft ob ein bestimmtes Capacitor-Plugin registriert ist
 */
function hasCapacitorPlugin(pluginName: string): boolean {
  try {
    const cap = (window as any).Capacitor;
    return !!(cap && cap.Plugins && cap.Plugins[pluginName]);
  } catch {
    return false;
  }
}

// =============================================================================
// Native EXIF-GPS via @capacitor-community/exif
// =============================================================================

/**
 * Extrahiert GPS aus einem Bild via Capacitor-Community EXIF Plugin (nativ).
 *
 * Im Gegensatz zu exifr.js umgeht dieses Plugin den Browser-Filter,
 * der auf mobilen Geräten EXIF-GPS aus Sicherheitsgründen entfernt.
 * Es liest die EXIF-Daten direkt aus der Datei via Java/Kotlin-Code.
 *
 * @param file - Das vom Benutzer ausgewählte Bild
 * @returns GpsData oder null wenn kein GPS gefunden
 */
export async function extractGpsNativeExif(file: File): Promise<GpsData | null> {
  if (!isCapacitorNative()) {
    return null;
  }

  if (!hasCapacitorPlugin('Exif')) {
    console.warn('[CapacitorGPS] @capacitor-community/exif nicht registriert');
    return null;
  }

  try {
    const CapacitorExif = (window as any).Capacitor.Plugins.Exif;
    console.log('[CapacitorGPS] Native EXIF extraction für:', file.name);

    // Datei in eine URI umwandeln, die das native Plugin lesen kann
    const fileUri = URL.createObjectURL(file);

    const result = await CapacitorExif.getExifData({ uri: fileUri });
    URL.revokeObjectURL(fileUri);

    if (!result?.exifData) {
      console.log('[CapacitorGPS] Keine EXIF-Daten vom nativen Plugin');
      return null;
    }

    const exif = result.exifData;
    console.log('[CapacitorGPS] Native EXIF keys:', Object.keys(exif));

    // GPS aus EXIF parsen
    const gpsResult = parseNativeExifGps(exif);
    if (gpsResult) {
      console.log('[CapacitorGPS] ✓ GPS via nativem EXIF Plugin:', gpsResult);
      return gpsResult;
    }

    return null;
  } catch (error) {
    console.warn('[CapacitorGPS] Native EXIF extraction fehlgeschlagen:', error);
    return null;
  }
}

/**
 * Parst GPS-Koordinaten aus nativen EXIF-Daten
 *
 * Das @capacitor-community/exif Plugin liefert GPS in verschiedenen Formaten:
 * - "37.7749" (decimal)
 * - "37/1, 46/1, 12345/1000" (DMS als Fraction-String)
 * - { numerator, denominator } Objekt
 */
interface NativeExifData {
  GPSLatitude?: any;
  GPSLatitudeRef?: string;
  GPSLongitude?: any;
  GPSLongitudeRef?: string;
  GPSAltitude?: any;
  [key: string]: any;
}

function parseNativeExifGps(exif: NativeExifData): GpsData | null {
  const lat = exif.GPSLatitude;
  const lon = exif.GPSLongitude;
  const latRef = exif.GPSLatitudeRef || 'N';
  const lonRef = exif.GPSLongitudeRef || 'E';

  if (!lat && !lon) return null;

  const latitude = parseExifCoordinate(lat, latRef);
  const longitude = parseExifCoordinate(lon, lonRef);

  if (latitude === null || longitude === null) return null;
  if (latitude === 0 && longitude === 0) return null;

  // Höhe (Altitude) parsen
  let altitude: number | undefined;
  if (exif.GPSAltitude !== undefined && exif.GPSAltitude !== null) {
    altitude = parseExifValue(exif.GPSAltitude);
  }

  return {
    latitude,
    longitude,
    altitude: altitude && !isNaN(altitude) ? altitude : undefined,
    precision: altitude !== undefined ? 'high' : 'medium',
  };
}

/**
 * Parst einen einzelnen GPS-Koordinatenwert aus EXIF
 *
 * Unterstützt:
 * - Zahl: "37.7749" → 37.7749
 * - DMS-Fraction: "37/1, 46/1, 12345/1000" → 37.774...
 * - DMS-Array: ["37/1", "46/1", "12345/1000"]
 * - Objekt: { numerator: 37, denominator: 1 }
 */
function parseExifCoordinate(value: any, ref: string): number | null {
  if (value === undefined || value === null) return null;

  let dd: number | null = null;

  // Direkter Zahlenwert
  if (typeof value === 'number') {
    dd = value;
  }
  // String
  else if (typeof value === 'string') {
    // Komma-separierte DMS-Werte: "37/1, 46/1, 12345/1000"
    if (value.includes(',')) {
      const parts = value.split(',').map(s => s.trim());
      dd = parseDMSFromStrings(parts);
    }
    // Einzelner Wert
    else {
      dd = parseExifValue(value);
    }
  }
  // Array: ["37/1", "46/1", "12345/1000"]
  else if (Array.isArray(value)) {
    dd = parseDMSFromStrings(value.map(String));
  }
  // Objekt: { numerator: 37, denominator: 1 }
  else if (typeof value === 'object') {
    const num = parseFractionObject(value);
    if (num !== null) dd = num;
  }

  if (dd === null || isNaN(dd)) return null;

  // Vorzeichen anhand der Referenz (N/S, E/W)
  if (ref?.toUpperCase() === 'S' || ref?.toUpperCase() === 'W') {
    dd = -dd;
  }

  return dd;
}

/**
 * Parst DMS (Degrees, Minutes, Seconds) aus String-Array
 * ["37/1", "46/1", "12345/1000"] → 37.774...
 */
function parseDMSFromStrings(parts: string[]): number | null {
  if (parts.length < 3) return null;

  const degrees = parseExifValue(parts[0]);
  const minutes = parseExifValue(parts[1]);
  const seconds = parseExifValue(parts[2]);

  if (degrees === null || minutes === null || seconds === null) return null;
  if (degrees === 0) return null;

  return degrees + minutes / 60 + seconds / 3600;
}

/**
 * Parst einen einzelnen EXIF-Wert (Fraction oder Zahl)
 * "12345/1000" → 12.345
 * "37" → 37
 */
function parseExifValue(value: any): number | null {
  if (value === undefined || value === null) return null;

  // Zahl
  if (typeof value === 'number') return value;

  // String
  if (typeof value === 'string') {
    // Fraction: "12345/1000"
    if (value.includes('/') && !value.includes(',')) {
      const [num, den] = value.split('/').map(s => parseFloat(s.trim()));
      if (den && den !== 0) return num / den;
    }
    // Normale Zahl
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  // Objekt: { numerator, denominator }
  if (typeof value === 'object') {
    return parseFractionObject(value);
  }

  return null;
}

/**
 * Parst ein Fraction-Objekt: { numerator: 12345, denominator: 1000 }
 */
function parseFractionObject(obj: any): number | null {
  const num = obj.numerator !== undefined ? parseFloat(obj.numerator) : undefined;
  const den = obj.denominator !== undefined ? parseFloat(obj.denominator) : undefined;

  if (num !== undefined && den !== undefined && den !== 0) {
    return num / den;
  }
  if (num !== undefined) return num;

  return null;
}

// =============================================================================
// Geräte-Standort via @capacitor/geolocation + Browser-Fallback
// =============================================================================

export interface GpsPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
}

/**
 * Holt den aktuellen Geräte-Standort.
 *
 * Versuche (in Reihenfolge):
 * 1. @capacitor/geolocation (nativ, nur APK)
 * 2. navigator.geolocation (Browser, Web + Capacitor WebView)
 *
 * @returns GpsPosition oder null bei Fehler/abgelehnt
 */
export async function getCurrentPosition(): Promise<GpsPosition | null> {
  // === Versuch 1: Capacitor Native Geolocation ===
  if (isCapacitorNative() && hasCapacitorPlugin('Geolocation')) {
    try {
      const Geo = (window as any).Capacitor.Plugins.Geolocation;
      console.log('[CapacitorGPS] Native Geolocation wird verwendet...');

      const position = await Geo.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      if (position?.coords) {
        const { latitude, longitude, altitude, accuracy } = position.coords;
        console.log('[CapacitorGPS] ✓ Native Position:', { latitude, longitude, accuracy });

        return {
          latitude,
          longitude,
          altitude: altitude ?? null,
          accuracy: accuracy || 0,
        };
      }
    } catch (error) {
      console.warn('[CapacitorGPS] Native Geolocation fehlgeschlagen:', error);
    }
  }

  // === Versuch 2: Browser Geolocation (auch für Capacitor WebView) ===
  if ('geolocation' in navigator) {
    try {
      console.log('[CapacitorGPS] Browser Geolocation wird verwendet...');

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude, altitude, accuracy } = position.coords;
      console.log('[CapacitorGPS] ✓ Browser Position:', { latitude, longitude, accuracy });

      return {
        latitude,
        longitude,
        altitude: altitude ?? null,
        accuracy: accuracy || 0,
      };
    } catch (error) {
      const msg = error instanceof GeolocationPositionError
        ? geolocationErrorMessage(error)
        : 'Unbekannter Fehler';
      console.warn('[CapacitorGPS] Browser Geolocation fehlgeschlagen:', msg);
    }
  } else {
    console.warn('[CapacitorGPS] Geolocation wird von diesem Gerät nicht unterstützt');
  }

  return null;
}

/**
 * Übersetzt GeolocationPositionError-Codes in deutsche Fehlermeldungen
 */
function geolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Standort-Zugriff verweigert. Bitte in den Einstellungen erlauben.';
    case error.POSITION_UNAVAILABLE:
      return 'Standort nicht verfügbar (GPS-Signal schwach?).';
    case error.TIMEOUT:
      return 'Zeitüberschreitung beim Standort-Abruf.';
    default:
      return `Fehler ${error.code}: ${error.message}`;
  }
}

// =============================================================================
// Cross-Plattform GPS-Batch: EXIF + Fallback
// =============================================================================

/**
 * Cross-Plattform GPS-Extraktion aus einem Bild.
 *
 * Strategie (in Reihenfolge):
 * 1. exifr.js (bereits vorhanden, funktioniert auf Desktop)
 * 2. @capacitor-community/exif (nativ, falls im APK) – umgeht Browser-Strip
 * 3. Geräte-Standort via getCurrentPosition() (letzter Fallback)
 *
 * @param file - Das Bild
 * @param existingGps - Bereits via exifr.extrahierte GPS-Daten (kann null sein)
 * @returns GpsData oder null
 */
export async function extractGpsCrossPlatform(
  file: File,
  existingGps: GpsData | null
): Promise<GpsData | null> {
  // 1. Bereits via exifr.extrahierte GPS-Daten
  if (existingGps) {
    console.log('[CapacitorGPS] ✓ Bereits via exifr.extrahierte GPS:', existingGps);
    return existingGps;
  }

  // 2. Capacitor Native EXIF (umgeht Browser-Strip)
  if (isCapacitorNative()) {
    const nativeGps = await extractGpsNativeExif(file);
    if (nativeGps) {
      console.log('[CapacitorGPS] ✓ GPS via nativem EXIF Plugin:', nativeGps);
      return nativeGps;
    }
  }

  // 3. Kein EXIF-GPS gefunden – hier wird keine Geolocation mehr gemacht,
  //    das passiert später im Batch für alle Bilder ohne GPS
  return null;
}

/**
 * Wandelt eine GpsPosition (vom Geolocation-API) in GpsData um
 */
export function positionToGpsData(pos: GpsPosition): GpsData {
  return {
    latitude: pos.latitude,
    longitude: pos.longitude,
    altitude: pos.altitude ?? undefined,
    precision: pos.accuracy < 20 ? 'high' : pos.accuracy < 100 ? 'medium' : 'low',
  };
}