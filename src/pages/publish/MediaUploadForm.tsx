import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/useToast";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useContinuityTracking } from "@/hooks/useContinuityTracking";
import { ImageOptimizationToggle } from "@/components/ImageOptimizationToggle";
import { GpsEditor } from "@/components/GpsEditor";
import { GpsStatusIndicator } from "@/components/GpsStatusIndicator";
import { LocationPicker } from "@/components/LocationPicker";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PerspectiveSelector } from "@/components/PerspectiveSelector";
import { type GenderType } from "@/config/prompts/lifestyles";
import { ModelSelect, type TextModelTier } from "@/components/ModelSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CountrySelector, getCountryTag } from "@/components/CountrySelector";
import { MAIN_MENU } from "@/config/menu";
import { TRIP_TYPES, type TripType } from "@/config/tags";
import { RemotionVideoBlock } from "@/components/RemotionVideoBlock";
import { CreateVideoDialog } from "@/components/CreateVideoDialog";
import { Progress } from "@/components/ui/progress";
import { Upload, UploadCloud, ImageIcon, Video, Music, File as FileIcon, Camera, MapPin, Calendar, Tag, Battery, Sun, Wrench, Hammer, Cpu, Mountain, Lightbulb, Dog, Trees, Droplets, Waves, Eye, Loader2, CheckCircle, Route, Sparkles, FileText, MessageSquare, Map } from "@/lib/icons";
import { extractGpsFromImage, formatCoordinatesSimple, reverseGeocode, mapCountryCode, type GpsData, type GpsStatus, type LocationData } from "@/lib/gpsExtraction";
import { extractGpsCrossPlatform, getCurrentPosition, positionToGpsData, isCapacitorNative, pickFilesNative } from "@/lib/capacitorGps";
import { createCorrectedPreview, mediaTypes, mainCategories, subCategories, type MediaFile, type UploadProgress } from "./publishUtils";
import exifr from "exifr";

