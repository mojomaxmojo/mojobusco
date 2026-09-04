/**
 * Trip Publish Form
 * 
 * Creates a Trip from multiple images with GPS data
 * - First image = title image, determines country and location
 * - Each image can have GPS (auto-detected or manual)
 * - Each image gets a description
 * - Images are sortable via drag & drop
 * - Preview shows the route on a map
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RemotionVideoBlock } from '@/components/RemotionVideoBlock';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ExperiencesConfirm } from '@/components/assistant/ExperiencesConfirm';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { type GenderType } from '@/config/prompts/lifestyles';
import { useTrip } from '@/hooks/useTrips';
import { GpsEditor } from '@/components/GpsEditor';
import { GpsStatusIndicator } from '@/components/GpsStatusIndicator';
import { LocationPicker } from '@/components/LocationPicker';
import { CountrySelector } from '@/components/CountrySelector';
import { VanillaMap, TILE_LAYERS, type MapMarker } from '@/components/VanillaMap';
import { TRIP_TYPES, type TripType } from '@/config/tags';
import {
  Camera, Upload, MapPin, Loader2, CheckCircle, GripVertical, X,
  ChevronLeft, ChevronRight, Route, Clock, Map as MapIcon, Trash2, Edit3
} from '@/lib/icons';
import {
  extractGpsFromImage, formatCoordinatesSimple, reverseGeocode, mapCountryCode,
  type GpsData, type GpsStatus
} from '@/lib/gpsExtraction';
import { compressImageForUpload, createCorrectedPreview, createCorrectedFile } from '@/lib/trip/tripImageUtils';
import { calculateDistance } from '@/lib/trip/tripGeoUtils';
import { mapWaypointsToStations } from '@/lib/trip/tripEditLoader';
import { readImageExif } from '@/lib/trip/tripExif';
import { startTripGenerationJob, cancelTripGenerationJob, fetchTripGenerationStatus } from '@/lib/trip/tripGenerationApi';
import { buildWaypointTags, buildImageTags, calculateTotalDistance, buildTripContent, buildTripTags } from '@/lib/trip/tripPublishBuilder';
import type { TripStation, TripData, WizardStep } from '@/lib/trip/tripTypes';
import { UploadStep } from './tripPublishForm/UploadStep';
import { DetailsStep } from './tripPublishForm/DetailsStep';
import { PreviewStep } from './tripPublishForm/PreviewStep';
import { useTripGpsFill } from './tripPublishForm/useTripGpsFill';
import { useTripUpload } from './tripPublishForm/useTripUpload';
import { useTripGeneration } from './tripPublishForm/useTripGeneration';

export function TripPublishForm() {
  // URL params for edit mode
  const [searchParams] = useSearchParams();
  const editNaddr = searchParams.get('edit');
  const isEditMode = !!editNaddr;
  
  // Load existing trip for editing
  const { data: existingTrip, isLoading: isLoadingExisting } = useTrip(editNaddr || '');
  
  // State
  const [stations, setStations] = useState<TripStation[]>([]);
  const [tripData, setTripData] = useState<TripData>({
    title: '',
    summary: '',
    country: '',
    tripType: '',
  });
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [editingStation, setEditingStation] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editDtag, setEditDtag] = useState<string | null>(null); // Store d-tag for updates

  // Upload state: siehe ./tripPublishForm/useTripUpload
  // Publish state: siehe ./tripPublishForm/useTripPublish
  // KI-Generierung state: siehe ./tripPublishForm/useTripGeneration
  // Ehrlichkeits-Gate für KI-generierte Trip-Texte (Standard: bestätigt, abwählbar)
  const [experiencesConfirmed, setExperiencesConfirmed] = useState(true);

  const [slideshowVideoUrl, setSlideshowVideoUrl] = useState<string | null>(null); // Fertige Blossom-URL der Slideshow
  const [stationPreviewOpen, setStationPreviewOpen] = useState<string | null>(null);
  const [draftDescription, setDraftDescription] = useState('');

  // Hooks
  const { toast } = useToast();
  const { gender: autoGender, user } = useCurrentUser(); // Automatisch erkannte Perspektive (Mojo=male, Susanne=female)
  const [perspectiveTouched, setPerspectiveTouched] = useState(false);
  const [perspective, setPerspective] = useState<GenderType>(autoGender);
  useEffect(() => {
    if (!perspectiveTouched) setPerspective(autoGender);
  }, [autoGender, perspectiveTouched]);
  const gender = perspective;

  // KI-Artikelgenerierung: siehe ./tripPublishForm/useTripGeneration
  const {
    isGeneratingArticle,
    generatingProgress,
    progressMessage,
    activeJobId,
    selectedModel,
    setSelectedModel,
    lifestyle,
    setLifestyle,
    tripLength,
    setTripLength,
    aiGeneratedCaptions,
    setAiGeneratedCaptions,
    generateArticleWithAI,
    cancelGeneration,
  } = useTripGeneration({
    stations,
    setStations,
    tripData,
    setTripData,
    gender,
  });
  
  const navigate = useNavigate();
  
  // Populate form when editing existing trip
  useEffect(() => {
    if (isEditMode && existingTrip && !isLoadingExisting) {
      console.log('[Trip Edit] Loading existing trip:', existingTrip.title);
      
      // Store d-tag for update
      setEditDtag(existingTrip.identifier || null);
      
      // Set trip metadata
      setTripData({
        title: existingTrip.title || '',
        summary: existingTrip.summary || '',
        country: existingTrip.country || '',
        tripType: (existingTrip.category as TripType) || '',
      });
      
      const existingStations = mapWaypointsToStations(existingTrip.waypoints);
      
      setStations(existingStations);

      // Vorhandene Video-URL laden (wenn trip.video gesetzt)
      if (existingTrip.video) {
        setSlideshowVideoUrl(existingTrip.video);
        console.log('[Trip Edit] Vorhandene Video-URL geladen:', existingTrip.video);
      }
      
      // Skip to details step since we have stations
      setCurrentStep('details');
      
      toast({
        title: 'Trip geladen',
        description: `"${existingTrip.title}" wird bearbeitet.`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, existingTrip, isLoadingExisting]);

  // Auto-fill trip metadata: siehe ./tripPublishForm/useTripGpsFill

  // Handle file selection + Drag-Sortierung + Blossom-Upload: siehe ./tripPublishForm/useTripUpload
  const {
    isUploading,
    uploadProgress,
    draggedId,
    handleFileSelect,
    handleDrop,
    removeStation,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    uploadImages,
  } = useTripUpload({
    stations,
    setStations,
    setIsDragging,
  });

  // GPS-Logik + Auto-Fill + Marker: siehe ./tripPublishForm/useTripGpsFill
  const {
    saveGps,
    removeGps,
    updateStation,
    mapMarkers,
    stationsWithGps,
  } = useTripGpsFill({
    stations,
    setStations,
    tripData,
    setTripData,
    setEditingStation,
    setShowMapPicker,
  });

  // Validate for each step
  const canProceedToDetails = stations.length >= 2;
  const canProceedToPreview = stations.length >= 2 && tripData.title.trim() !== '' && tripData.tripType !== '';
  const canPublish = stations.filter(s => s.gps).length >= 2 && tripData.title.trim() !== '' && tripData.tripType !== '';

  // Upload all images: siehe ./tripPublishForm/useTripUpload

  // Publish trip: siehe ./tripPublishForm/useTripPublish
  const {
    isPublishing,
    publishTeaserNote,
    setPublishTeaserNote,
    autoTranslateEn,
    setAutoTranslateEn,
    handlePublish,
  } = useTripPublish({
    stations,
    setStations,
    tripData,
    setTripData,
    editDtag,
    setEditDtag,
    isEditMode,
    slideshowVideoUrl,
    setSlideshowVideoUrl,
    gender,
    user,
    setCurrentStep,
    uploadImages,
  });

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'upload':
        return renderUploadStep();
      case 'details':
        return renderDetailsStep();
      case 'preview':
        return renderPreviewStep();
      case 'publish':
        return renderPublishStep();
      default:
        return null;
    }
  };

  // Step 1: Upload images: siehe ./tripPublishForm/UploadStep
  const renderUploadStep = () => (
    <UploadStep
      stations={stations}
      stationsWithGps={stationsWithGps}
      isDragging={isDragging}
      setIsDragging={setIsDragging}
      handleDrop={handleDrop}
      handleFileSelect={handleFileSelect}
      draggedId={draggedId}
      handleDragStart={handleDragStart}
      handleDragOver={handleDragOver}
      handleDragEnd={handleDragEnd}
      removeStation={removeStation}
      editingStation={editingStation}
      setEditingStation={setEditingStation}
      showMapPicker={showMapPicker}
      setShowMapPicker={setShowMapPicker}
      saveGps={saveGps}
      removeGps={removeGps}
      canProceedToDetails={canProceedToDetails}
      setCurrentStep={setCurrentStep}
    />
  );

  // Step 2: Add details to each station: siehe ./tripPublishForm/DetailsStep
  const renderDetailsStep = () => (
    <DetailsStep
      stations={stations}
      tripData={tripData}
      setTripData={setTripData}
      lifestyle={lifestyle}
      setLifestyle={setLifestyle}
      tripLength={tripLength}
      setTripLength={setTripLength}
      selectedModel={selectedModel}
      setSelectedModel={setSelectedModel}
      generateArticleWithAI={generateArticleWithAI}
      cancelGeneration={cancelGeneration}
      isGeneratingArticle={isGeneratingArticle}
      generatingProgress={generatingProgress}
      progressMessage={progressMessage}
      activeJobId={activeJobId}
      aiGeneratedCaptions={aiGeneratedCaptions}
      setAiGeneratedCaptions={setAiGeneratedCaptions}
      perspective={perspective}
      setPerspective={setPerspective}
      setPerspectiveTouched={setPerspectiveTouched}
      updateStation={updateStation}
      setEditingStation={setEditingStation}
      stationPreviewOpen={stationPreviewOpen}
      setStationPreviewOpen={setStationPreviewOpen}
      draftDescription={draftDescription}
      setDraftDescription={setDraftDescription}
      canProceedToPreview={canProceedToPreview}
      setCurrentStep={setCurrentStep}
    />
  );

  // Step 3: Preview on map: siehe ./tripPublishForm/PreviewStep
  const renderPreviewStep = () => (
    <PreviewStep
      stations={stations}
      stationsWithGps={stationsWithGps}
      tripData={tripData}
      mapMarkers={mapMarkers}
      isEditMode={isEditMode}
      lifestyle={lifestyle}
      setSlideshowVideoUrl={setSlideshowVideoUrl}
      slideshowVideoUrl={slideshowVideoUrl}
      toast={toast}
      experiencesConfirmed={experiencesConfirmed}
      setExperiencesConfirmed={setExperiencesConfirmed}
      canPublish={canPublish}
      isUploading={isUploading}
      isPublishing={isPublishing}
      uploadProgress={uploadProgress}
      handlePublish={handlePublish}
      publishTeaserNote={publishTeaserNote}
      setPublishTeaserNote={setPublishTeaserNote}
      autoTranslateEn={autoTranslateEn}
      setAutoTranslateEn={setAutoTranslateEn}
      setCurrentStep={setCurrentStep}
    />
  );

  // Step 4: Publishing (loading state)
  const renderPublishStep = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <h3 className="text-xl font-semibold">Trip wird veröffentlicht...</h3>
      <p className="text-muted-foreground">{uploadProgress.status}</p>
      {uploadProgress.total > 0 && (
        <Progress 
          value={(uploadProgress.current / uploadProgress.total) * 100}
          className="w-64"
        />
      )}
    </div>
  );

  // Main render
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" />
          {isEditMode ? 'Trip bearbeiten' : 'Trip erstellen'}
        </CardTitle>
        <CardDescription>
          {isEditMode 
            ? 'Bearbeite deinen Trip. Änderungen überschreiben die bestehende Version.'
            : 'Erstelle einen Trip aus mehreren Bildern mit GPS-Daten. Das erste Bild ist das Titelbild und bestimmt den Startort.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Loading state for edit mode */}
        {isEditMode && isLoadingExisting ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Trip wird geladen...</p>
          </div>
        ) : (
          <>
            {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[
            { step: 'upload', label: 'Bilder', icon: Camera },
            { step: 'details', label: 'Details', icon: Edit3 },
            { step: 'preview', label: 'Vorschau', icon: MapIcon },
          ].map((item, index) => {
            const isActive = currentStep === item.step;
            const isPast = ['upload', 'details', 'preview', 'publish'].indexOf(currentStep) > index;
            
            return (
              <div key={item.step} className="flex items-center">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-full ${
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : isPast
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="text-sm font-medium hidden sm:inline">{item.label}</span>
                </div>
                {index < 2 && (
                  <div className={`w-8 h-0.5 mx-1 ${
                    isPast ? 'bg-primary' : 'bg-muted'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        {renderStepContent()}
          </>
        )}
      </CardContent>
    </Card>
  );
}
