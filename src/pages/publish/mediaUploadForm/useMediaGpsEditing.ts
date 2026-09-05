/**
 * useMediaGpsEditing.ts
 *
 * GPS-Editor: State + Funktionen (inkl. Reverse-Geocoding) — 1:1 aus
 * MediaUploadForm.tsx verschoben (PLAN3.md Schritt 6, ehem. Z. 160–163,
 * 540–607 und 656–670). Reines Verschieben, keine Logik-Änderungen.
 */

import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { reverseGeocode, mapCountryCode, type GpsData } from "@/lib/gpsExtraction";
import type { MediaFile } from "../publishUtils";

export function useMediaGpsEditing({ files, setFiles, setLocation, setSelectedCountry }: {
  files: MediaFile[];
  setFiles: Dispatch<SetStateAction<MediaFile[]>>;
  setLocation: Dispatch<SetStateAction<string>>;
  setSelectedCountry: Dispatch<SetStateAction<string>>;
}) {
  // GPS editing state
  const [editingGpsFile, setEditingGpsFile] = useState<string | null>(null);
  const [batchEditMode, setBatchEditMode] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // GPS editing functions
  const openGpsEditor = (fileId: string) => {
    setEditingGpsFile(fileId);
  };

  const closeGpsEditor = () => {
    setEditingGpsFile(null);
    setShowMapPicker(false);
  };

  const saveGps = async (fileId: string, gps: GpsData) => {
    // Save GPS to file
    setFiles(prev => prev.map(file => {
      if (file.id === fileId) {
        return {
          ...file,
          gps,
          gpsStatus: 'manual',
        };
      }
      return file;
    }));

    // Auto-fill location and country using reverse geocoding
    try {
      console.log('[Media GPS Manual] Reverse geocoding for manual GPS...', gps);
      const locationData = await reverseGeocode(gps.latitude, gps.longitude);
      if (locationData) {
        // Set location to city + neighbourhood/suburb (no postcode)
        const locationParts = [
          locationData.city,
          locationData.neighbourhood,
          locationData.suburb
        ].filter(Boolean);
        const loc = locationParts.join(', ');
        setLocation(loc);
        console.log('[Media GPS Manual] Location found:', loc);

        // Auto-fill country if detected
        const country = mapCountryCode(locationData);
        if (country) {
          setSelectedCountry(country);
          console.log('[Media GPS Manual] Country auto-filled:', country);
        }
      }
    } catch (error) {
      console.error('[Media GPS Manual] Reverse geocoding failed:', error);
    }

    closeGpsEditor();
  };

  const removeGps = (fileId: string) => {
    setFiles(prev => prev.map(file => {
      if (file.id === fileId) {
        const updated = { ...file };
        delete updated.gps;
        updated.gpsStatus = 'not_found';
        return updated;
      }
      return file;
    }));
    closeGpsEditor();
  };

  const toggleBatchEditMode = () => {
    setBatchEditMode(prev => !prev);
  };

  const applyGpsToAll = (sourceFileId: string) => {
    const sourceFile = files.find(f => f.id === sourceFileId);
    // gps in eine Konstante ziehen – das Narrowing des Guards überlebt
    // nicht in den map-Callback hinein
    const sourceGps = sourceFile?.gps;
    if (!sourceFile || !sourceGps) return;

    setFiles(prev => prev.map(file => {
      if (file.type === 'image' && file.id !== sourceFileId) {
        return {
          ...file,
          gps: { ...sourceGps },
          gpsStatus: 'manual',
        };
      }
      return file;
    }));
  };

  return { editingGpsFile, batchEditMode, showMapPicker, setShowMapPicker, openGpsEditor, closeGpsEditor, saveGps, removeGps, toggleBatchEditMode, applyGpsToAll };
}
