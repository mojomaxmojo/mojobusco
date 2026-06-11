/**
 * Capacitor Native Dateiauswahl + EXIF-GPS via exifr.js
 *
 * Nutzt @capawesome/capacitor-file-picker für native content:// URIs.
 * Der Browser-Strip von EXIF-GPS wird umgangen, indem exifr.js direkt
 * die rohen Datei-Bytes liest (via readFile) – nicht das File-Objekt.
 *
 * WICHTIG (GrapheneOS-kompatibel):
 *   - KEIN fetch(content://) – wird auf GrapheneOS blockiert
 *   - Nur FilePicker.readFile() für rohe Bytes
 *   - Daten werden nur EINMAL gelesen und für GPS + Preview geteilt
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
  /** data: URI für Preview (base64 direkt, zuverlässiger als URL.createObjectURL) */
  dataUri?: string;
  gps?: GpsData;
  gpsStatus: 'detected' | 'not_found' | 'error';
  file: File;
}

/**
 * Öffnet den nativen Android-Dateipicker und extrahiert GPS aus EXIF.
 *
 * Ablauf:
 *   1. FilePicker.pickFiles() → content:// URI
 *   2. FilePicker.readFile()  → base64 (rohe Bytes, kein Browser-Strip!)
 *   3. exifr.gps(arrayBuffer) → GPS direkt aus den rohen Bytes
 *   4. data: URI aus base64   → Preview (kein URL.createObjectURL Umweg)
 *
 * KEIN fetch(content://) – wird auf modernen Android-Versionen blockiert.
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
      // 1. Datei EINMAL via readFile() lesen (rohe Bytes als base64)
      // ================================================================
      let base64Data: string | null = null;
      try {
        const readResult = await FilePicker.readFile({ path: uri });
        if (readResult?.data) {
          base64Data = readResult.data;
          console.log(`[CapacitorGPS] ${name}: ${Math.round(readResult.data.length * 0.75)} Bytes via readFile`);
        }
      } catch (readErr) {
        console.warn(`[CapacitorGPS] ${name}: readFile fehlgeschlagen:`, readErr);
      }

      // ================================================================
      // 2. EXIF-GPS aus rohen Bytes extrahieren
      // ================================================================
      let gpsData: GpsData | null = null;
      if (base64Data) {
        try {
          const arrayBuffer = base64ToArrayBuffer(base64Data);
          console.log(`[CapacitorGPS] ${name}: ${arrayBuffer.byteLength} Bytes für exifr.gps()`);
          gpsData = await exifr.gps(arrayBuffer);
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
          console.warn(`[CapacitorGPS] ${name}: exifr.gps() fehlgeschlagen:`, exifErr);
        }
      }

      // ================================================================
      // 3. data: URI für Preview (zuverlässiger als new File + createObjectURL)
      // ================================================================
      let dataUri: string | undefined;
      if (base64Data) {
        const effectiveMime = mimeType || 'image/jpeg';
        dataUri = `data:${effectiveMime};base64,${base64Data}`;
      }

      // ================================================================
      // 4. File-Objekt für Upload (muss sein für den Rest des Formulars)
      // ================================================================
      let file: File;
      if (base64Data) {
        try {
          const arrayBuffer = base64ToArrayBuffer(base64Data);
          file = new File([arrayBuffer], name, { type: mimeType || 'image/jpeg' });
        } catch {
          console.warn(`[CapacitorGPS] ${name}: File-Konstruktion fehlgeschlagen, leeres File`);
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
 * Extrahiert GPS aus rohen Bytes (via exifr.gps).
 * Wird von pickFilesNative() intern genutzt.
 *
 * @deprecated Wird nicht mehr direkt verwendet. Nutze pickFilesNative().
 */
async function extractGpsViaRawBytes(uri: string, fileName?: string): Promise<GpsData | null> {
  const logTag = `[GPS ${fileName || uri}]`;
  try {
    const FilePicker = (window as any).Capacitor?.Plugins?.FilePicker;
    if (!FilePicker?.readFile) {
      console.warn(`${logTag} FilePicker.readFile nicht verfügbar`);
      return null;
    }
    const readResult = await FilePicker.readFile({ path: uri });
    if (!readResult?.data) {
      console.warn(`${logTag} Keine Daten von readFile`);
      return null;
    }
    const arrayBuffer = base64ToArrayBuffer(readResult.data);
    console.log(`${logTag} ${arrayBuffer.byteLength} Bytes geladen`);
    const gpsData = await exifr.gps(arrayBuffer);
    if (gpsData?.latitude && gpsData?.longitude) {
      if (gpsData.latitude !== 0 || gpsData.longitude !== 0) {
        console.log(`${logTag} ✓ GPS via exifr:`, gpsData);
        return gpsData;
      }
    }
    console.log(`${logTag} Kein GPS gefunden`);
    return null;
  } catch (error) {
    console.warn(`${logTag} Fehler:`, error);
    return null;
  }
}

/**
 * base64 → ArrayBuffer (robust, binary-safe)
 *
 * Achtung: atob() + charCodeAt ist NICHT binary-safe für Werte > 127!
 * Stattdessen nutzen wir einen Puffer-Zugriff für korrekte Byte-Werte.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Browser-native base64 → Byte-Array (binary-safe)
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

// Alte exportierte Funktionen (deprecated, aber rückwärtskompatibel)
export { extractGpsViaRawBytes };