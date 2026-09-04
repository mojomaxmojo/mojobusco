/**
 * PreviewStep.tsx – Wizard-Schritt „Vorschau" (Routen-Karte, Zusammenfassung, Remotion-Block, Video-URL, Veröffentlichen)
 * (JSX 1:1 aus TripPublishForm.tsx, orig. Zeilen 1589–1835, PLAN6 Schritt 18)
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { VanillaMap, type MapMarker } from '@/components/VanillaMap';
import { RemotionVideoBlock } from '@/components/RemotionVideoBlock';
import { ExperiencesConfirm } from '@/components/assistant/ExperiencesConfirm';
import { ChevronLeft, MapPin, Route, Upload, Map as MapIcon } from '@/lib/icons';
import { Loader2 } from 'lucide-react';
import { AUTO_TRANSLATE_STORAGE_KEY } from '@/config/translation';
import type { TripStation, TripData } from '@/lib/trip/tripTypes';

export function PreviewStep({
  stations,
  stationsWithGps,
  tripData,
  mapMarkers,
  isEditMode,
  lifestyle,
  setSlideshowVideoUrl,
  slideshowVideoUrl,
  setSlideshowVideoUrlInput,
  toast,
  experiencesConfirmed,
  setExperiencesConfirmed,
  canPublish,
  isUploading,
  isPublishing,
  uploadProgress,
  handlePublish,
  publishTeaserNote, setPublishTeaserNote,
  autoTranslateEn, setAutoTranslateEn,
  setCurrentStep,
}: {
  stations: TripStation[]
  stationsWithGps: number
  tripData: TripData
  mapMarkers: MapMarker[]
  isEditMode: boolean
  lifestyle: string
  setSlideshowVideoUrl: (v: string | null) => void
  slideshowVideoUrl: string | null
  toast: (opts: { title: string; description?: string; variant?: string }) => void
  experiencesConfirmed: boolean
  setExperiencesConfirmed: (v: boolean) => void
  canPublish: boolean
  isUploading: boolean
  isPublishing: boolean
  uploadProgress: { current: number; total: number; status: string }
  handlePublish: () => void
  publishTeaserNote: boolean
  setPublishTeaserNote: (v: boolean) => void
  autoTranslateEn: boolean
  setAutoTranslateEn: (v: boolean) => void
  setCurrentStep: (v: 'upload' | 'details' | 'preview' | 'publish') => void
}) {
  return (
    <div className="space-y-6">
      {/* Map Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapIcon className="h-5 w-5" />
            Routen-Vorschau
          </CardTitle>
          <CardDescription>
            So wird dein Trip auf der Karte angezeigt
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mapMarkers.length >= 2 ? (
            <VanillaMap
              center={[mapMarkers[0].lat, mapMarkers[0].lng]}
              zoom={6}
              markers={mapMarkers}
              polylines={[{
                points: mapMarkers.map(m => [m.lat, m.lng]),
                color: '#0891B2',
                weight: 3,
                opacity: 0.8,
              }]}
              height="400px"
              fitToMarkers
            />
          ) : (
            <div className="h-[400px] flex items-center justify-center border rounded-lg bg-muted">
              <div className="text-center">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Mindestens 2 Stationen mit GPS erforderlich für Vorschau
                </p>
              </div>
            </div>
          )}

          {/* Route Stats */}
          <div className="mt-4 flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-primary" />
              <span><strong>{stations.length}</strong> Stationen</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-600" />
              <span><strong>{stationsWithGps}</strong> mit GPS</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trip Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trip-Zusammenfassung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            {stations[0]?.preview && (
              <img
                src={stations[0].preview}
                alt="Titelbild"
                className="w-24 h-24 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <h3 className="text-xl font-bold">{tripData.title || 'Unbenannter Trip'}</h3>
              <p className="text-muted-foreground">{tripData.summary}</p>
              {tripData.country && (
                <Badge variant="outline" className="mt-2">
                  {tripData.country}
                </Badge>
              )}
            </div>
          </div>

          {/* Station List */}
          <div className="space-y-2 mt-4">
            {stations.map((station, index) => (
              <div key={station.id} className="flex items-center gap-3 p-2 bg-muted rounded overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{station.title || `Station ${index + 1}`}</p>
                  {station.location && (
                    <p className="text-xs text-muted-foreground truncate">{station.location}</p>
                  )}
                </div>
                {station.gps ? (
                  <MapPin className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Video Generator — Remotion (nur mit echten Blossom-URLs) */}
      {(() => {
        const blossomUrls = stations.map(s => s.uploadedUrl).filter((u): u is string => !!u && u.startsWith('http'));
        const notUploaded = stations.filter(s => s.file && !s.uploadedUrl).length;
        const firstLocation = stations.find(s => s.location)?.location;
        const firstCountry = stations.find(s => s.gps)?.location?.split(',')?.pop()?.trim();
        if (notUploaded > 0) {
          return (
            <div className="p-4 border rounded-lg bg-muted/30 text-sm text-muted-foreground text-center space-y-1">
              <p className="font-medium">🎬 Remotion Video</p>
              <p>⚠️ Erst Bilder zu Blossom hochladen, dann Video generieren.</p>
              <p className="text-xs">({notUploaded} Bild{notUploaded !== 1 ? 'er' : ''} noch nicht hochgeladen – klicke "Trip veröffentlichen")</p>
            </div>
          );
        }
        return (
          <RemotionVideoBlock
            imageUrls={blossomUrls}
            lifestyle={lifestyle}
            title={tripData.title || 'trip'}
            summary={tripData.summary}
            location={firstLocation}
            country={firstCountry || tripData.country}
            onVideoReady={(url) => {
              setSlideshowVideoUrl(url);
              toast({
                title: '🎬 Remotion Video gespeichert',
                description: 'Video wird beim Veröffentlichen automatisch eingebunden.',
              });
            }}
          />
        );
      })()}

      {/* Video-URL: automatisch via Slideshow ODER manuell eintragen */}
      <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">🎞️ Video-URL</span>
          {slideshowVideoUrl && (
            <span className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded">
              ✅ via Slideshow
            </span>
          )}
        </div>
        <Input
          value={slideshowVideoUrl || ''}
          onChange={(e) => setSlideshowVideoUrl(e.target.value || null)}
          placeholder="https://... (MP4-URL – automatisch via Slideshow oder manuell eintragen)"
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Wird als <code className="bg-muted px-1 rounded">['video', url]</code> im Trip gespeichert und auf der Trip-Seite abgespielt.
        </p>
        {/* Vorschau wenn URL vorhanden */}
        {slideshowVideoUrl && slideshowVideoUrl.startsWith('http') && (
          <video
            src={slideshowVideoUrl}
            controls
            playsInline
            className="w-full rounded-lg mt-2"
            style={{ maxHeight: '300px' }}
          >
            <source src={slideshowVideoUrl} type="video/mp4" />
          </video>
        )}
      </div>

      <ExperiencesConfirm
        checked={experiencesConfirmed}
        onChange={setExperiencesConfirmed}
      />

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep('details')}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <Button
          onClick={handlePublish}
          disabled={!canPublish || isUploading || isPublishing || !experiencesConfirmed}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {uploadProgress.status || `Lade hoch... (${uploadProgress.current}/${uploadProgress.total})`}
            </>
          ) : isPublishing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Veröffentliche...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              {isEditMode ? 'Trip aktualisieren' : 'Trip veröffentlichen'}
            </>
          )}
        </Button>
      </div>

      {/* Progress Bar during Upload */}
      {isUploading && uploadProgress.total > 0 && (
        <div className="mt-4 space-y-2">
          <Progress
            value={(uploadProgress.current / uploadProgress.total) * 100}
            className="h-2"
          />
          <p className="text-sm text-center text-muted-foreground">
            {uploadProgress.status} ({uploadProgress.current} von {uploadProgress.total} Bildern)
          </p>
        </div>
      )}

      {/* Teaser-Note Option */}
      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
        <div className="space-y-0.5">
          <Label htmlFor="trip-publish-teaser" className="text-sm font-medium">Teaser-Note veröffentlichen</Label>
          <p className="text-xs text-muted-foreground">Erscheint im Nostr-Feed bei Primal, Amethyst & Damus</p>
        </div>
        <Switch
          id="trip-publish-teaser"
          checked={publishTeaserNote}
          onCheckedChange={setPublishTeaserNote}
        />
      </div>

      {/* Auto-Übersetzung Option */}
      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
        <div className="space-y-0.5">
          <Label htmlFor="trip-auto-translate" className="text-sm font-medium">🇬🇧 Automatisch ins Englische übersetzen</Label>
          <p className="text-xs text-muted-foreground">Erstellt automatisch eine englische Version unter mojobus.co/en/…</p>
        </div>
        <Switch
          id="trip-auto-translate"
          checked={autoTranslateEn}
          onCheckedChange={(checked) => {
            setAutoTranslateEn(checked);
            localStorage.setItem(AUTO_TRANSLATE_STORAGE_KEY, String(checked));
          }}
        />
      </div>
    </div>
  );
}