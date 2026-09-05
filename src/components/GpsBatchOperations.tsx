import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Copy, Trash2, Calculator, ArrowRight, X, Layers } from 'lucide-react';
import { GpsData } from '@/lib/gpsExtraction';
import { formatCoordinatesSimple } from '@/lib/gpsExtraction';
import { cn } from '@/lib/utils';

/**
 * Media file with GPS data
 */
export interface MediaFileWithGps {
  id: string;
  name: string;
  gps?: GpsData;
  gpsStatus?: 'detected' | 'manual' | 'not_found' | 'error';
}

/**
 * Props for GpsBatchOperations Component
 */
export interface GpsBatchOperationsProps {
  /** List of media files with GPS data */
  files: MediaFileWithGps[];
  /** Callback when GPS is applied to selected images */
  onApplyGps: (targetFileIds: string[], gps: GpsData) => void;
  /** Callback when GPS is removed from selected images */
  onRemoveGps: (targetFileIds: string[]) => void;
  /** Callback when GPS is cleared from all images */
  onClearAll: () => void;
  /** Callback to close batch panel */
  onClose?: () => void;
}

/**
 * GpsBatchOperations Component
 *
 * Advanced batch GPS operations for multiple images
 * Features:
 * - Copy GPS from first image to all selected images
 * - Copy GPS from any image to selected images
 * - Average GPS coordinates from selected images
 * - Clear GPS from all images
 * - Select/Deselect individual images
 */
