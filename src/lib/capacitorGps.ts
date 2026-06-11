/**
 * Capacitor Native GPS & EXIF Abstraktion
 *
 * Erkennt zur Laufzeit ob die App im Capacitor-WebView läuft
 * und nutzt dann native Plugins für EXIF-GPS + Geräte-Standort.
 *
 * Kernlösung für GPS: @capawesome/capacitor-file-picker liefert
 * native content:// URIs → @capacitor-community/exif kann EXIF
 * direkt aus der Datei lesen (umgeht WebView-GPS-Strip).
 *
 * Plugins (auf CachyOS installiert):
 *   - @capacitor/geolocation            → GPS natives Geräte-GPS
 *   - @capacitor-community/exif          → Native EXIF inkl. GPS aus Bildern
 *   - @capawesome/capacitor-file-picker  → Native Dateiauswahl (content:// URIs)
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
export function hasCapacitorPlugin(pluginName: string): boolean {
  try {
    const cap = (window as any).Capacitor;
    return !!(cap && cap.Plugins && cap.Plugins[pluginName]);
  } catch {
    return false;
  }
}

// =============================================================================
// Native Dateiauswahl via @capawesome/capacitor-file-picker
// =============================================================================

/**
 * Einzelne Datei aus dem Native Picker mit voller EXIF-Unterstützung
 */
export interface CapacitorPickedFile {
  /** Native content:// URI (z.B. content://media/external/images/media/123) */
  uri: string;
  /** Dateiname */
  name: string;
  /** MIME-Typ */
  mimeType: string;
  /** Dateigröße in Bytes */
  size: number;
  /** GPS-Daten (falls aus EXIF extrahiert) */
  gps?: GpsData;
  /** GPS-Status */
  gpsStatus: 'detected' | 'not_found' | 'error';
  /** File-Objekt für Upload-Pipeline (aus base64 erstellt) */
  file: File;
}

/**
 * Öffnet den nativen Android-Dateipicker via @capawesome/capacitor-file-picker
 * und liest für jedes Bild direkt via @capacitor-community/exif die GPS-Daten.
 *
 * Vorteil gegenüber <input type="file">:
 * - Liefert native content:// URIs
 * - @capacitor-community/exif kann diese URIs öffnen
 * - Umgeht den WebView-GPS-Strip
 *
 * @param options - Auswahloptionen
 * @returns Array von gepickten Dateien mit GPS-Daten
 */
export async function pickFilesNative(options: {
  multiple?: boolean;
  types?: string[];
} = {}): Promise<CapacitorPickedFile[]> {
  if (!isCapacitorNative()) {
    console.warn('[CapacitorGPS] Nicht im nativen Kontext');
    return [];
  }

  const FilePicker = (window as any).Capacitor?.Plugins?.FilePicker;
  if (!FilePicker) {
    console.error('[CapacitorGPS] @capawesome/capacitor-file-picker nicht gefunden');
    return [];
  }

  try {
    console.log('[CapacitorGPS] Öffne nativen Dateipicker...');

    const result = await FilePicker.pickFiles({
      multiple: options.multiple !== false,
      types: options.types || ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    });

    if (!result?.files || result.files.length === 0) {
      console.log('[CapacitorGPS] Keine Dateien ausgewählt');
      return [];
    }

    console.log(`[CapacitorGPS] ${result.files.length} Dateien ausgewählt`);

    const pickedFiles: CapacitorPickedFile[] = [];

    for (const picked of result.files) {
      try {
        const { uri, name, mimeType, size } = picked;
        console.log(`[CapacitorGPS] Verarbeite: ${name} (${uri})`);

        // EXIF-GPS aus der content:// URI lesen
        const gpsData = await extractGpsFromUri(uri, name);

        // Datei-Inhalt via FilePicker lesen (base64)
        let fileData: string | null = null;
        try {
          const readResult = await FilePicker.readFile({ path: uri });
          fileData = readResult?.data || null;
        } catch (readErr) {
          console.warn(`[CapacitorGPS] readFile fehlgeschlagen für ${name}:`, readErr);
        }

        // File-Objekt erstellen (für Upload-Pipeline)
        let file: File;
        if (fileData) {
          const byteString = atob(fileData);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          file = new File([ab], name, { type: mimeType || 'image/jpeg' });
        } else {
          // Fallback: leeres File (Upload wird dann fehlschlagen)
          file = new File([], name, { type: mimeType || 'image/jpeg' });
        }

        pickedFiles.push({
          uri,
          name,
          mimeType: mimeType || 'image/jpeg',
          size: size || 0,
          gps: gpsData || undefined,
          gpsStatus: gpsData ? 'detected' : 'not_found',
          file,
        });
      } catch (fileErr) {
        console.warn(`[CapacitorGPS] Fehler bei ${picked.name}:`, fileErr);
      }
    }

    console.log(`[CapacitorGPS] ${pickedFiles.length} Dateien verarbeitet`);
    return pickedFiles;

  } catch (error) {
    console.error('[CapacitorGPS] FilePicker fehlgeschlagen:', error);
    return [];
  }
}

