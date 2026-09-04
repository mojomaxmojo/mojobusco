/**
 * PlaceTitleImageSection.tsx — Titelbild-Karte des Ort-Formulars —
 * 1:1 aus PlaceForm.tsx verschoben (PLAN4.md Schritt 4). Reines Verschieben,
 * keine Logik-Änderungen. Props heißen wie die Original-Variablen, damit der
 * JSX-Inhalt zeichengleich bleibt. (Die console.log('[ArticleForm] …')-Texte
 * im Karten-Callback stammen so aus dem Original.)
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin } from "@/lib/icons";
import { GpsStatusIndicator } from "@/components/GpsStatusIndicator";
import { GpsEditor } from "@/components/GpsEditor";
import { LocationPicker } from "@/components/LocationPicker";
import { formatCoordinatesSimple, type GpsData, type GpsStatus } from "@/lib/gpsExtraction";
import type { Dispatch, SetStateAction } from "react";

interface PlaceTitleImageSectionProps {
  image: string;
  isUploading: boolean;
  imageGps: GpsData | null;
  imageGpsStatus: GpsStatus;
  editingImageGps: boolean;
  showMapPicker: boolean;
  setImage: (v: string) => void;
  setImageFile: (v: File | null) => void;
  setImageGps: (v: GpsData | null) => void;
  setImageGpsStatus: (v: GpsStatus) => void;
  setEditingImageGps: Dispatch<SetStateAction<boolean>>;
  setShowMapPicker: Dispatch<SetStateAction<boolean>>;
  setSelectedCountry: (v: string) => void;
  setLocation: (v: string) => void;
  handleImageFile: (file: File) => void;
}

export function PlaceTitleImageSection({
  image,
  isUploading,
  imageGps,
  imageGpsStatus,
  editingImageGps,
  showMapPicker,
  setImage,
  setImageFile,
  setImageGps,
  setImageGpsStatus,
  setEditingImageGps,
  setShowMapPicker,
  setSelectedCountry,
  setLocation,
  handleImageFile,
}: PlaceTitleImageSectionProps) {
  return (
        /* Title Image - Move to top */
        <div className="space-y-2">
          <Label htmlFor="article-image">Titelbild</Label>
          <div className="flex gap-2">
            {image ? (
              <div className="flex-1">
                <div className="relative group border rounded-lg p-3">
                  <img
                    src={image}
                    alt="Titelbild"
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                      <div className="text-white text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                        <p className="text-sm">Wird hochgeladen...</p>
                      </div>
                    </div>
                  )}

                  {/* GPS Info Display */}
                  {imageGps && imageGps.latitude && imageGps.longitude ? (
                    <div className="mt-3 space-y-2">
                      <GpsStatusIndicator status={imageGpsStatus} gps={imageGps} />
                      <div className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2">
                         <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                           <MapPin className="h-3 w-3 text-green-600 dark:text-green-400" />
                           <span className="truncate font-mono">
                             {formatCoordinatesSimple(imageGps.latitude, imageGps.longitude)}
                           </span>
                         </div>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-8 mt-3"
                      onClick={() => setEditingImageGps(true)}
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      GPS hinzufügen
                    </Button>
                  )}

                  {/* GPS Editor */}
                  {editingImageGps && (
                    <div className="space-y-2">
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
                          gps={imageGps || undefined}
                          onSave={(gps) => {
                            setImageGps(gps);
                            setImageGpsStatus('manual');
                            setEditingImageGps(false);
                          }}
                          onCancel={() => setEditingImageGps(false)}
                          initialZoom={13}
                          height="300px"
                          onCountryDetected={(country) => {
                            console.log('[ArticleForm] Country detected:', country);
                            setSelectedCountry(country);
                          }}
                          onLocationDetected={(locationText) => {
                            console.log('[ArticleForm] Location detected:', locationText);
                            setLocation(locationText);
                          }}
                        />
                      ) : (
                        /* Show Simple Editor */
                        <GpsEditor
                          gps={imageGps || undefined}
                          onSave={(gps) => {
                            setImageGps(gps);
                            setImageGpsStatus('manual');
                            setEditingImageGps(false);
                          }}
                          onCancel={() => setEditingImageGps(false)}
                          onRemove={() => {
                            setImageGps(null);
                            setImageGpsStatus('not_found');
                            setEditingImageGps(false);
                          }}
                        />
                      )}
                    </div>
                  )}

                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setImage('');
                      setImageFile(null);
                      setImageGps(null);
                      setImageGpsStatus('not_found');
                    }}
                    disabled={isUploading}
                  >
                    Entfernen
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageFile(file);
                    }}
                    className="mb-2 disabled:opacity-50"
                    disabled={isUploading}
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-white/80 rounded-md flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-ocean-600" />
                        <p className="text-xs text-ocean-600">Upload läuft...</p>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    oder
                  </p>
                  <Input
                    placeholder="https://... (Bild-URL)"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    className="mt-2 disabled:opacity-50"
                    disabled={isUploading}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
  );
}
