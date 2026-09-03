/**
 * useArticleImageGps.ts
 *
 * Titelbild-Upload/EXIF/GPS-Domäne des Berichte-Formulars — 1:1 aus
 * ArticleForm.tsx verschoben (PLAN.md Schritt 6). Reines Verschieben,
 * keine Logik-Änderungen.
 *
 * ⚠️ Dokumentierter Sonderfall (PLAN.md): Der Aufruf createCorrectedPreview
 * (ursprünglich ArticleForm.tsx Z. 715) hatte in ArticleForm.tsx KEINEN
 * Import — der Aufruf crashte zur Laufzeit still in den umgebenden catch
 * (Fallback: Original-Preview). Da die Funktion in publishUtils.ts
 * exportiert wird und von MediaUploadForm/TripPublishForm regulär importiert
 * wird, wird sie hier beim Verschieben regulär importiert — die
 * EXIF-rotierte Vorschau funktioniert damit erstmals wirklich.
 */

import { useState, useEffect } from "react";
import exifr from "exifr";
import { extractGpsFromImage, extractCaptureTime, reverseGeocode, mapCountryCode, type GpsData, type GpsStatus } from "@/lib/gpsExtraction";
import { createCorrectedPreview } from "../publishUtils";
import type { useToast } from "@/hooks/useToast";
import type { useUploadFile } from "@/hooks/useUploadFile";

type ToastFn = ReturnType<typeof useToast>['toast'];
type UploadFileFn = ReturnType<typeof useUploadFile>['mutateAsync'];

interface UseArticleImageGpsParams {
  toast: ToastFn;
  uploadFile: UploadFileFn;
  selectedCountry: string;
  setLocation: (v: string) => void;
  setSelectedCountry: (v: string) => void;
}

export function useArticleImageGps({
  toast,
  uploadFile,
  selectedCountry,
  setLocation,
  setSelectedCountry,
}: UseArticleImageGpsParams) {
  const [image, setImage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageGps, setImageGps] = useState<GpsData | null>(null);
  const [imageCapturedAt, setImageCapturedAt] = useState<Date | null>(null);
  const [imageGpsStatus, setImageGpsStatus] = useState<GpsStatus>('not_found');
  const [editingImageGps, setEditingImageGps] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // Bild-Metadaten (Alt-Text/Caption/Freitext) aus dem MilkdownEditor, keyed by Bild-URL
  const [imageMetaMap, setImageMetaMap] = useState<Record<string, { alt?: string; caption?: string; note?: string }>>({});

  // GPS Handler for Article Form (Title Image Only)
  const handleArticleImageUpload = async (file: File) => {
    setImageFile(file);
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
          console.log(`[Article EXIF] ${file.name}: Orientation (via exifr.orientation) = ${exifOrientation || 'not found'}`);
        } catch (orientErr) {
          console.warn(`[Article EXIF] ${file.name}: Could not read orientation:`, orientErr);
        }

        // Bildabmessungen lesen
        try {
          const dimExif = await exifr.parse(file, { exif: true, pickTags: ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight'] });
          exifWidth = dimExif?.ImageWidth || dimExif?.ExifImageWidth;
          exifHeight = dimExif?.ImageHeight || dimExif?.ExifImageHeight;
          if (exifWidth && exifHeight) {
            console.log(`[Article EXIF] ${file.name}: EXIF dimensions ${exifWidth}x${exifHeight}`);
          }
        } catch (dimErr) {
          console.warn(`[Article EXIF] ${file.name}: Could not read dimensions:`, dimErr);
        }

        // Korrigierte Preview erstellen (immer, wie in TripPublishForm.tsx)
        correctedPreviewUrl = await createCorrectedPreview(file, exifWidth, exifHeight, exifOrientation);
      } catch (exifError) {
        console.warn(`[Article EXIF] Failed to read EXIF from ${file.name}:`, exifError);
        // Fallback: Original file als Preview
        correctedPreviewUrl = URL.createObjectURL(file);
      }

      // Setze die korrigierte Preview als Anzeige-URL (nur temporär)
      if (correctedPreviewUrl) {
        setImage(correctedPreviewUrl);
      }

      // Upload des Original-Files → echte Blossom-URL holen und speichern
      const [urlTag] = await uploadFile(file);
      const uploadedUrl = urlTag[1]; // Blossom-URL: https://blossom.../hash
      if (uploadedUrl) {
        setImage(uploadedUrl); // Überschreibt blob:// mit der echten URL
        console.log(`[Article Upload] Titelbild hochgeladen: ${uploadedUrl}`);
      }

      // Extract GPS from title image
      try {
        const gpsData = await extractGpsFromImage(file);
        if (gpsData) {
          setImageGps(gpsData);
          setImageGpsStatus('detected');
          console.log(`[Article GPS] Extracted from ${file.name}:`, gpsData);
        } else {
          setImageGps(null);
          setImageGpsStatus('not_found');
        }
      } catch (error) {
        console.error(`[Article GPS] Failed to extract from ${file.name}:`, error);
        setImageGpsStatus('error');
      }

      // Extract capture time (EXIF DateTimeOriginal) für den Wetter-Kontext —
      // ohne EXIF-Zeit fällt das Wetter auf Formular-Datum + Tagesaggregat zurück
      try {
        const capturedAt = await extractCaptureTime(file);
        setImageCapturedAt(capturedAt);
      } catch (error) {
        console.warn(`[Article CaptureTime] Failed to extract from ${file.name}:`, error);
        setImageCapturedAt(null);
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Upload fehlgeschlagen.',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

   // Auto-fill location from GPS data
   useEffect(() => {
     const autoFillLocation = async () => {
       if (imageGps) {
         console.log('[Article GPS] GPS detected, reverse geocoding...');
         const locationData = await reverseGeocode(imageGps.latitude, imageGps.longitude);
         if (locationData) {
           // Set location to city + neighbourhood/suburb (no postcode)
           const locationParts = [
             locationData.city,
             locationData.neighbourhood,
             locationData.suburb
           ].filter(Boolean);
           const loc = locationParts.join(', ');
           setLocation(loc);
           console.log('[Article GPS] Location found:', loc);

           // Auto-fill country if detected
           const country = mapCountryCode(locationData);
           if (country && !selectedCountry) {
             setSelectedCountry(country);
             console.log('[Article GPS] Country auto-filled:', country);
           }
         }
       }
     };

     autoFillLocation();
   }, [imageGps]);

  const handleImageUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const [urlTag] = await uploadFile(file);
      setImage(urlTag[1]); // URL is in second position
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

  return {
    image, setImage,
    imageFile, setImageFile,
    imageGps, setImageGps,
    imageCapturedAt, setImageCapturedAt,
    imageGpsStatus, setImageGpsStatus,
    editingImageGps, setEditingImageGps,
    showMapPicker, setShowMapPicker,
    isUploading,
    handleArticleImageUpload,
    handleImageUpload,
    imageMetaMap, setImageMetaMap,
  };
}