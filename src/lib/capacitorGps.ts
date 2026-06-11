/**
 * Capacitor Native Dateiauswahl + EXIF-GPS via exifr.js
 *
 * Nutzt @capawesome/capacitor-file-picker für native content:// URIs.
 *
 * WICHTIG (GrapheneOS-kompatibel):
 *   - KEIN fetch(content://) – blockiert
 *   - KEIN separater readFile() – wird via readData:true direkt vom Picker geholt
 *   - exifr.gps() auf dem File-Objekt (exifr kann File selbst lesen)
 *   - URL.createObjectURL(File) für Preview (zuverlässigste Methode)
 */

import type { GpsData } from './gpsExtraction';
import exifr from 'exifr';

// =============================================================================
// Plattform-Erkennung
// =============================================================================

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

export function hasCapacitorPlugin(pluginName: string): boolean {
  try {
    const cap = (window as any).Capacitor;
    return !!(cap?.Plugins?.[pluginName]);
  } catch {
    return false;
  }
}

// =============================================================================
// Native Dateiauswahl via @capawesome/capacitor-file-picker
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
 * Öffnet den nativen Android-Dateipicker.
 *
 * Ablauf:
 *   1. pickFiles({ readData: true }) → base64 direkt vom Picker
 *   2. base64 → File (new File([Uint8Array], name, {type}))
 *   3. exifr.gps(file) auf dem File-Objekt (exifr liest rohe Bytes selbst)
 *   4. URL.createObjectURL(file) für Preview
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
    console.log('[CapacitorGPS] pickFiles({ readData: true }) ...');
    const result = await FilePicker.pickFiles({
      multiple: options.multiple !== false,
      readData: true,
      types: options.types || ['image/jpeg', 'image/png', 'image/webp'],
    });

    if (!result?.files?.length) {
      console.log('[CapacitorGPS] Keine Dateien');
      return [];
    }

    console.log(`[CapacitorGPS] ${result.files.length} Dateien`);
    const pickedFiles: CapacitorPickedFile[] = [];

    for (const picked of result.files) {
      const { uri, name, mimeType, size, data } = picked;

      console.log(`[CapacitorGPS] ${name}: mime=${mimeType}, size=${size}, data=${data ? data.length + ' chars' : 'KEINE'}`);

      // ================================================================
      // 1. File für Upload + Preview erstellen
      // ================================================================
      let file: File;
      if (data) {
        try {
          const binaryStr = atob(data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          file = new File([bytes], name, { type: mimeType || 'image/jpeg' });
          console.log(`[CapacitorGPS] ${name}: File erstellt (${bytes.byteLength} Bytes)`);
        } catch (convErr) {
          console.error(`[CapacitorGPS] ${name}: base64→File Fehler:`, convErr);
          file = new File([], name, { type: mimeType || 'image/jpeg' });
        }
      } else {
        file = new File([], name, { type: mimeType || 'image/jpeg' });
      }

      // ================================================================
      // 2. GPS via exifr.gps(file) – exifr liest File selbst
      // ================================================================
      let gpsData: GpsData | null = null;

      if (file.size > 0) {
        // Versuch A: exifr.gps(file)
        try {
          console.log(`[CapacitorGPS] ${name}: exifr.gps(file) ...`);
          gpsData = await exifr.gps(file);
          if (gpsData?.latitude && gpsData?.longitude && gpsData.latitude !== 0 && gpsData.longitude !== 0) {
            console.log(`[CapacitorGPS] ${name}: ✓ GPS via exifr.gps(file):`, gpsData);
          } else {
            console.log(`[CapacitorGPS] ${name}: exifr.gps(file) kein GPS`);
            gpsData = null;
          }
        } catch (exifErr) {
          console.warn(`[CapacitorGPS] ${name}: exifr.gps(file) Fehler:`, exifErr);
        }

        // Versuch B: exifr.parse(file) – komplettes EXIF
        if (!gpsData) {
          try {
            console.log(`[CapacitorGPS] ${name}: exifr.parse(file) ...`);
            const parsed = await exifr.parse(file);
            if (parsed) {
              console.log(`[CapacitorGPS] ${name}: EXIF-Tags:`, Object.keys(parsed).join(', '));
              if (parsed.latitude && parsed.longitude) {
                gpsData = { latitude: parsed.latitude, longitude: parsed.longitude, precision: 'medium' };
                console.log(`[CapacitorGPS] ${name}: ✓ GPS via exifr.parse():`, gpsData);
              }
            } else {
              console.log(`[CapacitorGPS] ${name}: exifr.parse(file) = null (kein EXIF)`);
            }
          } catch (parseErr) {
            console.warn(`[CapacitorGPS] ${name}: exifr.parse(file) Fehler:`, parseErr);
          }
        }
      }

      // ================================================================
      // 3. Geolocation-Fallback
      // ================================================================
      if (!gpsData) {
        console.log(`[CapacitorGPS] ${name}: EXIF kein GPS → Geolocation Fallback`);
        const geoPos = await getCurrentPosition();
        if (geoPos) {
          gpsData = positionToGpsData(geoPos);
          console.log(`[CapacitorGPS] ${name}: ✓ GPS via Geolocation:`, gpsData);
        }
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
    console.error('[CapacitorGPS] FilePicker Error:', error);
    return [];
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
  if (isCapacitorNative() && hasCapacitorPlugin('Geolocation')) {
    try {
      const Geo = (window as any).Capacitor.Plugins.Geolocation;
      const position = await Geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      if (position?.coords) {
        const { latitude, longitude, altitude, accuracy } = position.coords;
        console.log('[CapacitorGPS] ✓ Native Geolocation:', { latitude, longitude, accuracy });
        return { latitude, longitude, altitude: altitude ?? null, accuracy: accuracy || 0 };
      }
    } catch (error) {
      console.warn('[CapacitorGPS] Native Geolocation Fehler:', error);
    }
  }

  if ('geolocation' in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0,
        });
      });
      const { latitude, longitude, altitude, accuracy } = position.coords;
      return { latitude, longitude, altitude: altitude ?? null, accuracy: accuracy || 0 };
    } catch { /* silent */ }
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
