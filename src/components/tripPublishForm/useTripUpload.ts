/**
 * useTripUpload.ts – Bild-Auswahl (EXIF/GPS), Drag-Sortierung, Stationen löschen, Blossom-Upload
 * aus TripPublishForm.tsx (1:1 verschoben, PLAN6 Schritt 20).
 */

import { useState } from 'react'
import { extractGpsFromImage, reverseGeocode } from '@/lib/gpsExtraction'
import { readImageExif } from '@/lib/trip/tripExif'
import { createCorrectedPreview, createCorrectedFile } from '@/lib/trip/tripImageUtils'
import { useUploadFile } from '@/hooks/useUploadFile'
import { useToast } from '@/hooks/useToast'
import type { TripStation } from '@/lib/trip/tripTypes'

export function useTripUpload({
  stations,
  setStations,
  setIsDragging,
}: {
  stations: TripStation[]
  setStations: React.Dispatch<React.SetStateAction<TripStation[]>>
  setIsDragging: (v: boolean) => void
}) {
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, status: '' });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const { toast } = useToast();
  const { mutateAsync: uploadFile } = useUploadFile();

  // Handle file selection
  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    const newStations: TripStation[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;

      const { fileDate, timestamp, exifWidth, exifHeight, exifOrientation } = await readImageExif(file);

      // Bild laden um Vorschau zu erstellen
      let previewUrl: string;
      try {
        previewUrl = await createCorrectedPreview(file, exifWidth, exifHeight, exifOrientation);
      } catch (previewError) {
        console.warn(`[Trip Preview] Failed to create preview for ${file.name}:`, previewError);
        previewUrl = URL.createObjectURL(file);
      }

      const station: TripStation = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: previewUrl,
        gpsStatus: 'not_found',
        location: '',
        title: '',
        description: '',
        date: fileDate,
        timestamp,
        exifOrientation,
      };

      // Extract GPS from image (with better error handling for mobile)
      try {
        console.log(`[Trip GPS] Starting extraction for ${file.name}...`);
        const gpsData = await extractGpsFromImage(file);
        if (gpsData) {
          station.gps = gpsData;
          station.gpsStatus = 'detected';
          console.log(`[Trip GPS] ✓ Extracted from ${file.name}:`, gpsData);

          // Get location name via reverse geocoding
          try {
            const locationData = await reverseGeocode(gpsData.latitude, gpsData.longitude);
            if (locationData) {
              // Use specificLocation (first 3 parts of address) for more precision
              // Example: "Rocha Baixinha Beach, Avenida Comendador André Jordan, Vilamoura"
              station.location = locationData.specificLocation ||
                                 locationData.display_name?.split(',').slice(0, 3).join(', ') ||
                                 [locationData.city, locationData.suburb].filter(Boolean).join(', ');
              console.log(`[Trip Location] Found for ${file.name}:`, station.location);

              // Auto-fill title if empty
              if (!station.title && station.location) {
                station.title = station.location;
              }
            }
          } catch (geoError) {
            console.warn(`[Trip Location] Reverse geocoding failed for ${file.name}:`, geoError);
          }
        } else {
          console.log(`[Trip GPS] ✗ No GPS found in ${file.name}`);
        }
      } catch (error: any) {
        console.error(`[Trip GPS] ✗ Failed to extract from ${file.name}:`, error?.message || error);
        station.gpsStatus = 'error';
      }

      newStations.push(station);
    }

    // Sortieren nach EXIF-Timestamp (ältestes zuerst = Station 1)
    // a - b = aufsteigend = ältestes Bild (kleinster timestamp) zuerst
    newStations.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    console.log('[Trip] New stations sorted by timestamp');

    // Merge with existing stations and sort entire list
    setStations(prev => {
      const allStations = [...prev, ...newStations];

      // Debug: Log timestamps before sorting
      console.log('[Trip] Before sorting:');
      allStations.forEach((s, i) => {
        console.log(`  [${i}] ${s.file?.name}: timestamp=${s.timestamp}, date=${s.date}`);
      });

      // Sort all stations by timestamp (oldest first = smallest timestamp = Station 1)
      allStations.sort((a, b) => {
        const tsA = a.timestamp || 0;
        const tsB = b.timestamp || 0;
        return tsA - tsB; // Ascending: oldest (smallest) first
      });

      // Debug: Log timestamps after sorting
      console.log('[Trip] After sorting (oldest first = Station 1):');
      allStations.forEach((s, i) => {
        console.log(`  Station ${i + 1}: ${s.file?.name} (timestamp=${s.timestamp})`);
      });

      return allStations;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeStation = (id: string) => {
    setStations(prev => {
      const station = prev.find(s => s.id === id);
      if (station?.preview) {
        URL.revokeObjectURL(station.preview);
      }
      return prev.filter(s => s.id !== id);
    });
  };

  // Drag & Drop reordering
  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    setStations(prev => {
      const newStations = [...prev];
      const draggedIndex = newStations.findIndex(s => s.id === draggedId);
      const targetIndex = newStations.findIndex(s => s.id === targetId);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [draggedStation] = newStations.splice(draggedIndex, 1);
        newStations.splice(targetIndex, 0, draggedStation);
      }

      return newStations;
    });
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  // Upload all images to Blossom and return updated stations
  const uploadImages = async (): Promise<TripStation[]> => {
    setIsUploading(true);
    setUploadProgress({ current: 0, total: stations.length, status: 'Upload gestartet...' });

    const updatedStations: TripStation[] = [];

    try {
      for (let i = 0; i < stations.length; i++) {
        const station = stations[i];

        // Skip stations that are already uploaded (edit mode)
        if (station.uploaded && station.uploadedUrl) {
          console.log(`[Trip Upload] Station ${i + 1} already uploaded, skipping`);
          updatedStations.push(station);
          setUploadProgress({
            current: i + 1,
            total: stations.length,
            status: `Überspringe Station ${i + 1} (bereits vorhanden)`
          });
          continue;
        }

        // Skip stations without file (should not happen)
        if (!station.file) {
          console.warn(`[Trip Upload] Station ${i + 1} has no file, skipping`);
          continue;
        }

        setUploadProgress({
          current: i + 1,
          total: stations.length,
          status: `Lade ${station.file.name} hoch...`
        });

        try {
          // Create corrected file with proper orientation before upload
          const correctedFile = await createCorrectedFile(station.file, station.exifOrientation);

          const uploadResult = await uploadFile(correctedFile);

          let uploadedUrl: string | undefined;
          if (Array.isArray(uploadResult)) {
            const urlTag = uploadResult.find(tag =>
              Array.isArray(tag) && tag.length >= 2 && tag[0] === 'url'
            );
            if (urlTag) {
              uploadedUrl = urlTag[1];
            }
          }

          updatedStations.push({
            ...station,
            uploaded: true,
            uploadedUrl,
          });

          console.log(`[Trip Upload] Station ${i + 1} uploaded:`, uploadedUrl);
        } catch (uploadError: any) {
          console.error(`[Trip Upload] Failed to upload station ${i + 1}:`, uploadError);
          toast({
            title: 'Fehler beim Upload',
            description: `Bild ${i + 1} konnte nicht hochgeladen werden: ${uploadError.message}`,
            variant: 'destructive'
          });
          return []; // Abort on error
        }
      }

      toast({
        title: 'Upload erfolgreich!',
        description: `${stations.length} Bilder wurden hochgeladen.`,
      });

      // Update state with uploaded stations
      setStations(updatedStations);

      return updatedStations;
    } catch (error) {
      console.error('[Trip Upload] Error:', error);
      toast({
        title: 'Fehler beim Upload',
        description: 'Einige Bilder konnten nicht hochgeladen werden.',
        variant: 'destructive'
      });
      return [];
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0, status: '' });
    }
  };

  return {
    isUploading,
    uploadProgress,
    draggedId,
    setDraggedId,
    handleFileSelect,
    handleDrop,
    removeStation,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    uploadImages,
  }
}