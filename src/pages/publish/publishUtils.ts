/**
 * createCorrectedPreview — EXIF-orientierte Bildvorschau
 */
export async function createCorrectedPreview(
  file: File,
  exifWidth?: number,
  exifHeight?: number,
  exifOrientation?: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const actualWidth = img.naturalWidth;
      const actualHeight = img.naturalHeight;

      console.log(`[Preview] ${file.name}: Actual dimensions ${actualWidth}x${actualHeight}`);
      console.log(`[Preview] ${file.name}: EXIF Orientation = ${exifOrientation || 'not set'}`);

      // Rotation basierend auf EXIF Orientation (1-8)
      let rotation = 0;
      let flipH = false;

      if (exifOrientation && exifOrientation !== 1) {
        switch (exifOrientation) {
          case 2: flipH = true; break;
          case 3: rotation = 180; break;
          case 4: rotation = 180; flipH = true; break;
          case 5: rotation = -90; flipH = true; break;
          case 6: rotation = 90; break;  // 90° CW korrigiert 90° CCW
          case 7: rotation = 90; flipH = true; break;
          case 8: rotation = -90; break;
        }
        console.log(`[Corrected File] ${file.name}: Orientation=${exifOrientation}, applying rotation=${rotation}°`);
      }

      // Wenn keine Korrektur nötig, Original zurückgeben
      if (rotation === 0 && !flipH) {
        URL.revokeObjectURL(url);
        resolve(url);
        return;
      }

      // Canvas erstellen
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(url);
        return;
      }

      // Canvas-Größe basierend auf Rotation
      if (rotation === 90 || rotation === -90) {
        canvas.width = actualHeight;
        canvas.height = actualWidth;
      } else {
        canvas.width = actualWidth;
        canvas.height = actualHeight;
      }

      // Transformation anwenden
      ctx.translate(canvas.width / 2, canvas.height / 2);
      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180);
      }
      if (flipH) {
        ctx.scale(-1, 1);
      }
      ctx.translate(-actualWidth / 2, -actualHeight / 2);

      // Bild zeichnen
      ctx.drawImage(img, 0, 0, actualWidth, actualHeight);

      // Neue URL erstellen
      canvas.toBlob((blob) => {
        if (blob) {
          const correctedUrl = URL.createObjectURL(blob);
          console.log(`[Corrected File] ${file.name}: Created corrected preview`);
          URL.revokeObjectURL(url);
          resolve(correctedUrl);
        } else {
          URL.revokeObjectURL(url);
          resolve(url);
        }
      }, 'image/jpeg', 0.9);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(url);
    };

    img.src = url;
  });
}

/**
 * mediaTypes — Konfiguration der unterstützten Medientypen
 */
import { ImageIcon, Video, Music, File as FileIcon } from '@/lib/icons';

export const mediaTypes = [
  { type: 'image', label: 'Bilder', icon: ImageIcon, extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'], accept: 'image/*' },
  { type: 'video', label: 'Videos', icon: Video, extensions: ['mp4', 'mov', 'webm'], accept: 'video/*' },
  { type: 'audio', label: 'Audio', icon: Music, extensions: ['mp3', 'wav', 'm4a'], accept: 'audio/*' },
  { type: 'document', label: 'Dokumente', icon: FileIcon, extensions: ['pdf', 'kml', 'gpx'], accept: '.pdf,.kml,.gpx' }
];

export const mainCategories = [
  { value: 'vanlife', label: 'Vanlife', icon: '🚐' },
  { value: 'technik', label: 'Technik & Solar', icon: '⚡' },
  { value: 'reisen', label: 'Reisen', icon: '🗺️' },
  { value: 'leben', label: 'Lifestyle', icon: '🌊' },
  { value: 'natur', label: 'Natur', icon: '🌲' }
];

export const subCategories: Record<string, string[]> = {
  vanlife: ['camping', 'wildcamping', 'stellplatz', '4x4', 'minimalismus'],
  technik: ['solarenergie', 'batterie', 'internet', 'navigation', 'reparatur'],
  reisen: ['europa', 'portugal', 'spanien', 'kroatien', 'italien', 'route'],
  leben: ['kochen', 'fitness', 'freedom', 'community', 'bitcoin', 'sunset'],
  natur: ['tiere', 'blumen', 'strand', 'berge', 'wald', 'meer']
};

import type { GpsData, GpsStatus } from '@/lib/gpsExtraction';

export interface MediaFile {
  id: string;
  file: File;
  url?: string;
  name: string;
  type: string;
  size: number;
  preview?: string;
  uploaded?: boolean;
  tags?: string[];
  /** GPS data extracted from image EXIF */
  gps?: GpsData;
  /** GPS extraction status */
  gpsStatus?: GpsStatus;
  /** Aufnahme-Timestamp für Sortierung (EXIF > lastModified > now) */
  sortDate?: number;
}

export interface UploadProgress {
  current: number;
  total: number;
  stage: 'upload' | 'publish' | 'success' | 'error' | '';
  status: string;
}

/**
 * resolveBildPlaceholders — Ersetzt [BILD_1], [BILD_2] etc. im KI-Text durch Markdown-Bilder
 */
export function resolveBildPlaceholders(
  text: string,
  imageObjects: Array<{ url: string | null; description: string }>
): string {
  let result = text

  // Nur Bilder mit echten URLs – Titelbilder (url=null) überspringen
  const urlImages = imageObjects
    .map((img, i) => ({ ...img, num: i + 1 }))
    .filter(img => img.url !== null)

  const orphaned: string[] = [] // Bilder ohne Platzhalter im Text

  for (const img of urlImages) {
    const placeholder = `[BILD_${img.num}]`
    const markdownImg = `\n\n![](${img.url})\n\n`

    if (result.includes(placeholder)) {
      // Platzhalter im Text gefunden → ersetzen
      result = result.replace(placeholder, markdownImg)
    } else {
      // KI hat Platzhalter vergessen → Fallback: am Ende anhängen
      orphaned.push(`![](${img.url})`)
    }
  }

  // Verwaiste Bilder ans Ende (vor Hashtags)
  if (orphaned.length > 0) {
    // Hashtag-Zeilen ans Ende stellen, Bilder davor
    const lines = result.split('\n')
    const lastHashtagIdx = lines.reduce(
      (last, line, i) => line.trim().match(/^#\w+/) ? i : last,
      -1
    )
    if (lastHashtagIdx > 0) {
      // Hashtags gefunden → Bilder davor einfügen
      lines.splice(lastHashtagIdx, 0, '', ...orphaned, '')
      result = lines.join('\n')
    } else {
      result = result.trimEnd() + '\n\n' + orphaned.join('\n\n')
    }
  }

  return result
}