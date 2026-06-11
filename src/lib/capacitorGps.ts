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
 * Schreibt die Datei temporär in den App-Cache, damit das native Android
 * Plugin die Datei via Dateisystem-Pfad öffnen kann (Android ContentResolver
 * kann blob:-URIs nicht auflösen). Temp-Datei wird nach dem Lesevorgang
 * sofort gelöscht.
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

  let tempFilePath: string | null = null;

  try {
    const CapacitorExif = (window as any).Capacitor.Plugins.Exif;
    const CapacitorFilesystem = (window as any).Capacitor.Plugins.Filesystem;
    console.log('[CapacitorGPS] Native EXIF extraction für:', file.name);

    // Datei als Base64 lesen und in Cache-Verzeichnis schreiben
    // Das native Android Plugin braucht einen echten Dateipfad (content:// oder file://)
    // blob:-URIs funktionieren nicht mit Android's ContentResolver
    const base64 = await fileToBase64(file);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    tempFilePath = `gps-temp-${Date.now()}-${safeName}`;

    if (CapacitorFilesystem) {
      // 1. File in Cache schreiben
      await CapacitorFilesystem.writeFile({
        path: tempFilePath,
        data: base64,
        directory: 'CACHE',
      });
      console.log('[CapacitorGPS] ✓ Temp-Datei geschrieben:', tempFilePath);

      // 2. Echten Datei-URI vom Filesystem-Plugin holen (file:///data/...)
      //    Wichtig: Android's ExifInterface + @capacitor-community/exif
      //    brauchen einen validen content:// oder file:// URI – kein relativer Pfad!
      let nativeUri: string;
      try {
        const uriResult = await CapacitorFilesystem.getUri({
          path: tempFilePath,
          directory: 'CACHE',
        });
        nativeUri = uriResult?.uri || tempFilePath;
        console.log('[CapacitorGPS] Native URI:', nativeUri);
      } catch (uriErr) {
        console.warn('[CapacitorGPS] getUri fehlgeschlagen, verwende Fallback:', uriErr);
        nativeUri = tempFilePath;
      }

      // 3. EXIF via nativem Plugin lesen (mit vollem file:// Pfad)
      console.log('[CapacitorGPS] Rufe Exif.getExifData auf mit URI:', nativeUri);
      const result = await CapacitorExif.getExifData({
        uri: nativeUri,
      });

      // 4. Temp-Datei löschen
      try {
        await CapacitorFilesystem.deleteFile({
          path: tempFilePath,
          directory: 'CACHE',
        });
        console.log('[CapacitorGPS] ✓ Temp-Datei gelöscht');
      } catch (cleanupErr) {
        console.warn('[CapacitorGPS] Temp-Datei konnte nicht gelöscht werden:', cleanupErr);
      }

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
    } else {
      console.warn('[CapacitorGPS] @capacitor/filesystem nicht registriert – native EXIF nicht möglich');
    }

    return null;
  } catch (error) {
    console.warn('[CapacitorGPS] Native EXIF extraction fehlgeschlagen:', error);

    // Aufräumen falls temp-Datei noch existiert
    if (tempFilePath) {
      try {
        const CapacitorFilesystem = (window as any).Capacitor?.Plugins?.Filesystem;
        if (CapacitorFilesystem) {
          await CapacitorFilesystem.deleteFile({
            path: tempFilePath,
            directory: 'CACHE',
          });
        }
      } catch { /* ignore cleanup errors */ }
    }

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

// =============================================================================
// Hilfsfunktionen
// =============================================================================

/**
 * Konvertiert ein File-Objekt in einen Base64-String.
 * Wird benötigt um das File an das native Capacitor Filesystem zu übergeben.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Entferne den data:-Prefix (z.B. "data:image/jpeg;base64,")
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`FileReader Fehler für ${file.name}`));
    reader.readAsDataURL(file);
  });
}