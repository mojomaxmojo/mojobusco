import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ExperiencesConfirm } from "@/components/assistant/ExperiencesConfirm";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/useToast";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useAutoTranslate } from "@/hooks/useAutoTranslate";
import { getApiBaseUrl } from "@/lib/apiBase";
import { useContinuityTracking } from "@/hooks/useContinuityTracking";
import { AUTO_TRANSLATE_STORAGE_KEY } from "@/config/translation";
import { ImageOptimizationToggle } from "@/components/ImageOptimizationToggle";
import { GpsEditor } from "@/components/GpsEditor";
import { GpsStatusIndicator } from "@/components/GpsStatusIndicator";
import { LocationPicker } from "@/components/LocationPicker";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PerspectiveSelector } from "@/components/PerspectiveSelector";
import { type GenderType } from "@/config/prompts/lifestyles";
import { ModelSelect, type TextModelTier } from "@/components/ModelSelect";
import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CountrySelector, getCountryTag } from "@/components/CountrySelector";
import { CONTENT_CATEGORIES, createRequiredTags, getOptionalTags, getTabConfig } from "@/config/contentCategories";
import { ARTICLE_CATEGORIES, DIY_CATEGORIES, DIY_TAGS, NATURE_CATEGORIES, NATURE_TAGS, TAG_GROUPS } from "@/config";
import { TRIP_TYPES, type TripType } from "@/config/tags";
import MAIN_MENU from "@/config/menu";
import { RV_LIFE_CONFIG } from "@/config/rvlife";
import { nip19 } from "nostr-tools";
import { canonicalUrl, noteUrl } from "@/lib/canonicalUrl";
import { notifyPublishedPipeline } from "@/lib/publishNotify";
import { MilkdownEditor } from "@/components/MilkdownEditor";
import { TripPublishForm } from "@/components/TripPublishForm";
import { RemotionVideoBlock } from "@/components/RemotionVideoBlock";
import { SlideshowBlock } from "@/components/SlideshowBlock";
import { Progress } from "@/components/ui/progress";
import { Upload, UploadCloud, ImageIcon, Video, Music, File as FileIcon, Camera, MapPin, Calendar, Tag, Battery, Sun, Wrench, Hammer, Cpu, Mountain, Lightbulb, Dog, Trees, Droplets, Waves, Eye, Loader2, CheckCircle, Route, Sparkles, FileText, MessageSquare, Map } from "@/lib/icons";
import { extractGpsFromImage, formatCoordinatesSimple, reverseGeocode, mapCountryCode, type GpsData, type GpsStatus, type LocationData } from "@/lib/gpsExtraction";
import { createCorrectedPreview } from "./publishUtils";
import type { NostrEvent } from "@nostrify/nostrify";
import exifr from "exifr";

