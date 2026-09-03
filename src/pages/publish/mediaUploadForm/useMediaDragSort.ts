/**
 * useMediaDragSort.ts
 *
 * Drag-and-Drop Reihenfolge + Pfeil-Buttons (lokale Listenlogik) —
 * 1:1 aus MediaUploadForm.tsx verschoben (PLAN3.md Schritt 5, ehem.
 * Z. 609–654). Reines Verschieben, keine Logik-Änderungen.
 */

import { useState } from "react";
import type { MediaFile } from "../publishUtils";

export function useMediaDragSort({ files, setFiles }: {
  files: MediaFile[];
  setFiles: React.Dispatch<React.SetStateAction<MediaFile[]>>;
}) {
  // ── Drag-and-Drop Reihenfolge ──────────────────────────────────────────
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== dragIndex) setDragOverIndex(index);
  };

  const handleDragDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setFiles(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(dropIndex, 0, moved);
      return updated;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Bild nach links/rechts verschieben (Pfeil-Buttons als Alternative)
  const moveFile = (index: number, direction: 'left' | 'right') => {
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= files.length) return;
    setFiles(prev => {
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return updated;
    });
  };

  return { dragIndex, dragOverIndex, handleDragStart, handleDragOver, handleDragDrop, handleDragEnd, moveFile };
}
