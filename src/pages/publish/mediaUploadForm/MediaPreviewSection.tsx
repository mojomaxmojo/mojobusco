/**
 * MediaPreviewSection.tsx
 *
 * Media-Preview-Karte: Datei-Grid mit Drag-&-Drop-Sortierung, GPS-Anzeige,
 * Inline-GPS-Editor (Einfach/Karte) und Batch-GPS-Panel — 1:1 aus
 * MediaUploadForm.tsx verschoben (PLAN3.md Schritt 7, ehem. Z. 990–1221).
 * Reines Verschieben, keine Logik-Änderungen. Props tragen die
 * Original-Namen, damit der JSX-Inhalt zeichengleich bleibt.
 */

import type { Dispatch, SetStateAction } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GpsStatusIndicator } from "@/components/GpsStatusIndicator";
import { LocationPicker } from "@/components/LocationPicker";
import { GpsEditor } from "@/components/GpsEditor";
import { formatCoordinatesSimple, type GpsData } from "@/lib/gpsExtraction";
import { Video, Music, File as FileIcon, MapPin, CheckCircle, Wrench } from "@/lib/icons";
import type { MediaFile } from "../publishUtils";

export function MediaPreviewSection({
  files, batchEditMode, toggleBatchEditMode,
  dragIndex, dragOverIndex, handleDragStart, handleDragOver, handleDragDrop, handleDragEnd, moveFile,
  editingGpsFile, openGpsEditor, showMapPicker, setShowMapPicker,
  saveGps, closeGpsEditor, removeGps, applyGpsToAll, removeFile,
  setLocation, setSelectedCountry,
}: {
  files: MediaFile[];
  batchEditMode: boolean;
  toggleBatchEditMode: () => void;
  dragIndex: number | null;
  dragOverIndex: number | null;
  handleDragStart: (index: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDragDrop: (e: React.DragEvent, dropIndex: number) => void;
  handleDragEnd: () => void;
  moveFile: (index: number, direction: 'left' | 'right') => void;
  editingGpsFile: string | null;
  openGpsEditor: (fileId: string) => void;
  showMapPicker: boolean;
  setShowMapPicker: Dispatch<SetStateAction<boolean>>;
  saveGps: (fileId: string, gps: GpsData) => Promise<void>;
  closeGpsEditor: () => void;
  removeGps: (fileId: string) => void;
  applyGpsToAll: (sourceFileId: string) => void;
  removeFile: (id: string) => void;
  setLocation: Dispatch<SetStateAction<string>>;
  setSelectedCountry: Dispatch<SetStateAction<string>>;
}) {
  return (
    <>
      {/* Media Preview */}
       {files.length > 0 && (
         <Card>
           <CardHeader>
             <div className="flex items-center justify-between">
               <div>
                 <CardTitle>Vorschau ({files.length} Dateien)</CardTitle>
                 {files.length > 1 && files.some(f => f.type === 'image') && (
                   <p className="text-xs text-muted-foreground mt-1">
                     ☰ Ziehen zum Sortieren · Reihenfolge gilt auch für Slideshow
                   </p>
                 )}
               </div>
               {files.some(f => f.type === 'image') && (
                 <Button
                   size="sm"
                   variant={batchEditMode ? "default" : "outline"}
                   onClick={toggleBatchEditMode}
                   className="gap-1"
                 >
                   {batchEditMode ? <CheckCircle className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                   {batchEditMode ? "Batch-Edit aktiv" : "Batch-Edit"}
                 </Button>
               )}
             </div>
           </CardHeader>
           <CardContent>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {files.map((file, index) => (
                  <div
                    key={file.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDragDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`relative group border-2 rounded-lg overflow-hidden transition-all cursor-grab active:cursor-grabbing select-none ${
                      dragOverIndex === index && dragIndex !== index
                        ? 'border-ocean-500 bg-ocean-50 dark:bg-ocean-950/30 scale-[1.02] shadow-lg'
                        : dragIndex === index
                          ? 'border-dashed border-gray-400 opacity-50'
                          : 'border-transparent'
                    }`}
                  >
                    {/* Reihenfolge-Badge + Drag-Handle oben links */}
                    <div className="absolute top-1 left-1 z-20 flex items-center gap-1">
                      <div className="bg-black/60 text-white text-xs font-bold w-5 h-5 rounded flex items-center justify-center">
                        {index + 1}
                      </div>
                      <div className="bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity px-1 py-0.5 rounded text-xs">
                        ☰
                      </div>
                    </div>

                    {/* Pfeil-Buttons zum Verschieben (erscheinen beim Hover) */}
                    {files.length > 1 && (
                      <div className="absolute bottom-1 left-1 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); moveFile(index, 'left'); }}
                            className="bg-black/60 hover:bg-ocean-600 text-white text-xs w-6 h-6 rounded flex items-center justify-center transition-colors"
                            title="Nach links"
                          >
                            ‹
                          </button>
                        )}
                        {index < files.length - 1 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); moveFile(index, 'right'); }}
                            className="bg-black/60 hover:bg-ocean-600 text-white text-xs w-6 h-6 rounded flex items-center justify-center transition-colors"
                            title="Nach rechts"
                          >
                            ›
                          </button>
                        )}
                      </div>
                    )}

                    {file.preview ? (
                      file.type === 'video' ? (
                        // Video-Vorschau mit Controls
                        <video
                          src={file.preview}
                          controls
                          className="w-full h-32 object-cover rounded"
                          preload="metadata"
                        />
                      ) : (
                        // Bild-Vorschau
                        <img
                          src={file.preview}
                          alt={file.name}
                          className="w-full h-32 object-cover rounded"
                        />
                      )
                    ) : (
                      <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                        {file.type === 'video' && <Video className="h-8 w-8 text-gray-400" />}
                        {file.type === 'audio' && <Music className="h-8 w-8 text-gray-400" />}
                        {file.type === 'document' && <FileIcon className="h-8 w-8 text-gray-400" />}
                      </div>
                    )}
                   <div className="p-2 space-y-1">
                     <div className="text-sm">
                       <p className="font-medium truncate">{file.name}</p>
                       <p className="text-gray-500 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                     </div>

                     {/* GPS Info Display */}
                     {file.type === 'image' && (
                       <>
                         {file.gps && file.gps.latitude && file.gps.longitude ? (
                           <div className="space-y-2">
                             <GpsStatusIndicator status={file.gpsStatus} gps={file.gps} />
                             <div className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2">
                               <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                 <MapPin className="h-3 w-3 text-green-600 dark:text-green-400" />
                                 <span className="truncate font-mono">
                                   {formatCoordinatesSimple(file.gps.latitude, file.gps.longitude)}
                                 </span>
                               </div>
                             </div>
                           </div>
                         ) : (
                           <Button
                             size="sm"
                             variant="outline"
                             className="w-full text-xs h-8"
                             onClick={() => openGpsEditor(file.id)}
                           >
                             <MapPin className="h-3 w-3 mr-1" />
                             GPS hinzufügen
                           </Button>
                         )}
                       </>
                     )}
                   </div>

                   {/* GPS Editor */}
                   {editingGpsFile === file.id && file.type === 'image' && (
                     <div className="mt-2 space-y-2">
                       {/* Toggle between Simple Editor and Map */}
                       <div className="flex gap-2">
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
                           gps={file.gps}
                           onSave={(gps) => saveGps(file.id, gps)}
                           onCancel={closeGpsEditor}
                           initialZoom={13}
                           height="300px"
                           onCountryDetected={(country) => {
                             console.log('[Publish] Country detected:', country);
                             setSelectedCountry(country);
                           }}
                           onLocationDetected={(locationText) => {
                             console.log('[Publish] Location detected:', locationText);
                             setLocation(locationText);
                           }}
                         />
                       ) : (
                         /* Show Simple Editor */
                         <GpsEditor
                           gps={file.gps}
                           onSave={(gps) => saveGps(file.id, gps)}
                           onCancel={closeGpsEditor}
                           onRemove={() => removeGps(file.id)}
                           onApplyToAll={() => applyGpsToAll(file.id)}
                         />
                       )}
                     </div>
                   )}

                   {/* Delete Button */}
                   <Button
                     variant="destructive"
                     size="sm"
                     className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                     onClick={() => removeFile(file.id)}
                   >
                     ×
                   </Button>
                 </div>
               ))}
             </div>

             {/* Batch GPS Edit Panel */}
             {batchEditMode && files.some(f => f.type === 'image' && f.gps) && (
               <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                 <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">Batch GPS bearbeiten</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {files.filter(f => f.type === 'image' && f.gps).map(file => (
                     <div key={file.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border">
                       <span className="text-sm truncate">{file.name}</span>
                       <Button
                         size="sm"
                         variant="outline"
                         className="h-7"
                         onClick={() => applyGpsToAll(file.id)}
                       >
                         Auf alle anwenden
                       </Button>
                     </div>
                   ))}
                 </div>
               </div>
             )}
           </CardContent>
         </Card>
       )}
    </>
  );
}