export function NoteForm({ editEvent }: { editEvent?: any }) {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [isPublic, setIsPublic] = useState(true);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [imageGpsData, setImageGpsData] = useState<Record<number, GpsData>>({});
  const [imageGpsStatuses, setImageGpsStatuses] = useState<Record<number, GpsStatus>>({});
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, status: '' });
  const [isPublishing, setIsPublishing] = useState(false);
  // Ehrlichkeits-Gate für KI-generierte Notes (Standard: bestätigt, abwählbar)
  const [experiencesConfirmed, setExperiencesConfirmed] = useState(true);
  const [publishProgress, setPublishProgress] = useState({ stage: '', status: '' });
  const [editingGpsImage, setEditingGpsImage] = useState<number | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [selectedModel, setSelectedModel] = useState<TextModelTier>('medium');
  const [lifestyle, setLifestyle] = useState<'mojobus' | 'vanlife' | 'rvlife' | 'beachlife' | 'wohnmobil' | 'perpetual-travelers'>('mojobus');
  const [tripType, setTripType] = useState<TripType | ''>('');

  // Auto-Übersetzung (DE→EN) State
  const [autoTranslateEn, setAutoTranslateEn] = useState(() => {
    const stored = localStorage.getItem(AUTO_TRANSLATE_STORAGE_KEY);
    return stored === null ? true : stored !== 'false';
  });

  const { toast } = useToast();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { mutateAsync: uploadFile } = useUploadFile();
  const { gender: autoGender } = useCurrentUser(); // Automatisch erkannte Perspektive (Mojo=male, Susanne=female)
  const [perspectiveTouched, setPerspectiveTouched] = useState(false);
  const [perspective, setPerspective] = useState<GenderType>(autoGender);
  useEffect(() => {
    if (!perspectiveTouched) setPerspective(autoGender);
  }, [autoGender, perspectiveTouched]);
  const gender = perspective;
  const navigate = useNavigate();
  const { translateAndPublish } = useAutoTranslate();
  const { trackPublishedPost } = useContinuityTracking();

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
      const eventTags = editEvent.tags?.filter((tag: any) => tag[0] === 't')?.map((tag: any) => tag[1]) || [];
      setTags(eventTags);

      // Extract country from tags
      const countryTags = ['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg'];
      const foundCountry = eventTags.find(tag => countryTags.includes(tag));
      if (foundCountry) {
        setSelectedCountry(foundCountry);
      }

      // Extract images from edit content
      const imageTags = editEvent.tags?.filter((tag: any) => tag[0] === 'image')?.map((tag: any) => tag[1]) || [];
      if (imageTags.length > 0) {
        setImageUrls(imageTags);

        // Load GPS data from tags for each image
        // GPS tags are stored sequentially with image tags
        const allGpsLatTags = editEvent.tags?.filter((tag: any) => tag[0] === 'gps_lat')?.map((tag: any) => tag[1]) || [];
        const allGpsLonTags = editEvent.tags?.filter((tag: any) => tag[0] === 'gps_lon')?.map((tag: any) => tag[1]) || [];
        const allGpsAltTags = editEvent.tags?.filter((tag: any) => tag[0] === 'gps_alt')?.map((tag: any) => tag[1]) || [];
        const allGpsPrecisionTags = editEvent.tags?.filter((tag: any) => tag[0] === 'gps_precision')?.map((tag: any) => tag[1]) || [];
        const allGpsSourceTags = editEvent.tags?.filter((tag: any) => tag[0] === 'gps_source')?.map((tag: any) => tag[1]) || [];

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

  const handleTagToggle = (tag: string) => {
    setTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };



  const handleImageSelect = async (files: FileList | null) => {
    if (!files) return;

    // Filter for image files only
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    const newImageFiles: File[] = [];
    const newImageUrls: string[] = [];

    // Process each image file for EXIF correction
    for (const file of imageFiles) {
      let correctedPreviewUrl: string | undefined;
      let exifWidth: number | undefined;
      let exifHeight: number | undefined;
      let exifOrientation: number | undefined;

      try {
        // EXIF-Daten lesen (wie in TripPublishForm.tsx)
        // Orientation separat lesen (funktioniert auch wenn parse fehlschlägt)
        try {
          exifOrientation = await exifr.orientation(file);
          console.log(`[Note EXIF] ${file.name}: Orientation (via exifr.orientation) = ${exifOrientation || 'not found'}`);
        } catch (orientErr) {
          console.warn(`[Note EXIF] ${file.name}: Could not read orientation:`, orientErr);
        }

        // Bildabmessungen lesen
        try {
          const dimExif = await exifr.parse(file, { exif: true, pickTags: ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight'] });
          exifWidth = dimExif?.ImageWidth || dimExif?.ExifImageWidth;
          exifHeight = dimExif?.ImageHeight || dimExif?.ExifImageHeight;
          if (exifWidth && exifHeight) {
            console.log(`[Note EXIF] ${file.name}: EXIF dimensions ${exifWidth}x${exifHeight}`);
          }
        } catch (dimErr) {
          console.warn(`[Note EXIF] ${file.name}: Could not read dimensions:`, dimErr);
        }

        // Korrigierte Preview erstellen (immer, wie in TripPublishForm.tsx)
        correctedPreviewUrl = await createCorrectedPreview(file, exifWidth, exifHeight, exifOrientation);
      } catch (exifError) {
        console.warn(`[Note EXIF] Failed to read EXIF from ${file.name}:`, exifError);
        // Fallback: Original file als Preview
        correctedPreviewUrl = URL.createObjectURL(file);
      }

      newImageFiles.push(file);
      if (correctedPreviewUrl) {
        newImageUrls.push(correctedPreviewUrl);
      }
    }

    setImageFiles(prev => [...prev, ...newImageFiles]);
    setImageUrls(prev => [...prev, ...newImageUrls]);

    // Extract GPS from each image immediately upon selection
    const startIndex = imageUrls.length;
    for (let i = 0; i < newImageFiles.length; i++) {
      const file = newImageFiles[i];
      const index = startIndex + i;

      try {
        const gpsData = await extractGpsFromImage(file);
        if (gpsData) {
          setImageGpsData(prev => ({ ...prev, [index]: gpsData }));
          setImageGpsStatuses(prev => ({ ...prev, [index]: 'detected' }));
          console.log(`[Note GPS] Extracted from ${file.name} (image ${index}):`, gpsData);
        } else {
          setImageGpsStatuses(prev => ({ ...prev, [index]: 'not_found' }));
        }
      } catch (error) {
        console.error(`[Note GPS] Failed to extract from ${file.name}:`, error);
        setImageGpsStatuses(prev => ({ ...prev, [index]: 'error' }));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleImageSelect(e.dataTransfer.files);
  };

  const removeImageFile = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async () => {
    if (imageFiles.length === 0) return;

    setIsUploadingImages(true);
    setUploadProgress({ current: 0, total: imageFiles.length, status: 'Upload läuft...' });

    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const [urlTag] = await uploadFile(file);
        uploadedUrls.push(urlTag[1]); // URL is in second position

        // Update progress
        setUploadProgress({ current: i + 1, total: imageFiles.length, status: 'Upload läuft...' });
      }

      // Ersetze die korrigierten Previews durch die hochgeladenen URLs
      setImageUrls(prev => {
        // Entferne die Preview-URLs für die hochgeladenen Bilder und füge die Upload-URLs hinzu
        const existingUrls = prev.slice(0, prev.length - imageFiles.length);
        return [...existingUrls, ...uploadedUrls];
      });

      setImageFiles([]);
      setIsUploadingImages(false);
      setUploadProgress({ current: imageFiles.length, total: imageFiles.length, status: '' });

      toast({
        title: 'Erfolg!',
        description: `${uploadedUrls.length} Bild(er) erfolgreich hochgeladen.`,
      });
    } catch (error) {
      setIsUploadingImages(false);
      setUploadProgress({ current: 0, total: 0, status: 'Upload fehlgeschlagen' });
      toast({
        title: 'Fehler',
        description: 'Bild-Upload fehlgeschlagen. Bitte versuche es erneut.',
        variant: 'destructive'
      });
    }
  };

  const removeImageUrl = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
    // Also remove GPS data for this image
    setImageGpsData(prev => {
      const { [index]: _, ...rest } = prev;
      return rest;
    });
    setImageGpsStatuses(prev => {
      const { [index]: _, ...rest } = prev;
      return rest;
    });
  };

  // GPS editing functions for Note Form
  const openGpsEditor = (imageIndex: number) => {
    setEditingGpsImage(imageIndex);
  };

  const closeGpsEditor = () => {
    setEditingGpsImage(null);
    setShowMapPicker(false);
  };

  const saveGps = async (imageIndex: number, gps: GpsData) => {
    // Save GPS data
    setImageGpsData(prev => ({
      ...prev,
      [imageIndex]: gps
    }));
    setImageGpsStatuses(prev => ({
      ...prev,
      [imageIndex]: 'manual'
    }));

    // Auto-fill location and country using reverse geocoding
    try {
      console.log('[Note GPS Manual] Reverse geocoding for manual GPS...', gps);
      const locationData = await reverseGeocode(gps.latitude, gps.longitude);
      if (locationData) {
        // Set location to city + neighbourhood/suburb (no postcode)
        const locationParts = [
          locationData.city,
          locationData.neighbourhood,
          locationData.suburb
        ].filter(Boolean);
        const loc = locationParts.join(', ');
        setLocation(loc);
        console.log('[Note GPS Manual] Location found:', loc);

        // Auto-fill country if detected
        const country = mapCountryCode(locationData);
        if (country) {
          setSelectedCountry(country);
          console.log('[Note GPS Manual] Country auto-filled:', country);
        }
      }
    } catch (error) {
      console.error('[Note GPS Manual] Reverse geocoding failed:', error);
    }

    closeGpsEditor();
  };

  const removeGps = (imageIndex: number) => {
    setImageGpsData(prev => {
      const { [imageIndex]: _, ...rest } = prev;
      return rest;
    });
    setImageGpsStatuses(prev => ({
      ...prev,
      [imageIndex]: 'not_found'
    }));
    closeGpsEditor();
  };

  // Auto-fill location and country from GPS data (first image)
  useEffect(() => {
      const autoFillLocation = async () => {
        // Use GPS from first image if available
        const firstGpsData = Object.values(imageGpsData)[0];

        if (firstGpsData) {
          console.log('[Note GPS] GPS detected, reverse geocoding...');
          const locationData = await reverseGeocode(firstGpsData.latitude, firstGpsData.longitude);
          if (locationData) {
            // Set location to city + neighbourhood/suburb (no postcode)
            const locationParts = [
              locationData.city,
              locationData.neighbourhood,
              locationData.suburb
            ].filter(Boolean);
            const loc = locationParts.join(', ');
            setLocation(loc);
            console.log('[Note GPS] Location found:', loc);

            // Auto-fill country if detected
            const country = mapCountryCode(locationData);
            if (country && !selectedCountry) {
              setSelectedCountry(country);
              console.log('[Note GPS] Country auto-filled:', country);
            }
          }
        }
      };

      autoFillLocation();
    }, [imageGpsData]);

  const handleSubmit = () => {
    if (!content.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte gib einen Text ein.',
        variant: 'destructive'
      });
      return;
    }

    // Warn if there are unsaved images
    if (imageFiles.length > 0) {
      toast({
        title: 'Achtung',
        description: 'Bitte lade die ausgewählten Bilder zuerst hoch.',
        variant: 'destructive'
      });
      return;
    }

    setIsPublishing(true);
    setPublishProgress({ stage: 'publish', status: 'Event wird zu Nostr gesendet...' });

    // Entferne Country-Tags aus tags, um Duplikate zu vermeiden
    const countryList = ['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg'];
    const tagsWithoutCountry = tags.filter(tag =>
      !countryList.includes(tag.toLowerCase()) && !tag.startsWith('#') && !countryList.includes(tag.replace('#', '').toLowerCase())
    );

    // Create event tags with country tags and #mojobus
    const baseTags = createRequiredTags('notes', tagsWithoutCountry);
    const additionalTags = [
      ['type', 'note'],      // Explicit type marker
      ['t', 'mojobus'],     // #mojobus tag
      ['t', 'note'],        // Standard tag #note
      ['t', 'notiz']        // Standard tag #notiz
    ];

    // Add location tag if set
    if (location.trim()) {
      additionalTags.push(['location', location.trim()]);
    }

    // Add country tags (nur wenn selectedCountry gewählt wurde)
    if (selectedCountry) {
      const countryTags = getCountryTag(selectedCountry);
      countryTags.forEach(tag => additionalTags.push(['t', tag]));
    }

    // Add image tags if images exist
    imageUrls.forEach((url, index) => {
      additionalTags.push(['image', url]);

      // Add GPS tags if available for this image
      const gpsData = imageGpsData[index];
      const gpsStatus = imageGpsStatuses[index];
      if (gpsData && gpsStatus) {
        additionalTags.push(['gps_lat', gpsData.latitude.toString()], ['gps_lon', gpsData.longitude.toString()]);
        if (gpsData.altitude) {
          additionalTags.push(['gps_alt', gpsData.altitude.toString()]);
        }
        additionalTags.push(['gps_precision', gpsData.precision]);
        additionalTags.push(['gps_source', gpsStatus]);
      }
    });

    const eventTags = [
      ...baseTags,
      ...additionalTags
    ];

    // Create content with images
    let articleContent = content.trim();
    if (imageFiles.length > 0) {
      articleContent += '\n\n'; // Add spacing before images
      imageFiles.forEach((file, index) => {
        articleContent += `\n![Titelbild ${index + 1}](${URL.createObjectURL(file)})`;
      });
    }

    publishEvent({
      kind: 1, // Note
      content: articleContent,
      tags: eventTags
    }, {
      onSuccess: (data: NostrEvent) => {
        setIsPublishing(false);
        setPublishProgress({ stage: 'success', status: 'Erfolgreich veröffentlicht!' });

        toast({
          title: 'Erfolg!',
          description: 'Note erfolgreich veroeffentlicht.'
        });

        // Kontinuitäts-Tracking: Motive/Entitäten/Stimmung/offene Fäden erfassen
        trackPublishedPost({
          id: data.id,
          type: 'note',
          kind: 1,
          location,
          content: articleContent,
          url: data.id ? canonicalUrl(noteUrl(nip19.noteEncode(data.id))) : undefined,
        });

        // Publish-Pipeline sofort triggern (Prerender/Sitemap/Feed + IndexNow)
        if (data.id) {
          notifyPublishedPipeline({
            d_tag: data.id,
            url: canonicalUrl(noteUrl(nip19.noteEncode(data.id))),
          });
        }

        // Auto-Übersetzung (DE→EN): EN-Version im Hintergrund veröffentlichen
        if (autoTranslateEn) {
          translateAndPublish({
            type: 'note', kind: 1, originalEventId: data.id,
            pubkey: data.pubkey, title: '', summary: '',
            content: articleContent, baseTags: eventTags, publishTeaser: false,
          });
        }

        // Reset form and redirect
        setContent('');
        setTags([]);
        setLocation('');
        setSelectedCountry('');
        setImageFiles([]);
        setImageUrls([]);
        setImageGpsData({});
        setImageGpsStatuses({});
        setPublishProgress({ stage: '', status: '' });

        // Redirect to notes page after successful publish
        setTimeout(() => {
          navigate('/notes');
        }, 1000);
      },
      onError: (error) => {
        setIsPublishing(false);
        setPublishProgress({ stage: 'error', status: 'Veröffentlichung fehlgeschlagen' });

        toast({
          title: 'Fehler',
          description: 'Veröffentlichung fehlgeschlagen. Bitte versuche es erneut.',
          variant: 'destructive'
        });
      }
    });
  };

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

        {/* KI-Notiz generieren (Optional) */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-ocean-500" />
            <h3 className="font-semibold">KI-Notiz generieren (Optional)</h3>
          </div>

          <div className="space-y-2">
            <Label>Lifestyle</Label>
            <Select value={lifestyle} onValueChange={(value: any) => setLifestyle(value)}>
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

          {/* Perspektive (Ich/Wir) */}
          <PerspectiveSelector
            value={perspective}
            onChange={(v) => { setPerspective(v); setPerspectiveTouched(true); }}
          />

          {/* Art der Reise */}
          <div className="space-y-2">
            <Label>Art der Reise (optional)</Label>
            <Select value={tripType || 'none'} onValueChange={(value) => setTripType(value === 'none' ? '' : value as TripType)}>
              <SelectTrigger>
                <SelectValue placeholder="Keine Angabe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Keine Angabe —</SelectItem>
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
            <p className="text-xs text-muted-foreground">
              Beeinflusst den KI-Text (z.B. Wandern statt Roadtrip)
            </p>
          </div>

          {/* KI-Modell Auswahl */}
          <div className="space-y-2">
            <ModelSelect
              value={selectedModel}
              onChange={setSelectedModel}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={generateNoteWithAI}
            disabled={isGeneratingNote || imageFiles.length === 0}
            className="w-full mt-2"
          >
            {isGeneratingNote ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generiere mit {selectedModel.toUpperCase()} Modell...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                KI-Notiz generieren ({selectedModel.toUpperCase()} Modell)
              </>
            )}
          </Button>
          {content.length > 0 && (
            <p className="text-xs text-muted-foreground">
              📝 Dein Text ({content.length} Zeichen) wird als Grundlage verwendet.
            </p>
          )}
          {imageFiles.length === 0 && (
            <p className="text-xs text-muted-foreground">
              💡 Lade zuerst Bilder hoch, um die KI-Generierung zu nutzen.
            </p>
          )}
        </div>

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

          {/* Uploaded Images */}
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

        <div className="space-y-3">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {getOptionalTags('notes').map(tag => (
              <Badge
                key={tag}
                variant={tags.includes(tag) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => handleTagToggle(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Eigene Tags (mit Leerzeichen trennen)..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const value = e.currentTarget.value;
                  const newTags = value.split(' ').filter(Boolean);
                  setTags(prev => [...prev, ...newTags]);
                  e.currentTarget.value = '';
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                const value = input.value;
                const newTags = value.split(' ').filter(Boolean);
                setTags(prev => [...prev, ...newTags]);
                input.value = '';
              }}
            >
              Hinzufügen
            </Button>
          </div>
        </div>

        {tags.length > 0 && (
          <div className="space-y-2">
            <Label>Ausgewaehlte Tags</Label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="gap-1"
                >
                  {tag}
                  <button
                    className="ml-1 text-xs hover:text-red-500"
                    onClick={() => setTags(prev => prev.filter((_, i) => i !== index))}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

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
