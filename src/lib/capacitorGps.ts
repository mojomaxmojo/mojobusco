/**
 * Capacitor Native Dateiauswahl + EXIF-GPS via exifr.js
 *
 * Nutzt @capawesome/capacitor-file-picker für native content:// URIs.
 * Der Browser-Strip von EXIF-GPS wird umgangen, indem exifr.js direkt
 * die rohen Datei-Bytes liest – nicht das File-Objekt vom Browser.
 *
 * WICHTIG:
 *   - KEIN fetch(content://) – wird auf GrapheneOS blockiert
 *   - GPS via exifr.gps(dataUri) – exifr lädt data: URIs intern,
 *     vermeidet fehleranfällige base64→ArrayBuffer Konvertierung
 *   - Wenn EXIF-GPS leer → sofort Geolocation-Fallback
 *
 * Plugins (auf CachyOS installiert):
 *   - @capawesome/capacitor-file-picker → Native Dateiauswahl
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
  /** data: URI für Preview (base64 direkt vom FilePicker) */
  dataUri?: string;
  /** blob: URI als Fallback-Preview (wenn data:URI nicht funktioniert) */
  blobUri?: string;
  gps?: GpsData;
  gpsStatus: 'detected' | 'not_found' | 'error';
  file: File;
}

/**
 * Öffnet den nativen Android-Dateipicker und extrahiert GPS aus EXIF.
 *
 * Ablauf:
 *   1. FilePicker.pickFiles() → content:// URIs
 *   2. Für jede Datei: FilePicker.readFile() → base64 (rohe Bytes)
 *   3. exifr.gps(dataUri) → GPS direkt aus base64 (kein ArrayBuffer-Umweg)
 *   4. Geolocation-Fallback wenn EXIF leer
 *   5. data:URI + blob:URI für Preview
 *   6. File-Objekt für Upload
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
    console.error('[CapacitorGPS] FilePicker Plugin nicht gefunden');
    return [];
  }

  try {
    console.log('[CapacitorGPS] Öffne nativen Dateipicker...');
    const result = await FilePicker.pickFiles({
      multiple: options.multiple !== false,
      types: options.types || ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    });

    if (!result?.files?.length) {
      console.log('[CapacitorGPS] Keine Dateien ausgewählt');
      return [];
    }

    console.log(`[CapacitorGPS] ${result.files.length} Dateien ausgewählt`);
    const pickedFiles: CapacitorPickedFile[] = [];

    for (const picked of result.files) {
      const { uri, name, mimeType, size } = picked;

      // ================================================================
      // 1. Datei via readFile() lesen (rohe Bytes als base64)
      // ================================================================
      let base64Data: string | null = null;
      try {
        const readResult = await FilePicker.readFile({ path: uri });
        if (readResult?.data) {
          base64Data = readResult.data;
          console.log(`[CapacitorGPS] ${name}: ${Math.round(readResult.data.length * 0.75)} Bytes geladen`);
        } else {
          console.warn(`[CapacitorGPS] ${name}: readFile() lieferte leere Daten`);
        }
      } catch (readErr) {
        console.error(`[CapacitorGPS] ${name}: readFile() fehlgeschlagen:`, readErr);
      }

      // ================================================================
      // 2. EXIF-GPS via exifr.gps(dataUri) – exifr lädt data: URIs intern
      //    KEIN base64→ArrayBuffer Umweg (vermeidet Korruption!)
      // ================================================================
      let gpsData: GpsData | null = null;
      let dataUri: string | undefined;
      let blobUri: string | undefined;

      if (base64Data) {
        const effectiveMime = mimeType || 'image/jpeg';
        dataUri = `data:${effectiveMime};base64,${base64Data}`;

        // GPS via exifr.gps(dataUri) – exifr lädt die data:URI selbst
        try {
          console.log(`[CapacitorGPS] ${name}: exifr.gps(dataUri) ...`);
          gpsData = await exifr.gps(dataUri);
          if (gpsData?.latitude && gpsData?.longitude) {
            if (gpsData.latitude !== 0 || gpsData.longitude !== 0) {
              console.log(`[CapacitorGPS] ${name}: ✓ GPS via exifr:`, gpsData);
            } else {
              gpsData = null;
            }
          } else {
            console.log(`[CapacitorGPS] ${name}: Kein GPS in EXIF gefunden`);
          }
        } catch (exifErr) {
          console.warn(`[CapacitorGPS] ${name}: exifr.gps(dataUri) fehlgeschlagen:`, exifErr);
          // Versuch 2: exifr.gps(base64) – exifr kann auch raw base64
          try {
            console.log(`[CapacitorGPS] ${name}: exifr.gps(base64) Fallback ...`);
            gpsData = await exifr.gps(base64Data);
            if (gpsData?.latitude && gpsData?.longitude && gpsData.latitude !== 0 && gpsData.longitude !== 0) {
              console.log(`[CapacitorGPS] ${name}: ✓ GPS via exifr(base64):`, gpsData);
            } else {
              gpsData = null;
            }
          } catch (exifErr2) {
            console.warn(`[CapacitorGPS] ${name}: exifr.gps(base64) auch fehlgeschlagen:`, exifErr2);
          }
        }
      }

      // ================================================================
      // 3. Geolocation-Fallback wenn EXIF kein GPS geliefert hat
      // ================================================================
      if (!gpsData) {
        console.log(`[CapacitorGPS] ${name}: EXIF leer, versuche Geräte-Standort...`);
        const geoPosition = await getCurrentPosition();
        if (geoPosition) {
          gpsData = positionToGpsData(geoPosition);
          console.log(`[CapacitorGPS] ${name}: ✓ GPS via Geolocation:`, gpsData);
        } else {
          console.log(`[CapacitorGPS] ${name}: Auch Geolocation keine Position`);
        }
      }

      // ================================================================
      // 4. File-Objekt für Upload
      // ================================================================
      let file: File;
      if (base64Data) {
        try {
          const arrayBuffer = base64ToArrayBuffer(base64Data);
          file = new File([arrayBuffer], name, { type: mimeType || 'image/jpeg' });
          // blob:URI als Fallback-Preview (data:URI ist primär)
          try {
            blobUri = URL.createObjectURL(file);
          } catch {
            // silent – dataUri reicht
          }
        } catch {
          console.warn(`[CapacitorGPS] ${name}: File-Erstellung fehlgeschlagen`);
          file = new File([], name, { type: mimeType || 'image/jpeg' });
        }
      } else {
        file = new File([], name, { type: mimeType || 'image/jpeg' });
      }

      pickedFiles.push({
        uri,
        name,
        mimeType: mimeType || 'image/jpeg',
        size: size || 0,
        dataUri,
        blobUri,
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
 * base64 → ArrayBuffer
 *
 * Wird NUR für die File-Erstellung verwendet (Upload).
 * Für GPS wird exifr.gps(dataUri) genutzt (kein ArrayBuffer-Umweg).
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryStr = atob(base64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
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
        console.log('[CapacitorGPS] ✓ Native Geolocation:', { latitude, longitude, accuracy });
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
 * Wird von MediaUploadForm.tsx + PlaceForm.tsx importiert.
 */
export async function extractGpsCrossPlatform(
  _file: File,
  existingGps: GpsData | null
): Promise<GpsData | null> {
  if (existingGps) return existingGps;
  return null;
}
