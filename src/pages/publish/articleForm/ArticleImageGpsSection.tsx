/**
 * ArticleImageGpsSection.tsx
 *
 * JSX-Sektion des Berichte-Formulars: Titelbild + GPS + Standort + Land —
 * 1:1 aus ArticleForm.tsx verschoben (PLAN.md Schritt 7). Reines Verschieben,
 * keine Logik-Änderungen (alle Props werden unverändert weitergereicht).
 */

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GpsEditor } from "@/components/GpsEditor";
import { GpsStatusIndicator } from "@/components/GpsStatusIndicator";
import { CountrySelector } from "@/components/CountrySelector";
import { ImageIcon, Loader2, MapPin } from "@/lib/icons";
import { formatCoordinatesSimple, type GpsData, type GpsStatus } from "@/lib/gpsExtraction";
import type { useToast } from "@/hooks/useToast";

type ToastFn = ReturnType<typeof useToast>['toast'];

interface ArticleImageGpsSectionProps {
  image: string;
  setImage: (v: string) => void;
  isUploading: boolean;
  handleArticleImageUpload: (file: File) => void;
  imageGps: GpsData | null;
  setImageGps: (g: GpsData | null) => void;
  imageGpsStatus: GpsStatus;
  setImageGpsStatus: (s: GpsStatus) => void;
  editingImageGps: boolean;
  setEditingImageGps: (v: boolean) => void;
  setShowMediaLibrary: (v: boolean) => void;
  location: string;
  setLocation: (v: string) => void;
  selectedCountry: string;
  setSelectedCountry: (v: string) => void;
  // GPS-Save-Callback zeigt einen Toast (ursprünglich inline in ArticleForm)
  toast: ToastFn;
}

export function ArticleImageGpsSection({
  image,
  setImage,
  isUploading,
  handleArticleImageUpload,
  imageGps,
  setImageGps,
  imageGpsStatus,
  setImageGpsStatus,
  editingImageGps,
  setEditingImageGps,
  setShowMediaLibrary,
  location,
  setLocation,
  selectedCountry,
  setSelectedCountry,
  toast,
}: ArticleImageGpsSectionProps) {
  return (
    <>
        {/* Title Image - Move to top */}
        <div className="space-y-2">
          <Label htmlFor="article-image">Titelbild</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowMediaLibrary(true)}
          >
            <ImageIcon className="h-4 w-4 mr-1" />
            Aus Media-Library wählen
          </Button>
          <div className="flex gap-2">
            {image ? (
              <div className="flex-1">
                <div className="relative">
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
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImage('')}
                  className="mt-2"
                  disabled={isUploading}
                >
                  Entfernen
                </Button>
              </div>
            ) : (
                 <div className="flex-1">
                  <div className="relative">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleArticleImageUpload(file);
                      }}
                      className="flex-1 mb-2 disabled:opacity-50"
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
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button variant="outline" asChild disabled={isUploading}>
                      <label htmlFor="article-image-url" className="cursor-pointer">
                        URL
                      </label>
                    </Button>
                    <Input
                      id="article-image-url"
                      placeholder="https://..."
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      className="flex-1 disabled:opacity-50"
                      disabled={isUploading}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* GPS Info Display + manueller Editor */}
            {editingImageGps ? (
              <GpsEditor
                gps={imageGps ?? undefined}
                onSave={(gps) => {
                  setImageGps(gps);
                  setImageGpsStatus('manual');
                  setEditingImageGps(false);
                  toast({ title: 'GPS gespeichert', description: 'Fließt in Wetter-Kontext, Karte und Publish-Tags ein.' });
                }}
                onCancel={() => setEditingImageGps(false)}
                onRemove={imageGps ? () => {
                  setImageGps(null);
                  setImageGpsStatus('not_found');
                  setEditingImageGps(false);
                } : undefined}
              />
            ) : imageGps && imageGps.latitude && imageGps.longitude ? (
              <div className="space-y-2">
                <GpsStatusIndicator status={imageGpsStatus} gps={imageGps} />
                <div className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2">
                  <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                    <MapPin className="h-3 w-3 text-green-600 dark:text-green-400" />
                    <span className="truncate font-mono">
                      {formatCoordinatesSimple(imageGps.latitude, imageGps.longitude)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 ml-auto"
                      onClick={() => setEditingImageGps(true)}
                      title="GPS-Koordinaten bearbeiten"
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      Bearbeiten
                    </Button>
                  </div>
                </div>
              </div>
             ) : (
              <Button size="sm" variant="outline" onClick={() => setEditingImageGps(true)}>
                <MapPin className="h-4 w-4 mr-1" />
                GPS manuell hinzufügen
              </Button>
             )}
           </div>

         {/* Location (auto-filled from GPS) */}
         <div className="space-y-2">
          <Label htmlFor="article-location">Standort</Label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                id="article-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Wo wurde dieser Artikel erstellt? (z.B. Lagos, Portugal)"
                className="flex-1"
              />
            </div>
            {imageGps && (
              <GpsStatusIndicator status={imageGpsStatus} gps={imageGps} />
            )}
          </div>
          {location && imageGps && (
            <p className="text-xs text-green-600 dark:text-green-400">
              📍 Standort automatisch aus GPS-Koordinaten ermittelt
            </p>
          )}
        </div>

        {/* Country Selection */}
        <CountrySelector
          selectedCountry={selectedCountry}
          onCountryChange={setSelectedCountry}
          placeholder="Land auswaehlen"
        />
    </>
  );
}