import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/useToast";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { ImageOptimizationToggle } from "@/components/ImageOptimizationToggle";
import { GpsEditor } from "@/components/GpsEditor";
import { GpsStatusIndicator } from "@/components/GpsStatusIndicator";
import { LocationPicker } from "@/components/LocationPicker";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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
import { MilkdownEditor } from "@/components/MilkdownEditor";
import { TripPublishForm } from "@/components/TripPublishForm";
import { RemotionVideoBlock } from "@/components/RemotionVideoBlock";
import { SlideshowBlock } from "@/components/SlideshowBlock";
import { Progress } from "@/components/ui/progress";
import { Upload, UploadCloud, ImageIcon, Video, Music, File as FileIcon, Camera, MapPin, Calendar, Tag, Battery, Sun, Wrench, Hammer, Cpu, Mountain, Lightbulb, Dog, Trees, Droplets, Waves, Eye, Loader2, CheckCircle, Route, Sparkles, FileText, MessageSquare, Map } from "@/lib/icons";
import { extractGpsFromImage, formatCoordinatesSimple, reverseGeocode, mapCountryCode, type GpsData, type GpsStatus, type LocationData } from "@/lib/gpsExtraction";
import { extractGpsCrossPlatform, getCurrentPosition, positionToGpsData, isCapacitorNative } from "@/lib/capacitorGps";
import exifr from "exifr";

