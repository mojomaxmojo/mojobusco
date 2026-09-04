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
import { useAutoTranslate } from "@/hooks/useAutoTranslate";
import { useContinuityTracking } from "@/hooks/useContinuityTracking";
import { createLongformTeaser } from "@/lib/createLongformTeaser";
import { placeUrl, canonicalUrl, canonicalNaddr } from "@/lib/canonicalUrl";
import { notifyPublishedPipeline } from "@/lib/publishNotify";
import { SeoPublishPanel } from "@/components/assistant/SeoPublishPanel";
import { buildSmartSlug } from "@/config/assistant";
import { ImageOptimizationToggle } from "@/components/ImageOptimizationToggle";
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
import { AUTO_TRANSLATE_STORAGE_KEY } from "@/config/translation";
import { nip19 } from "nostr-tools";
import { MilkdownEditor } from "@/components/MilkdownEditor";
import { TripPublishForm } from "@/components/TripPublishForm";
import { RemotionVideoBlock } from "@/components/RemotionVideoBlock";
import { SlideshowBlock } from "@/components/SlideshowBlock";
import { Progress } from "@/components/ui/progress";
import { Upload, UploadCloud, ImageIcon, Video, Music, File as FileIcon, Camera, Calendar, Tag, Battery, Sun, Wrench, Hammer, Cpu, Mountain, Lightbulb, Dog, Trees, Droplets, Waves, Eye, Loader2, CheckCircle, Route, Sparkles, FileText, MessageSquare, Map } from "@/lib/icons";
import { type GpsData, type GpsStatus, type LocationData } from "@/lib/gpsExtraction";
import { getCurrentPosition, positionToGpsData, isCapacitorNative } from "@/lib/capacitorGps";
import { extractPlaceImageUrls } from "./placeForm/placeFormUtils";
import { usePlaceFormHandlers } from "./placeForm/usePlaceFormHandlers";
import { PlaceTitleImageSection } from "./placeForm/PlaceTitleImageSection";
import { usePlaceImageUpload } from "./placeForm/usePlaceImageUpload";
import { usePlaceGpsAutoFill } from "./placeForm/usePlaceGpsAutoFill";
import { usePlaceAiDescription } from "./placeForm/usePlaceAiDescription";
import { categories, facilityOptions, bestForOptions } from "./placeForm/placeFormConfig";

