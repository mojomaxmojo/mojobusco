import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ExperiencesConfirm } from "@/components/assistant/ExperiencesConfirm";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/useToast";
import { getApiBaseUrl } from "@/lib/apiBase";
import { ImageOptimizationToggle } from "@/components/ImageOptimizationToggle";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PerspectiveSelector } from "@/components/PerspectiveSelector";
import { type GenderType } from "@/config/prompts/lifestyles";
import { ModelSelect, type TextModelTier } from "@/components/ModelSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MAIN_MENU } from "@/config/menu";
import { TRIP_TYPES, type TripType } from "@/config/tags";
import { RemotionVideoBlock } from "@/components/RemotionVideoBlock";
import { CreateVideoDialog } from "@/components/CreateVideoDialog";
import { Upload, UploadCloud, ImageIcon, Video, Camera, Calendar, Tag, Battery, Sun, Hammer, Cpu, Mountain, Lightbulb, Dog, Trees, Droplets, Waves, Eye, Loader2, CheckCircle, Route, Sparkles, FileText, MessageSquare, Map } from "@/lib/icons";
import { extractGpsFromImage, reverseGeocode, mapCountryCode, type GpsStatus, type LocationData } from "@/lib/gpsExtraction";
import { getTagValue, getTagValues } from "@/lib/nostrEventUtils";
import { extractGpsCrossPlatform, getCurrentPosition, positionToGpsData, isCapacitorNative, pickFilesNative } from "@/lib/capacitorGps";
import { createCorrectedPreview, mediaTypes, mainCategories, subCategories, type MediaFile } from "./publishUtils";
import exifr from "exifr";
import { natureSubcategories, countryTags } from "./mediaUploadForm/mediaUploadFormConfig";
import { TagSummarySection } from "./mediaUploadForm/TagSummarySection";
import { UploadProgressSection } from "./mediaUploadForm/UploadProgressSection";
import { MediaLocationSection } from "./mediaUploadForm/MediaLocationSection";
import { useMediaDragSort } from "./mediaUploadForm/useMediaDragSort";
import { useMediaGpsEditing } from "./mediaUploadForm/useMediaGpsEditing";
import { useMediaPublish } from "./mediaUploadForm/useMediaPublish";
import { MediaPreviewSection } from "./mediaUploadForm/MediaPreviewSection";

import { getTagValue, getTagValues } from "@/lib/nostrEventUtils";
import type { NostrEvent } from '@nostrify/nostrify';