export function MediaUploadForm({ editEvent }: { editEvent?: any }) {
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
  const { mutateAsync: uploadFile } = useUploadFile();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { trackPublishedPost } = useContinuityTracking();
  const { gender: autoGender } = useCurrentUser(); // Automatisch erkannte Perspektive (Mojo=male, Susanne=female)
  const [perspectiveTouched, setPerspectiveTouched] = useState(false);
  const [perspective, setPerspective] = useState<GenderType>(autoGender);
  useEffect(() => {
    if (!perspectiveTouched) setPerspective(autoGender);
  }, [autoGender, perspectiveTouched]);
  const gender = perspective;
  const navigate = useNavigate();

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

      const response = await fetch('/api/generate-media-article', {
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

  // GPS editing state
  const [editingGpsFile, setEditingGpsFile] = useState<string | null>(null);
  const [batchEditMode, setBatchEditMode] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

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
      const eventTags = editEvent.tags?.filter((tag: any) => tag[0] === 't')?.map((tag: any) => tag[1]) || [];
      const categoryTag = eventTags.find(tag => ['vanlife', 'technik', 'reisen', 'leben', 'natur'].includes(tag));
      if (categoryTag) {
        setMainCategory(categoryTag);

        // For natur category, separate subcategories from detailed tags
        if (categoryTag === 'natur') {
          const natureSubcategories = ['tiere', 'blumen', 'strand', 'berge', 'wald', 'meer'];
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
      setLocation(editEvent.tags?.find((tag: any) => tag[0] === 'location')?.[1] || '');
      const dateTag = editEvent.tags?.find((tag: any) => tag[0] === 'published_at')?.[1];
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
      const countryTags = ['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg'];
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

  // GPS editing functions
  const openGpsEditor = (fileId: string) => {
    setEditingGpsFile(fileId);
  };

  const closeGpsEditor = () => {
    setEditingGpsFile(null);
    setShowMapPicker(false);
  };

  const saveGps = async (fileId: string, gps: GpsData) => {
    // Save GPS to file
    setFiles(prev => prev.map(file => {
      if (file.id === fileId) {
        return {
          ...file,
          gps,
          gpsStatus: 'manual',
        };
      }
      return file;
    }));

    // Auto-fill location and country using reverse geocoding
    try {
      console.log('[Media GPS Manual] Reverse geocoding for manual GPS...', gps);
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
        console.log('[Media GPS Manual] Location found:', loc);

        // Auto-fill country if detected
        const country = mapCountryCode(locationData);
        if (country) {
          setSelectedCountry(country);
          console.log('[Media GPS Manual] Country auto-filled:', country);
        }
      }
    } catch (error) {
      console.error('[Media GPS Manual] Reverse geocoding failed:', error);
    }

    closeGpsEditor();
  };

  const removeGps = (fileId: string) => {
    setFiles(prev => prev.map(file => {
      if (file.id === fileId) {
        const updated = { ...file };
        delete updated.gps;
        updated.gpsStatus = 'not_found';
        return updated;
      }
      return file;
    }));
    closeGpsEditor();
  };

  const toggleBatchEditMode = () => {
    setBatchEditMode(prev => !prev);
  };

  // ── Drag-and-Drop Reihenfolge ──────────────────────────────────────────
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== dragIndex) setDragOverIndex(index);
  };

  const handleDragDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setFiles(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(dropIndex, 0, moved);
      return updated;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Bild nach links/rechts verschieben (Pfeil-Buttons als Alternative)
  const moveFile = (index: number, direction: 'left' | 'right') => {
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= files.length) return;
    setFiles(prev => {
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return updated;
    });
  };

  const applyGpsToAll = (sourceFileId: string) => {
    const sourceFile = files.find(f => f.id === sourceFileId);
    if (!sourceFile || !sourceFile.gps) return;

    setFiles(prev => prev.map(file => {
      if (file.type === 'image' && file.id !== sourceFileId) {
        return {
          ...file,
          gps: { ...sourceFile.gps },
          gpsStatus: 'manual',
        };
      }
      return file;
    }));
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast({
        title: 'Fehler',
        description: 'Bitte waehle mindestens eine Datei aus.',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: files.length, stage: 'upload', status: '📤 Upload zu Blossom wird gestartet...' });

    try {
      // STAGE 1: Upload all files to Blossom
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const fileObj = files[i];
        setUploadProgress({
          current: i + 1,
          total: files.length,
          stage: 'upload',
          status: `📤 Lade "${fileObj.name}" zu Blossom hochladen... (${((i + 1) / files.length * 100).toFixed(0)}%)`
        });

        try {
          const uploadResult = await uploadFile(fileObj.file);

          if (!uploadResult) {
            throw new Error('Upload returned null');
          }

          // Check if uploadResult is an array (expected format from BlossomUploader)
          if (!Array.isArray(uploadResult)) {
            console.error('Upload result is not an array:', typeof uploadResult, uploadResult);
            throw new Error('Upload returned invalid format - expected array');
          }

          if (uploadResult.length === 0) {
            throw new Error('Upload returned empty array');
          }

          // Find the URL tag (format: ['url', 'https://...'])
          const urlTag = uploadResult.find(tag => Array.isArray(tag) && tag.length >= 2 && tag[0] === 'url');

          if (!urlTag) {
            // Fallback: try to get the first tag that looks like a URL
            const potentialUrlTag = uploadResult.find(tag =>
              Array.isArray(tag) &&
              tag.length >= 2 &&
              typeof tag[1] === 'string' &&
              tag[1].startsWith('http')
            );

            if (potentialUrlTag) {
              uploadedUrls.push(potentialUrlTag[1]);
            } else {
              console.error('No URL tag found in upload result:', uploadResult);
              throw new Error('No URL found in upload result');
            }
          } else {
            uploadedUrls.push(urlTag[1]);
          }

          // Brief delay to show progress
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (uploadError) {
          console.error('Upload failed for file:', fileObj.file.name, uploadError);
          console.error('Upload error details:', {
            name: uploadError.name,
            message: uploadError.message,
            stack: uploadError.stack
          });
          throw new Error(`Upload failed for ${fileObj.file.name}: ${uploadError.message}`);
        }
      }

      // STAGE 2: Publish to Nostr
      setUploadProgress({
        current: files.length,
        total: files.length,
        stage: 'publish',
        status: '📝 Nostr Event wird erstellt...'
      });

      // Create content with file URLs
      const content = `${title ? `# ${title}\n\n` : ''}${description ? `${description}\n\n` : ''}${uploadedUrls.join('\n\n')}`;

      // Entferne Country-Tags aus customTags, um Duplikate zu vermeiden
      const countryList = ['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg'];
      const customTagsArray = (customTags || '').split(' ').filter(Boolean);
      const customTagsWithoutCountry = customTagsArray.filter(tag =>
        !countryList.includes(tag.toLowerCase()) &&
        !countryList.includes(tag.replace('#', '').toLowerCase())
      );

      // Collect all tags from different sources
      const allTags = [
        ...selectedSubTags,
        ...detailedTags,
        ...customTagsWithoutCountry,
        ...(selectedCountry ? getCountryTag(selectedCountry) : []) // Country-Tags nur hinzufügen, wenn gewählt
      ];

      // Always add #mojobus as mandatory tag for /veroeffentlichen
      const mojobusTag = 'mojobus';
      const tagsWithMojobus = [...allTags, mojobusTag];

      // Additional special tags
      const additionalTags = [
        ['type', 'media'],
        ['t', 'media']  // Add media tag for /bilder page compatibility
      ];

      if (mainCategory) additionalTags.push(['t', mainCategory]);

      // Add GPS tags from first image with GPS data
      const firstGpsImage = files.find(f => f.type === 'image' && f.gps);
      if (firstGpsImage && firstGpsImage.gps) {
        additionalTags.push(['gps_lat', firstGpsImage.gps.latitude.toString()]);
        additionalTags.push(['gps_lon', firstGpsImage.gps.longitude.toString()]);
        if (firstGpsImage.gps.altitude) {
          additionalTags.push(['gps_alt', firstGpsImage.gps.altitude.toString()]);
        }
        additionalTags.push(['gps_precision', firstGpsImage.gps.precision]);
        additionalTags.push(['gps_source', firstGpsImage.gpsStatus]);
      }

      // Add location and date tags
      if (location) additionalTags.push(['location', location]);
      if (date) additionalTags.push(['published_at', date]);

      // Final tag array - includes #mojobus
      const tags = [
        ...tagsWithMojobus.map(tag => ['t', tag]),
        ...additionalTags
      ];

      setUploadProgress({
        current: files.length,
        total: files.length,
        stage: 'publish',
        status: '📡 Sende Event zu Nostr Relays...'
      });

      // Publish to Nostr
      try {
        console.log('[MediaUpload] Publishing event to Nostr...');
        console.log('[MediaUpload] Content:', content.substring(0, 100) + '...');
        console.log('[MediaUpload] Tags count:', tags.length);
        
        const publishedEvent = await publishEvent({
          kind: 1, // Text note with media attachments
          content,
          tags
        });

        console.log('[MediaUpload] Event published successfully!');

        // Kontinuitäts-Tracking: Motive/Entitäten/Stimmung/offene Fäden erfassen
        trackPublishedPost({
          id: publishedEvent.id,
          type: 'media',
          kind: 1,
          location,
          country: selectedCountry,
          publishedAt: date,
          content,
        });
      } catch (publishError: any) {
        console.error('[MediaUpload] Publish failed:', publishError);
        console.error('[MediaUpload] Error details:', {
          name: publishError?.name,
          message: publishError?.message,
          stack: publishError?.stack,
          cause: publishError?.cause
        });
        throw new Error(`Publishing failed: ${publishError?.message || 'Unknown error'}`);
      }

      // SUCCESS!
      setUploadProgress({
        current: files.length,
        total: files.length,
        stage: 'success',
        status: '✅ Erfolgreich! Bilder hochgeladen und veroeffentlicht.'
      });

      toast({
        title: 'Erfolg!',
        description: 'Bilder erfolgreich hochgeladen und veroeffentlicht.'
      });

      // Reset form and redirect
      setFiles([]);
      setTitle('');
      setDescription('');
      setMainCategory('');
      setSelectedSubTags([]);
      setDetailedTags([]);
      setCustomTags('');
      setLocation('');
      setSelectedCountry('');
      setDate(''); // Wird im useEffect neu auf aktuelles Datum gesetzt

      // Redirect to bilder page after successful publish
      setTimeout(() => {
        navigate('/bilder');
      }, 1500);

    } catch (error) {
      console.error('Complete upload error:', error);
      setUploadProgress({
        current: 0,
        total: 0,
        stage: 'error',
        status: `❌ Fehler: ${error.message || 'Unbekannter Fehler'}`
      });

      toast({
        title: 'Fehler',
        description: `Upload fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`,
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        setUploadProgress({ current: 0, total: 0, stage: '', status: '' });
      }, 5000);
    }
  };

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

       {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Standort
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="location">Standort</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="📍 Wo wurden die Bilder aufgenommen?"
            />
            {files.some(f => f.type === 'image' && f.gps) && (
              <p className="text-xs text-green-600 dark:text-green-400">
                📍 GPS-Daten verfügbar - Standort kann automatisch ausgefüllt werden
              </p>
            )}
          </div>

          {/* Country Selection */}
          <CountrySelector
            selectedCountry={selectedCountry}
            onCountryChange={setSelectedCountry}
            placeholder="Land auswaehlen"
          />
         </CardContent>
       </Card>

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
          {(mainCategory || selectedSubTags.length > 0 || detailedTags.length > 0 || customTags) && (
            <div className="mt-6 p-4 bg-ocean-50 dark:bg-ocean-950 rounded-lg border border-ocean-200 dark:border-ocean-800">
              <h4 className="font-medium text-ocean-900 dark:text-ocean-100 mb-3">
                📋 Zusammenfassung aller Tags
              </h4>
              <div className="space-y-2">
                {mainCategory && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Hauptkategorie:</span>
                    <Badge className="ml-2 bg-ocean-600 text-white">
                      {mainCategories.find(cat => cat.value === mainCategory)?.icon} {mainCategory}
                    </Badge>
                  </div>
                )}
                {selectedSubTags.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Themen:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedSubTags.map(tag => (
                        <Badge key={tag} variant="secondary" className="bg-ocean-100 text-ocean-700">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {detailedTags.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Detail-Tags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {detailedTags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs border-green-300 text-green-700">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {customTags && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Eigene Tags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {customTags.split(' ').filter(Boolean).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs border-purple-300 text-purple-700">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <Card className={`border-2 ${
              uploadProgress.stage === 'error'
                ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950'
                : uploadProgress.stage === 'success'
                  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950'
                  : 'border-ocean-200 dark:border-ocean-800 bg-ocean-50 dark:bg-ocean-950'
            }`}>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  {/* Stage Indicator */}
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 ${
                      uploadProgress.stage === 'upload' ? 'text-ocean-600 dark:text-ocean-400' :
                      uploadProgress.stage === 'publish' ? 'text-ocean-600 dark:text-ocean-400' :
                      uploadProgress.stage === 'success' ? 'text-green-600 dark:text-green-400' :
                      uploadProgress.stage === 'error' ? 'text-red-600 dark:text-red-400' :
                      'text-gray-400'
                    }`}>
                      {uploadProgress.stage === 'upload' && <Loader2 className="h-5 w-5 animate-spin" />}
                      {uploadProgress.stage === 'publish' && <UploadCloud className="h-5 w-5" />}
                      {uploadProgress.stage === 'success' && <CheckCircle className="h-5 w-5" />}
                      {uploadProgress.stage === 'error' && <span className="text-2xl">❌</span>}
                      {!uploadProgress.stage && <span className="text-2xl">⏳</span>}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-sm">
                        {uploadProgress.status}
                      </p>
                      {/* Stage badges */}
                      <div className="flex gap-2">
                        <Badge variant="outline" className={`text-xs ${
                          uploadProgress.stage === 'upload'
                            ? 'bg-ocean-100 border-ocean-300 text-ocean-700'
                            : uploadProgress.stage === 'publish' || uploadProgress.stage === 'success'
                              ? 'bg-green-100 border-green-300 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}>
                          🌸 Blossom Upload
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${
                          uploadProgress.stage === 'publish'
                            ? 'bg-ocean-100 border-ocean-300 text-ocean-700'
                            : uploadProgress.stage === 'success'
                              ? 'bg-green-100 border-green-300 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}>
                          📡 Nostr Post
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* File Upload Progress */}
                  {uploadProgress.stage === 'upload' && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-ocean-600 dark:text-ocean-400">
                          {uploadProgress.current} von {uploadProgress.total} Dateien
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                        </Badge>
                      </div>
                      <Progress
                        value={(uploadProgress.current / uploadProgress.total) * 100}
                        className="h-2"
                      />
                    </>
                  )}

                  {/* Publishing Progress */}
                  {uploadProgress.stage === 'publish' && (
                    <div className="flex items-center gap-3 text-sm text-ocean-600 dark:text-ocean-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <p>Event wird zu {uploadProgress.total} Nostr Relays gesendet...</p>
                    </div>
                  )}

                  {/* Success State */}
                  {uploadProgress.stage === 'success' && (
                    <div className="flex items-center gap-3 text-sm text-green-600 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      <p>Bilder erfolgreich zu Blossom hochgeladen und zu Nostr veroeffentlicht!</p>
                    </div>
                  )}

                  {/* Error State */}
                  {uploadProgress.stage === 'error' && (
                    <div className="flex items-start gap-3 text-sm text-red-600 dark:text-red-400">
                      <span className="text-xl">⚠️</span>
                      <div className="space-y-1">
                        <p>{uploadProgress.status}</p>
                        <p className="text-xs">Bitte versuche es erneut.</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
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

          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={files.length === 0 || isUploading}
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