export function PlaceForm({ editEvent }: { editEvent?: any }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // SEO-Felder (Assistent) + Ehrlichkeits-Gate (Standard: bestätigt, abwählbar)
  const [seoTitle, setSeoTitle] = useState('');
  const [seoMetaDescription, setSeoMetaDescription] = useState('');
  const [seoSlug, setSeoSlug] = useState('');
  const [experiencesConfirmed, setExperiencesConfirmed] = useState(true);
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
    const [selectedModel, setSelectedModel] = useState<TextModelTier>('medium');
     const [tripType, setTripType] = useState<TripType | ''>('');
   const [publishTeaserNote, setPublishTeaserNote] = useState(true);
   const [isPublishingTeaser, setIsPublishingTeaser] = useState(false);
   // Bild-Metadaten (Alt-Text/Caption/Freitext) aus dem MilkdownEditor, keyed by Bild-URL
   const [imageMetaMap, setImageMetaMap] = useState<Record<string, { alt?: string; caption?: string; note?: string }>>({});

   // Auto-Übersetzung (DE→EN) State
   const [autoTranslateEn, setAutoTranslateEn] = useState(() => {
     const stored = localStorage.getItem(AUTO_TRANSLATE_STORAGE_KEY);
     return stored === null ? true : stored !== 'false';
   });

   const { toast } = useToast();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { mutateAsync: uploadFile } = useUploadFile();
  const { gender: autoGender, user: currentUser } = useCurrentUser(); // Automatisch erkannte Perspektive (Mojo=male, Susanne=female)
  const [perspectiveTouched, setPerspectiveTouched] = useState(false);
  const [perspective, setPerspective] = useState<GenderType>(autoGender);
  useEffect(() => {
    if (!perspectiveTouched) setPerspective(autoGender);
  }, [autoGender, perspectiveTouched]);
  const gender = perspective;
  const navigate = useNavigate();
  const { translateAndPublish } = useAutoTranslate();
   const { trackPublishedPost } = useContinuityTracking();
  const { handleFacilityToggle, handleBestForToggle, removeAdditionalImage,
          handleManualTagInput, removeManualTag, closeGpsEditor } = usePlaceFormHandlers({ setFacilities, setBestFor, setAdditionalImages, setManualTags, setEditingImageGps, setShowMapPicker });

  const { generatePlaceWithAI } = usePlaceAiDescription({ name, description, imageFile, additionalImages, location, coordinates, visitDate, lifestyle, selectedModel, category, facilities, bestFor, selectedCountry, gender, rating, price, tripType, imageMetaMap, manualTags, toast, setDescription, setManualTags, setIsGeneratingDescription });

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

      // SEO-Felder (Assistent) aus dem Event laden — ohne dieses Laden
      // würde ein Edit+Republish die Tags stillschweigend löschen
      setSeoTitle(editEvent.tags?.find((tag: any) => tag[0] === 'seo_title')?.[1] || '');
      setSeoMetaDescription(editEvent.tags?.find((tag: any) => tag[0] === 'meta_description')?.[1] || '');
      setSeoSlug(editEvent.tags?.find((tag: any) => tag[0] === 'slug')?.[1] || '');

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

  usePlaceGpsAutoFill({ imageGps, selectedCountry, setLocation, setCoordinates, setSelectedCountry });

  const { handleImageFile, handleAdditionalImagesUpload } = usePlaceImageUpload({ toast, uploadFile, setImage, setImageFile, setImageGps, setImageGpsStatus, setIsUploading, setAdditionalImages });

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

    // SEO-Zusatz-Tags (Assistent) — bestehende Tags unverändert
    if (seoTitle.trim()) additionalTags.push(['seo_title', seoTitle.trim()]);
    const effectiveMetaDescription = seoMetaDescription.trim() || placeSummary;
    if (effectiveMetaDescription) additionalTags.push(['meta_description', effectiveMetaDescription]);
    const effectiveSlug = (seoSlug.trim() || buildSmartSlug(name)).trim();
    if (effectiveSlug) additionalTags.push(['slug', effectiveSlug]);

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

    const handlePublishPlace = async () => {
      try {
        await publishEvent({
          kind: 30023, // Long-form event for places
          content,
          tags
        });

        toast({
          title: 'Erfolg!',
          description: 'Ort erfolgreich gespeichert.'
        });

        // Kontinuitäts-Tracking: Motive/Entitäten/Stimmung/offene Fäden erfassen
        trackPublishedPost({
          id: dTag,
          type: 'place',
          kind: 30023,
          title: name.trim(),
          location: location.trim(),
          country: selectedCountry,
          publishedAt: visitTimestamp,
          content,
          url: currentUser?.pubkey
            ? canonicalUrl(placeUrl(canonicalNaddr({ kind: 30023, pubkey: currentUser.pubkey, identifier: dTag })))
            : undefined,
        });

        // Publish-Pipeline sofort triggern (Prerender/Sitemap/Feed + IndexNow)
        // — vorher erschienen Orte erst im 3-h-Cron
        if (currentUser?.pubkey) {
          notifyPublishedPipeline({
            d_tag: dTag,
            url: canonicalUrl(placeUrl(canonicalNaddr({ kind: 30023, pubkey: currentUser.pubkey, identifier: dTag }))),
          });
        }

        // Auto-Übersetzung (DE→EN): EN-Version im Hintergrund veröffentlichen
        if (autoTranslateEn && currentUser?.pubkey) {
          translateAndPublish({
            type: 'place', kind: 30023, originalDTag: dTag,
            pubkey: currentUser.pubkey, title: name, summary: placeSummary,
            content, baseTags: tags, publishTeaser: publishTeaserNote,
          });
        }

        // Teaser-Note (Kind 1) automatisch posten, wenn aktiviert
        if (publishTeaserNote && currentUser?.pubkey) {
          setIsPublishingTeaser(true);
          try {
            const allImages = [image, ...additionalImages].filter(Boolean);
            const firstImage = allImages[0] || null;
            const teaser = createLongformTeaser({
              type: 'place',
              title: name.trim(),
              body: description.trim() || placeSummary,
              summary: placeSummary,
              pubkey: currentUser.pubkey,
              dTag,
              kind: 30023,
              imageUrl: firstImage,
              tags: manualTagsWithoutCountry,
              country: selectedCountry,
            });

            await publishEvent({
              kind: 1,
              content: teaser.content,
              tags: teaser.tags,
            });

            toast({
              title: '✅ Teaser veröffentlicht!',
              description: 'Der Ort erscheint im Nostr-Feed.',
            });
          } catch (teaserErr: any) {
            console.warn('[Place] Teaser-Post fehlgeschlagen:', teaserErr);
            toast({
              title: '⚠️ Ort gespeichert',
              description: 'Teaser-Note konnte nicht gepostet werden.',
              variant: 'destructive',
            });
          } finally {
            setIsPublishingTeaser(false);
          }
        }

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
        setImageMetaMap({});

        // Redirect to plaetze page after successful publish
        setTimeout(() => {
          navigate('/plaetze');
        }, 1000);
      } catch (err: any) {
        toast({
          title: 'Fehler',
          description: err.message || 'Ort konnte nicht gespeichert werden.',
          variant: 'destructive',
        });
      }
    };

    handlePublishPlace();
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
        <PlaceTitleImageSection image={image} isUploading={isUploading} imageGps={imageGps} imageGpsStatus={imageGpsStatus} editingImageGps={editingImageGps} showMapPicker={showMapPicker} setImage={setImage} setImageFile={setImageFile} setImageGps={setImageGps} setImageGpsStatus={setImageGpsStatus} setEditingImageGps={setEditingImageGps} setShowMapPicker={setShowMapPicker} setSelectedCountry={setSelectedCountry} setLocation={setLocation} handleImageFile={handleImageFile} />

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
            onImageMetaChange={(url, meta) => setImageMetaMap(prev => ({ ...prev, [url]: meta }))}
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

        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
          <div className="space-y-0.5">
            <Label htmlFor="place-publish-teaser" className="text-sm font-medium">Teaser-Note veröffentlichen</Label>
            <p className="text-xs text-muted-foreground">Erscheint im Nostr-Feed bei Primal, Amethyst & Damus</p>
          </div>
          <Switch
            id="place-publish-teaser"
            checked={publishTeaserNote}
            onCheckedChange={setPublishTeaserNote}
          />
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
          <div className="space-y-0.5">
            <Label htmlFor="place-auto-translate" className="text-sm font-medium">🇬🇧 Automatisch ins Englische übersetzen</Label>
            <p className="text-xs text-muted-foreground">Erstellt automatisch eine englische Version unter mojobus.co/en/…</p>
          </div>
          <Switch
            id="place-auto-translate"
            checked={autoTranslateEn}
            onCheckedChange={(checked) => {
              setAutoTranslateEn(checked);
              localStorage.setItem(AUTO_TRANSLATE_STORAGE_KEY, String(checked));
            }}
          />
        </div>

        <SeoPublishPanel
          title={name}
          articleText={description}
          summary={description.length > 160 ? `${description.slice(0, 157)}...` : description}
          seoTitle={seoTitle}
          onSeoTitleChange={setSeoTitle}
          metaDescription={seoMetaDescription}
          onMetaDescriptionChange={setSeoMetaDescription}
          slug={seoSlug}
          onSlugChange={setSeoSlug}
          experiencesConfirmed={experiencesConfirmed}
          onExperiencesConfirmedChange={setExperiencesConfirmed}
        />

        <Button onClick={handleSubmit} className="w-full" disabled={!name.trim() || isPublishingTeaser || !experiencesConfirmed}>
          <Map className="h-4 w-4 mr-2" />
          {isPublishingTeaser ? 'Wird veröffentlicht...' : 'Ort speichern'}
        </Button>
      </CardContent>
    </Card>
  );
}