export function MediaUploadForm({ editEvent }: { editEvent?: NostrEvent }) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mainCategory, setMainCategory] = useState('');
  const [selectedSubTags, setSelectedSubTags] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [customTags, setCustomTags] = useState('');
  const [location, setLocation] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [detailedTags, setDetailedTags] = useState<string[]>([]);
  const [additionalImagesUrlInput, setAdditionalImagesUrlInput] = useState('');
  const [manualTags, setManualTags] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  // Ehrlichkeits-Gate für KI-generierte Bild-Texte (Standard: bestätigt, abwählbar)
  const [experiencesConfirmed, setExperiencesConfirmed] = useState(true);
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [selectedModel, setSelectedModel] = useState<TextModelTier>('medium');
  const [lifestyle, setLifestyle] = useState<'mojobus' | 'vanlife' | 'rvlife' | 'beachlife' | 'wohnmobil' | 'perpetual-travelers'>('mojobus');
  const [tripType, setTripType] = useState<TripType | ''>('');
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, stage: '', status: '' });
  const [createVideoOpen, setCreateVideoOpen] = useState(false);

  // Status-Text für nativen Dateipicker (sichtbar im UI, keine Toasts)
  const [nativePickStatus, setNativePickStatus] = useState<string | null>(null);
  // Video-URL der fertigen Slideshow (wird automatisch in Beschreibung eingefügt)
  const [slideshowVideoUrl, setSlideshowVideoUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { gender: autoGender } = useCurrentUser(); // Automatisch erkannte Perspektive (Mojo=male, Susanne=female)
  const [perspectiveTouched, setPerspectiveTouched] = useState(false);
  const [perspective, setPerspective] = useState<GenderType>(autoGender);
  useEffect(() => {
    if (!perspectiveTouched) setPerspective(autoGender);
  }, [autoGender, perspectiveTouched]);
  const gender = perspective;

  // Wird von SlideshowBlock aufgerufen sobald das Video auf Blossom fertig ist
  const handleSlideshowVideoReady = (videoUrl: string) => {
    setSlideshowVideoUrl(videoUrl);
    // Video-URL ans Ende der Beschreibung anfügen
    setDescription(prev => {
      const trimmed = prev.trimEnd();
      return trimmed ? `${trimmed}\n\n${videoUrl}` : videoUrl;
    });
    toast({
      title: '🎬 Video in Beschreibung eingefügt',
      description: 'Die Slideshow-URL wurde automatisch in die Beschreibung übernommen.',
    });
  };

  // KI-Artikelgenerierung (Foster Huntington Stil)
  const generateArticleWithAI = async () => {
    if (files.length === 0) {
      toast({
        title: 'Fehler',
        description: 'Bitte lade mindestens ein Bild hoch.',
        variant: 'destructive'
      });
      return;
    }

    setIsGeneratingArticle(true);
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('images', file.file));
      formData.append('title', title);
      formData.append('description', description);
      formData.append('text', customTags || 'Meer Abenteuer Strand');
      formData.append('location', location);
      formData.append('model', selectedModel);
      formData.append('lifestyle', lifestyle);

      // Zusätzliche Kontext-Felder für bessere KI-Generierung
      formData.append('mainCategory', mainCategory || '');
      formData.append('subCategories', JSON.stringify(selectedSubTags));
      formData.append('detailedTags', JSON.stringify(detailedTags));
      formData.append('country', selectedCountry || '');

      // Erweiterte Kontext-Felder für noch bessere KI-Generierung
      formData.append('manualTags', JSON.stringify(manualTags));
      formData.append('additionalImageUrls', additionalImagesUrlInput || '');
      formData.append('gender', gender || 'neutral'); // Mojo=male, Susanne=female
      formData.append('tripType', tripType || '');
      // Wetter-Kontext: Aufnahmedatum (Server-Fallback: heute)
      if (date) formData.append('publishedAt', date);

      const response = await fetch(`${getApiBaseUrl()}/api/generate-media-article`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.article) {
        setDescription(data.article);
        if (data.hashtags) {
          setCustomTags(prev => prev ? `${prev} ${data.hashtags}` : data.hashtags);
        }
        toast({
          title: 'Erfolg!',
           description: `KI-Artikel generiert mit ${(data.model || 'MEDIUM').toUpperCase()} Modell und in Felder eingefügt.`
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
      setIsGeneratingArticle(false);
    }
  };

  // GPS editing state + functions (Hook, PLAN3.md Schritt 6)
  const { editingGpsFile, batchEditMode, showMapPicker, setShowMapPicker, openGpsEditor, closeGpsEditor, saveGps, removeGps, toggleBatchEditMode, applyGpsToAll } = useMediaGpsEditing({ files, setFiles, setLocation, setSelectedCountry });

  // Auto-fill location from first GPS-detected image
   useEffect(() => {
      const autoFillLocation = async () => {
       const firstGpsImage = files.find(f => f.type === 'image' && f.gps && f.gpsStatus === 'detected');
       if (firstGpsImage && !location) {
         console.log('[Media GPS] GPS detected, reverse geocoding...');
         const locationData = await reverseGeocode(firstGpsImage.gps.latitude, firstGpsImage.gps.longitude);
         if (locationData) {
           // Set location to city + neighbourhood/suburb (no postcode)
           const locationParts = [
             locationData.city,
             locationData.neighbourhood,
             locationData.suburb
           ].filter(Boolean);
           const loc = locationParts.join(', ');
           setLocation(loc);
           console.log('[Media GPS] Location found:', loc);

           // Auto-fill country if detected
           const country = mapCountryCode(locationData);
           if (country && !selectedCountry) {
             setSelectedCountry(country);
             console.log('[Media GPS] Country auto-filled:', country);
           }
         }
       }
     };

     autoFillLocation();
   }, [files, location, selectedCountry]);

  // Handler functions
  const handleMainCategoryChange = (value: string) => {
    setMainCategory(value);
    setSelectedSubTags([]); // Reset sub-tags when main category changes
    setDetailedTags([]); // Reset detailed tags when main category changes
  };

  const handleDetailedTagToggle = (tag: string) => {
    setDetailedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSubTagToggle = (tag: string) => {
    setSelectedSubTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Load edit data
  useEffect(() => {
    if (editEvent) {
      // Extract title from content
      const lines = editEvent.content.split('\n');
      const titleMatch = lines[0]?.match(/^# (.+)$/);
      if (titleMatch) {
        setTitle(titleMatch[1]);
        setDescription(lines.slice(2).join('\n').trim());
      } else {
        setDescription(editEvent.content || '');
      }

      // Extract tags
      const eventTags = getTagValues(editEvent, 't');
      const categoryTag = eventTags.find(tag => ['vanlife', 'technik', 'reisen', 'leben', 'natur'].includes(tag));
      if (categoryTag) {
        setMainCategory(categoryTag);

        // For natur category, separate subcategories from detailed tags
        if (categoryTag === 'natur') {
          const subCategories = eventTags.filter(tag => natureSubcategories.includes(tag));
          const detailedTags = eventTags.filter(tag =>
            !natureSubcategories.includes(tag) &&
            tag !== categoryTag &&
            !['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg'].includes(tag)
          );
          setSelectedSubTags(subCategories);
          setDetailedTags(detailedTags);
        } else {
          setSelectedSubTags(eventTags.filter(tag => tag !== categoryTag));
        }
      }
      setLocation(getTagValue(editEvent, 'location') || '');
      const dateTag = getTagValue(editEvent, 'published_at');
      if (dateTag) {
        // Wenn Unix-Timestamp, in Datum umwandeln
        if (/^\d+$/.test(dateTag)) {
          setDate(new Date(parseInt(dateTag) * 1000).toISOString().split('T')[0]);
        } else {
          // Wenn schon im richtigen Format
          setDate(dateTag);
        }
      }

      // Extract country from tags
      const foundCountry = eventTags.find(tag => countryTags.includes(tag));
      if (foundCountry) {
        setSelectedCountry(foundCountry);
      }
    } else {
      // Bei neuen Beiträgen: aktuelles Datum setzen
      setDate(''); // Wird im useEffect neu auf aktuelles Datum gesetzt
    }
  }, [editEvent]);

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles: MediaFile[] = [];

    // Device-Erkennung: Desktop braucht EXIF-Korrektur, Mobil nicht
    const isDesktop = window.innerWidth > 768 || !/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log(`[Device] Detected as ${isDesktop ? 'Desktop' : 'Mobile'} - ${isDesktop ? 'will correct EXIF orientation' : 'will use simple preview'}`);

    // Process each file asynchronously
    for (const file of Array.from(selectedFiles)) {
      const mediaType = file.type.startsWith('image/') ? 'image' :
                         file.type.startsWith('video/') ? 'video' :
                         file.type.startsWith('audio/') ? 'audio' : 'document';

      let preview: string | undefined;
      let exifWidth: number | undefined;
      let exifHeight: number | undefined;
      let exifOrientation: number | undefined;

       // Für Desktop-Bilder: EXIF-Korrektur anwenden
       if (mediaType === 'image' && isDesktop) {
         try {
           // EXIF-Daten lesen (wie in TripPublishForm.tsx)
           // Orientation separat lesen (funktioniert auch wenn parse fehlschlägt)
           try {
             exifOrientation = await exifr.orientation(file);
             console.log(`[Media EXIF] ${file.name}: Orientation (via exifr.orientation) = ${exifOrientation || 'not found'}`);
           } catch (orientErr) {
             console.warn(`[Media EXIF] ${file.name}: Could not read orientation:`, orientErr);
           }

           // Bildabmessungen lesen
           try {
             const dimExif = await exifr.parse(file, { exif: true, pickTags: ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight'] });
             exifWidth = dimExif?.ImageWidth || dimExif?.ExifImageWidth;
             exifHeight = dimExif?.ImageHeight || dimExif?.ExifImageHeight;
             if (exifWidth && exifHeight) {
               console.log(`[Media EXIF] ${file.name}: EXIF dimensions ${exifWidth}x${exifHeight}`);
             }
           } catch (dimErr) {
             console.warn(`[Media EXIF] ${file.name}: Could not read dimensions:`, dimErr);
           }

           // Korrigierte Preview erstellen (immer, wie in TripPublishForm.tsx)
           preview = await createCorrectedPreview(file, exifWidth, exifHeight, exifOrientation);
         } catch (exifError) {
           console.warn(`[Media EXIF] Failed to read EXIF from ${file.name}:`, exifError);
           preview = URL.createObjectURL(file);
         }
       } else {
         // Für Mobil oder Nicht-Bilder: Einfache Preview
         // Bilder und Videos bekommen eine Preview
         preview = (mediaType === 'image' || mediaType === 'video') ? URL.createObjectURL(file) : undefined;
       }

      // EXIF-Aufnahmedatum lesen (für Sortierung: älteste zuerst)
      let exifDate: number | undefined;
      if (mediaType === 'image') {
        try {
          const dateMeta = await exifr.parse(file, { exif: true, pickTags: ['DateTimeOriginal', 'CreateDate', 'DateTime'] });
          const rawDate = dateMeta?.DateTimeOriginal || dateMeta?.CreateDate || dateMeta?.DateTime;
          if (rawDate instanceof Date) {
            exifDate = rawDate.getTime();
          } else if (typeof rawDate === 'string') {
            // EXIF Format: "2024:06:15 14:30:00" → ISO parsen
            const iso = rawDate.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
            exifDate = new Date(iso).getTime();
          }
          if (exifDate) console.log(`[EXIF Date] ${file.name}: ${new Date(exifDate).toLocaleString()}`);
        } catch {
          // kein EXIF-Datum → Fallback: lastModified
        }
      }

      const newFile: MediaFile = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        type: mediaType,
        size: file.size,
        preview,
        gpsStatus: 'not_found',
        // Sortier-Timestamp: EXIF-Datum > lastModified > jetzt
        sortDate: exifDate || file.lastModified || Date.now(),
      };

      // Extract GPS from images only
      if (mediaType === 'image') {
        try {
          // 1. exifr.js (funktioniert auf Desktop-Browsern)
          const gpsData = await extractGpsFromImage(file);
          if (gpsData) {
            newFile.gps = gpsData;
            newFile.gpsStatus = 'detected';
            console.log(`[GPS] Extracted from ${file.name}:`, gpsData);
          } else if (isCapacitorNative()) {
            // 2. Capacitor Native EXIF (umgeht Browser-Strip auf Mobil)
            console.log(`[GPS] exifr keine GPS, versuche Capacitor native EXIF für ${file.name}...`);
            const nativeGps = await extractGpsCrossPlatform(file, null);
            if (nativeGps) {
              newFile.gps = nativeGps;
              newFile.gpsStatus = 'detected';
              console.log(`[GPS] ✓ Native EXIF GPS für ${file.name}:`, nativeGps);
            }
          }
        } catch (error) {
          console.error(`[GPS] Failed to extract from ${file.name}:`, error);
          newFile.gpsStatus = 'error';
        }
      }

      newFiles.push(newFile);
    }

    // Sortierung: älteste zuerst (kleinster Timestamp zuerst)
    newFiles.sort((a, b) => (a.sortDate ?? 0) - (b.sortDate ?? 0));
    console.log('[Sort] Bilder sortiert nach Aufnahmedatum (älteste zuerst):', newFiles.map(f => `${f.name} (${new Date(f.sortDate ?? 0).toLocaleString()})`));

    // 3. Geolocation-Fallback für Bilder ohne GPS (alle Plattformen)
    const imagesWithoutGps = newFiles.filter(f => f.type === 'image' && (!f.gps || f.gpsStatus === 'not_found'));
    if (imagesWithoutGps.length > 0) {
      console.log(`[GPS] ${imagesWithoutGps.length} Bilder ohne GPS – versuche Geräte-Standort...`);
      try {
        const position = await getCurrentPosition();
        if (position) {
          const gpsData = positionToGpsData(position);
          console.log(`[GPS] ✓ Standort bezogen, wende auf ${imagesWithoutGps.length} Bilder an:`, gpsData);
          imagesWithoutGps.forEach(f => {
            f.gps = { ...gpsData };
            f.gpsStatus = 'detected';
          });
        } else {
          console.log('[GPS] Kein Standort verfügbar (abgelehnt oder nicht unterstützt)');
        }
      } catch (geoError) {
        console.warn('[GPS] Geolocation-Fallback fehlgeschlagen:', geoError);
      }
    }

    // Auto-fill location from first GPS-detected image
    const firstGpsImage = newFiles.find(f => f.type === 'image' && f.gps && f.gpsStatus === 'detected');
    if (firstGpsImage && !location) {
      try {
        const locationData = await reverseGeocode(firstGpsImage.gps.latitude, firstGpsImage.gps.longitude);
        if (locationData) {
          const locationParts = [locationData.city, locationData.neighbourhood, locationData.suburb].filter(Boolean);
          const loc = locationParts.join(', ');
          setLocation(loc);
          console.log('[GPS] Location from GPS image:', loc);
          const country = mapCountryCode(locationData);
          if (country && !selectedCountry) {
            setSelectedCountry(country);
          }
        }
      } catch (err) {
        console.warn('[GPS] Reverse geocoding for auto-location failed:', err);
      }
    }

    setFiles(prev => [...prev, ...newFiles]);
  };

  /**
   * handleNativePick – Capacitor Native Dateipicker
   *
   * Nutzt @capawesome/capacitor-file-picker + @capacitor-community/exif
   * um native content:// URIs zu erhalten und GPS direkt zu lesen.
   * Nur verfügbar wenn die App als APK läuft (Capacitor WebView).
   */
  const handleNativePick = async () => {
    try {
      setNativePickStatus('📷 Öffne Galerie...');

      const pickedFiles = await pickFilesNative({ multiple: true });
      if (pickedFiles.length === 0) {
        setNativePickStatus('❌ Keine Dateien ausgewählt');
        return;
      }

      const newFiles: MediaFile[] = [];
      let gpsFoundFrom: 'exif' | 'geolocation' | null = null;

      for (const picked of pickedFiles) {
        if (!picked.file || picked.file.size === 0) {
          setNativePickStatus(`❌ ${picked.name}: Datei leer`);
          continue;
        }

        let preview: string | undefined;
        try {
          preview = URL.createObjectURL(picked.file);
        } catch { /* silent */ }

        const newFile: MediaFile = {
          id: Math.random().toString(36).substr(2, 9),
          file: picked.file,
          name: picked.name,
          type: picked.mimeType.startsWith('image/') ? 'image' : 'document',
          size: picked.file.size,
          preview,
          gps: picked.gps,
          gpsStatus: picked.gpsStatus,
          sortDate: Date.now(),
        };

        newFiles.push(newFile);

        if (picked.gpsStatus === 'detected') gpsFoundFrom = 'exif';
        else if (picked.gpsStatus === 'geolocation') gpsFoundFrom = 'geolocation';

        const fileSize = (picked.file.size / 1024).toFixed(0);
        const gpsTxt = picked.gps
          ? `${picked.gpsStatus === 'geolocation' ? '📡 Geräte-GPS' : '📍 EXIF-GPS'}: ${picked.gps.latitude.toFixed(4)}, ${picked.gps.longitude.toFixed(4)}`
          : '📍 Kein GPS';
        setNativePickStatus(`✅ ${picked.name} (${fileSize} KB) | ${preview ? '🖼️ OK' : '⚠️ Kein Vorschau'} | ${gpsTxt}`);
      }

      if (newFiles.length === 0) {
        setNativePickStatus('❌ Keine Datei konnte geladen werden');
        return;
      }

      // GPS-Geocoding
      const firstGps = newFiles.find(f => f.gps && (f.gpsStatus === 'detected' || f.gpsStatus === 'geolocation'));
      if (firstGps && firstGps.gps && !location) {
        try {
          setNativePickStatus(`📍 Ermittle Standort für GPS...`);
          const locData = await reverseGeocode(firstGps.gps.latitude, firstGps.gps.longitude);
          if (locData) {
            const parts = [locData.city, locData.neighbourhood, locData.suburb].filter(Boolean);
            setLocation(parts.join(', '));
            const country = mapCountryCode(locData);
            if (country) setSelectedCountry(country);
          }
        } catch { /* silent */ }
      }

      setFiles(prev => [...prev, ...newFiles]);

      if (gpsFoundFrom === 'exif') {
        setNativePickStatus(`✅ ${newFiles.length} Datei(en) | 📍 EXIF-GPS: ${firstGps?.gps?.latitude.toFixed(4)}, ${firstGps?.gps?.longitude.toFixed(4)}`);
      } else if (gpsFoundFrom === 'geolocation') {
        setNativePickStatus(`✅ ${newFiles.length} Datei(en) | 📡 Geräte-GPS: ${firstGps?.gps?.latitude.toFixed(4)}, ${firstGps?.gps?.longitude.toFixed(4)}`);
      } else {
        setNativePickStatus(`✅ ${newFiles.length} Datei(en) | 📍 Kein GPS`);
      }
    } catch (error) {
      console.error('[NativePick] Error:', error);
      setNativePickStatus('❌ Fehler: ' + String(error).slice(0, 100));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // ── Drag-and-Drop Reihenfolge ──────────────────────────────────────────
  const { dragIndex, dragOverIndex, handleDragStart, handleDragOver, handleDragDrop, handleDragEnd, moveFile } = useMediaDragSort({ files, setFiles });

  const { handleSubmit } = useMediaPublish({ files, title, description, customTags, selectedSubTags, detailedTags, selectedCountry, mainCategory, location, date, setFiles, setTitle, setDescription, setMainCategory, setSelectedSubTags, setDetailedTags, setCustomTags, setLocation, setSelectedCountry, setDate, setIsUploading, setUploadProgress });

  const handleVideoCreated = (mediaFile: MediaFile) => {
    setFiles(prev => [...prev, mediaFile]);
    setCreateVideoOpen(false);
  };



  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Medien hochladen
          </CardTitle>
        </CardHeader>
        <CardContent>
<div
 className={`border-2 border-dashed rounded-lg text-center transition-colors p-8 max-sm:p-2 ${
   isDragging ? 'border-ocean-500 bg-ocean-50' : 'border-gray-300 dark:border-gray-600'
 }`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
          >
            <input
              type="file"
              multiple
              accept={mediaTypes.map(m => m.accept).join(',')}
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              id="file-upload"
            />
            <div className="flex flex-row gap-2 justify-center">
              <Button asChild variant="outline" className="max-sm:flex-col max-sm:aspect-square max-sm:h-24 max-sm:w-24 max-sm:p-1 max-sm:gap-0.5 text-sm max-sm:text-[10px]">
                <label htmlFor="file-upload" className="cursor-pointer flex items-center gap-1 max-sm:flex-col max-sm:gap-0.5">
                  <Camera className="h-4 w-4 max-sm:h-5 max-sm:w-5 shrink-0" />
                  <span>Auswahl</span>
                </label>
              </Button>

              <Button
                onClick={handleNativePick}
                variant="outline"
                className="flex items-center gap-1 max-sm:flex-col max-sm:aspect-square max-sm:h-24 max-sm:w-24 max-sm:p-1 max-sm:gap-0.5 text-sm max-sm:text-[10px]"
              >
                <Camera className="h-4 w-4 max-sm:h-5 max-sm:w-5 shrink-0" />
                <span>Bilder GPS</span>
              </Button>

              <Button
                onClick={() => setCreateVideoOpen(true)}
                variant="outline"
                className="flex items-center gap-1 max-sm:flex-col max-sm:aspect-square max-sm:h-24 max-sm:w-24 max-sm:p-1 max-sm:gap-0.5 text-sm max-sm:text-[10px]"
              >
                <Video className="h-4 w-4 max-sm:h-5 max-sm:w-5 shrink-0" />
                <span>Video erstellen</span>
              </Button>

              {nativePickStatus && (
                <div className="w-full text-xs bg-muted/50 rounded p-2 border text-center">
                  {nativePickStatus}
                </div>
              )}
            </div>
          </div>
        </CardContent>
       </Card>

      <CreateVideoDialog
        open={createVideoOpen}
        onOpenChange={setCreateVideoOpen}
        onVideoCreated={handleVideoCreated}
      />

      {/* Media Preview */}
      <MediaPreviewSection
        files={files}
        batchEditMode={batchEditMode}
        toggleBatchEditMode={toggleBatchEditMode}
        dragIndex={dragIndex}
        dragOverIndex={dragOverIndex}
        handleDragStart={handleDragStart}
        handleDragOver={handleDragOver}
        handleDragDrop={handleDragDrop}
        handleDragEnd={handleDragEnd}
        moveFile={moveFile}
        editingGpsFile={editingGpsFile}
        openGpsEditor={openGpsEditor}
        showMapPicker={showMapPicker}
        setShowMapPicker={setShowMapPicker}
        saveGps={saveGps}
        closeGpsEditor={closeGpsEditor}
        removeGps={removeGps}
        applyGpsToAll={applyGpsToAll}
        removeFile={removeFile}
        setLocation={setLocation}
        setSelectedCountry={setSelectedCountry}
      />

        {/* Location */}
        <MediaLocationSection files={files} location={location} setLocation={setLocation} selectedCountry={selectedCountry} setSelectedCountry={setSelectedCountry} />

       {/* Media Details */}
      <Card>
        <CardHeader>
          <CardTitle>Bilderdetails</CardTitle>
          <ImageOptimizationToggle className="mt-4" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Gib deinen Bildern einen Titel..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Datum</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

           <div className="space-y-2">
             <Label htmlFor="description">Beschreibung</Label>
             <Textarea
               id="description"
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               placeholder="Beschreibe deine Bilder-Erlebnisse..."
               rows={4}
              />
              
              {/* Lifestyle Selection */}
               <div className="mt-4 space-y-3">
                 <Label className="text-sm font-medium">Lifestyle auswählen:</Label>
                  <Select value={lifestyle} onValueChange={(value: string) => setLifestyle(value as typeof lifestyle)}>
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
               <div className="mt-3">
                 <PerspectiveSelector
                   value={perspective}
                   onChange={(v) => { setPerspective(v); setPerspectiveTouched(true); }}
                 />
               </div>

               {/* Art der Reise */}
               <div className="mt-3 space-y-2">
                 <Label className="text-sm font-medium">Art der Reise (optional):</Label>
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
                 <div className="mt-4 space-y-2">
                   <ModelSelect
                     value={selectedModel}
                     onChange={setSelectedModel}
                   />
                   <p className="text-xs text-muted-foreground">
                     Stufen sind zentral in src/config/ai-models.js konfigurierbar.
                   </p>
                 </div>
              
              <Button
                type="button"
                variant="outline"
                onClick={generateArticleWithAI}
                disabled={isGeneratingArticle || files.length === 0}
                className="mt-2"
              >
                {isGeneratingArticle ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generiere mit {selectedModel.toUpperCase()} Modell...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    KI-Artikel generieren ({lifestyle})
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({selectedModel.toUpperCase()} Modell)
                    </span>
                  </>
                )}
              </Button>
              {files.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  💡 Lade zuerst Bilder hoch, um die KI-Generierung zu nutzen.
                </p>
              )}
            </div>

          {/* Categories */}
          <div className="space-y-4">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hauptkategorie</Label>
                <Select value={mainCategory} onValueChange={handleMainCategoryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Hauptkategorie waehlen" />
                  </SelectTrigger>
                  <SelectContent>
                    {mainCategories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <span className="flex items-center gap-2">
                          <span>{cat.icon}</span>
                          {cat.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Themen</Label>
                  {selectedSubTags.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {selectedSubTags.length} ausgewählt
                    </span>
                  )}
                </div>

                {mainCategory ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {subCategories[mainCategory as keyof typeof subCategories]?.map(tag => (
                        <Badge
                          key={tag}
                          variant={selectedSubTags.includes(tag) ? "default" : "outline"}
                          className={`cursor-pointer transition-all hover:scale-105 ${
                            selectedSubTags.includes(tag)
                              ? "bg-ocean-600 hover:bg-ocean-700 text-white"
                              : "hover:bg-ocean-100 hover:text-ocean-700 hover:border-ocean-300"
                          }`}
                          onClick={() => handleSubTagToggle(tag)}
                        >
                          {selectedSubTags.includes(tag) && (
                            <span className="mr-1">✓</span>
                          )}
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {selectedSubTags.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Ausgewählte Themen:</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedSubTags.map(tag => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs bg-ocean-100 text-ocean-700 hover:bg-ocean-200"
                            >
                              {tag}
                              <button
                                onClick={() => handleSubTagToggle(tag)}
                                className="ml-1 hover:text-ocean-900"
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Special handling for Nature category - show detailed tags */}
                    {mainCategory === 'natur' && selectedSubTags.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <div className="text-sm font-medium text-muted-foreground">
                          Detaillierte Tags für {selectedSubTags.join(', ')}:
                        </div>
                        {selectedSubTags.map(subCategory => {
                          const categoryConfig = MAIN_MENU.nature[subCategory as keyof typeof MAIN_MENU.nature];
                          if (!categoryConfig?.tags) return null;

                      return (
                            <div key={subCategory} className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{categoryConfig.emoji}</span>
                                <span className="font-medium">{categoryConfig.name}</span>
                              </div>

                              <div className="space-y-2">
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Primär-Tags:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {categoryConfig.tags.primary.map(tag => (
                                      <Badge
                                        key={`primary-${tag}`}
                                        variant={detailedTags.includes(tag) ? "default" : "outline"}
                                        className={`text-xs cursor-pointer transition-all hover:scale-105 ${
                                          detailedTags.includes(tag)
                                            ? "bg-green-600 hover:bg-green-700 text-white"
                                            : "hover:bg-green-100 hover:text-green-700 hover:border-green-300"
                                        }`}
                                        onClick={() => handleDetailedTagToggle(tag)}
                                      >
                                        {detailedTags.includes(tag) && <span className="mr-1">✓</span>}
                                        #{tag}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Sekundär-Tags:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {categoryConfig.tags.secondary.map(tag => (
                                      <Badge
                                        key={`secondary-${tag}`}
                                        variant={detailedTags.includes(tag) ? "default" : "outline"}
                                        className={`text-xs cursor-pointer transition-all hover:scale-105 ${
                                          detailedTags.includes(tag)
                                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                                            : "hover:bg-blue-100 hover:text-blue-700 hover:border-blue-300"
                                        }`}
                                        onClick={() => handleDetailedTagToggle(tag)}
                                      >
                                        {detailedTags.includes(tag) && <span className="mr-1">✓</span>}
                                        #{tag}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Show selected detailed tags */}
                    {detailedTags.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Ausgewählte Detail-Tags:</p>
                        <div className="flex flex-wrap gap-1">
                          {detailedTags.map(tag => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >
                              #{tag}
                              <button
                                onClick={() => handleDetailedTagToggle(tag)}
                                className="ml-1 hover:text-gray-900"
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-dashed">
                    Bitte wähle zuerst eine Hauptkategorie
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Eigene Tags</Label>
              <Input
                placeholder="sunset-watching vanlife portugal (mit Leerzeichen trennen)"
                value={customTags}
                onChange={(e) => setCustomTags(e.target.value)}
              />
              {customTags && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Vorschau:</p>
                  <div className="flex flex-wrap gap-1">
                    {customTags.split(' ').filter(Boolean).map((tag, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="text-xs bg-purple-100 text-purple-700 border-purple-300"
                      >
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tag Summary */}
          <TagSummarySection mainCategory={mainCategory} selectedSubTags={selectedSubTags} detailedTags={detailedTags} customTags={customTags} />

          {/* Upload Progress */}
          {isUploading && (
            <UploadProgressSection uploadProgress={uploadProgress} />
          )}

          {/* Video Generator — Remotion */}
          <RemotionVideoBlock
            imageUrls={imageUrls}
            localFiles={files.filter(f => f.type === 'image').map(f => f.file)}
            lifestyle={lifestyle}
            title={title || 'medien'}
            summary={description?.slice(0, 120)}
            location={location}
            country={selectedCountry}
            onVideoReady={handleSlideshowVideoReady}
          />

          {/* Hinweis wenn Video bereits eingefügt */}
          {slideshowVideoUrl && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
              <span>🎬</span>
              <span>Slideshow-Video wurde in die Beschreibung eingefügt und wird beim Veröffentlichen automatisch mit gepostet.</span>
            </div>
          )}

          <ExperiencesConfirm
            checked={experiencesConfirmed}
            onChange={setExperiencesConfirmed}
          />

          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={files.length === 0 || isUploading || !experiencesConfirmed}
          >
            {isUploading ? (
              <>
                {uploadProgress.stage === 'upload' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {uploadProgress.stage === 'publish' && <UploadCloud className="h-4 w-4 mr-2" />}
                {uploadProgress.stage === 'success' && <CheckCircle className="h-4 w-4 mr-2" />}
                {uploadProgress.stage === 'error' && <span className="mr-2">⚠️</span>}
                {!uploadProgress.stage && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {uploadProgress.stage === 'upload' && 'Upload zu Blossom...'}
                {uploadProgress.stage === 'publish' && 'Post zu Nostr...'}
                {uploadProgress.stage === 'success' && '✅ Erfolgreich!'}
                {uploadProgress.stage === 'error' && 'Fehler aufgetreten'}
                {!uploadProgress.stage && 'Wird verarbeitet...'}
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4 mr-2" />
                Bilder veroeffentlichen
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}