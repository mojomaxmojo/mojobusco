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
import { useUploadFile } from '@/hooks/useUploadFile';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useAutoTranslate } from '@/hooks/useAutoTranslate';
import { useContinuityTracking } from '@/hooks/useContinuityTracking';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { PerspectiveSelector } from '@/components/PerspectiveSelector';
import { type GenderType } from '@/config/prompts/lifestyles';
import { ModelSelect, type TextModelTier } from '@/components/ModelSelect';
import { canonicalUrl, tripUrl, canonicalNaddr } from '@/lib/canonicalUrl';
import { notifyPublishedPipeline } from '@/lib/publishNotify';
import { createLongformTeaser } from '@/lib/createLongformTeaser';
import { AUTO_TRANSLATE_STORAGE_KEY } from '@/config/translation';
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
  const [isPublishing, setIsPublishing] = useState(false);
  // KI-Generierung state: siehe ./tripPublishForm/useTripGeneration
  // Ehrlichkeits-Gate für KI-generierte Trip-Texte (Standard: bestätigt, abwählbar)
  const [experiencesConfirmed, setExperiencesConfirmed] = useState(true);

  const [slideshowVideoUrl, setSlideshowVideoUrl] = useState<string | null>(null); // Fertige Blossom-URL der Slideshow
  const [stationPreviewOpen, setStationPreviewOpen] = useState<string | null>(null);
  const [draftDescription, setDraftDescription] = useState('');

  // Hooks
  const { toast } = useToast();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { trackPublishedPost } = useContinuityTracking();
  const { gender: autoGender, user } = useCurrentUser(); // Automatisch erkannte Perspektive (Mojo=male, Susanne=female)
  const [perspectiveTouched, setPerspectiveTouched] = useState(false);
  const [perspective, setPerspective] = useState<GenderType>(autoGender);
  useEffect(() => {
    if (!perspectiveTouched) setPerspective(autoGender);
  }, [autoGender, perspectiveTouched]);
  const gender = perspective;
  const { translateAndPublish } = useAutoTranslate();

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

  // Auto-fill trip metadata from first station
  useEffect(() => {
    const autoFill = async () => {
      const firstStationWithGps = stations.find(s => s.gps && s.gpsStatus === 'detected');
      if (firstStationWithGps?.gps && !tripData.country) {
        const locationData = await reverseGeocode(
          firstStationWithGps.gps.latitude,
          firstStationWithGps.gps.longitude
        );
        if (locationData) {
          const locationParts = [
            locationData.city,
            locationData.neighbourhood,
            locationData.suburb
          ].filter(Boolean);
          
          const loc = locationParts.join(', ');
          const country = mapCountryCode(locationData);
          
          // Update station with location
          setStations(prev => prev.map(s => 
            s.id === firstStationWithGps.id 
              ? { ...s, location: loc }
              : s
          ));
          
          // Update trip data
          if (country && !tripData.country) {
            setTripData(prev => ({ ...prev, country }));
          }
          
          // Auto-generate title if empty
          if (!tripData.title && loc) {
            setTripData(prev => ({ 
              ...prev, 
              title: `Trip nach ${loc}`,
              summary: `Eine Reise durch ${loc} und Umgebung.`
            }));
          }
        }
      }
    };
    
    autoFill();
  }, [stations, tripData.country, tripData.title]);

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

  // Publish trip
  // Teaser-Note State
  const [publishTeaserNote, setPublishTeaserNote] = useState(true);

  // Auto-Übersetzung (DE→EN) State
  const [autoTranslateEn, setAutoTranslateEn] = useState(() => {
    const stored = localStorage.getItem(AUTO_TRANSLATE_STORAGE_KEY);
    return stored === null ? true : stored !== 'false';
  });

  const handlePublish = async () => {
    // First upload all images and get updated stations
    const uploadedStations = await uploadImages();
    
    if (uploadedStations.length === 0) {
      console.error('[Trip Publish] No stations uploaded');
      return;
    }
    
    // Check for GPS stations
    const gpsStations = uploadedStations.filter(s => s.gps && s.uploadedUrl);
    if (gpsStations.length < 2) {
      toast({
        title: 'Nicht genug GPS-Daten',
        description: 'Mindestens 2 Stationen mit GPS erforderlich.',
        variant: 'destructive'
      });
      return;
    }
    
    // Create trip event (Kind 30025 - compatible with mojotravel)
    // Use existing d-tag for updates, or create new one
    const dTag = editDtag || `trip-${Date.now()}`;
    
    console.log('[Trip Publish] Publishing with', uploadedStations.length, 'stations');
    console.log('[Trip Publish] GPS stations:', gpsStations.length);
    console.log('[Trip Publish] Mode:', isEditMode ? 'UPDATE' : 'CREATE');
    console.log('[Trip Publish] d-tag:', dTag);
    
    const waypointTags = buildWaypointTags(gpsStations);

    const imageTags = buildImageTags(uploadedStations);

    const totalDistance = calculateTotalDistance(gpsStations);

    const content = buildTripContent(uploadedStations, tripData);

    console.log('[Trip Publish] Waypoint tags:', waypointTags.length);
    console.log('[Trip Publish] Image tags:', imageTags.length);

    const tags = buildTripTags(dTag, tripData, waypointTags, imageTags, totalDistance, slideshowVideoUrl);
    
    // Publish
    setIsPublishing(true);

    const doPublish = async (retryCount = 0): Promise<boolean> => {
      try {
        await publishEvent({
          kind: 30025, // Trip events (Kind 30025 - Parameterized Replaceable)
          content,
          tags,
        });

        toast({
          title: isEditMode ? 'Trip aktualisiert!' : 'Trip veröffentlicht!',
          description: isEditMode
            ? 'Dein Trip wurde erfolgreich aktualisiert.'
            : 'Dein Trip wurde erfolgreich veröffentlicht.',
        });

        // Kontinuitäts-Tracking: Motive/Entitäten/Stimmung/offene Fäden erfassen
        // (nur der erste/Hauptort, Wegpunkt 1)
        trackPublishedPost({
          id: dTag,
          type: 'trip',
          kind: 30025,
          title: tripData.title,
          location: gpsStations[0]?.location || gpsStations[0]?.title || '',
          country: tripData.country,
          content,
          url: user?.pubkey
            ? canonicalUrl(tripUrl(canonicalNaddr({ kind: 30025, pubkey: user.pubkey, identifier: dTag })))
            : undefined,
        });

        // Publish-Pipeline sofort triggern (Prerender/Sitemap/Feed + IndexNow)
        if (user?.pubkey) {
          notifyPublishedPipeline({
            d_tag: dTag,
            url: canonicalUrl(tripUrl(canonicalNaddr({ kind: 30025, pubkey: user.pubkey, identifier: dTag }))),
          });
        }

        // Auto-Übersetzung (DE→EN): EN-Version im Hintergrund veröffentlichen
        if (autoTranslateEn && user?.pubkey) {
          translateAndPublish({
            type: 'trip', kind: 30025, originalDTag: dTag,
            pubkey: user.pubkey, title: tripData.title, summary: tripData.summary,
            content, baseTags: tags, publishTeaser: publishTeaserNote,
          });
        }

        return true;
      } catch (error: any) {
        console.error('[Trip Publish] Error:', error);

        // Retry up to 3 times
        if (retryCount < 3) {
          console.log(`[Trip Publish] Retrying... (${retryCount + 1}/3)`);
          toast({
            title: 'Veröffentlichung wird erneut versucht...',
            description: `Versuch ${retryCount + 1} von 3`,
          });
          await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
          return doPublish(retryCount + 1);
        }

        toast({
          title: 'Fehler beim Veröffentlichen',
          description: `Der Trip konnte nicht veröffentlicht werden: ${error?.message || 'Unbekannter Fehler'}. Bitte versuche es später erneut.`,
          variant: 'destructive',
        });
        return false;
      }
    };

    const success = await doPublish();
    setIsPublishing(false);

    if (!success) return;

    // Teaser-Note (Kind 1) automatisch posten
    if (publishTeaserNote && user?.pubkey) {
      const teaserLoggerPrefix = '[Trip Teaser]';
      try {
        const firstStation = uploadedStations.find(s => s.uploadedUrl);
        const firstImageUrl = firstStation?.uploadedUrl;
        const teaserSummary = tripData.summary.trim().slice(0, 120) + (tripData.summary.trim().length > 120 ? '…' : '');

        const tripTeaserTags = [
          'trip',
          'reisen',
          ...(tripData.tripType ? [tripData.tripType] : []),
        ];

        console.log(`${teaserLoggerPrefix} Erstelle Teaser...`, {
          title: tripData.title.trim(),
          summaryLength: teaserSummary.length,
          imageUrl: firstImageUrl,
          videoUrl: slideshowVideoUrl,
          tags: tripTeaserTags,
          country: tripData.country
        });

        const teaser = createLongformTeaser({
          type: 'trip',
          title: tripData.title.trim() || 'Trip',
          body: tripData.summary.trim(),
          summary: teaserSummary,
          pubkey: user.pubkey,
          dTag,
          kind: 30025,
          imageUrl: firstImageUrl,
          videoUrl: slideshowVideoUrl,
          tags: tripTeaserTags,
          country: tripData.country,
        });

        console.log(`${teaserLoggerPrefix} Teaser erstellt:`, {
          contentLength: teaser.content.length,
          tagCount: teaser.tags.length,
          tags: teaser.tags,
          naddr: teaser.naddr
        });

        const publishResult = await publishEvent({
          kind: 1,
          content: teaser.content,
          tags: teaser.tags,
        });

        console.log(`${teaserLoggerPrefix} publishEvent result:`, publishResult);

        toast({
          title: '✅ Teaser-Note veröffentlicht!',
          description: 'Erscheint im Nostr-Feed bei Primal, Amethyst & Damus',
        });
      } catch (teaserErr: any) {
        const errorMessage = teaserErr?.message || 'Unbekannter Fehler';
        const errorStack = teaserErr?.stack || '';
        console.error(`${teaserLoggerPrefix} Teaser-Post fehlgeschlagen:`, teaserErr);
        console.error(`${teaserLoggerPrefix} Details:`, {
          message: errorMessage,
          stack: errorStack,
          fullError: JSON.stringify(teaserErr, Object.getOwnPropertyNames(teaserErr))
        });

        toast({
          title: '⚠️ Trip gespeichert',
          description: `Teaser-Note konnte nicht gepostet werden: ${errorMessage}`,
          variant: 'destructive',
        });
      }
    }

    // Reset + Redirect
    setStations([]);
    setTripData({ title: '', summary: '', country: '', tripType: '' });
    setEditDtag(null);
    setSlideshowVideoUrl(null);
    setCurrentStep('upload');
    navigate('/map/trips');
  };

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
