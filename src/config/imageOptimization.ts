/**
 * Image Optimization Configuration
 *
 * Konfiguration für die client-seitige Bildverarbeitung beim Upload
 */

// ============================================================================
// OPTIMIZATION SETTINGS
// ============================================================================

/**
 * Maximale Bildbreite nach der Optimierung (in Pixeln)
 * Bilder, die breiter sind, werden proportional verkleinert.
 * 2560 px = ausreichend für 1920×1080 HD-Video inkl. Ken-Burns-Zoom.
 */
export const IMAGE_OPTIMIZATION_MAX_WIDTH = 2560;

/**
 * Maximale Bildhöhe nach der Optimierung (in Pixeln)
 * Bilder, die höher sind, werden proportional verkleinert.
 * 2560 px = ausreichend für 1080×1920 Shorts inkl. Zoom.
 */
export const IMAGE_OPTIMIZATION_MAX_HEIGHT = 2560;

/**
 * WebP Qualität (0.0 - 1.0)
 * Empfohlener Bereich: 0.75 - 0.85 für gute Balance zwischen Qualität und Dateigröße
 */
export const IMAGE_OPTIMIZATION_QUALITY = 0.85;

/**
 * Output-Format für die Optimierung
 * 'image/webp' ist Standard und liefert beste Komprimierung
 */
export const IMAGE_OPTIMIZATION_OUTPUT_FORMAT = 'image/webp';

/**
 * Ob die Bildoptimierung standardmäßig aktiviert ist
 * User kann dies über UI-Toggle steuern
 */
export const IMAGE_OPTIMIZATION_ENABLED_DEFAULT = true;

/**
 * Dateierweiterungen, die NICHT optimiert werden sollen
 * GIFs werden ausgeschlossen, da sie animiert sind und WebP nur statische Bilder unterstützt
 */
export const IMAGE_OPTIMIZATION_EXCLUDE_FORMATS = ['image/gif'];

/**
 * Maximale Dateigröße für die Optimierung (in Bytes)
 * Dateien, die größer sind, werden nicht optimiert (um Browser-Abstürze zu vermeiden)
 * 50 MB = 50 * 1024 * 1024 = 52428800 Bytes
 */
export const IMAGE_OPTIMIZATION_MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Ob ein Thumbnail generiert werden soll
 * Thumbnails können für Vorschauen verwendet werden
 */
export const IMAGE_OPTIMIZATION_GENERATE_THUMBNAIL = false;

/**
 * Thumbnail-Größe (in Pixeln)
 * Wird nur verwendet, wenn IMAGE_OPTIMIZATION_GENERATE_THUMBNAIL = true
 */
export const IMAGE_OPTIMIZATION_THUMBNAIL_SIZE = 400;

// ============================================================================
// CONFIGURATION OBJECT
// ============================================================================

/**
 * Vollständige Konfiguration für Bildoptimierung
 * Kann direkt an browser-image-compression übergeben werden
 */
export const imageOptimizationConfig = {
  maxSizeMB: IMAGE_OPTIMIZATION_MAX_FILE_SIZE / (1024 * 1024),
  maxWidthOrHeight: Math.max(
    IMAGE_OPTIMIZATION_MAX_WIDTH,
    IMAGE_OPTIMIZATION_MAX_HEIGHT
  ),
  useWebWorker: true, // Verwendet Web Worker für bessere Performance
  fileType: IMAGE_OPTIMIZATION_OUTPUT_FORMAT,
  quality: IMAGE_OPTIMIZATION_QUALITY,
  // WICHTIG: EXIF-Orientierung beibehalten/korrigieren
  // Smartphone-Fotos haben oft EXIF-Orientierungs-Tags
  alwaysKeepResolution: false,
  // Die Bibliothek liest automatisch EXIF und rotiert entsprechend
  // wenn diese Option nicht gesetzt ist (Standard)
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Prüft, ob eine Datei optimiert werden soll
 *
 * @param file - Die zu prüfende Datei
 * @returns true, wenn die Datei optimiert werden soll
 */
export function shouldOptimizeImage(file: File): boolean {
  // Prüfen, ob Dateityp ausgeschlossen ist (z.B. GIF)
  if (IMAGE_OPTIMIZATION_EXCLUDE_FORMATS.includes(file.type)) {
    return false;
  }

  // Prüfen, ob Datei zu groß ist
  if (file.size > IMAGE_OPTIMIZATION_MAX_FILE_SIZE) {
    return false;
  }

  // Prüfen, ob es ein Bild ist
  if (!file.type.startsWith('image/')) {
    return false;
  }

  return true;
}

/**
 * Gibt menschenlesbare Informationen über die Optimierungseinstellungen zurück
 * Für UI-Anzeigen und Debugging
 */
export function getOptimizationInfo(): {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: string;
  enabledDefault: boolean;
  excludedFormats: string[];
  maxFileSizeMB: number;
} {
  return {
    maxWidth: IMAGE_OPTIMIZATION_MAX_WIDTH,
    maxHeight: IMAGE_OPTIMIZATION_MAX_HEIGHT,
    quality: IMAGE_OPTIMIZATION_QUALITY,
    format: IMAGE_OPTIMIZATION_OUTPUT_FORMAT,
    enabledDefault: IMAGE_OPTIMIZATION_ENABLED_DEFAULT,
    excludedFormats: IMAGE_OPTIMIZATION_EXCLUDE_FORMATS,
    maxFileSizeMB: IMAGE_OPTIMIZATION_MAX_FILE_SIZE / (1024 * 1024),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ...imageOptimizationConfig,
  shouldOptimizeImage,
  getOptimizationInfo,
};