export function GpsBatchOperations({
  files,
  onApplyGps,
  onRemoveGps,
  onClearAll,
  onClose,
}: GpsBatchOperationsProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [activeOperation, setActiveOperation] = useState<'copy_first' | 'copy_source' | 'average' | null>(null);

  // Get files with GPS
  const filesWithGps = useMemo(() => {
    return files.filter(f => f.gps && f.gpsStatus !== 'not_found');
  }, [files]);

  // Get first file with GPS (for copy-first operation)
  const firstFileWithGps = useMemo(() => {
    return filesWithGps.find(f => f.gps);
  }, [filesWithGps]);

  // Calculate average GPS coordinates from selected files
  const averageGps = useMemo(() => {
    const selected = filesWithGps.filter(f => selectedFiles.has(f.id));
    if (selected.length === 0) return null;

    const sumLat = selected.reduce((sum, f) => sum + f.gps!.latitude, 0);
    const sumLon = selected.reduce((sum, f) => sum + f.gps!.longitude, 0);
    const sumAlt = selected.reduce((sum, f) => sum + (f.gps!.altitude || 0), 0);

    return {
      latitude: sumLat / selected.length,
      longitude: sumLon / selected.length,
      altitude: sumAlt > 0 ? sumAlt / selected.length : undefined,
      precision: 'medium' as const,
    };
  }, [filesWithGps, selectedFiles]);

  // Toggle file selection
  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  // Select all files with GPS
  const selectAll = () => {
    const allIds = new Set(filesWithGps.map(f => f.id));
    setSelectedFiles(allIds);
  };

  // Deselect all files
  const deselectAll = () => {
    setSelectedFiles(new Set());
  };

  // Copy GPS from first file to selected files
  const handleCopyFirst = () => {
    if (!firstFileWithGps || selectedFiles.size === 0) return;
    onApplyGps(Array.from(selectedFiles), firstFileWithGps.gps!);
    setSelectedFiles(new Set());
    setActiveOperation(null);
  };

  // Copy GPS from selected files to unselected files
  const handleCopySelected = () => {
    if (selectedFiles.size === 0) return;

    const sourceFiles = filesWithGps.filter(f => selectedFiles.has(f.id));
    if (sourceFiles.length !== 1) {
      alert('Bitte wähle genau ein Bild mit GPS als Quelle aus.');
      return;
    }

    const sourceFile = sourceFiles[0];
    const targetFiles = filesWithGps.filter(f => !selectedFiles.has(f.id));

    onApplyGps(targetFiles.map(f => f.id), sourceFile.gps!);
    setSelectedFiles(new Set());
    setActiveOperation(null);
  };

  // Apply average GPS to selected files
  const handleAverage = () => {
    if (!averageGps || selectedFiles.size === 0) return;
    onApplyGps(Array.from(selectedFiles), averageGps);
    setSelectedFiles(new Set());
    setActiveOperation(null);
  };

  // Remove GPS from selected files
  const handleRemoveGps = () => {
    if (selectedFiles.size === 0) return;
    onRemoveGps(Array.from(selectedFiles));
    setSelectedFiles(new Set());
    setActiveOperation(null);
  };

  // Clear GPS from all files
  const handleClearAll = () => {
    onClearAll();
    setSelectedFiles(new Set());
  };

  if (filesWithGps.length === 0) {
    return null;
  }

  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Batch GPS-Operationen
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={selectAll}
              disabled={selectedFiles.size === filesWithGps.length}
              className="text-xs"
            >
              Alle
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={deselectAll}
              disabled={selectedFiles.size === 0}
              className="text-xs"
            >
              Keine
            </Button>
            {onClose && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">
            {selectedFiles.size} / {filesWithGps.length} ausgewählt
          </Badge>
          {filesWithGps.length > 0 && firstFileWithGps && (
            <span className="text-xs">
              Erstes GPS: {formatCoordinatesSimple(firstFileWithGps.gps!.latitude, firstFileWithGps.gps!.longitude)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Image Selection */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto p-2 bg-muted/30 rounded-lg">
          {filesWithGps.map(file => (
            <div
              key={file.id}
              onClick={() => toggleFileSelection(file.id)}
              className={cn(
                'flex items-center justify-between p-2 rounded border cursor-pointer transition-colors',
                selectedFiles.has(file.id)
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                  : 'bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-gray-200 dark:border-gray-700'
              )}
            >
              <span className="text-xs truncate flex-1">{file.name}</span>
              {file.gps && (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-mono">
                  {file.gps.latitude.toFixed(4)}, {file.gps.longitude.toFixed(4)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Batch Operations */}
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* Copy from First */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyFirst}
              disabled={selectedFiles.size === 0}
              className={cn(
                'flex items-center justify-start gap-2',
                activeOperation === 'copy_first' && 'ring-2 ring-blue-500'
              )}
              title="GPS vom ersten Bild auf alle ausgewählten Bilder kopieren"
            >
              <Copy className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <div className="flex flex-col items-start">
                <span className="text-xs font-medium">Erstes kopieren</span>
                <span className="text-[10px] text-muted-foreground">Vom ersten Bild auf alle</span>
              </div>
            </Button>

            {/* Copy from Selected */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopySelected}
              disabled={selectedFiles.size !== 1}
              className={cn(
                'flex items-center justify-start gap-2',
                activeOperation === 'copy_source' && 'ring-2 ring-blue-500'
              )}
              title="GPS vom ausgewählten Bild auf alle anderen kopieren"
            >
              <Copy className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <div className="flex flex-col items-start">
                <span className="text-xs font-medium">Ausgewähltes kopieren</span>
                <span className="text-[10px] text-muted-foreground">Vom ausgewählten auf alle</span>
              </div>
            </Button>

            {/* Average GPS */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleAverage}
              disabled={selectedFiles.size < 2 || !averageGps}
              className={cn(
                'flex items-center justify-start gap-2',
                activeOperation === 'average' && 'ring-2 ring-blue-500'
              )}
              title="Durchschnitt der GPS-Koordinaten berechnen und anwenden"
            >
              <Calculator className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <div className="flex flex-col items-start">
                <span className="text-xs font-medium">Durchschnitt</span>
                <span className="text-[10px] text-muted-foreground">
                  {averageGps ? formatCoordinatesSimple(averageGps.latitude, averageGps.longitude) : 'Min. 2 auswählen'}
                </span>
              </div>
            </Button>

            {/* Remove GPS */}
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRemoveGps}
              disabled={selectedFiles.size === 0}
              className="flex items-center justify-start gap-2"
              title="GPS von ausgewählten Bildern entfernen"
            >
              <Trash2 className="h-3 w-3" />
              <div className="flex flex-col items-start">
                <span className="text-xs font-medium">GPS entfernen</span>
                <span className="text-[10px] text-red-600 dark:text-red-400">
                  Von {selectedFiles.size} Bildern
                </span>
              </div>
            </Button>
          </div>

          {/* Clear All */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleClearAll}
            className="w-full flex items-center justify-start gap-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
            title="GPS von allen Bildern entfernen"
          >
            <Trash2 className="h-3 w-3" />
            <span className="text-xs font-medium">Alle GPS-Daten löschen</span>
          </Button>
        </div>

        {/* Instructions */}
        <div className="text-[10px] text-muted-foreground space-y-1 bg-muted/20 p-2 rounded">
          <div className="flex items-start gap-1">
            <ArrowRight className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span><strong>Klicke auf Bild</strong> zum Auswählen</span>
          </div>
          <div className="flex items-start gap-1">
            <ArrowRight className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span><strong>Erstes kopieren:</strong> GPS vom ersten auf alle ausgewählten Bilder</span>
          </div>
          <div className="flex items-start gap-1">
            <ArrowRight className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span><strong>Ausgewähltes kopieren:</strong> Wähle genau 1 Bild als Quelle</span>
          </div>
          <div className="flex items-start gap-1">
            <ArrowRight className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span><strong>Durchschnitt:</strong> Mittelpunkt aller ausgewählten GPS-Koordinaten</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