// =============================================================================
// Native EXIF-GPS via @capacitor-community/exif
// =============================================================================

/**
 * Extrahiert GPS aus einer nativen content:// URI via @capacitor-community/exif.
 *
 * Android's ExifInterface + ContentResolver können content:// URIs öffnen
 * und mit setRequireOriginal(true) auch ACCESS_MEDIA_LOCATION abfragen.
 *
 * @param uri - Native content:// URI (vom FilePicker)
 * @param fileName - Dateiname (für Logging)
 * @returns GpsData oder null
 */
export async function extractGpsFromUri(uri: string, fileName?: string): Promise<GpsData | null> {
  if (!isCapacitorNative()) return null;
  if (!hasCapacitorPlugin('Exif')) {
    console.warn('[CapacitorGPS] @capacitor-community/exif nicht registriert');
    return null;
  }

  try {
    const CapacitorExif = (window as any).Capacitor.Plugins.Exif;
    console.log(`[CapacitorGPS] Rufe Exif.getExifData auf für: ${fileName || uri}`);

    const result = await CapacitorExif.getExifData({ uri });
    console.log(`[CapacitorGPS] EXIF-Result:`, result ? 'OK' : 'null');

    if (!result?.exifData) {
      console.log(`[CapacitorGPS] Keine EXIF-Daten von ${fileName || uri}`);
      return null;
    }

    const exif = result.exifData;
    console.log(`[CapacitorGPS] EXIF keys:`, Object.keys(exif));

    // GPS parsen
    const gpsResult = parseNativeExifGps(exif);
    if (gpsResult) {
      console.log(`[CapacitorGPS] ✓ GPS gefunden für ${fileName}:`, gpsResult);
      return gpsResult;
    }

    console.log(`[CapacitorGPS] Kein GPS in EXIF von ${fileName}`);
    return null;
  } catch (error) {
    console.warn(`[CapacitorGPS] EXIF-Fehler für ${fileName}:`, error);
    return null;
  }
}

// =============================================================================
// GPS-Parsing (EXIF → GpsData)
// =============================================================================

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

function parseExifCoordinate(value: any, ref: string): number | null {
  if (value === undefined || value === null) return null;

  let dd: number | null = null;

  if (typeof value === 'number') {
    dd = value;
  } else if (typeof value === 'string') {
    if (value.includes(',')) {
      const parts = value.split(',').map(s => s.trim());
      dd = parseDMSFromStrings(parts);
    } else {
      dd = parseExifValue(value);
    }
  } else if (Array.isArray(value)) {
    dd = parseDMSFromStrings(value.map(String));
  } else if (typeof value === 'object') {
    const num = parseFractionObject(value);
    if (num !== null) dd = num;
  }

  if (dd === null || isNaN(dd)) return null;

  if (ref?.toUpperCase() === 'S' || ref?.toUpperCase() === 'W') {
    dd = -dd;
  }

  return dd;
}

