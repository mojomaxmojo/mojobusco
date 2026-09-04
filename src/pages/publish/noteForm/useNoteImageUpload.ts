/**
 * useNoteImageUpload.ts — Bild-Auswahl (inkl. EXIF-Vorschau + GPS-Extraktion),
 * Drag & Drop, Upload mit Fortschrittsanzeige und Löschen des Note-Formulars
 * — 1:1 aus NoteForm.tsx verschoben (PLAN5.md Schritt 6). Reines Verschieben,
 * keine Logik-Änderungen.
 */

import { useState } from "react";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useToast } from "@/hooks/useToast";
import { createImagePreview } from './noteImagePreview';
import { extractGpsFromImage, type GpsData, type GpsStatus } from '@/lib/gpsExtraction';
import type { Dispatch, SetStateAction } from "react";

interface UseNoteImageUploadParams {
  setImageGpsData: Dispatch<SetStateAction<Record<number, GpsData>>>;
  setImageGpsStatuses: Dispatch<SetStateAction<Record<number, GpsStatus>>>;
}

export function useNoteImageUpload({ setImageGpsData, setImageGpsStatuses }: UseNoteImageUploadParams) {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, status: '' });

  const { mutateAsync: uploadFile } = useUploadFile();
  const { toast } = useToast();

  const handleImageSelect = async (files: FileList | null) => {
    if (!files) return;

    // Filter for image files only
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    const newImageFiles: File[] = [];
    const newImageUrls: string[] = [];

    // Process each image file for EXIF correction
    for (const file of imageFiles) {
      let correctedPreviewUrl: string | undefined;

      try {
        correctedPreviewUrl = await createImagePreview(file);
      } catch (exifError) {
        console.warn(`[Note EXIF] Failed to read EXIF from ${file.name}:`, exifError);
        // Fallback: Original file als Preview
        correctedPreviewUrl = URL.createObjectURL(file);
      }

      newImageFiles.push(file);
      if (correctedPreviewUrl) {
        newImageUrls.push(correctedPreviewUrl);
      }
    }

    setImageFiles(prev => [...prev, ...newImageFiles]);
    setImageUrls(prev => [...prev, ...newImageUrls]);

    // Extract GPS from each image immediately upon selection
    const startIndex = imageUrls.length;
    for (let i = 0; i < newImageFiles.length; i++) {
      const file = newImageFiles[i];
      const index = startIndex + i;

      try {
        const gpsData = await extractGpsFromImage(file);
        if (gpsData) {
          setImageGpsData(prev => ({ ...prev, [index]: gpsData }));
          setImageGpsStatuses(prev => ({ ...prev, [index]: 'detected' }));
          console.log(`[Note GPS] Extracted from ${file.name} (image ${index}):`, gpsData);
        } else {
          setImageGpsStatuses(prev => ({ ...prev, [index]: 'not_found' }));
        }
      } catch (error) {
        console.error(`[Note GPS] Failed to extract from ${file.name}:`, error);
        setImageGpsStatuses(prev => ({ ...prev, [index]: 'error' }));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleImageSelect(e.dataTransfer.files);
  };

  const removeImageFile = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async () => {
    if (imageFiles.length === 0) return;

    setIsUploadingImages(true);
    setUploadProgress({ current: 0, total: imageFiles.length, status: 'Upload läuft...' });

    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const [urlTag] = await uploadFile(file);
        uploadedUrls.push(urlTag[1]); // URL is in second position

        // Update progress
        setUploadProgress({ current: i + 1, total: imageFiles.length, status: 'Upload läuft...' });
      }

      // Ersetze die korrigierten Previews durch die hochgeladenen URLs
      setImageUrls(prev => {
        // Entferne die Preview-URLs für die hochgeladenen Bilder und füge die Upload-URLs hinzu
        const existingUrls = prev.slice(0, prev.length - imageFiles.length);
        return [...existingUrls, ...uploadedUrls];
      });

      setImageFiles([]);
      setIsUploadingImages(false);
      setUploadProgress({ current: imageFiles.length, total: imageFiles.length, status: '' });

      toast({
        title: 'Erfolg!',
        description: `${uploadedUrls.length} Bild(er) erfolgreich hochgeladen.`,
      });
    } catch (error) {
      setIsUploadingImages(false);
      setUploadProgress({ current: 0, total: 0, status: 'Upload fehlgeschlagen' });
      toast({
        title: 'Fehler',
        description: 'Bild-Upload fehlgeschlagen. Bitte versuche es erneut.',
        variant: 'destructive'
      });
    }
  };

  const removeImageUrl = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
    // Also remove GPS data for this image
    setImageGpsData(prev => {
      const { [index]: _, ...rest } = prev;
      return rest;
    });
    setImageGpsStatuses(prev => {
      const { [index]: _, ...rest } = prev;
      return rest;
    });
  };

  return {
    imageFiles, imageUrls, isDragging, isUploadingImages, uploadProgress,
    setIsDragging, setImageFiles, setImageUrls,
    handleImageSelect, handleDrop, removeImageFile, uploadImages, removeImageUrl,
  };
}
