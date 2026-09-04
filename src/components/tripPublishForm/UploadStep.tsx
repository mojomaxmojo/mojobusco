/**
 * UploadStep.tsx – Wizard-Schritt „Bilder" (Upload + Stationen + GPS-Editor-Dialog)
 * (JSX 1:1 aus TripPublishForm.tsx, orig. Zeilen 943–1145, PLAN6 Schritt 16)
 */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { LocationPicker } from '@/components/LocationPicker';
import { GpsEditor } from '@/components/GpsEditor';
import { ChevronRight, Camera, MapPin, GripVertical, Upload, X } from '@/lib/icons';
import { formatCoordinatesSimple } from '@/lib/gpsExtraction';
import type { TripStation } from '@/lib/trip/tripTypes';

export function UploadStep({
  stations,
  stationsWithGps,
  isDragging,
  setIsDragging,
  handleDrop,
  handleFileSelect,
  draggedId,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
  removeStation,
  editingStation,
  setEditingStation,
  showMapPicker,
  setShowMapPicker,
  saveGps,
  removeGps,
  canProceedToDetails,
  setCurrentStep,
}: {
  stations: TripStation[]
  stationsWithGps: number
  isDragging: boolean
  setIsDragging: (v: boolean) => void
  handleDrop: (e: React.DragEvent) => void
  handleFileSelect: (files: FileList | null) => void
  draggedId: string | null
  handleDragStart: (id: string) => void
  handleDragOver: (e: React.DragEvent, targetId: string) => void
  handleDragEnd: () => void
  removeStation: (id: string) => void
  editingStation: string | null
  setEditingStation: (v: string | null) => void
  showMapPicker: boolean
  setShowMapPicker: (v: boolean) => void
  saveGps: (stationId: string, gps: any) => void
  removeGps: (stationId: string) => void
  canProceedToDetails: boolean
  setCurrentStep: (v: 'upload' | 'details' | 'preview' | 'publish') => void
}) {
  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 dark:border-gray-600'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          id="trip-image-upload"
        />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium mb-2">Bilder für deinen Trip hochladen</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Ziehe Bilder hierher oder klicke zum Auswählen. Mindestens 2 Bilder erforderlich.
        </p>
        <Button asChild>
          <label htmlFor="trip-image-upload" className="cursor-pointer">
            <Camera className="h-4 w-4 mr-2" />
            Bilder auswählen
          </label>
        </Button>
      </div>

      {/* Image Grid */}
      {stations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              Stationen ({stations.length}) - {stationsWithGps} mit GPS
            </h3>
            <p className="text-sm text-muted-foreground">
              Ziehe zum Sortieren
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {stations.map((station, index) => (
              <div
                key={station.id}
                draggable
                onDragStart={() => handleDragStart(station.id)}
                onDragOver={(e) => handleDragOver(e, station.id)}
                onDragEnd={handleDragEnd}
                className={`relative group border rounded-lg overflow-hidden cursor-move ${
                  draggedId === station.id ? 'opacity-50' : ''
                }`}
              >
                {/* Drag Handle */}
                <div className="absolute top-1 left-1 z-10 bg-black/50 rounded p-1">
                  <GripVertical className="h-4 w-4 text-white" />
                </div>

                {/* Station Number */}
                <div className="absolute top-1 right-10 z-10 bg-primary rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold">
                  {index + 1}
                </div>

                {/* Image */}
                <img
                  src={station.preview}
                  alt={station.title || `Station ${index + 1}`}
                  className="w-full h-32 object-cover"
                />

                {/* GPS Status */}
                <div className="p-2 space-y-1">
                  {station.gps ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs text-green-600 justify-start overflow-hidden"
                      onClick={() => setEditingStation(station.id)}
                    >
                      <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{station.location || 'GPS erkannt'}</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs"
                      onClick={() => setEditingStation(station.id)}
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      GPS hinzufügen
                    </Button>
                  )}
                </div>

                {/* Delete Button */}
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  onClick={() => removeStation(station.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GPS Editor Dialog */}
      <Dialog open={editingStation !== null} onOpenChange={(open) => { if (!open) { setEditingStation(null); setShowMapPicker(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              GPS-Standort bearbeiten
            </DialogTitle>
            <DialogDescription>
              Wähle zwischen Koordinaten-Eingabe oder Karte
            </DialogDescription>
          </DialogHeader>

          {editingStation && (() => {
            const station = stations.find(s => s.id === editingStation);
            if (!station) return null;

            return (
              <div className="space-y-4">
                {/* Preview Image */}
                <div className="flex gap-4 items-start">
                  <img
                    src={station.preview}
                    alt=""
                    className="w-24 h-24 object-cover rounded"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{station.title || `Station ${stations.findIndex(s => s.id === editingStation) + 1}`}</p>
                    {station.gps && (
                      <p className="text-sm text-muted-foreground">
                        Aktuell: {formatCoordinatesSimple(station.gps.latitude, station.gps.longitude)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Toggle Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant={!showMapPicker ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setShowMapPicker(false)}
                  >
                    ✏️ Koordinaten eingeben
                  </Button>
                  <Button
                    variant={showMapPicker ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setShowMapPicker(true)}
                  >
                    🗺️ Auf Karte wählen
                  </Button>
                </div>

                {/* Editor Content */}
                {showMapPicker ? (
                  <LocationPicker
                    gps={station.gps}
                    onSave={(gps) => saveGps(station.id, gps)}
                    onCancel={() => { setEditingStation(null); setShowMapPicker(false); }}
                    height="350px"
                  />
                ) : (
                  <GpsEditor
                    gps={station.gps}
                    onSave={(gps) => saveGps(station.id, gps)}
                    onCancel={() => { setEditingStation(null); setShowMapPicker(false); }}
                    onRemove={() => removeGps(station.id)}
                  />
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Navigation */}
      <div className="flex justify-end">
        <Button
          onClick={() => setCurrentStep('details')}
          disabled={!canProceedToDetails}
        >
          Weiter zur Beschreibung
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}