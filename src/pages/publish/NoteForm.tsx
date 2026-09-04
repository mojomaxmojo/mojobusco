import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ExperiencesConfirm } from "@/components/assistant/ExperiencesConfirm";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/useToast";
import { getApiBaseUrl } from "@/lib/apiBase";
import { AUTO_TRANSLATE_STORAGE_KEY } from "@/config/translation";
import { ImageOptimizationToggle } from "@/components/ImageOptimizationToggle";
import { GpsStatusIndicator } from "@/components/GpsStatusIndicator";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { type GenderType } from "@/config/prompts/lifestyles";
import { type TextModelTier } from "@/components/ModelSelect";
import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { CountrySelector } from "@/components/CountrySelector";
import { ARTICLE_CATEGORIES, DIY_CATEGORIES, DIY_TAGS, NATURE_CATEGORIES, NATURE_TAGS, TAG_GROUPS } from "@/config";
import type { TripType } from "@/config/tags";
import MAIN_MENU from "@/config/menu";
import { RV_LIFE_CONFIG } from "@/config/rvlife";
import { MilkdownEditor } from "@/components/MilkdownEditor";
import { TripPublishForm } from "@/components/TripPublishForm";
import { RemotionVideoBlock } from "@/components/RemotionVideoBlock";
import { SlideshowBlock } from "@/components/SlideshowBlock";
import { Progress } from "@/components/ui/progress";
import { Upload, UploadCloud, ImageIcon, Video, Music, File as FileIcon, Camera, Calendar, Tag, Battery, Sun, Wrench, Hammer, Cpu, Mountain, Lightbulb, Dog, Trees, Droplets, Waves, Eye, Loader2, CheckCircle, Route, FileText, MessageSquare, Map } from "@/lib/icons";
import type { GpsStatus } from '@/lib/gpsExtraction';
import { getTagValues } from '@/lib/nostrEventUtils';
import type { NostrEvent } from '@nostrify/nostrify';
import { NOTE_COUNTRY_TAGS } from './noteForm/noteFormConstants';
import { NoteTagsSection } from './noteForm/NoteTagsSection';
import { NoteAiSection } from './noteForm/NoteAiSection';
import { useNoteGps } from './noteForm/useNoteGps';
import { useNoteImageUpload } from './noteForm/useNoteImageUpload';
import { NoteImageGallery } from './noteForm/NoteImageGallery';
import { useNotePublish } from './noteForm/useNotePublish';

