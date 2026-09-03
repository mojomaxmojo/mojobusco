/**
 * usePlaceFormHandlers.ts — kleine synchrone Handler des Ort-Formulars —
 * 1:1 aus PlaceForm.tsx verschoben (PLAN4.md Schritt 3).
 * Reines Verschieben, keine Logik-Änderungen.
 * (removeAdditionalImage und closeGpsEditor sind aktuell toter Code —
 * 1:1 übernommen, wie im Original ungenutzt.)
 */

import type { Dispatch, SetStateAction } from "react";

interface UsePlaceFormHandlersParams {
  setFacilities: Dispatch<SetStateAction<string[]>>;
  setBestFor: Dispatch<SetStateAction<string[]>>;
  setAdditionalImages: Dispatch<SetStateAction<string[]>>;
  setManualTags: Dispatch<SetStateAction<string[]>>;
  setEditingImageGps: Dispatch<SetStateAction<boolean>>;
  setShowMapPicker: Dispatch<SetStateAction<boolean>>;
}

export function usePlaceFormHandlers({
  setFacilities,
  setBestFor,
  setAdditionalImages,
  setManualTags,
  setEditingImageGps,
  setShowMapPicker,
}: UsePlaceFormHandlersParams) {
  const handleFacilityToggle = (facility: string) => {
    setFacilities(prev =>
      prev.includes(facility)
        ? prev.filter(f => f !== facility)
        : [...prev, facility]
    );
  };

  const handleBestForToggle = (item: string) => {
    setBestFor(prev =>
      prev.includes(item)
        ? prev.filter(b => b !== item)
        : [...prev, item]
    );
  };

  const removeAdditionalImage = (index: number) => {
    setAdditionalImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleManualTagInput = (input: string) => {
    // Split by both comma and whitespace, remove empty strings and # prefixes
    const tags = input
      .split(/[\s,]+/)
      .map(tag => tag.replace('#', '').trim())
      .filter(Boolean);

    if (tags.length > 0) {
      setManualTags(prev => [...prev, ...tags]);
    }
  };

  const removeManualTag = (index: number) => {
    setManualTags(prev => prev.filter((_, i) => i !== index));
  };

  const closeGpsEditor = () => {
    setEditingImageGps(false);
    setShowMapPicker(false);
  };

  return { handleFacilityToggle, handleBestForToggle, removeAdditionalImage,
           handleManualTagInput, removeManualTag, closeGpsEditor };
}
