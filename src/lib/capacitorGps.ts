/**
 * Capacitor Native Dateiauswahl + EXIF-GPS via exifr.js
 *
 * Nutzt @capawesome/capacitor-file-picker für native content:// URIs.
 * Der Browser-Strip von EXIF-GPS wird umgangen, indem exifr.js direkt
 * die rohen Datei-Bytes liest (via readFile) – nicht das File-Objekt.
 *
 * Plugins (auf CachyOS installiert):
 *   - @capawesome/capacitor-file-picker → Native Dateiauswahl (content:// URIs)
 *   - @capacitor/geolocation           → GPS natives Geräte-GPS
 */

import type { GpsData } from './gpsExtraction';
import exifr from 'exifr';

// =============================================================================
// Plattform-Erkennung
// =============================================================================

/**
 * Prüft ob die App im Capacitor Native WebView läuft
 */
export function isCapacitorNative(): boolean {
  try {
    const cap = (window as any).Capacitor;
    if (cap?.isNative) return true;
    const cap8 = (window as any).__Capacitor;
    if (cap8?.isNative) return true;
    if (cap?.getPlatform?.() === 'android') return true;
    return false;
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
    return !!(cap?.Plugins?.[pluginName]);
  } catch {
    return false;
  }
}

// =============================================================================
// Native Dateiauswahl via @capawesome/capacitor-file-picker + exifr GPS
// =============================================================================

export interface CapacitorPickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  gps?: GpsData;
  gpsStatus: 'detected' | 'not_found' | 'error';
  file: File;
}

/**
 * Öffnet den nativen Android-Dateipicker und extrahiert GPS aus EXIF.
 *
 * Schlüssel: content:// URI → readFile Base64 → ArrayBuffer → exifr.gps()
 * exifr.js kann EXIF-GPS aus rohen Bytes lesen, ohne Browser-Strip.
 *
 * @param options - multiple: true/false, types: MIME-Typen
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
    console.error('[CapacitorGPS] FilePicker nicht gefunden');
    return [];
  }

  try {
    console.log('[CapacitorGPS] Öffne nativen Dateipicker...');
    const result = await FilePicker.pickFiles({
      multiple: options.multiple !== false,
      types: options.types || ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    });

    if (!result?.files?.length) return [];

    console.log(`[CapacitorGPS] ${result.files.length} Dateien ausgewählt`);
    const pickedFiles: CapacitorPickedFile[] = [];

    for (const picked of result.files) {
      const { uri, name, mimeType, size } = picked;

      // 1. EXIF-GPS via exifr.js aus rohen Bytes lesen (umgeht File-Strip!)
      const gpsData = await extractGpsViaRawBytes(uri, name);

      // 2. Datei-Inhalt via readFile (base64) → File-Objekt
      let file: File;
      try {
        const readResult = await FilePicker.readFile({ path: uri });
        if (readResult?.data) {
          const byteString = atob(readResult.data);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          file = new File([ab], name, { type: mimeType || 'image/jpeg' });
        } else {
          file = new File([], name, { type: mimeType || 'image/jpeg' });
        }
      } catch {
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
    }

    return pickedFiles;
  } catch (error) {
    console.error('[CapacitorGPS] FilePicker fehlgeschlagen:', error);
    return [];
  }
}

/**
 * Extrahiert GPS aus einer content:// URI via exifr.js + fetch.
 *
 * Statt das gestrippte File-Objekt zu nutzen, holen wir die rohen
 * Bytes direkt aus der content:// URI und lesen EXIF-GPS daraus.
 *
 * @param uri - content:// URI vom FilePicker
 * @param fileName - Dateiname für Logging
 */
async function extractGpsViaRawBytes(uri: string, fileName?: string): Promise<GpsData | null> {
  const logTag = `[GPS ${fileName || uri}]`;

  try {
    console.log(`${logTag} Lese rohe Bytes via content:// URI...`);

    // Versuch 1: fetch(uri) → ArrayBuffer → exifr.gps
    try {
      const response = await fetch(uri);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        console.log(`${logTag} ${arrayBuffer.byteLength} Bytes via fetch geladen`);
        const gpsData = await exifr.gps(arrayBuffer);
        if (gpsData?.latitude && gpsData?.longitude) {
          if (gpsData.latitude !== 0 || gpsData.longitude !== 0) {
            console.log(`${logTag} ✓ GPS via exifr(fetch):`, gpsData);
            return gpsData;
          }
        }
      }
    } catch (fetchErr) {
      console.warn(`${logTag} fetch fehlgeschlagen:`, fetchErr);
    }

    // Versuch 2: FilePicker.readFile() → base64 → ArrayBuffer → exifr.gps
    try {
      const FilePicker = (window as any).Capacitor?.Plugins?.FilePicker;
      if (FilePicker?.readFile) {
        const readResult = await FilePicker.readFile({ path: uri });
        if (readResult?.data) {
          const byteString = atob(readResult.data);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          console.log(`${logTag} ${ab.byteLength} Bytes via readFile geladen`);
          const gpsData = await exifr.gps(ab);
          if (gpsData?.latitude && gpsData?.longitude) {
            if (gpsData.latitude !== 0 || gpsData.longitude !== 0) {
              console.log(`${logTag} ✓ GPS via exifr(readFile):`, gpsData);
              return gpsData;
            }
          }
        }
      }
    } catch (readErr) {
      console.warn(`${logTag} readFile fehlgeschlagen:`, readErr);
    }

    console.log(`${logTag} Kein GPS gefunden`);
    return null;
  } catch (error) {
    console.warn(`${logTag} Fehler:`, error);
    return null;
  }
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

export async function getCurrentPosition(): Promise<GpsPosition | null> {
  // Versuch 1: Capacitor Native Geolocation
  if (isCapacitorNative() && hasCapacitorPlugin('Geolocation')) {
    try {
      const Geo = (window as any).Capacitor.Plugins.Geolocation;
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
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });
      const { latitude, longitude, altitude, accuracy } = position.coords;
      return { latitude, longitude, altitude: altitude ?? null, accuracy: accuracy || 0 };
    } catch {
      // silent
    }
  }

  return null;
}

export function positionToGpsData(pos: GpsPosition): GpsData {
  return {
    latitude: pos.latitude,
    longitude: pos.longitude,
    altitude: pos.altitude ?? undefined,
    precision: pos.accuracy < 20 ? 'high' : pos.accuracy < 100 ? 'medium' : 'low',
  };
}

/**
 * Cross-Plattform GPS-Extraktion (Kompatibilitäts-Wrapper)
 */
export async function extractGpsCrossPlatform(
  _file: File,
  existingGps: GpsData | null
): Promise<GpsData | null> {
  if (existingGps) return existingGps;
  return null;
}