export function NoteForm({ editEvent }: { editEvent?: NostrEvent }) {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [isPublic, setIsPublic] = useState(true);
  const {
    imageGpsData, imageGpsStatuses, setImageGpsData, setImageGpsStatuses,
    editingGpsImage, showMapPicker, setShowMapPicker,
    openGpsEditor, closeGpsEditor, saveGps, removeGps,
  } = useNoteGps({ selectedCountry, setLocation, setSelectedCountry });
  const {
    imageFiles, imageUrls, isDragging, isUploadingImages, uploadProgress,
    setIsDragging, setImageFiles, setImageUrls,
    handleImageSelect, handleDrop, removeImageFile, uploadImages, removeImageUrl,
  } = useNoteImageUpload({ setImageGpsData, setImageGpsStatuses });
  // Ehrlichkeits-Gate für KI-generierte Notes (Standard: bestätigt, abwählbar)
  const [experiencesConfirmed, setExperiencesConfirmed] = useState(true);
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [selectedModel, setSelectedModel] = useState<TextModelTier>('medium');
  const [lifestyle, setLifestyle] = useState<'mojobus' | 'vanlife' | 'rvlife' | 'beachlife' | 'wohnmobil' | 'perpetual-travelers'>('mojobus');
  const [tripType, setTripType] = useState<TripType | ''>('');

  // Auto-Übersetzung (DE→EN) State
  const [autoTranslateEn, setAutoTranslateEn] = useState(() => {
    const stored = localStorage.getItem(AUTO_TRANSLATE_STORAGE_KEY);
    return stored === null ? true : stored !== 'false';
  });

  const { handleSubmit, isPublishing, publishProgress } = useNotePublish({
    content, tags, imageFiles, imageUrls, imageGpsData, imageGpsStatuses,
    location, selectedCountry, autoTranslateEn,
    setContent, setTags, setLocation, setSelectedCountry,
    setImageFiles, setImageUrls, setImageGpsData, setImageGpsStatuses,
  });

  const { toast } = useToast();
  const { gender: autoGender } = useCurrentUser(); // Automatisch erkannte Perspektive (Mojo=male, Susanne=female)
  const [perspectiveTouched, setPerspectiveTouched] = useState(false);
  const [perspective, setPerspective] = useState<GenderType>(autoGender);
  useEffect(() => {
    if (!perspectiveTouched) setPerspective(autoGender);
  }, [autoGender, perspectiveTouched]);
  const gender = perspective;

  // KI-Notiz generieren (Foster Huntington Stil)
  const generateNoteWithAI = async () => {
    if (imageFiles.length === 0) {
      toast({
        title: 'Bild erforderlich',
        description: 'Bitte lade zuerst mindestens ein Bild hoch.',
        variant: 'destructive'
      });
      return;
    }

    setIsGeneratingNote(true);
    try {
      const formData = new FormData();

      // Alle Bilder senden
      imageFiles.forEach((file) => {
        formData.append('images', file);
      });

      // content = was der User in die Textarea geschrieben hat (HÖCHSTE PRIORITÄT für KI)
      formData.append('text', content || '');
      formData.append('location', location);
      formData.append('country', selectedCountry || '');
      formData.append('lifestyle', lifestyle);
      formData.append('model', selectedModel);
      formData.append('gender', gender || 'neutral');
      formData.append('tripType', tripType || '');

      const response = await fetch(`${getApiBaseUrl()}/api/generate-note`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.note) {
        setContent(data.note);
        if (data.hashtags) {
          const newTags = data.hashtags.split(' ').filter((t: string) => !tags.includes(t));
          setTags([...tags, ...newTags]);
        }
        toast({
          title: 'Erfolg!',
           description: `KI-Notiz generiert mit ${selectedModel.toUpperCase()} Modell`
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Fehler',
        description: 'KI-Generierung fehlgeschlagen.',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingNote(false);
    }
  };

  // Load edit data
  useEffect(() => {
    if (editEvent) {
      setContent(editEvent.content || '');
      const eventTags = getTagValues(editEvent, 't');
      setTags(eventTags);

      // Extract country from tags
      const countryTags = NOTE_COUNTRY_TAGS;
      const foundCountry = eventTags.find(tag => countryTags.includes(tag));
      if (foundCountry) {
        setSelectedCountry(foundCountry);
      }

      // Extract images from edit content
      const imageTags = getTagValues(editEvent, 'image');
      if (imageTags.length > 0) {
        setImageUrls(imageTags);

        // Load GPS data from tags for each image
        // GPS tags are stored sequentially with image tags
        const allGpsLatTags = getTagValues(editEvent, 'gps_lat');
        const allGpsLonTags = getTagValues(editEvent, 'gps_lon');
        const allGpsAltTags = getTagValues(editEvent, 'gps_alt');
        const allGpsPrecisionTags = getTagValues(editEvent, 'gps_precision');
        const allGpsSourceTags = getTagValues(editEvent, 'gps_source');

        // Assign GPS data to images by index
        allGpsLatTags.forEach((lat, index) => {
          if (index < imageTags.length) {
            setImageGpsData(prev => ({
              ...prev,
              [index]: {
                latitude: parseFloat(lat),
                longitude: parseFloat(allGpsLonTags[index]),
                altitude: allGpsAltTags[index] ? parseFloat(allGpsAltTags[index]) : undefined,
                precision: allGpsPrecisionTags[index] || 'medium'
              }
            }));
            setImageGpsStatuses(prev => ({
              ...prev,
              [index]: (allGpsSourceTags[index] as GpsStatus) || 'detected'
            }));
          }
        });
        console.log('[Note Edit] GPS data loaded from tags for', imageTags.length, 'images');
      }
    }
  }, [editEvent]);



  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Note veroeffentlichen
        </CardTitle>
        <CardDescription>
          Kurze Updates, Gedanken und Momente fuer deine Vanlife-Gemeinschaft
        </CardDescription>
        <ImageOptimizationToggle className="mt-4" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="note-content">Dein Note</Label>
          <Textarea
            id="note-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Was machst du gerade? Was bewegt dich? Share your vanlife moments..."
            rows={4}
            className="resize-none"
          />
          <p className="text-sm text-muted-foreground">
            {content.length}/500 Zeichen
          </p>
        </div>

        <NoteAiSection
          lifestyle={lifestyle} setLifestyle={setLifestyle}
          perspective={perspective} setPerspective={setPerspective} setPerspectiveTouched={setPerspectiveTouched}
          tripType={tripType} setTripType={setTripType}
          selectedModel={selectedModel} setSelectedModel={setSelectedModel}
          generateNoteWithAI={generateNoteWithAI} isGeneratingNote={isGeneratingNote}
          content={content} imageFiles={imageFiles}
        />

        {/* Image Upload Area */}
        <div className="space-y-4">
          <Label>Bilder hinzufuegen</Label>

          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging ? 'border-ocean-500 bg-ocean-50' : 'border-gray-300 dark:border-gray-600'
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
          >
            <Upload className="mx-auto h-8 w-8 text-gray-400 mb-3" />
            <h4 className="text-sm font-medium mb-2">Bilder hinzufuegen</h4>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleImageSelect(e.target.files)}
              className="hidden"
              id="note-image-upload"
            />
            <Button asChild>
              <label htmlFor="note-image-upload" className="cursor-pointer">
                <Camera className="h-4 w-4 mr-2" />
                Dateien auswaehlen
              </label>
            </Button>
          </div>

          {/* Selected Files Preview */}
          {imageFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Ausgewaehlte Dateien ({imageFiles.length})</Label>
                <Button
                  onClick={uploadImages}
                  size="sm"
                  disabled={imageFiles.length === 0 || isUploadingImages}
                >
                  {isUploadingImages ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Upload...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Hochladen
                    </>
                  )}
                </Button>
              </div>

              {/* Upload Progress */}
              {isUploadingImages && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-ocean-600 dark:text-ocean-400">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {uploadProgress.status}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {uploadProgress.current} von {uploadProgress.total}
                    </Badge>
                  </div>
                  <Progress
                    value={(uploadProgress.current / uploadProgress.total) * 100}
                    className="h-2"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {imageFiles.map((file, index) => (
                  <div key={index} className="relative group border rounded-lg overflow-hidden">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-20 object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImageFile(index)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <NoteImageGallery
            imageUrls={imageUrls} imageGpsData={imageGpsData} imageGpsStatuses={imageGpsStatuses}
            editingGpsImage={editingGpsImage} showMapPicker={showMapPicker} setShowMapPicker={setShowMapPicker}
            openGpsEditor={openGpsEditor} closeGpsEditor={closeGpsEditor} saveGps={saveGps} removeGps={removeGps}
            removeImageUrl={removeImageUrl}
            setImageUrls={setImageUrls} setImageGpsData={setImageGpsData} setImageGpsStatuses={setImageGpsStatuses}
            setLocation={setLocation} setSelectedCountry={setSelectedCountry}
          />
        </div>

         {/* Location (auto-filled from GPS) */}
         <div className="space-y-2">
           <Label htmlFor="note-location">Standort</Label>
           <div className="space-y-2">
             <div className="flex gap-2">
               <Input
                 id="note-location"
                 value={location}
                 onChange={(e) => setLocation(e.target.value)}
                 placeholder="Wo wurde diese Note erstellt? (z.B. Lagos, Portugal)"
                 className="flex-1"
               />
             </div>
             {Object.values(imageGpsData).length > 0 && (
               <GpsStatusIndicator status={Object.values(imageGpsStatuses)[0] as GpsStatus} gps={Object.values(imageGpsData)[0]} />
             )}
           </div>
           {location && Object.values(imageGpsData).length > 0 && (
             <p className="text-xs text-green-600 dark:text-green-400">
               📍 Standort automatisch aus GPS-Koordinaten ermittelt
             </p>
           )}
         </div>

        <NoteTagsSection tags={tags} setTags={setTags} />

        {/* Country Selection */}
        <CountrySelector
          selectedCountry={selectedCountry}
          onCountryChange={setSelectedCountry}
          placeholder="Land auswaehlen"
        />

        {/* Video Generator — Remotion */}
        <RemotionVideoBlock
          imageUrls={imageUrls}
          lifestyle={lifestyle}
          title={content.slice(0, 60) || 'note'}
          summary={content.slice(0, 120)}
          location={location}
          country={selectedCountry}
        />

        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
          <div className="space-y-0.5">
            <Label htmlFor="note-auto-translate" className="text-sm font-medium">🇬🇧 Automatisch ins Englische übersetzen</Label>
            <p className="text-xs text-muted-foreground">Erstellt automatisch eine englische Version unter mojobus.co/en/…</p>
          </div>
          <Switch
            id="note-auto-translate"
            checked={autoTranslateEn}
            onCheckedChange={(checked) => {
              setAutoTranslateEn(checked);
              localStorage.setItem(AUTO_TRANSLATE_STORAGE_KEY, String(checked));
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Switch
              id="note-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
            <Label htmlFor="note-public">Öffentlich sichtbar</Label>
          </div>

          <ExperiencesConfirm
            checked={experiencesConfirmed}
            onChange={setExperiencesConfirmed}
          />
        </div>

          <Button onClick={handleSubmit} disabled={!content || isPublishing || isUploadingImages || !experiencesConfirmed}>
            {isPublishing ? (
              <>
                {publishProgress.stage === 'publish' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {publishProgress.stage === 'success' && <CheckCircle className="h-4 w-4 mr-2" />}
                {publishProgress.stage === 'error' && <span className="mr-2">⚠️</span>}
                {publishProgress.stage === 'publish' && 'Note wird veröffentlicht...'}
                {publishProgress.stage === 'success' && '✅ Erfolgreich!'}
                {publishProgress.stage === 'error' && 'Fehler aufgetreten'}
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4 mr-2" />
                Note veroeffentlichen
              </>
            )}
          </Button>

        {/* Publishing Progress */}
        {publishProgress.stage === 'publish' && (
          <div className="flex items-center gap-3 text-sm text-ocean-600 dark:text-ocean-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p>{publishProgress.status}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
