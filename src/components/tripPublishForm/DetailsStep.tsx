/**
 * DetailsStep.tsx – Wizard-Schritt „Details" (Trip-Details, Stationen beschreiben, Station-Bild-Dialog)
 * (JSX 1:1 aus TripPublishForm.tsx, orig. Zeilen 1147–1409, PLAN6 Schritt 17)
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PerspectiveSelector } from '@/components/PerspectiveSelector';
import { CountrySelector } from '@/components/CountrySelector';
import { ModelSelect, type TextModelTier } from '@/components/ModelSelect';
import { TRIP_TYPES, type TripType } from '@/config/tags';
import { ChevronLeft, ChevronRight, MapPin } from '@/lib/icons';
import { Loader2 } from 'lucide-react';
import { formatCoordinatesSimple } from '@/lib/gpsExtraction';
import type { TripStation, TripData } from '@/lib/trip/tripTypes';

export function DetailsStep({
  stations,
  tripData, setTripData,
  lifestyle, setLifestyle,
  tripLength, setTripLength,
  selectedModel, setSelectedModel,
  generateArticleWithAI,
  cancelGeneration,
  isGeneratingArticle,
  generatingProgress,
  progressMessage,
  activeJobId,
  aiGeneratedCaptions, setAiGeneratedCaptions,
  perspective, setPerspective, setPerspectiveTouched,
  updateStation,
  setEditingStation,
  stationPreviewOpen, setStationPreviewOpen,
  draftDescription, setDraftDescription,
  canProceedToPreview,
  setCurrentStep,
}: {
  stations: TripStation[]
  tripData: TripData
  setTripData: React.Dispatch<React.SetStateAction<TripData>>
  lifestyle: string
  setLifestyle: (v: string) => void
  tripLength: string
  setTripLength: (v: 'short' | 'medium' | 'long') => void
  selectedModel: TextModelTier
  setSelectedModel: (v: TextModelTier) => void
  generateArticleWithAI: () => void
  cancelGeneration: () => void
  isGeneratingArticle: boolean
  generatingProgress: number
  progressMessage: string
  activeJobId: string | null
  aiGeneratedCaptions: Set<string>
  setAiGeneratedCaptions: React.Dispatch<React.SetStateAction<Set<string>>>
  perspective: any
  setPerspective: (v: any) => void
  setPerspectiveTouched: (v: boolean) => void
  updateStation: (id: string, field: keyof TripStation, value: string) => void
  setEditingStation: (v: string | null) => void
  stationPreviewOpen: string | null
  setStationPreviewOpen: (v: string | null) => void
  draftDescription: string
  setDraftDescription: (v: string) => void
  canProceedToPreview: boolean
  setCurrentStep: (v: 'upload' | 'details' | 'preview' | 'publish') => void
}) {
  return (
    <div className="space-y-6">
      {/* Trip Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trip-Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trip-title">Trip-Titel</Label>
            <Input
              id="trip-title"
              value={tripData.title}
              onChange={(e) => setTripData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="z.B. Portugal Roadtrip 2024"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="trip-summary">Zusammenfassung</Label>
              {tripData.summary && (
                <span className="text-xs text-muted-foreground">
                  {tripData.summary.trim().split(/\s+/).filter(Boolean).length} Wörter
                </span>
              )}
            </div>
            <Textarea
              id="trip-summary"
              value={tripData.summary}
              onChange={(e) => setTripData(prev => ({ ...prev, summary: e.target.value }))}
              placeholder="Langer Foster-Text für die Reise – oder KI generieren lassen..."
              rows={6}
            />

            {/* Lifestyle Auswahl für KI-Generierung */}
            <div className="mt-4 space-y-2">
              <Label className="text-sm font-medium">Lifestyle für KI-Text:</Label>
              <Select value={lifestyle} onValueChange={(value) => setLifestyle(value as typeof lifestyle)}>
                <SelectTrigger>
                  <SelectValue placeholder="Wähle deinen Lifestyle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mojobus">🚌 Mojobus - Max &amp; Susanne, US-Oldtimer</SelectItem>
                  <SelectItem value="vanlife">🚐 Vanlife - Van-Life auf Rädern</SelectItem>
                  <SelectItem value="rvlife">🚗 RVlife - Recreational Vehicle</SelectItem>
                  <SelectItem value="beachlife">🏖️ Beachlife - Strand &amp; Surf Lifestyle</SelectItem>
                  <SelectItem value="wohnmobil">🏠 Wohnmobil - Wohnmobil/Camper</SelectItem>
                  <SelectItem value="perpetual-travelers">🌍 Perpetual Travelers - Permanent Reisende</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Foster Huntington Stil - ehrlich, direkt, authentisch
              </p>
            </div>

            {/* Trip-Länge Auswahl */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Trip-Länge:</span>
                <div className="flex gap-1">
                  {([
                    { value: 'short', label: 'Kurz', words: '150-400' },
                    { value: 'medium', label: 'Mittel', words: '500-1200' },
                    { value: 'long', label: 'Lang', words: '1200-2500' }
                  ] as const).map((len) => (
                    <button
                      key={len.value}
                      type="button"
                      onClick={() => setTripLength(len.value)}
                      className={`h-5 px-2 text-xs rounded transition-colors ${
                        tripLength === len.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {tripLength === len.value && '✓ '}{len.label} <span className="opacity-70">({len.words})</span>
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {tripLength === 'short' && '📖 Ein Tag unterwegs. Eine Strecke. Der Moment wo du ankommst.'}
                {tripLength === 'medium' && '📖 Mehrere Tage. Stationen die zusammengehören. Eine Geschichte mit Bewegung.'}
                {tripLength === 'long' && '📖 Die ganze Reise. Szenen, Abschweifungen, Veränderung.'}
              </p>
            </div>

            {/* KI-Modell Auswahl */}
            <div className="mt-2 space-y-2">
              <ModelSelect
                value={selectedModel}
                onChange={setSelectedModel}
              />
            </div>

            {/* KI-Generierung Button */}
            <div className="mt-2 rounded-lg border border-dashed border-ocean-300 dark:border-ocean-700 bg-ocean-50/50 dark:bg-ocean-950/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-ocean-700 dark:text-ocean-300">
                <span>🤖</span>
                <span>KI generiert beides gleichzeitig:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">📝</span>
                  <div>
                    <div className="font-medium text-foreground">Zusammenfassung</div>
                    <div>Langer Foster-Text für den Trip</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🖼️</span>
                  <div>
                    <div className="font-medium text-foreground">
                      {stations.length}× Bild-Text
                    </div>
                    <div>20–100 Wörter pro Bild · Qwen Vision</div>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={generateArticleWithAI}
                disabled={isGeneratingArticle || stations.length === 0}
                className="w-full"
              >
                {isGeneratingArticle ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {progressMessage || 'KI arbeitet...'}
                  </>
                ) : (
                  <>
                    <span className="mr-2">✨</span>
                    Zusammenfassung + Bild-Texte generieren
                    <span className="ml-2 text-xs opacity-70">
                      {selectedModel.toUpperCase()} Modell
                    </span>
                  </>
                )}
              </Button>
              {isGeneratingArticle && (
                <>
                  <Progress value={generatingProgress} className="h-1.5" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={cancelGeneration}
                    disabled={!activeJobId}
                    className="w-full"
                  >
                    Generierung abbrechen
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Trip Type Select - Pflichtfeld */}
          <div className="space-y-2">
            <Label htmlFor="trip-type" className={!tripData.tripType ? 'text-destructive' : ''}>
              Art der Reise *
            </Label>
            <Select
              value={tripData.tripType}
              onValueChange={(value) => setTripData(prev => ({ ...prev, tripType: value as TripType }))}
            >
              <SelectTrigger id="trip-type" className={!tripData.tripType ? 'border-destructive' : ''}>
                <SelectValue placeholder="Wähle die Art deiner Reise... (Pflichtfeld)" />
              </SelectTrigger>
              <SelectContent>
                {TRIP_TYPES.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <span className="flex items-center gap-2">
                      <span>{type.icon}</span>
                      <span>{type.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!tripData.tripType && (
              <p className="text-xs text-destructive">
                Bitte wähle die Art deiner Reise aus
              </p>
            )}
            {tripData.tripType && (
              <p className="text-xs text-muted-foreground">
                Ausgewählt: {TRIP_TYPES.find(t => t.id === tripData.tripType)?.icon} {TRIP_TYPES.find(t => t.id === tripData.tripType)?.label}
              </p>
            )}
          </div>

          {/* Perspektive (Ich/Wir) */}
          <PerspectiveSelector
            value={perspective}
            onChange={(v) => { setPerspective(v); setPerspectiveTouched(true); }}
          />

          <CountrySelector
            selectedCountry={tripData.country}
            onCountryChange={(country) => setTripData(prev => ({ ...prev, country }))}
            placeholder="Land auswählen"
          />
        </CardContent>
      </Card>

      {/* Station Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stationen beschreiben</CardTitle>
          <CardDescription>
            Füge jeder Station einen Titel, Standort und eine Beschreibung hinzu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stations.map((station, index) => (
            <div key={station.id} className="border rounded-lg p-4 space-y-3 overflow-hidden">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                </div>

                <div className="flex-1 space-y-3 min-w-0">
                  {/* GPS & Location Status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {station.gps ? (
                      <>
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          <MapPin className="h-3 w-3 mr-1" />
                          GPS: {formatCoordinatesSimple(station.gps.latitude, station.gps.longitude)}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                          onClick={() => setEditingStation(station.id)}
                        >
                          ✏️ GPS ändern
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => setEditingStation(station.id)}
                      >
                        <MapPin className="h-3 w-3 mr-1" />
                        GPS hinzufügen
                      </Button>
                    )}
                  </div>

                  {/* Title */}
                  <Input
                    value={station.title}
                    onChange={(e) => updateStation(station.id, 'title', e.target.value)}
                    placeholder={`Station ${index + 1} Titel (z.B. Ankunft in Porto)`}
                  />

                  {/* Location - Manually Editable */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Standort (manuell änderbar)</Label>
                    <Input
                      value={station.location}
                      onChange={(e) => updateStation(station.id, 'location', e.target.value)}
                      placeholder="z.B. Porto, Portugal"
                    />
                    {station.gps && !station.location && (
                      <p className="text-xs text-orange-600">
                        ⏳ Standort wird ermittelt...
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Bildtext</Label>
                      {aiGeneratedCaptions.has(station.id) && (
                        <span className="text-xs bg-ocean-100 dark:bg-ocean-900 text-ocean-700 dark:text-ocean-300 px-1.5 py-0.5 rounded font-medium">
                          ✨ KI-Text – bearbeitbar
                        </span>
                      )}
                    </div>
                    <Textarea
                      value={station.description}
                      onChange={(e) => {
                        updateStation(station.id, 'description', e.target.value);
                        // KI-Badge entfernen sobald User editiert
                        if (aiGeneratedCaptions.has(station.id)) {
                          setAiGeneratedCaptions(prev => {
                            const next = new Set(prev);
                            next.delete(station.id);
                            return next;
                          });
                        }
                      }}
                      placeholder="Kurzer Text zu diesem Bild (oder KI generieren lassen)..."
                      rows={3}
                    />
                    {station.description && (
                      <p className="text-xs text-muted-foreground text-right">
                        {station.description.trim().split(/\s+/).filter(Boolean).length} Wörter
                      </p>
                    )}
                  </div>

                  {/* Date */}
                  <Input
                    type="date"
                    value={station.date}
                    onChange={(e) => updateStation(station.id, 'date', e.target.value)}
                    className="max-w-[200px]"
                  />
                </div>

                <div className="flex-shrink-0">
                  <img
                    src={station.preview}
                    alt={station.title || `Station ${index + 1}`}
                    className="w-20 h-20 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity hover:ring-2 hover:ring-primary"
                    onClick={() => {
                      setDraftDescription(station.description);
                      setStationPreviewOpen(station.id);
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

       {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep('upload')}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <Button
          onClick={() => setCurrentStep('preview')}
          disabled={!canProceedToPreview}
        >
          Vorschau anzeigen
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {/* Station-Bild Dialog (groß) */}
      <Dialog
        open={!!stationPreviewOpen}
        onOpenChange={(open) => {
          if (!open) {
            // Speichern beim Schließen
            if (stationPreviewOpen) {
              updateStation(stationPreviewOpen, 'description', draftDescription);
              // KI-Badge entfernen
              const st = stations.find(s => s.id === stationPreviewOpen);
              if (st && aiGeneratedCaptions.has(st.id)) {
                setAiGeneratedCaptions(prev => {
                  const next = new Set(prev);
                  next.delete(st.id);
                  return next;
                });
              }
            }
            setStationPreviewOpen(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {(() => {
                const st = stations.find(s => s.id === stationPreviewOpen);
                if (!st) return '';
                const idx = stations.indexOf(st);
                return `Station ${idx + 1}: ${st.title || st.location || 'Unbenannt'}`;
              })()}
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const st = stations.find(s => s.id === stationPreviewOpen);
                return st?.date ? new Date(st.date).toLocaleDateString('de-DE') : '';
              })()}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const stIndex = stations.findIndex(s => s.id === stationPreviewOpen);
            if (stIndex === -1) return null;
            const st = stations[stIndex];
            // Draft laden wenn Dialog für neue Station geöffnet wird
            if (draftDescription === '' && st.description !== '') {
              setDraftDescription(st.description);
            }
            return (
              <div className="space-y-4">
                {/* Großes Bild */}
                <div className="relative rounded-lg overflow-hidden bg-black">
                  <img
                    src={st.preview}
                    alt={st.title || `Station ${stIndex + 1}`}
                    className="w-full max-h-[50vh] object-contain mx-auto"
                  />
                </div>
                {/* Station-Info */}
                <div className="space-y-3">
                  {st.gps && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-green-600" />
                      <span className="text-muted-foreground">{formatCoordinatesSimple(st.gps.latitude, st.gps.longitude)}</span>
                      {st.location && <span>· {st.location}</span>}
                    </div>
                  )}

                  {/* Editable Description */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">✏️ Bildtext editieren</Label>
                    <Textarea
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                      placeholder="Beschreibe dieses Bild..."
                      rows={5}
                      className="min-h-[120px]"
                    />
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}