function parseDMSFromStrings(parts: string[]): number | null {
  if (parts.length < 3) return null;

  const degrees = parseExifValue(parts[0]);
  const minutes = parseExifValue(parts[1]);
  const seconds = parseExifValue(parts[2]);

  if (degrees === null || minutes === null || seconds === null) return null;
  if (degrees === 0) return null;

  return degrees + minutes / 60 + seconds / 3600;
}

function parseExifValue(value: any): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    if (value.includes('/') && !value.includes(',')) {
      const [num, den] = value.split('/').map(s => parseFloat(s.trim()));
      if (den && den !== 0) return num / den;
    }
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  if (typeof value === 'object') {
    return parseFractionObject(value);
  }

  return null;
}

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
 */
export async function getCurrentPosition(): Promise<GpsPosition | null> {
  // Versuch 1: Capacitor Native Geolocation
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
        return { latitude, longitude, altitude: altitude ?? null, accuracy: accuracy || 0 };
      }
    } catch (error) {
      console.warn('[CapacitorGPS] Native Geolocation fehlgeschlagen:', error);
    }
  }

  // Versuch 2: Browser Geolocation
  if ('geolocation' in navigator) {
    try {
      console.log('[CapacitorGPS] Browser Geolocation...');
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude, altitude, accuracy } = position.coords;
      console.log('[CapacitorGPS] ✓ Browser Position:', { latitude, longitude, accuracy });
      return { latitude, longitude, altitude: altitude ?? null, accuracy: accuracy || 0 };
    } catch (error) {
      const msg = error instanceof GeolocationPositionError
        ? geolocationErrorMessage(error) : 'Unbekannter Fehler';
      console.warn('[CapacitorGPS] Browser Geolocation:', msg);
    }
  }

  return null;
}

function geolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED: return 'Standort-Zugriff verweigert.';
    case error.POSITION_UNAVAILABLE: return 'Standort nicht verfügbar (GPS-Signal?).';
    case error.TIMEOUT: return 'Zeitüberschreitung.';
    default: return `Fehler ${error.code}`;
  }
}

/**
 * Wandelt eine GpsPosition in GpsData um
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
// Kompatibilitäts-Wrapper (für MediaUploadForm + PlaceForm)
// =============================================================================

/**
 * Cross-Plattform GPS-Extraktion (Kompatibilitäts-Wrapper)
 *
 * Ruft bei Bedarf die native EXIF-Extraktion via @capacitor-community/exif auf.
 * Wird von MediaUploadForm.tsx und PlaceForm.tsx verwendet.
 *
 * @param file - Vom Browser geliefertes File-Objekt (GPS wurde ggf. gestripped)
 * @param existingGps - Bereits via exifr.extrahierte GPS-Daten (kann null sein)
 * @returns GpsData oder null
 */
export async function extractGpsCrossPlatform(
  file: File,
  existingGps: GpsData | null
): Promise<GpsData | null> {
  // 1. Bereits via exifr.extrahierte GPS-Daten → zurückgeben
  if (existingGps) {
    return existingGps;
  }

  // 2. Capacitor Native EXIF: file-picker ist die primäre Lösung.
  //    Hier nur als Fallback über Filesystem (falls kein file-picker verwendet wurde).
  //    Diese Methode ist weniger zuverlässig, daher try-catch.
  if (isCapacitorNative() && hasCapacitorPlugin('Exif')) {
    try {
      // Fallback: versuche GPS direkt via content:// URI aus der Datei
      // (funktioniert nur wenn der Datei-Pfad als content:// vorliegt)
      console.log('[CapacitorGPS] extractGpsCrossPlatform: Bitte nutze pickFilesNative() für GPS');
      return null; // File-Objekte haben keine content:// URI
    } catch {
      return null;
    }
  }

  return null;
}