export function PlaceForm({ editEvent }: { editEvent?: any }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState({ lat: '', lng: '' });
  const [category, setCategory] = useState('');
  const [rating, setRating] = useState(5);
  const [facilities, setFacilities] = useState<string[]>([]);
  const [bestFor, setBestFor] = useState<string[]>([]);
  const [price, setPrice] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [image, setImage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
   const [imageGps, setImageGps] = useState<GpsData | null>(null);
   const [imageGpsStatus, setImageGpsStatus] = useState<GpsStatus>('not_found');
   const [editingImageGps, setEditingImageGps] = useState(false);
   const [showMapPicker, setShowMapPicker] = useState(false);
   const [additionalImages, setAdditionalImages] = useState<string[]>([]);
   const [additionalImagesUrlInput, setAdditionalImagesUrlInput] = useState('');
   const [manualTags, setManualTags] = useState<string[]>([]);
   const [selectedCountry, setSelectedCountry] = useState<string>('');
   const [isUploading, setIsUploading] = useState(false);
   const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [lifestyle, setLifestyle] = useState<'mojobus' | 'vanlife' | 'rvlife' | 'beachlife' | 'wohnmobil' | 'perpetual-travelers'>('mojobus');
    const [selectedModel, setSelectedModel] = useState<'mini' | 'medium' | 'maxi'>('medium');
    const [tripType, setTripType] = useState<TripType | ''>('');
  const { toast } = useToast();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { mutateAsync: uploadFile } = useUploadFile();
  const { gender, user: currentUser } = useCurrentUser(); // Gender für KI-Generierung (Mojo=male, Susanne=female)
  const navigate = useNavigate();

   // Hilfsfunktion: Bild-URLs aus Markdown extrahieren (gleiche Logik wie ArticleForm)
   const extractPlaceImageUrls = (markdown: string): string[] => {
     const regex = /!\[.*?\]\((https?:\/\/[^)]+)\)/g;
     const urls: string[] = [];
     let match;
     while ((match = regex.exec(markdown)) !== null) {
       urls.push(match[1]);
     }
     return [...new Set(urls)];
   };

   // KI-Platz-Beschreibung generieren (Foster Huntington Stil)
   const generatePlaceWithAI = async () => {
     const markdownImageUrls = extractPlaceImageUrls(description);
     const hasAnyImage = imageFile || additionalImages.length > 0 || markdownImageUrls.length > 0;

     if (!hasAnyImage) {
       toast({
         title: 'Bild erforderlich',
         description: 'Lade ein Titelbild hoch, füge Zusatzbilder hinzu oder binde Bilder im Editor ein.',
         variant: 'destructive'
       });
       return;
     }

     setIsGeneratingDescription(true);
     try {
       const formData = new FormData();

       // Titelbild (optional wenn andere Bilder vorhanden)
       if (imageFile) {
         formData.append('images', imageFile);
       }

       formData.append('title', name);
       formData.append('description', description); // Vollständig – kein 500-Zeichen-Limit
       formData.append('location', location);

       if (coordinates.lat && coordinates.lng) {
         formData.append('gps_lat', coordinates.lat);
         formData.append('gps_lon', coordinates.lng);
       }

       formData.append('lifestyle', lifestyle);
       formData.append('model', selectedModel);

       // Alle Kontext-Felder
       formData.append('category', category || '');
       formData.append('facilities', JSON.stringify(facilities));
       formData.append('bestFor', JSON.stringify(bestFor));
       formData.append('country', selectedCountry || '');
       formData.append('gender', gender || 'neutral');
       formData.append('rating', rating.toString());
       formData.append('price', price || '');
       formData.append('tripType', tripType || '');

       // Zusatzbilder (hochgeladene URLs)
       if (additionalImages.length > 0) {
         formData.append('additionalImageUrls', JSON.stringify(additionalImages));
         console.log(`[KI] ${additionalImages.length} Zusatzbild-URL(s) mitgeschickt`);
       }

       // Markdown-Bilder aus dem Editor
       if (markdownImageUrls.length > 0) {
         formData.append('markdownImageUrls', JSON.stringify(markdownImageUrls));
         console.log(`[KI] ${markdownImageUrls.length} Markdown-Bild-URL(s) aus Editor mitgeschickt`);
       }

       const response = await fetch('/api/generate-place', {
         method: 'POST',
         body: formData
       });

       const data = await response.json();
       if (data.description) {
         // [BILD_N] Platzhalter durch echte Markdown-Bilder ersetzen
         const imageObjects: Array<{ url: string | null; description: string }> =
           data.imageObjects || [];

         const finalDescription = imageObjects.length > 0
           ? resolveBildPlaceholders(data.description, imageObjects)
           : data.description;

         setDescription(finalDescription);

         if (data.hashtags) {
           const newTags = data.hashtags.split(' ').filter((t: string) => !manualTags.includes(t));
           setManualTags([...manualTags, ...newTags]);
         }

         const urlImageCount = imageObjects.filter((img: { url: string | null }) => img.url !== null).length;
         toast({
           title: 'Erfolg!',
           description: `KI-Beschreibung generiert mit ${selectedModel.toUpperCase()} Modell`
             + (urlImageCount > 0 ? ` – ${urlImageCount} Bild(er) im Text platziert.` : '.')
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
       setIsGeneratingDescription(false);
     }
   };

   // Load edit data
  useEffect(() => {
    if (editEvent) {
      setName(editEvent.tags?.find((tag: any) => tag[0] === 'name')?.[1] || '');

      // Bestimme das Event-Format basierend auf dem type-Tag
      // Neue Plätze haben type=place und HTML-Content
      // Alte Plätze haben type=article und Markdown-Content
      const eventType = editEvent.tags?.find((tag: any) => tag[0] === 'type')?.[1];
      const isPlaceType = eventType === 'place';

      // Wenn es ein place-Event ist, den Content bereinigen und verwenden (HTML)
      // Wenn es ein altes article-Event ist, Markdown zu HTML konvertieren
      let contentToSet = '';
      if (isPlaceType) {
        // Content bereinigen - ALLE strukturierten Daten entfernen
        let cleanContent = editEvent.content || '';

        // Remove h1 title (wird aus name-Tag geholt)
        cleanContent = cleanContent.replace(/^<h1[^>]*>.*?<\/h1>\s*/gi, '');

        // Remove structured sections (alles was in Tags steht, nicht im Content!)
        // Bilder-Sektion
        cleanContent = cleanContent.replace(/<h2[^>]*>Bilder<\/h2>.*?(?=<h[2-6]>|<p><strong>|$)/gis, '');

        // Strukturierte Felder (Kategorie, Bewertung, Standort, etc.)
        cleanContent = cleanContent.replace(/<p><strong>Kategorie:<\/strong>.*?<\/p>/gi, '');
        cleanContent = cleanContent.replace(/<p><strong>Bewertung:<\/strong>.*?<\/p>/gi, '');
        cleanContent = cleanContent.replace(/<p><strong>Standort:<\/strong>.*?<\/p>/gi, '');
        cleanContent = cleanContent.replace(/<p><strong>Koordinaten:<\/strong>.*?<\/p>/gi, '');
        cleanContent = cleanContent.replace(/<p><strong>Einrichtungen:<\/strong>.*?<\/p>/gi, '');
        cleanContent = cleanContent.replace(/<p><strong>Geeignet für:<\/strong>.*?<\/p>/gi, '');
        cleanContent = cleanContent.replace(/<p><strong>Preis:<\/strong>.*?<\/p>/gi, '');

        // Clean up extra whitespace
        cleanContent = cleanContent.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

        contentToSet = cleanContent || '';
      } else {
        // Content bereinigen
        let cleanContent = editEvent.content || '';

        // Remove title line
        cleanContent = cleanContent.replace(/^# .+?\n\n/, '');

        // Remove structured lines that are stored in tags
        const structuredPatterns = [
          /^## Bilder\n\n.*$/gm, // Images section (multiline)
          /^\*\*Kategorie:\*\*.*$/gm, // Category line
          /^\*\*Bewertung:\*\*.*$/gm, // Rating line
          /^\*\*Standort:\*\*.*$/gm, // Location line
          /^\*\*Koordinaten:\*\*.*$/gm, // Coordinates line
          /^\*\*Einrichtungen:\*\*.*$/gm, // Facilities line
          /^\*\*Geeignet für:\*\*.*$/gm, // Best for line
          /\*\*Preis:\*\*.*/
        ];

        structuredPatterns.forEach(pattern => {
          cleanContent = cleanContent.replace(pattern, '');
        });

        // Clean up extra whitespace
        cleanContent = cleanContent.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

        // Markdown zu HTML konvertieren
        contentToSet = markdownToHtml(cleanContent || '');
      }

      setDescription(contentToSet);

      setLocation(editEvent.tags?.find((tag: any) => tag[0] === 'location')?.[1] || '');
      const latTag = editEvent.tags?.find((tag: any) => tag[0] === 'lat')?.[1];
      const lngTag = editEvent.tags?.find((tag: any) => tag[0] === 'lng')?.[1];
      if (latTag && lngTag) {
        setCoordinates({ lat: latTag, lng: lngTag });
      }
      setCategory(editEvent.tags?.find((tag: any) => tag[0] === 'category')?.[1] || '');
      const ratingTag = editEvent.tags?.find((tag: any) => tag[0] === 'rating')?.[1];
      if (ratingTag) {
        setRating(parseInt(ratingTag));
      }
      const facilityTags = editEvent.tags?.filter((tag: any) => tag[0] === 'facility')?.map((tag: any) => tag[1]) || [];
      setFacilities(facilityTags);
      const bestForTags = editEvent.tags?.filter((tag: any) => tag[0] === 'best_for')?.map((tag: any) => tag[1]) || [];
      setBestFor(bestForTags);
      setPrice(editEvent.tags?.find((tag: any) => tag[0] === 'price')?.[1] || '');

      // Load visit date (from published_at or visit_date tag)
      const visitDateTag = editEvent.tags?.find((tag: any) => tag[0] === 'visit_date')?.[1]
        || editEvent.tags?.find((tag: any) => tag[0] === 'published_at')?.[1];
      if (visitDateTag) {
        const d = new Date(parseInt(visitDateTag) * 1000);
        setVisitDate(d.toISOString().split('T')[0]);
      }

      // Load images
      const imageTags = editEvent.tags?.filter((tag: any) => tag[0] === 'image')?.map((tag: any) => tag[1]) || [];
      if (imageTags.length > 0) {
        setImage(imageTags[0]); // First image is title image
        setAdditionalImages(imageTags.slice(1)); // Rest are additional images
      }

      // Load manual tags (excluding place-specific tags)
      const allTags = editEvent.tags?.filter((tag: any) => tag[0] === 't')?.map((tag: any) => tag[1]) || [];
      const excludedTags = ['location', 'places', 'place', 'campingplatz', 'wildcamping', 'stellplatz', 'aussichtspunkt', 'strand', 'berg', 'see', 'stadt', 'natur', 'portugal', 'spanien', 'italien', 'frankreich', 'deutschland', 'algarve', 'andalusien', 'katalonien', 'toskana', 'strom', 'wasser', 'wc', 'dusche', 'wlan', 'shop', 'familien', 'paare', 'single', 'wohnmobil', 'zelt'];
      const manualTagsOnly = allTags.filter(tag => !excludedTags.includes(tag));
      setManualTags(manualTagsOnly);

      // Extract country from tags
      const countryTags = ['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg'];
      const foundCountry = allTags.find(tag => countryTags.includes(tag));
      if (foundCountry) {
        setSelectedCountry(foundCountry);
      }

      // Load GPS data from tags
      const gpsLat = editEvent.tags?.find((tag: any) => tag[0] === 'gps_lat')?.[1];
      const gpsLon = editEvent.tags?.find((tag: any) => tag[0] === 'gps_lon')?.[1];
      const gpsAlt = editEvent.tags?.find((tag: any) => tag[0] === 'gps_alt')?.[1];
      const gpsPrecision = editEvent.tags?.find((tag: any) => tag[0] === 'gps_precision')?.[1];
      const gpsSource = editEvent.tags?.find((tag: any) => tag[0] === 'gps_source')?.[1] as GpsStatus;

      if (gpsLat && gpsLon) {
        setImageGps({
          latitude: parseFloat(gpsLat),
          longitude: parseFloat(gpsLon),
          altitude: gpsAlt ? parseFloat(gpsAlt) : undefined,
          precision: gpsPrecision || 'medium'
        });
        setImageGpsStatus(gpsSource || 'detected');
        console.log('[Place Edit] GPS data loaded from tags:', { gpsLat, gpsLon, gpsAlt, gpsSource });
      }
    }
  }, [editEvent]);

  const categories = [
    { value: 'campingplatz', label: 'Campingplatz', icon: '🏕️' },
    { value: 'wildcamping', label: 'Wildcamping', icon: '🌲' },
    { value: 'stellplatz', label: 'Stellplatz', icon: '🅿️' },
    { value: 'aussichtspunkt', label: 'Aussichtspunkt', icon: '👁️' },
    { value: 'strand', label: 'Strand', icon: '🏖️' },
    { value: 'berg', label: 'Berg', icon: '⛰️' }
  ];

   // Auto-fill location and country from GPS data
   useEffect(() => {
     const autoFillLocation = async () => {
       if (imageGps) {
         console.log('[Place GPS] GPS detected, reverse geocoding...');
         const locationData = await reverseGeocode(imageGps.latitude, imageGps.longitude);
         if (locationData) {
           // Set location to city + neighbourhood/suburb (no postcode)
           const locationParts = [
             locationData.city,
             locationData.neighbourhood,
             locationData.suburb
           ].filter(Boolean);
           const loc = locationParts.join(', ');
           setLocation(loc);
           console.log('[Place GPS] Location found:', loc);

           // Also set coordinates
           setCoordinates({ lat: imageGps.latitude.toString(), lng: imageGps.longitude.toString() });

           // Auto-fill country if detected
           const country = mapCountryCode(locationData);
           if (country && !selectedCountry) {
             setSelectedCountry(country);
             console.log('[Place GPS] Country auto-filled:', country);
           }
         }
       }
     };

     autoFillLocation();
   }, [imageGps]);

  const facilityOptions = [
    'Strom', 'Wasser', 'WC', 'Dusche', 'WLAN',
    'Shop', 'Restaurant', 'Spielplatz', 'Hund erlaubt',
    'Grill', 'Feuerstelle', 'Chemie-Entsorgung'
  ];

  const bestForOptions = [
    'Familien', 'Paare', 'Single', 'Große Fahrzeuge',
    'Wohnmobile', 'Zelte', 'Ruhe', 'Natur',
    'Meerblick', 'Bergblick', 'Stadtnahe'
  ];

  const handleFacilityToggle = (facility: string) => {
    setFacilities(prev =>
      prev.includes(facility)
        ? prev.filter(f => f !== facility)
        : [...prev, facility]
    );
  };

  const handleBestForToggle = (item: string) => {
    setBestFor(prev =>
      prev.includes(item)
        ? prev.filter(b => b !== item)
        : [...prev, item]
    );
  };

  const handleImageFile = async (file: File) => {
    setIsUploading(true);
    try {
      // EXIF-Daten lesen und korrigierte Preview erstellen (wie in TripPublishForm.tsx)
      let correctedPreviewUrl: string | undefined;
      let exifWidth: number | undefined;
      let exifHeight: number | undefined;
      let exifOrientation: number | undefined;

      try {
        // EXIF-Daten lesen (wie in TripPublishForm.tsx)
        // Orientation separat lesen (funktioniert auch wenn parse fehlschlägt)
        try {
          exifOrientation = await exifr.orientation(file);
          console.log(`[Place EXIF] ${file.name}: Orientation (via exifr.orientation) = ${exifOrientation || 'not found'}`);
        } catch (orientErr) {
          console.warn(`[Place EXIF] ${file.name}: Could not read orientation:`, orientErr);
        }

        // Bildabmessungen lesen
        try {
          const dimExif = await exifr.parse(file, { exif: true, pickTags: ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight'] });
          exifWidth = dimExif?.ImageWidth || dimExif?.ExifImageWidth;
          exifHeight = dimExif?.ImageHeight || dimExif?.ExifImageHeight;
          if (exifWidth && exifHeight) {
            console.log(`[Place EXIF] ${file.name}: EXIF dimensions ${exifWidth}x${exifHeight}`);
          }
        } catch (dimErr) {
          console.warn(`[Place EXIF] ${file.name}: Could not read dimensions:`, dimErr);
        }

        // Korrigierte Preview erstellen (immer, wie in TripPublishForm.tsx)
        correctedPreviewUrl = await createCorrectedPreview(file, exifWidth, exifHeight, exifOrientation);
      } catch (exifError) {
        console.warn(`[Place EXIF] Failed to read EXIF from ${file.name}:`, exifError);
        // Fallback: Original file als Preview
        correctedPreviewUrl = URL.createObjectURL(file);
      }

      // Setze die korrigierte Preview als Anzeige-URL (nur temporär)
      if (correctedPreviewUrl) {
        setImage(correctedPreviewUrl);
      }

      // Speichere das File für KI-Generierung
      setImageFile(file);

      // Upload des Original-File → echte Blossom-URL holen und speichern
      const [urlTag] = await uploadFile(file);
      const uploadedUrl = urlTag[1]; // Blossom-URL: https://blossom.../hash
      if (uploadedUrl) {
        setImage(uploadedUrl); // Überschreibt blob:// mit der echten URL
        console.log(`[Place Upload] Titelbild hochgeladen: ${uploadedUrl}`);
      }

      // Extract GPS from title image
      try {
        const gpsData = await extractGpsFromImage(file);
        if (gpsData) {
          setImageGps(gpsData);
          setImageGpsStatus('detected');
          console.log(`[Place GPS] Extracted from ${file.name}:`, gpsData);
        } else {
          // Fallback: Capacitor Native EXIF (umgeht Browser-Strip im APK)
          console.log(`[Place GPS] exifr keine GPS, versuche Capacitor native EXIF für ${file.name}...`);
          const nativeGps = await extractGpsCrossPlatform(file, null);
          if (nativeGps) {
            setImageGps(nativeGps);
            setImageGpsStatus('detected');
            console.log(`[Place GPS] ✓ Native EXIF GPS für ${file.name}:`, nativeGps);
          } else {
            setImageGps(null);
            setImageGpsStatus('not_found');
          }
        }
      } catch (error) {
        console.error(`[Place GPS] Failed to extract from ${file.name}:`, error);
        setImageGpsStatus('error');
      }

      toast({
        title: 'Upload erfolgreich!',
        description: 'Titelbild wurde hochgeladen.',
      });
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Bild-Upload fehlgeschlagen.',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAdditionalImagesUpload = async (files: File[]) => {
    try {
      const newUrls: string[] = [];
      for (const file of files) {
        const [urlTag] = await uploadFile(file);
        newUrls.push(urlTag[1]);
      }
      setAdditionalImages(prev => [...prev, ...newUrls]);
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Upload zusatzlicher Bilder fehlgeschlagen.',
        variant: 'destructive'
      });
    }
  };

  const removeAdditionalImage = (index: number) => {
    setAdditionalImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleManualTagInput = (input: string) => {
    // Split by both comma and whitespace, remove empty strings and # prefixes
    const tags = input
      .split(/[\s,]+/)
      .map(tag => tag.replace('#', '').trim())
      .filter(Boolean);

    if (tags.length > 0) {
      setManualTags(prev => [...prev, ...tags]);
    }
  };

  const removeManualTag = (index: number) => {
    setManualTags(prev => prev.filter((_, i) => i !== index));
  };

  const closeGpsEditor = () => {
    setEditingImageGps(false);
    setShowMapPicker(false);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte gib einen Namen fuer den Ort ein.',
        variant: 'destructive'
      });
      return;
    }

    // Create NIP-23 compliant content for place
    // WICHTIG: Strukturierte Daten werden NUR als Tags gespeichert, nicht im Content!
    // - Content: Nur Titel und Beschreibung
    // - Tags: Alle strukturierten Daten
    let content = `# ${name.trim()}\n\n`;

    // Konvertiere HTML zu Markdown für Nostr und füge BESCHREIBUNG hinzu
    // Bereinige die Beschreibung, falls sie strukturierte Daten enthält
    if (description.trim()) {
      const cleanDescription = description.trim()
        .replace(/<p><strong>Kategorie:<\/strong>.*?<\/p>/gis, '')
        .replace(/<p><strong>Bewertung:<\/strong>.*?<\/p>/gis, '')
        .replace(/<p><strong>Standort:<\/strong>.*?<\/p>/gis, '')
        .replace(/<p><strong>Koordinaten:<\/strong>.*?<\/p>/gis, '')
        .replace(/<p><strong>Einrichtungen:<\/strong>.*?<\/p>/gis, '')
        .replace(/<p><strong>Geeignet für:<\/strong>.*?<\/p>/gis, '')
        .replace(/<p><strong>Preis:<\/strong>.*?<\/p>/gis, '')
        .replace(/<h2[^>]*>Bilder<\/h2>.*?(?=<h[2-6]>|<p><strong>|$)/gis, '');

      const descriptionMarkdown = cleanDescription.trim();
      if (descriptionMarkdown) {
        content += `${descriptionMarkdown}\n\n`;
      }
    }

    // Add additional images if present (title image handled separately)
    if (additionalImages.length > 0) {
      content += `## Bilder\n\n`;
      additionalImages.forEach((img, index) => {
        content += `![${index + 1}](${img})\n\n`;
      });
    }

    // WICHTIG: Strukturierte Daten werden NUR als Tags gespeichert, nicht im Content!
    // Das verhindert Duplikate beim Bearbeiten.

    // Entferne Country-Tags aus manualTags, um Duplikate zu vermeiden
    const countryList = ['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg'];
    const manualTagsWithoutCountry = manualTags.filter(tag =>
      !countryList.includes(tag.toLowerCase()) && !tag.startsWith('#') && !countryList.includes(tag.replace('#', '').toLowerCase())
    );

    // Erstelle summary für Vorschau auf Startseite
    let placeSummary = '';
    if (description.trim()) {
      // Verwende die Beschreibung als summary, gekürzt auf 200 Zeichen
      placeSummary = description.trim().length > 200
        ? description.trim().substring(0, 197) + '...'
        : description.trim();
    } else if (location.trim()) {
      // Fallback: Verwende Standort als summary
      placeSummary = `Ort in ${location.trim()}`;
    } else {
      // Fallback: Kurze Beschreibung basierend auf Kategorie
      placeSummary = `Ein ${category} für Vanlife-Abenteurer`;
    }

    // Create tags from config
    const baseTags = createRequiredTags('places', manualTagsWithoutCountry);

    // Get original d-tag for edit, or create new one
    const originalDTag = editEvent?.tags?.find((tag: any) => tag[0] === 'd')?.[1];
    const dTag = originalDTag || `place-${Date.now()}`;

    // published_at / visit_date: Beim Edit ORIGINALES Datum behalten, bei Neuem visitDate oder heute
    const existingPublishedAt = editEvent?.tags?.find((tag: any) => tag[0] === 'published_at')?.[1];
    const visitTimestamp = editEvent && existingPublishedAt
      ? existingPublishedAt
      : (visitDate ? Math.floor(new Date(visitDate).getTime() / 1000).toString() : Math.floor(Date.now() / 1000).toString());

    const additionalTags = [
      ['d', dTag],
      ['t', 'place'],
      ['type', 'place'],
      ['title', name.trim()],
      ['name', name.trim()],
      ['summary', placeSummary],
      ['category', category],
      ['rating', rating.toString()],
      ...facilities.map(f => ['facility', f]),
      ...bestFor.map(b => ['best_for', b]),
      ['published_at', visitTimestamp],
      ['visit_date', visitTimestamp],
    ];

    const tags = [
      ...baseTags,
      ...additionalTags
    ];

    if (location.trim()) tags.push(['location', location]);

    // Handle GPS coordinates - priority: manual coordinates > image GPS
    if (coordinates.lat && coordinates.lng) {
      // Manual coordinates entered
      tags.push(['lat', coordinates.lat]);
      tags.push(['lng', coordinates.lng]);

      // Also add as GPS tags for map display
      const lat = parseFloat(coordinates.lat);
      const lng = parseFloat(coordinates.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        tags.push(['gps_lat', lat.toString()]);
        tags.push(['gps_lon', lng.toString()]);
        tags.push(['gps_source', 'manual']);
        tags.push(['gps_precision', 'manual']);
        console.log('[Place] Manual GPS saved:', { lat, lng });
      }
    } else if (imageGps) {
      // Use GPS from title image
      tags.push(['gps_lat', imageGps.latitude.toString()]);
      tags.push(['gps_lon', imageGps.longitude.toString()]);
      if (imageGps.altitude) {
        tags.push(['gps_alt', imageGps.altitude.toString()]);
      }
      tags.push(['gps_precision', imageGps.precision]);
      tags.push(['gps_source', imageGpsStatus]);
      console.log('[Place] Image GPS saved:', imageGps);
    }

    if (price.trim()) tags.push(['price', price.trim()]);
    if (image) tags.push(['image', image]);
    additionalImages.forEach((img, index) => {
      tags.push(['image', img]);
    });

    // Add country tags (nur wenn selectedCountry gewählt wurde)
    if (selectedCountry) {
      const countryTags = getCountryTag(selectedCountry);
      countryTags.forEach(tag => tags.push(['t', tag]));
    }

    publishEvent({
      kind: 30023, // Long-form event for places
      content,
      tags
    });

    toast({
      title: 'Erfolg!',
      description: 'Ort erfolgreich gespeichert.'
    });

    // Reset form and redirect
    setName('');
    setDescription('');
    setLocation('');
    setCoordinates({ lat: '', lng: '' });
    setCategory('');
    setRating(5);
    setFacilities([]);
    setBestFor([]);
       setPrice('');
       setVisitDate('');
    setImageFile(null);
    setImageGps(null);
    setImageGpsStatus('not_found');
    setEditingImageGps(false);

    // Redirect to plaetze page after successful publish
    setTimeout(() => {
      navigate('/plaetze');
    }, 1000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Map className="h-5 w-5" />
          Ort hinzufuegen
        </CardTitle>
        <CardDescription>
          Teile deine besten Campingplaetze, Wildcamping-Stellen und Reiseziele
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Title Image - Move to top */}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="place-location">Standort</Label>
            <Input
              id="place-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="z.B. Algarve, Portugal"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="place-lat">GPS Breite</Label>
              <Input
                id="place-lat"
                value={coordinates.lat}
                onChange={(e) => setCoordinates(prev => ({ ...prev, lat: e.target.value }))}
                placeholder="37.1234"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-lng">GPS Laenge</Label>
              <Input
                id="place-lng"
                value={coordinates.lng}
                onChange={(e) => setCoordinates(prev => ({ ...prev, lng: e.target.value }))}
                placeholder="-8.4567"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="place-name">Name des Ortes</Label>
            <Input
              id="place-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Algarve Beach Camping"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="place-category">Kategorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Kategorie wählen" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Country Selection */}
        <CountrySelector
          selectedCountry={selectedCountry}
          onCountryChange={setSelectedCountry}
          placeholder="Land auswaehlen"
        />

        <div className="space-y-2">
          <Label htmlFor="place-description">Beschreibung</Label>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            WYSIWYG Editor - Beschreibe den Ort mit Formatierung, Bildern und Links
          </div>
          <MilkdownEditor
            content={description}
            onChange={setDescription}
            placeholder={`# Erlebnis-Bericht

Beschreibe hier den Ort, was macht ihn besonders...

- Verwende die Toolbar für Formatierung
- Fett oder kursiv

## Was erwartet dich

### Highlights
- Der Ort bietet einen tollen Blick auf das Meer
- Perfekt für Vanlife mit Solarstrom
- Ruah und Natur

### Tipps und Tricks
- Beste Zeit für einen Besuch: Frühling/Herbst
- Versorgungsmöglichkeiten in der Nähe

### Bilder und Videos
- Füge Bilder über das Bild-Icon ein
- Oder lade Bilder direkt in den Editor

### Noch mehr...
`}
            minHeight="300px"
            maxLength={30000}
            onImageUpload={(url) => {
              // Optional: Füge hochgeladene Bilder zu einer Liste hinzu
            }}
          />
        </div>

        {/* KI-Beschreibung generieren (Optional) */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-ocean-500" />
            <h3 className="font-semibold">KI-Beschreibung generieren (Optional)</h3>
          </div>

          <div className="space-y-2">
            <Label>Lifestyle</Label>
            <Select value={lifestyle} onValueChange={(value: any) => setLifestyle(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Wähle deinen Lifestyle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mojobus">🚌 Mojobus - Mojo &amp; Susanne, US-Oldtimer</SelectItem>
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
            <Label className="text-sm font-medium">KI-Modell auswählen:</Label>
            <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as 'mini' | 'medium' | 'maxi')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mini">Mini (Claude Sonnet 5)</SelectItem>
                <SelectItem value="medium">Medium (Claude Sonnet 5)</SelectItem>
                <SelectItem value="maxi">Maxi (Claude Sonnet 5)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Stufen sind zentral in src/config/ai-models.js konfigurierbar.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={generatePlaceWithAI}
            disabled={isGeneratingDescription || (!imageFile && additionalImages.length === 0 && extractPlaceImageUrls(description).length === 0)}
            className="w-full mt-2"
          >
            {isGeneratingDescription ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generiere mit {selectedModel.toUpperCase()} Modell...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                KI-Beschreibung generieren ({selectedModel.toUpperCase()} Modell)
              </>
            )}
          </Button>
          {!imageFile && additionalImages.length === 0 && extractPlaceImageUrls(description).length === 0 && (
            <p className="text-xs text-muted-foreground">
              💡 Lade ein Titelbild hoch, füge Zusatzbilder hinzu oder binde Bilder im Editor ein.
            </p>
          )}
          {(!imageFile) && (additionalImages.length > 0 || extractPlaceImageUrls(description).length > 0) && (
            <p className="text-xs text-muted-foreground">
              🖼️ {additionalImages.length + extractPlaceImageUrls(description).length} Bild(er) werden analysiert.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Bewertung</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <Button
                  key={star}
                  variant="ghost"
                  size="sm"
                  onClick={() => setRating(star)}
                  className={`transition-all ${
                    star <= rating
                      ? "text-yellow-500 hover:text-yellow-600 hover:scale-110"
                      : "text-gray-300 hover:text-yellow-400 hover:scale-110"
                  }`}
                >
                  <span className="text-lg">{star <= rating ? "⭐" : "☆"}</span>
                </Button>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              {rating} von 5 Sternen {rating === 5 && "⭐ Exzellente Bewertung!"}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="place-price">Preis (optional)</Label>
            <Input
              id="place-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="z.B. 15€/Nacht oder Kostenlos"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="place-visit-date">Besuchsdatum</Label>
            <Input
              id="place-visit-date"
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Wann warst du dort? (Standard: Heute)
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Einrichtungen & Ausstattung</Label>
          <div className="flex flex-wrap gap-2">
            {facilityOptions.map(facility => (
              <Badge
                key={facility}
                variant={facilities.includes(facility) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => handleFacilityToggle(facility)}
              >
                {facility}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>Geeignet fuer</Label>
          <div className="flex flex-wrap gap-2">
            {bestForOptions.map(item => (
              <Badge
                key={item}
                variant={bestFor.includes(item) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => handleBestForToggle(item)}
              >
                {item}
              </Badge>
            ))}
          </div>
        </div>

        {/* Manual Tags */}
        <div className="space-y-3">
          <Label>Manuelle Tags</Label>
          <Input
            placeholder="Eigene Tags (mit Komma oder Leerzeichen trennen)..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleManualTagInput(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Z.B. #sunset-watching vanlife portugal
          </p>

          {/* Show current manual tags */}
          {manualTags.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Hinzugefuegte Tags:</Label>
              <div className="flex flex-wrap gap-2">
                {manualTags.map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="gap-1"
                  >
                    {tag}
                    <button
                      className="ml-1 text-xs hover:text-red-500"
                      onClick={() => removeManualTag(index)}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Video Generator — Remotion */}
        <RemotionVideoBlock
          imageUrls={[...(image ? [image] : []), ...additionalImages]}
          lifestyle={lifestyle}
          title={name || 'ort'}
          location={location}
          country={selectedCountry}
        />

        <Button onClick={handleSubmit} className="w-full" disabled={!name.trim()}>
          <Map className="h-4 w-4 mr-2" />
          Ort speichern
        </Button>
      </CardContent>
    </Card>
  );
}
