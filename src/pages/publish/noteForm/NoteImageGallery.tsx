/**
 * NoteImageGallery.tsx — Galerie „Hochgeladene Bilder" inkl. GPS-Overlay
 * (Zähler, „Alle entfernen", GPS-Anzeige mit Koordinaten, GPS+-Button,
 * Editor-Umschalter Einfach/Karte, LocationPicker, GpsEditor, Einzellöschung)
 * des Note-Formulars — 1:1 aus NoteForm.tsx verschoben (PLAN5.md Schritt 7).
 * Reines Verschieben, keine Logik-Änderungen.
 */

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GpsEditor } from "@/components/GpsEditor";
import { GpsStatusIndicator } from "@/components/GpsStatusIndicator";
import { LocationPicker } from "@/components/LocationPicker";
import { MapPin } from "@/lib/icons";
import { formatCoordinatesSimple, type GpsData, type GpsStatus } from '@/lib/gpsExtraction';
import type { Dispatch, SetStateAction } from "react";

interface NoteImageGalleryProps {
  imageUrls: string[];
  imageGpsData: Record<number, GpsData>;
  imageGpsStatuses: Record<number, GpsStatus>;
  editingGpsImage: number | null;
  showMapPicker: boolean;
  setShowMapPicker: Dispatch<SetStateAction<boolean>>;
  openGpsEditor: (imageIndex: number) => void;
  closeGpsEditor: () => void;
  saveGps: (imageIndex: number, gps: GpsData) => void | Promise<void>;
  removeGps: (imageIndex: number) => void;
  removeImageUrl: (index: number) => void;
  setImageUrls: Dispatch<SetStateAction<string[]>>;
  setImageGpsData: Dispatch<SetStateAction<Record<number, GpsData>>>;
  setImageGpsStatuses: Dispatch<SetStateAction<Record<number, GpsStatus>>>;
  setLocation: Dispatch<SetStateAction<string>>;
  setSelectedCountry: Dispatch<SetStateAction<string>>;
}

export function NoteImageGallery({
  imageUrls, imageGpsData, imageGpsStatuses,
  editingGpsImage, showMapPicker, setShowMapPicker,
  openGpsEditor, closeGpsEditor, saveGps, removeGps, removeImageUrl,
  setImageUrls, setImageGpsData, setImageGpsStatuses,
  setLocation, setSelectedCountry,
}: NoteImageGalleryProps) {
  return (
    <>
      {imageUrls.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Hochgeladene Bilder ({imageUrls.length})</Label>
            <Button
              onClick={() => {
                setImageUrls([]);
                setImageGpsData({});
                setImageGpsStatuses({});
              }}
              variant="outline"
              size="sm"
            >
              Alle entfernen
            </Button>
          </div>
           <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
             {imageUrls.map((url, index) => {
               const gpsData = imageGpsData[index];
               const gpsStatus = imageGpsStatuses[index];
               return (
                 <div key={index} className="relative group border rounded-lg overflow-hidden">
                   <img
                     src={url}
                     alt={`Uploaded ${index + 1}`}
                     className="w-full h-20 object-cover"
                   />

                    {/* GPS Display */}
                    {gpsData && gpsStatus && gpsData.latitude && gpsData.longitude && editingGpsImage !== index && (
                      <div className="space-y-2 cursor-pointer" onClick={() => openGpsEditor(index)}>
                        <GpsStatusIndicator status={gpsStatus} gps={gpsData} />
                        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-700 dark:text-gray-300">
                            <MapPin className="h-2.5 w-2.5 text-green-600 dark:text-green-400" />
                            <span className="truncate font-mono">
                              {formatCoordinatesSimple(gpsData.latitude, gpsData.longitude)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                   {/* Add GPS Button */}
                   {!gpsData && editingGpsImage !== index && (
                     <Button
                       size="sm"
                       variant="outline"
                       className="absolute bottom-1 right-1 text-xs h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                       onClick={() => openGpsEditor(index)}
                     >
                       <MapPin className="h-2.5 w-2.5 mr-1" />
                       GPS+
                     </Button>
                   )}

                    {/* GPS Editor */}
                    {editingGpsImage === index && (
                      <div className="absolute bottom-0 left-0 right-0 z-10 p-2 bg-white dark:bg-gray-800 border-t">
                        {/* Toggle between Simple Editor and Map */}
                        <div className="flex gap-2 mb-2">
                          <Button
                            size="sm"
                            variant={!showMapPicker ? 'default' : 'outline'}
                            className="flex-1 h-7 text-xs"
                            onClick={() => setShowMapPicker(false)}
                          >
                            <span className="mr-1">✏️</span>
                            Einfach
                          </Button>
                          <Button
                            size="sm"
                            variant={showMapPicker ? 'default' : 'outline'}
                            className="flex-1 h-7 text-xs"
                            onClick={() => setShowMapPicker(true)}
                          >
                            <span className="mr-1">🗺️</span>
                            Karte
                          </Button>
                        </div>

                        {/* Show Map Picker */}
                        {showMapPicker ? (
                          <LocationPicker
                            gps={gpsData}
                            onSave={(gps) => saveGps(index, gps)}
                            onCancel={closeGpsEditor}
                            initialZoom={13}
                            height="300px"
                            onCountryDetected={(country) => {
                              console.log('[NoteForm] Country detected:', country);
                              setSelectedCountry(country);
                            }}
                            onLocationDetected={(locationText) => {
                              console.log('[NoteForm] Location detected:', locationText);
                              setLocation(locationText);
                            }}
                          />
                        ) : (
                          /* Show Simple Editor */
                          <GpsEditor
                            gps={gpsData || undefined}
                            onSave={(gps) => saveGps(index, gps)}
                            onCancel={closeGpsEditor}
                            onRemove={() => removeGps(index)}
                          />
                        )}
                      </div>
                    )}

                   {/* Delete Button */}
                   <Button
                     variant="destructive"
                     size="sm"
                     className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                     onClick={() => removeImageUrl(index)}
                   >
                     ×
                   </Button>
                 </div>
               );
             })}
           </div>
        </div>
      )}
    </>
  );
}
