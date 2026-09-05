// src/pages/publish/noteForm/noteImagePreview.ts
import exifr from 'exifr';
import { createCorrectedPreview } from '../publishUtils';

export async function createImagePreview(file: File) {
  let correctedPreviewUrl: string | undefined;
  let exifWidth: number | undefined;
  let exifHeight: number | undefined;
  let exifOrientation: number | undefined;

  try {
    // EXIF-Daten lesen (wie in TripPublishForm.tsx)
    // Orientation separat lesen (funktioniert auch wenn parse fehlschlägt)
    try {
      exifOrientation = await exifr.orientation(file);
      console.log(`[Note EXIF] ${file.name}: Orientation (via exifr.orientation) = ${exifOrientation || 'not found'}`);
    } catch (orientErr) {
      console.warn(`[Note EXIF] ${file.name}: Could not read orientation:`, orientErr);
    }

    // Bildabmessungen lesen
    try {
      const dimExif = await exifr.parse(file, { exif: true, pickTags: ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight'] } as NonNullable<Parameters<typeof exifr.parse>[1]>);
      exifWidth = dimExif?.ImageWidth || dimExif?.ExifImageWidth;
      exifHeight = dimExif?.ImageHeight || dimExif?.ExifImageHeight;
      if (exifWidth && exifHeight) {
        console.log(`[Note EXIF] ${file.name}: EXIF dimensions ${exifWidth}x${exifHeight}`);
      }
    } catch (dimErr) {
      console.warn(`[Note EXIF] ${file.name}: Could not read dimensions:`, dimErr);
    }

    // Korrigierte Preview erstellen (immer, wie in TripPublishForm.tsx)
    correctedPreviewUrl = await createCorrectedPreview(file, exifWidth, exifHeight, exifOrientation);
  } catch (exifError) {
    console.warn(`[Note EXIF] Failed to read EXIF from ${file.name}:`, exifError);
    // Fallback: Original file als Preview
    correctedPreviewUrl = URL.createObjectURL(file);
  }

  return correctedPreviewUrl;
}
