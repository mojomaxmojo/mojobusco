/**
 * usePlaceImageUpload.ts — Titelbild-Domäne des Ort-Formulars — 1:1 aus
 * PlaceForm.tsx verschoben (PLAN4.md Schritt 5). Reines Verschieben, keine
 * Logik-Änderungen.
 *
 * ⚠️ Dokumentierter Sonderfall (PLAN4.md): createCorrectedPreview hatte im
 * Original keinen Import (stiller catch-Fallback). Wird hier regulär aus
 * ../publishUtils importiert — gleiche Entscheidung wie in
 * articleForm/useArticleImageGps.ts (dort dokumentiert).
 */

import exifr from "exifr";
import { extractGpsFromImage, type GpsData, type GpsStatus } from "@/lib/gpsExtraction";
import { extractGpsCrossPlatform } from "@/lib/capacitorGps";
import { createCorrectedPreview } from "../publishUtils";
import type { useToast } from "@/hooks/useToast";
import type { useUploadFile } from "@/hooks/useUploadFile";
import type { Dispatch, SetStateAction } from "react";

type ToastFn = ReturnType<typeof useToast>['toast'];
type UploadFileFn = ReturnType<typeof useUploadFile>['mutateAsync'];

interface UsePlaceImageUploadParams {
  toast: ToastFn;
  uploadFile: UploadFileFn;
  setImage: (v: string) => void;
  setImageFile: (v: File | null) => void;
  setImageGps: (v: GpsData | null) => void;
  setImageGpsStatus: (v: GpsStatus) => void;
  setIsUploading: Dispatch<SetStateAction<boolean>>;
  setAdditionalImages: Dispatch<SetStateAction<string[]>>;
}

export function usePlaceImageUpload({
  toast,
  uploadFile,
  setImage,
  setImageFile,
  setImageGps,
  setImageGpsStatus,
  setIsUploading,
  setAdditionalImages,
}: UsePlaceImageUploadParams) {
  const handleImageFile = async (file: File) => {
    setIsUploading(true);
    try {
      // EXIF-Daten lesen und korrigierte Preview erstellen (wie in TripPublishForm.tsx)
      let correctedPreviewUrl: string | undefined;
      let exifWidth: number | undefined;
      let exifHeight: number | undefined;
      let exifOrientation: number | undefined;

      try {
        // EXIF-Daten lesen (wie in TripPublishForm.tsx)
        // Orientation separat lesen (funktioniert auch wenn parse fehlschlägt)
        try {
          exifOrientation = await exifr.orientation(file);
          console.log(`[Place EXIF] ${file.name}: Orientation (via exifr.orientation) = ${exifOrientation || 'not found'}`);
        } catch (orientErr) {
          console.warn(`[Place EXIF] ${file.name}: Could not read orientation:`, orientErr);
        }

        // Bildabmessungen lesen
        try {
          const dimExif = await exifr.parse(file, { exif: true, pickTags: ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight'] } as NonNullable<Parameters<typeof exifr.parse>[1]>);
          exifWidth = dimExif?.ImageWidth || dimExif?.ExifImageWidth;
          exifHeight = dimExif?.ImageHeight || dimExif?.ExifImageHeight;
          if (exifWidth && exifHeight) {
            console.log(`[Place EXIF] ${file.name}: EXIF dimensions ${exifWidth}x${exifHeight}`);
          }
        } catch (dimErr) {
          console.warn(`[Place EXIF] ${file.name}: Could not read dimensions:`, dimErr);
        }

        // Korrigierte Preview erstellen (immer, wie in TripPublishForm.tsx)
        correctedPreviewUrl = await createCorrectedPreview(file, exifWidth, exifHeight, exifOrientation);
      } catch (exifError) {
        console.warn(`[Place EXIF] Failed to read EXIF from ${file.name}:`, exifError);
        // Fallback: Original file als Preview
        correctedPreviewUrl = URL.createObjectURL(file);
      }

      // Setze die korrigierte Preview als Anzeige-URL (nur temporär)
      if (correctedPreviewUrl) {
        setImage(correctedPreviewUrl);
      }

      // Speichere das File für KI-Generierung
      setImageFile(file);

      // Upload des Original-File → echte Blossom-URL holen und speichern
      const [urlTag] = await uploadFile(file);
      const uploadedUrl = urlTag[1]; // Blossom-URL: https://blossom.../hash
      if (uploadedUrl) {
        setImage(uploadedUrl); // Überschreibt blob:// mit der echten URL
        console.log(`[Place Upload] Titelbild hochgeladen: ${uploadedUrl}`);
      }

      // Extract GPS from title image
      try {
        const gpsData = await extractGpsFromImage(file);
        if (gpsData) {
          setImageGps(gpsData);
          setImageGpsStatus('detected');
          console.log(`[Place GPS] Extracted from ${file.name}:`, gpsData);
        } else {
          // Fallback: Capacitor Native EXIF (umgeht Browser-Strip im APK)
          console.log(`[Place GPS] exifr keine GPS, versuche Capacitor native EXIF für ${file.name}...`);
          const nativeGps = await extractGpsCrossPlatform(file, null);
          if (nativeGps) {
            setImageGps(nativeGps);
            setImageGpsStatus('detected');
            console.log(`[Place GPS] ✓ Native EXIF GPS für ${file.name}:`, nativeGps);
          } else {
            setImageGps(null);
            setImageGpsStatus('not_found');
          }
        }
      } catch (error) {
        console.error(`[Place GPS] Failed to extract from ${file.name}:`, error);
        setImageGpsStatus('error');
      }

      toast({
        title: 'Upload erfolgreich!',
        description: 'Titelbild wurde hochgeladen.',
      });
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Bild-Upload fehlgeschlagen.',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAdditionalImagesUpload = async (files: File[]) => {
    try {
      const newUrls: string[] = [];
      for (const file of files) {
        const [urlTag] = await uploadFile(file);
        newUrls.push(urlTag[1]);
      }
      setAdditionalImages(prev => [...prev, ...newUrls]);
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Upload zusatzlicher Bilder fehlgeschlagen.',
        variant: 'destructive'
      });
    }
  };

  return { handleImageFile, handleAdditionalImagesUpload };
}
