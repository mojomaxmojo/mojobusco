import { useState, useEffect, useMemo } from "react";
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
import { ImageOptimizationToggle } from "@/components/ImageOptimizationToggle";
import { GpsEditor } from "@/components/GpsEditor";
import { GpsStatusIndicator } from "@/components/GpsStatusIndicator";
import { LocationPicker } from "@/components/LocationPicker";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CountrySelector, getCountryTag } from "@/components/CountrySelector";
import { ARTICLE_CATEGORIES, DIY_CATEGORIES, DIY_TAGS, NATURE_CATEGORIES, NATURE_TAGS, TAG_GROUPS } from "@/config";
import { TRIP_TYPES, type TripType } from "@/config/tags";
import { RV_LIFE_CONFIG } from "@/config/rvlife";
import { AUTO_TRANSLATE_STORAGE_KEY } from "@/config/translation";
import { MilkdownEditor } from "@/components/MilkdownEditor";
import { RemotionVideoBlock } from "@/components/RemotionVideoBlock";
import { SlideshowBlock } from "@/components/SlideshowBlock";
import { Progress } from "@/components/ui/progress";
import { Upload, UploadCloud, ImageIcon, Video, Music, File as FileIcon, Camera, MapPin, Calendar, Tag, Battery, Sun, Wrench, Hammer, Cpu, Mountain, Lightbulb, Dog, Trees, Droplets, Waves, Eye, Loader2, CheckCircle, Route, Sparkles, FileText, MessageSquare, Map } from "@/lib/icons";
import { extractGpsFromImage, formatCoordinatesSimple, reverseGeocode, mapCountryCode, type GpsData, type GpsStatus, type LocationData } from "@/lib/gpsExtraction";
import { CONTENT_CATEGORIES, createRequiredTags, getOptionalTags, getTabConfig } from "@/config/contentCategories";
import { resolveBildPlaceholders } from "./publishUtils";
import { canonicalUrl, articleUrl } from "@/lib/canonicalUrl";
import { createLongformTeaser } from "@/lib/createLongformTeaser";
import exifr from "exifr";

export function ArticleForm({ editEvent }: { editEvent?: any }) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageGps, setImageGps] = useState<GpsData | null>(null);
  const [imageGpsStatus, setImageGpsStatus] = useState<GpsStatus>('not_found');
  const [editingImageGps, setEditingImageGps] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [publishedAt, setPublishedAt] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [lifestyle, setLifestyle] = useState<'mojobus' | 'vanlife' | 'rvlife' | 'beachlife' | 'wohnmobil' | 'perpetual-travelers'>('mojobus');
  const [selectedModel, setSelectedModel] = useState<'mini' | 'medium' | 'maxi'>('medium');
  const [articleLength, setArticleLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]); // 3 KI-Titel-Vorschläge
  const [tripType, setTripType] = useState<TripType | ''>('');
  // Grok Imagine Video (xAI) State
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoJobId, setVideoJobId] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<'idle' | 'submitting' | 'processing' | 'completed' | 'failed'>('idle');
  const [videoDuration, setVideoDuration] = useState<'5' | '10' | '15'>('10');
  const [videoAspect, setVideoAspect] = useState<'16:9' | '9:16'>('16:9');
  const [videoMode, setVideoMode] = useState<'auto' | 'image-to-video' | 'reference-to-video' | 'text-to-video'>('auto');

  // Slideshow-Generator State
  const [slideshowEnabled, setSlideshowEnabled] = useState(false);
  const [slideshowMusicMode, setSlideshowMusicMode] = useState<'local' | 'elevenlabs'>('local');
  const [slideshowAspect, setSlideshowAspect] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [slideshowImgDuration, setSlideshowImgDuration] = useState<4 | 6 | 8>(4);
  const [isGeneratingSlideshow, setIsGeneratingSlideshow] = useState(false);
  const [slideshowJobId, setSlideshowJobId] = useState<string | null>(null);
  const [slideshowProgress, setSlideshowProgress] = useState(0);
  const [slideshowStatus, setSlideshowStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [slideshowVideoUrl, setSlideshowVideoUrl] = useState<string | null>(null);
  // Teaser-Note State
  const [publishTeaserNote, setPublishTeaserNote] = useState(true);
  const [isPublishingTeaser, setIsPublishingTeaser] = useState(false);

  // Auto-Übersetzung (DE→EN) State
  const [autoTranslateEn, setAutoTranslateEn] = useState(() => {
    const stored = localStorage.getItem(AUTO_TRANSLATE_STORAGE_KEY);
    return stored === null ? true : stored !== 'false';
  });

  const { toast } = useToast();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { mutateAsync: uploadFile } = useUploadFile();
  const { gender, user: currentUser } = useCurrentUser(); // Gender für KI-Generierung (Mojo=male, Susanne=female)
  const navigate = useNavigate();
  const { translateAndPublish } = useAutoTranslate();

  // Hilfsfunktion: Bild-URLs aus Markdown-Content extrahieren
  // Format: ![alt](https://...) oder ![alt](https://...)
  const extractImageUrlsFromMarkdown = (markdown: string): string[] => {
    const regex = /!\[.*?\]\((https?:\/\/[^)]+)\)/g;
    const urls: string[] = [];
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      urls.push(match[1]);
    }
    return [...new Set(urls)]; // Duplikate entfernen
  };

  // ── Grok Imagine Video (xAI) Generator (via eigener Server) ────────────
  const generateVideoWithRunway = async () => {
    // Beim Text-to-Video Modus kein Bild nötig
    const effectiveMode = videoMode === 'auto'
      ? (image ? 'image-to-video' : 'text-to-video')
      : videoMode;

    if (effectiveMode === 'image-to-video' && !image) {
      toast({ title: 'Kein Titelbild', description: 'Lade zuerst ein Titelbild hoch – es wird als Start-Frame verwendet.', variant: 'destructive' });
      return;
    }
    if (effectiveMode === 'reference-to-video' && !image && extractImageUrlsFromMarkdown(content).length === 0) {
      toast({ title: 'Keine Bilder', description: 'Für Reference-to-Video werden Bilder aus dem Artikel benötigt.', variant: 'destructive' });
      return;
    }

    setIsGeneratingVideo(true);
    setVideoProgress('submitting');
    setGeneratedVideoUrl(null);
    setVideoJobId(null);

    // Referenzbilder aus Artikel extrahieren (für reference-to-video)
    const articleImages = extractImageUrlsFromMarkdown(content);
    const allImages = [...(image ? [image] : []), ...articleImages].slice(0, 6); // max 6 Referenzbilder

    try {
      // Schritt 1: Job über eigenen Server einreichen (XAI_API_KEY liegt auf VPS)
      const submitRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: image || null,
          referenceImageUrls: effectiveMode === 'reference-to-video' ? allImages : undefined,
          title,
          summary,
          location,
          country: selectedCountry,
          lifestyle,
          tags,
          duration: videoDuration,
          aspectRatio: videoAspect,
          mode: effectiveMode
        })
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        throw new Error(submitData?.error || `HTTP ${submitRes.status}`);
      }

      const jobId = submitData.jobId; // = request_id von xAI
      setVideoJobId(jobId);
      setVideoProgress('processing');

      toast({
        title: '🎬 Grok Video wird generiert...',
        description: `${effectiveMode} · ${videoDuration}s · 720p · ${videoAspect}. Bitte ~2–5 Min. warten...`
      });

      // Schritt 2: Polling über eigenen Server alle 8 Sekunden, max. 6 Minuten
      // xAI Generierung dauert typisch 2–5 Minuten
      let attempts = 0;
      const maxAttempts = 45; // 45 × 8s = 6 Min.
      const poll = async (): Promise<void> => {
        if (attempts >= maxAttempts) {
          throw new Error('Timeout: Video-Generierung dauert zu lange (max. 6 Min.). Bitte erneut versuchen.');
        }
        attempts++;

        const pollRes = await fetch(`/api/video-status/${jobId}`);
        const pollData = await pollRes.json();

        if (pollData.status === 'completed' && pollData.videoUrl) {
          const xaiUrl = pollData.videoUrl;

          toast({
            title: '🎬 Video fertig! Lade zu Blossom hoch...',
            description: `${videoDuration}s · 720p. Wird permanent gespeichert...`
          });

          // ── Automatisch zu Blossom hochladen ──────────────────────────
          // xAI URLs sind temporär → permanent auf Blossom speichern
          try {
            setVideoProgress('processing');
            const videoRes = await fetch(xaiUrl);
            if (!videoRes.ok) throw new Error(`Video-Download fehlgeschlagen: ${videoRes.status}`);
            const videoBlob = await videoRes.blob();

            const safeTitle = (title || 'video').replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);
            const videoFile = new File(
              [videoBlob],
              `${safeTitle}-grok-imagine.mp4`,
              { type: 'video/mp4' }
            );

            console.log(`[Video] Lade ${(videoFile.size / 1024 / 1024).toFixed(2)}MB zu Blossom hoch...`);

            const blossomTags = await uploadFile(videoFile);
            const blossomUrl = blossomTags.find(
              (tag: string[]) => Array.isArray(tag) && tag[0] === 'url'
            )?.[1];

            if (!blossomUrl) throw new Error('Keine Blossom-URL erhalten');

            console.log(`[Video] Blossom Upload erfolgreich: ${blossomUrl}`);
            setGeneratedVideoUrl(blossomUrl);
            setVideoProgress('completed');
            toast({
              title: '✅ Video auf Blossom gespeichert!',
              description: `Permanent verfügbar · ${videoDuration}s · 720p`
            });

          } catch (uploadErr: any) {
            // Blossom-Upload fehlgeschlagen → xAI URL verwenden (temporär)
            console.warn('[Video] Blossom-Upload fehlgeschlagen, verwende xAI URL:', uploadErr.message);
            setGeneratedVideoUrl(xaiUrl);
            setVideoProgress('completed');
            toast({
              title: '⚠️ Video fertig (temporäre URL)',
              description: `Blossom-Upload fehlgeschlagen: ${uploadErr.message}. URL läuft ab!`,
              variant: 'destructive'
            });
          }
          return;
        } else if (pollData.status === 'failed') {
          throw new Error(pollData.error || 'Video-Generierung fehlgeschlagen.');
        } else {
          await new Promise(r => setTimeout(r, 8000)); // 8s zwischen Polls
          return poll();
        }
      };

      await poll();

    } catch (err: any) {
      setVideoProgress('failed');
      toast({
        title: 'Video-Fehler',
        description: err?.message || 'Unbekannter Fehler beim Video generieren.',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // Video-URL in den Artikeltext einbetten
  const embedVideoInArticle = () => {
    if (!generatedVideoUrl) return;
    // Nackte URL einfügen – funktioniert auf mojobus.co UND in allen Nostr-Clients (Primal, Amethyst usw.)
    const videoMarkdown = `\n\n${generatedVideoUrl}\n\n`;
    setContent(prev => prev + videoMarkdown);
    toast({ title: '✅ Video eingebettet', description: 'Das Video wurde am Ende des Artikels eingefügt.' });
  };

  // ── Slideshow Generator ────────────────────────────────────────────────
  const generateSlideshow = async () => {
    // Alle Bilder sammeln: Titelbild + Markdown-Bilder
    const markdownUrls = extractImageUrlsFromMarkdown(content);
    const allImages = [...(image ? [image] : []), ...markdownUrls];

    if (allImages.length === 0) {
      toast({ title: 'Keine Bilder', description: 'Lade ein Titelbild hoch oder füge Bilder in den Artikel ein.', variant: 'destructive' });
      return;
    }

    setIsGeneratingSlideshow(true);
    setSlideshowStatus('running');
    setSlideshowProgress(0);
    setSlideshowVideoUrl(null);
    setSlideshowJobId(null);

    try {
      // Job starten
      const res = await fetch('/api/generate-slideshow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    imageUrls: allImages,
                    musicMode: 'local',
                    lifestyle,
                    aspectRatio: slideshowAspect,
                    imageDuration: slideshowImgDuration,
                  })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setSlideshowJobId(data.jobId);
      toast({
        title: '🎬 Slideshow wird erstellt...',
        description: `${data.imageCount} Bilder · ${data.totalDuration}s · Musik: ${slideshowMusicMode === 'elevenlabs' ? 'KI ($0.50)' : 'Lokal (gratis)'}`
      });

       // Polling alle 3 Sekunden — 400 attempts = 20 Minuten
      let attempts = 0;
      const poll = async (): Promise<void> => {
        if (attempts++ > 400) throw new Error('Timeout nach 20 Minuten.');
        const pollRes = await fetch(`/api/slideshow-status/${data.jobId}`);
        const pollData = await pollRes.json();

        setSlideshowProgress(pollData.progress || 0);

        if (pollData.status === 'completed' && pollData.downloadUrl) {
          // Video direkt vom Server downloaden (kein Base64)
          toast({ title: '📤 Lade zu Blossom hoch...', description: `${pollData.videoSizeMB}MB · ${pollData.imageCount} Bilder` });

          const videoRes = await fetch(pollData.downloadUrl);
          if (!videoRes.ok) throw new Error(`Download fehlgeschlagen: ${videoRes.status}`);
          const blob = await videoRes.blob();

          const safeTitle = (title || 'slideshow').replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);
          const videoFile = new File([blob], `${safeTitle}-slideshow.mp4`, { type: 'video/mp4' });
          const blossomTags = await uploadFile(videoFile);
          const blossomUrl = blossomTags.find((t: string[]) => t[0] === 'url')?.[1];
          if (!blossomUrl) throw new Error('Keine Blossom-URL erhalten.');

          setSlideshowVideoUrl(blossomUrl);
          setSlideshowStatus('completed');
          setSlideshowProgress(100);
          toast({
            title: '✅ Slideshow auf Blossom gespeichert!',
            description: `${pollData.totalDuration}s · ${pollData.imageCount} Bilder · Musik: ${pollData.musicUsed || 'keine'}`
          });
          return;

        } else if (pollData.status === 'failed') {
          throw new Error(pollData.error || 'Slideshow fehlgeschlagen.');
        } else {
          await new Promise(r => setTimeout(r, 3000));
          return poll();
        }
      };
      await poll();

    } catch (err: any) {
      setSlideshowStatus('failed');
      toast({ title: 'Slideshow Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setIsGeneratingSlideshow(false);
    }
  };

  const embedSlideshowInArticle = () => {
    if (!slideshowVideoUrl) return;
    // Nackte URL einfügen – funktioniert auf mojobus.co UND in allen Nostr-Clients (Primal, Amethyst usw.)
    const videoMd = `\n\n${slideshowVideoUrl}\n\n`;
    setContent(prev => prev + videoMd);
    toast({ title: '✅ Slideshow eingebettet' });
  };

  // KI-Artikel generieren (Foster Huntington Stil)
  const generateArticleWithAI = async () => {
    // Bild-URLs aus Markdown extrahieren
    const markdownImageUrls = extractImageUrlsFromMarkdown(content);

    // Mindestens Titelbild ODER Bilder im Editor erforderlich
    if (!imageFile && markdownImageUrls.length === 0) {
      toast({
        title: 'Bild erforderlich',
        description: 'Lade ein Titelbild hoch oder füge Bilder im Editor ein.',
        variant: 'destructive'
      });
      return;
    }

    setIsGeneratingArticle(true);
    try {
      const formData = new FormData();

      // Titelbild (optional – kann fehlen wenn Bilder im Editor vorhanden)
      if (imageFile) {
        formData.append('images', imageFile);
      }

      formData.append('title', title);
      formData.append('description', summary);
      formData.append('location', location);
      formData.append('text', content); // Vollständiger Text – kein 500-Zeichen-Limit
      formData.append('lifestyle', lifestyle);
      formData.append('model', selectedModel);

      // Zusätzliche Kontext-Felder
      formData.append('category', category || '');
      formData.append('tags', JSON.stringify(tags));
      formData.append('country', selectedCountry || '');
      formData.append('articleLength', articleLength);
      formData.append('gender', gender || 'neutral');
      formData.append('tripType', tripType || '');

      // Bild-URLs aus dem MilkdownEditor (bereits auf Blossom hochgeladen)
      if (markdownImageUrls.length > 0) {
        formData.append('markdownImageUrls', JSON.stringify(markdownImageUrls));
        console.log(`[KI] ${markdownImageUrls.length} Bild-URL(s) aus Editor mitgeschickt`);
      }

      const response = await fetch('/api/generate-article', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.article) {
        // [BILD_N] Platzhalter durch echte Markdown-Bilder ersetzen
        const imageObjects: Array<{ url: string | null; description: string }> =
          data.imageObjects || [];

        const finalContent = imageObjects.length > 0
          ? resolveBildPlaceholders(data.article, imageObjects)
          : data.article;

        setContent(finalContent);

        // Zusammenfassung automatisch ins Summary-Feld
        if (data.summary) {
          setSummary(data.summary);
        }

        // 3 Titel-Vorschläge speichern
        if (data.titleSuggestions && data.titleSuggestions.length > 0) {
          setTitleSuggestions(data.titleSuggestions);
        }

        if (data.hashtags) {
          const newTags = data.hashtags.split(' ').filter((t: string) => !tags.includes(t));
          setTags([...tags, ...newTags]);
        }

        const urlImageCount = imageObjects.filter((img: { url: string | null }) => img.url !== null).length;
        toast({
          title: 'Fertig!',
           description: `Artikel + Zusammenfassung + 3 Titel generiert (${selectedModel.toUpperCase()} Modell)`
            + (urlImageCount > 0 ? ` – ${urlImageCount} Bild(er) platziert.` : '.')
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

  // Load edit data
  useEffect(() => {
    if (editEvent) {
      // Bei bearbeiteten Beiträgen: Daten aus dem Event laden
      setTitle(editEvent.tags?.find((tag: any) => tag[0] === 'title')?.[1] || '');
      setSummary(editEvent.tags?.find((tag: any) => tag[0] === 'summary')?.[1] || '');

      // Content ist bereits Markdown (vom MilkdownEditor)
      setContent(editEvent.content || '');

      setImage(editEvent.tags?.find((tag: any) => tag[0] === 'image')?.[1] || '');
      setCategory(editEvent.tags?.find((tag: any) => tag[0] === 'category')?.[1] || '');

      // Datum aus dem Event extrahieren (published_at Tag)
      const publishedAtTag = editEvent.tags?.find((tag: any) => tag[0] === 'published_at')?.[1];
      if (publishedAtTag) {
        // Wenn Unix-Timestamp, in Datum umwandeln
        if ( /^\d+$/.test(publishedAtTag)) {
          setPublishedAt(new Date(parseInt(publishedAtTag) * 1000).toISOString().split('T')[0]);
        } else {
          // Wenn schon im richtigen Format
          setPublishedAt(publishedAtTag);
        }
      }

      const eventTags = editEvent.tags?.filter((tag: any) => tag[0] === 't')?.map((tag: any) => tag[1]) || [];
      setTags(eventTags);

      // Extract country from tags
      const countryTags = ['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg'];
      const foundCountry = eventTags.find(tag => countryTags.includes(tag));
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
        console.log('[Article Edit] GPS data loaded from tags:', { gpsLat, gpsLon, gpsAlt, gpsSource });
      }
    } else {
      // Bei neuen Beiträgen: aktuelles Datum setzen
      setPublishedAt(new Date().toISOString().split('T')[0]);
    }
  }, [editEvent]);

  // GPS Handler for Article Form (Title Image Only)
  const handleArticleImageUpload = async (file: File) => {
    setImageFile(file);
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
          console.log(`[Article EXIF] ${file.name}: Orientation (via exifr.orientation) = ${exifOrientation || 'not found'}`);
        } catch (orientErr) {
          console.warn(`[Article EXIF] ${file.name}: Could not read orientation:`, orientErr);
        }

        // Bildabmessungen lesen
        try {
          const dimExif = await exifr.parse(file, { exif: true, pickTags: ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight'] });
          exifWidth = dimExif?.ImageWidth || dimExif?.ExifImageWidth;
          exifHeight = dimExif?.ImageHeight || dimExif?.ExifImageHeight;
          if (exifWidth && exifHeight) {
            console.log(`[Article EXIF] ${file.name}: EXIF dimensions ${exifWidth}x${exifHeight}`);
          }
        } catch (dimErr) {
          console.warn(`[Article EXIF] ${file.name}: Could not read dimensions:`, dimErr);
        }

        // Korrigierte Preview erstellen (immer, wie in TripPublishForm.tsx)
        correctedPreviewUrl = await createCorrectedPreview(file, exifWidth, exifHeight, exifOrientation);
      } catch (exifError) {
        console.warn(`[Article EXIF] Failed to read EXIF from ${file.name}:`, exifError);
        // Fallback: Original file als Preview
        correctedPreviewUrl = URL.createObjectURL(file);
      }

      // Setze die korrigierte Preview als Anzeige-URL (nur temporär)
      if (correctedPreviewUrl) {
        setImage(correctedPreviewUrl);
      }

      // Upload des Original-Files → echte Blossom-URL holen und speichern
      const [urlTag] = await uploadFile(file);
      const uploadedUrl = urlTag[1]; // Blossom-URL: https://blossom.../hash
      if (uploadedUrl) {
        setImage(uploadedUrl); // Überschreibt blob:// mit der echten URL
        console.log(`[Article Upload] Titelbild hochgeladen: ${uploadedUrl}`);
      }

      // Extract GPS from title image
      try {
        const gpsData = await extractGpsFromImage(file);
        if (gpsData) {
          setImageGps(gpsData);
          setImageGpsStatus('detected');
          console.log(`[Article GPS] Extracted from ${file.name}:`, gpsData);
        } else {
          setImageGps(null);
          setImageGpsStatus('not_found');
        }
      } catch (error) {
        console.error(`[Article GPS] Failed to extract from ${file.name}:`, error);
        setImageGpsStatus('error');
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Upload fehlgeschlagen.',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

   // Auto-fill location from GPS data
   useEffect(() => {
     const autoFillLocation = async () => {
       if (imageGps) {
         console.log('[Article GPS] GPS detected, reverse geocoding...');
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
           console.log('[Article GPS] Location found:', loc);

           // Auto-fill country if detected
           const country = mapCountryCode(locationData);
           if (country && !selectedCountry) {
             setSelectedCountry(country);
             console.log('[Article GPS] Country auto-filled:', country);
           }
         }
       }
     };

     autoFillLocation();
   }, [imageGps]);

  // Get available tags from config (excluding DIY & Leon tags which are shown separately)
  const availableTags = TAG_GROUPS
    .filter(group => !['Technik', 'Pets', 'RV Life', 'Küche & Essen', 'Ausstattung', 'Freeliving', 'Länder'].includes(group.name)) // DIY, Leon & RV Life tags are shown separately
    .flatMap(group => group.tags)
    .filter(tag => !DIY_TAGS.includes(tag.id))
    .map(tag => tag.id); // Remove # - it will be added in JSX

  // Icon mapping for DIY categories
  const getDIYIcon = (iconName: string) => {
    switch (iconName) {
      case 'Battery': return Battery;
      case 'Sun': return Sun;
      case 'Wrench': return Wrench;
      case 'Hammer': return Hammer;
      case 'Cpu': return Cpu;
      default: return Wrench;
    }
  };



  // Icon mapping for Nature categories
  const getNatureIcon = (iconName: string) => {
    switch (iconName) {
      case 'strand': return Waves;
      case 'berge': return Mountain;
      case 'see': return Eye;
      case 'wald': return Trees;
      case 'wasserfall': return Droplets;
      case 'wiese': return Sun;
      case 'tiere': return Camera;
      default: return Camera;
    }
  };

  // Prueft ob die aktuelle Kategorie ein DIY-Bereich ist
  const currentCategoryConfig = ARTICLE_CATEGORIES.find(cat => cat.id === category);
  const isDIYCategory = currentCategoryConfig?.isDIY || false;

  // Prueft ob Leon-Kategorie
  const isLeonCategory = tags.includes('leon') || currentCategoryConfig?.isLeon || false;

  // Prueft ob RV Life-Kategorie
  const isRVLifeCategory = currentCategoryConfig?.isRVLife || false;

  // Automatische Tags zu manuellen Tags hinzufügen
  const updateTagsWithAuto = (currentTags: string[]) => {
    let updatedTags = [...currentTags];

    // Leon-spezifische Tags hinzufügen
    if (isLeonCategory && currentCategoryConfig?.autoTags) {
      currentCategoryConfig.autoTags.forEach(autoTag => {
        if (!updatedTags.includes(autoTag)) {
          updatedTags.push(autoTag);
        }
      });
    }

    // RV Life-spezifische Tags hinzufügen
    if (isRVLifeCategory && currentCategoryConfig?.autoTags) {
      currentCategoryConfig.autoTags.forEach(autoTag => {
        if (!updatedTags.includes(autoTag)) {
          updatedTags.push(autoTag);
        }
      });
    }

    // DIY-spezifische Tags hinzufügen
    if (isDIYCategory && !updatedTags.includes('diy')) {
      updatedTags.push('diy');
    }

    return updatedTags;
  };

  // Berechnete displayTags (kein useState nötig, da berechnet) - Fixed
  const displayTags = updateTagsWithAuto(tags);

  const handleTagToggle = (tag: string) => {
    setTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleImageUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const [urlTag] = await uploadFile(file);
      setImage(urlTag[1]); // URL is in second position
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

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte gib einen Titel ein.',
        variant: 'destructive'
      });
      return;
    }

    if (!content.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte gib einen Inhalt ein.',
        variant: 'destructive'
      });
      return;
    }

    // Create article metadata
    const articleData = {
      title: title.trim(),
      summary: summary.trim(),
      image,
      published_at: publishedAt,
      author: 'MojoBus Team'
    };

    // Entferne Country-Tags aus displayTags, um Duplikate zu vermeiden
    const countryList = ['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg'];
    const displayTagsWithoutCountry = displayTags.filter(tag =>
      !countryList.includes(tag.toLowerCase()) &&
      !tag.startsWith('#') &&
      !countryList.includes(tag.replace('#', '').toLowerCase())
    );

    // Create tags from config (mit allen Tags inkl. automatischen!)
    const baseTags = createRequiredTags('articles', displayTagsWithoutCountry);

    // Get the original d-tag for edit, or create new one
    const originalDTag = editEvent?.tags?.find((tag: any) => tag[0] === 'd')?.[1];
    const dTag = originalDTag || `article-${Date.now()}`;

    // published_at: Beim Edit ORIGINALES Datum behalten, bei Neuem aktuelles Datum setzen
    const existingPublishedAt = editEvent?.tags?.find((tag: any) => tag[0] === 'published_at')?.[1];
    const publishedAtTimestamp = editEvent && existingPublishedAt 
      ? existingPublishedAt 
      : Math.floor(new Date(publishedAt).getTime() / 1000).toString();

    const additionalTags = [
      ['d', dTag],
      ['type', 'article'],
      ['title', title.trim()],
      ['summary', summary.trim()],
      ['published_at', publishedAtTimestamp],
    ];

    // Add location tag if set
    if (location.trim()) {
      additionalTags.push(['location', location.trim()]);
    }

    // Add category and image tags if present
    if (category) additionalTags.push(['category', category]);
    if (image) additionalTags.push(['image', image]);

    // Add country tags (nur wenn selectedCountry gewählt wurde)
    if (selectedCountry) {
      const countryTags = getCountryTag(selectedCountry);
      countryTags.forEach(tag => additionalTags.push(['t', tag]));
    }

    // Add GPS tags from title image
    if (imageGps) {
      additionalTags.push(['gps_lat', imageGps.latitude.toString()]);
      additionalTags.push(['gps_lon', imageGps.longitude.toString()]);
      if (imageGps.altitude) {
        additionalTags.push(['gps_alt', imageGps.altitude.toString()]);
      }
      additionalTags.push(['gps_precision', imageGps.precision]);
      additionalTags.push(['gps_source', imageGpsStatus]);
    }

    const finalTags = [
      ...baseTags,
      ...additionalTags
    ];

    // Schritt 1: Kind 30023 publizieren (NIP-23 Long-form)
    const pubkey = finalTags.find(t => t[0] === 'p')?.[1] || '';
    await publishEvent({
      kind: 30023,
      content: content.trim(),
      tags: finalTags,
    });

    // Schritt 2: Teaser-Note (Kind 1) automatisch ins Nostr-Netzwerk posten
    if (publishTeaserNote && currentUser?.pubkey) {
      setIsPublishingTeaser(true);
      try {
        const videoMatch = content.match(
          /(https?:\/\/[^\s)]+\.mp4[^\s)]*|https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+|https?:\/\/youtu\.be\/[\w-]+|https?:\/\/[^\s)]+\.m3u8[^\s)]*)/i
        );
        const videoUrl = generatedVideoUrl || slideshowVideoUrl || videoMatch?.[1] || null;

        const teaser = createLongformTeaser({
          type: 'article',
          title: title.trim(),
          body: content.trim(),
          summary: summary.trim(),
          pubkey: currentUser.pubkey,
          dTag,
          kind: 30023,
          imageUrl: image,
          videoUrl,
          tags: displayTagsWithoutCountry,
          country: selectedCountry,
        });

        await publishEvent({
          kind: 1,
          content: teaser.content,
          tags: teaser.tags,
        });

        toast({
          title: '✅ Teaser-Note veröffentlicht!',
          description: 'Erscheint im Nostr-Feed bei Primal, Amethyst & Damus',
        });
      } catch (teaserErr: any) {
        console.warn('[Article] Teaser-Post fehlgeschlagen:', teaserErr);
        toast({
          title: '⚠️ Bericht gespeichert',
          description: 'Teaser-Note konnte nicht gepostet werden.',
          variant: 'destructive',
        });
      } finally {
        setIsPublishingTeaser(false);
      }
    }

    toast({
      title: 'Erfolg!',
      description: editEvent
        ? 'Bericht erfolgreich aktualisiert.'
        : 'Bericht veröffentlicht!'
    });

    // Auto-Übersetzung (DE→EN): EN-Version im Hintergrund veröffentlichen
    if (autoTranslateEn && currentUser?.pubkey) {
      translateAndPublish({
        type: 'article', kind: 30023, originalDTag: dTag,
        pubkey: currentUser.pubkey, title, summary, content,
        baseTags: finalTags, publishTeaser: publishTeaserNote,
      });
    }

    // Reset + Redirect
    setTitle('');
    setSummary('');
    setContent('');
    setImage('');
    setCategory('');
    setTags([]);
    setLocation('');
    setSelectedCountry('');
    setPublishedAt('');
    setImageFile(null);
    setImageGps(null);
    setImageGpsStatus('not_found');
    setEditingImageGps(false);

    setTimeout(() => {
      navigate('/artikel');
    }, 1000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Berichte veroeffentlichen
        </CardTitle>
        <CardDescription>
          Ausfuehrliche Geschichten, Guides und Erfahrungsberichte fuer die Vanlife-Community
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Artikellänge Auswahl - Über dem Titelbild */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Artikellänge:</span>
            <div className="flex gap-1">
              {([
                { value: 'short', label: 'Kurz', words: '200-400' },
                { value: 'medium', label: 'Mittel', words: '500-1000' },
                { value: 'long', label: 'Lang', words: '1000-2500' }
              ] as const).map((len) => (
                <button
                  key={len.value}
                  type="button"
                  onClick={() => setArticleLength(len.value)}
                  className={`h-5 px-2 text-xs rounded transition-colors ${
                    articleLength === len.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {articleLength === len.value && '✓ '}{len.label} <span className="opacity-70">({len.words})</span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {articleLength === 'short' && '📖 Ein Moment. Vielleicht zwei. Wie ein Tagebucheintrag.'}
            {articleLength === 'medium' && '📖 Mehrere Momente die zusammengehören. Eine Geschichte mit Raum zum Atmen.'}
            {articleLength === 'long' && '📖 Langform. Szenen, Abschweifungen, Atmosphäre. Wie ein Kapitel aus einem Buch.'}
          </p>
        </div>

        {/* Title Image - Move to top */}
        <div className="space-y-2">
          <Label htmlFor="article-image">Titelbild</Label>
          <div className="flex gap-2">
            {image ? (
              <div className="flex-1">
                <div className="relative">
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
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImage('')}
                  className="mt-2"
                  disabled={isUploading}
                >
                  Entfernen
                </Button>
              </div>
            ) : (
                 <div className="flex-1">
                  <div className="relative">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleArticleImageUpload(file);
                      }}
                      className="flex-1 mb-2 disabled:opacity-50"
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
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button variant="outline" asChild disabled={isUploading}>
                      <label htmlFor="article-image-url" className="cursor-pointer">
                        URL
                      </label>
                    </Button>
                    <Input
                      id="article-image-url"
                      placeholder="https://..."
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      className="flex-1 disabled:opacity-50"
                      disabled={isUploading}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* GPS Info Display */}
            {imageGps && imageGps.latitude && imageGps.longitude ? (
              <div className="space-y-2">
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
             ) : null}
           </div>

         {/* Location (auto-filled from GPS) */}
         <div className="space-y-2">
          <Label htmlFor="article-location">Standort</Label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                id="article-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Wo wurde dieser Artikel erstellt? (z.B. Lagos, Portugal)"
                className="flex-1"
              />
            </div>
            {imageGps && (
              <GpsStatusIndicator status={imageGpsStatus} gps={imageGps} />
            )}
          </div>
          {location && imageGps && (
            <p className="text-xs text-green-600 dark:text-green-400">
              📍 Standort automatisch aus GPS-Koordinaten ermittelt
            </p>
          )}
        </div>

        {/* Country Selection */}
        <CountrySelector
          selectedCountry={selectedCountry}
          onCountryChange={setSelectedCountry}
          placeholder="Land auswaehlen"
        />

        <div className="space-y-2">
          <Label htmlFor="article-title">Titel</Label>
          <Input
            id="article-title"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setTitleSuggestions([]); }}
            placeholder="Einprägsamer Titel für deinen Artikel..."
          />
          {/* KI-Titel-Vorschläge */}
          {titleSuggestions.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-muted-foreground font-medium">✨ KI-Vorschläge – klicken zum Übernehmen:</p>
              <div className="flex flex-col gap-1.5">
                {titleSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setTitle(suggestion); setTitleSuggestions([]); }}
                    className="text-left px-3 py-2 text-sm rounded-lg border border-ocean-200 dark:border-ocean-800 bg-ocean-50 dark:bg-ocean-950/50 hover:bg-ocean-100 dark:hover:bg-ocean-900 text-ocean-900 dark:text-ocean-100 transition-colors group"
                  >
                    <span className="text-xs text-ocean-400 dark:text-ocean-500 mr-2 group-hover:text-ocean-600">{i + 1}.</span>
                    {suggestion}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setTitleSuggestions([])}
                className="text-xs text-muted-foreground hover:text-foreground underline mt-1"
              >
                Vorschläge ausblenden
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="article-summary">Zusammenfassung</Label>
            {summary && (
              <span className="text-xs text-muted-foreground">
                {summary.trim().split(/\s+/).filter(Boolean).length} Wörter
              </span>
            )}
          </div>
          <Textarea
            id="article-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Kurze Zusammenfassung (wird nach KI-Generierung automatisch befüllt)..."
            rows={2}
          />
        </div>

         <div className="space-y-2">
           <Label htmlFor="article-content">Inhalt</Label>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            WYSIWYG Editor - Schreibe deinen Artikel mit Formatierung, Bildern und Links
          </div>
          <MilkdownEditor
            content={content}
            onChange={setContent}
            placeholder={`# Überschrift

Schreibe deinen Artikel hier...

- Verwende die Toolbar für Formatierung
- Fett oder kursiv

## Unterüberschrift

### Listen
- Listenpunkte
- Weitere Punkte

### Links und Bilder
- Füge Links über das Link-Icon ein
- Lade Bilder direkt in den Editor

### Noch mehr...
`}
            minHeight="400px"
            maxLength={50000}
            onImageUpload={(url) => {
              // Optional: Füge hochgeladene Bilder zu einer Liste hinzu
            }}
           />
         </div>

        {/* Kategorie */}
        <div className="space-y-2">
          <Label htmlFor="article-category">Kategorie</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Wähle eine Kategorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reise">🗺️ Reise</SelectItem>
              <SelectItem value="outdoor">🏕️ Outdoor</SelectItem>
              <SelectItem value="technik">🔧 Technik</SelectItem>
              <SelectItem value="lifestyle">🏠 Lifestyle</SelectItem>
              <SelectItem value="food">🍳 Food & Cooking</SelectItem>
              <SelectItem value="community">👥 Community</SelectItem>
              <SelectItem value="diy">🛠️ DIY & Ausbau</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KI-Artikel generieren (Optional) */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-ocean-500" />
            <h3 className="font-semibold">KI-Artikel generieren (Optional)</h3>
          </div>

          {/* Lifestyle Auswahl */}
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
          <div className="mt-4 space-y-2">
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
            onClick={generateArticleWithAI}
            disabled={isGeneratingArticle || (!imageFile && extractImageUrlsFromMarkdown(content).length === 0)}
            className="w-full mt-2"
          >
            {isGeneratingArticle ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generiere mit {selectedModel.toUpperCase()} Modell...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                KI-Artikel generieren ({selectedModel.toUpperCase()} Modell)
              </>
            )}
          </Button>
          {!imageFile && extractImageUrlsFromMarkdown(content).length === 0 && (
            <p className="text-xs text-muted-foreground">
              💡 Lade ein Titelbild hoch oder füge Bilder im Editor ein, um die KI-Generierung zu nutzen.
            </p>
          )}
          {!imageFile && extractImageUrlsFromMarkdown(content).length > 0 && (
            <p className="text-xs text-muted-foreground">
              🖼️ {extractImageUrlsFromMarkdown(content).length} Bild(er) im Editor werden analysiert.
            </p>
          )}
        </div>

        {/* ── 🎞️ Slideshow Generator ────────────────────────────────────── */}
        <SlideshowBlock
          imageUrls={[...(image ? [image] : []), ...extractImageUrlsFromMarkdown(content)]}
          lifestyle={lifestyle}
          title={title || 'bericht'}
        />
        {/* ALT — wird nicht mehr angezeigt, ersetzt durch SlideshowBlock */}
        <div className="hidden">
          {/* Header mit An/Abwahl Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-emerald-500" />
              <h3 className="font-semibold">🎞️ Slideshow generieren</h3>
              <span className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                ffmpeg · Ken Burns · Deep Pan
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setSlideshowEnabled(v => !v); if (slideshowEnabled) { setSlideshowVideoUrl(null); setSlideshowStatus('idle'); } }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                slideshowEnabled
                  ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-emerald-400 hover:text-emerald-600'
              }`}
            >
              {slideshowEnabled
                ? <><span className="w-2 h-2 rounded-full bg-white inline-block" />Aktiv</>
                : <><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />Inaktiv</>
              }
            </button>
          </div>

          {/* Bilder-Vorschau immer sichtbar */}
          {(() => {
            const imgs = [...(image ? [image] : []), ...extractImageUrlsFromMarkdown(content)];
            return (
              <p className="text-xs text-muted-foreground">
                {imgs.length > 0
                  ? <>🖼️ <strong>{imgs.length} Bild{imgs.length !== 1 ? 'er' : ''}</strong> verfügbar · {imgs.length * slideshowImgDuration}s Slideshow · Ken Burns + Deep Pan Effekte</>
                  : '⚠️ Noch keine Bilder — lade ein Titelbild hoch oder füge Bilder in den Artikel ein.'}
              </p>
            );
          })()}

          {/* Erweiterter Bereich nur wenn aktiviert */}
          {slideshowEnabled && (
            <div className="space-y-4 pt-2 border-t border-muted">

               {/* 🎵 Musik: Nur Lokal */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">🎵 Musik</Label>
                <div className="rounded-lg p-3 border bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
                  <div className="font-medium text-sm text-emerald-700 dark:text-emerald-300">🎸 Lokal</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Fertige Chill-Tracks · Zufällige Auswahl</div>
                  <div className="text-xs font-medium text-emerald-600 mt-1">$0.00 — kostenlos</div>
                </div>
                <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                  🎸 Zufälliger Chill-Track aus <code>server/music/</code> — lifestyle-passend wenn vorhanden.
                </p>
              </div>

              {/* Einstellungen: Format + Bild-Dauer */}
              <div className="grid grid-cols-2 gap-3">
                {/* Format */}
                <div className="space-y-1">
                  <Label className="text-xs">Format</Label>
                  <div className="flex gap-1">
                     {([
                      { value: '16:9' as const, label: '16:9 Cinema' },
                      { value: '9:16' as const, label: '9:16 Phone' },
                      { value: '1:1' as const, label: '1:1 Square' },
                    ]).map(({ value: a, label }) => (
                      <button key={a} type="button" onClick={() => setSlideshowAspect(a)}
                        className={`flex-1 py-1 text-xs rounded border transition-colors ${
                          slideshowAspect === a
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-300 dark:border-gray-600 hover:border-emerald-400'
                        }`}
                      >{label}</button>
                    ))}
                  </div>
                </div>
                {/* Sekunden pro Bild */}
                <div className="space-y-1">
                  <Label className="text-xs">Sek. pro Bild</Label>
                  <div className="flex gap-1">
                    {([4, 6, 8] as const).map(d => (
                      <button key={d} type="button" onClick={() => setSlideshowImgDuration(d)}
                        className={`flex-1 py-1 text-xs rounded border transition-colors ${
                          slideshowImgDuration === d
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-300 dark:border-gray-600 hover:border-emerald-400'
                        }`}
                      >{d}s</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bilder + Kosten Info */}
              {(() => {
                const imgs = [...(image ? [image] : []), ...extractImageUrlsFromMarkdown(content)];
                const totalSec = imgs.length * slideshowImgDuration;
                return (
                  <div className="space-y-1 text-xs bg-gray-50 dark:bg-gray-800/50 rounded p-2">
                    <div className="flex justify-between">
                      <span>🖼️ Bilder: <strong>{imgs.length}</strong></span>
                      <span>⏱️ Länge: <strong>{totalSec}s</strong></span>
                      <span>💰 Kosten: <strong className="text-emerald-600">${slideshowMusicMode === 'elevenlabs' ? '0.50' : '0.00'}</strong></span>
                    </div>
                    <div className="text-muted-foreground">
                      Effekte: Zoom In · Zoom Out · Pan L→R · Pan R→L · Deep Pan ↑↓ · Diagonal
                    </div>
                  </div>
                );
              })()}

              {/* Server Info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                <span>🔒</span>
                <span>ffmpeg läuft auf dem VPS — kein Upload nötig, direkt zu Blossom.</span>
              </div>

              {/* Generieren Button */}
              <Button
                type="button"
                onClick={generateSlideshow}
                disabled={isGeneratingSlideshow || (image ? false : extractImageUrlsFromMarkdown(content).length === 0)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isGeneratingSlideshow ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {slideshowProgress > 0 ? `${slideshowProgress}% — ` : ''}
                    {slideshowProgress < 32 ? 'Bilder herunterladen...'
                      : slideshowProgress < 40 ? (slideshowMusicMode === 'elevenlabs' ? 'KI-Musik generieren...' : 'Musik laden...')
                      : slideshowProgress < 85 ? 'ffmpeg rendert Slideshow...'
                      : 'Zu Blossom hochladen...'}
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4 mr-2" />
                    🎞️ Slideshow generieren
                  </>
                )}
              </Button>

              {/* Fortschrittsbalken */}
              {isGeneratingSlideshow && slideshowProgress > 0 && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${slideshowProgress}%` }}
                  />
                </div>
              )}

              {/* Ergebnis */}
              {slideshowStatus === 'completed' && slideshowVideoUrl && (
                <div className="space-y-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium text-sm">✅ Slideshow auf Blossom gespeichert!</span>
                  </div>
                  <video src={slideshowVideoUrl} controls autoPlay muted loop
                    className="w-full rounded-lg max-h-56 object-cover" />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={embedSlideshowInArticle}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                      <Video className="h-3 w-3 mr-1" />In Artikel einbetten
                    </Button>
                    <Button type="button" size="sm" variant="outline"
                      onClick={() => window.open(slideshowVideoUrl, '_blank')}>
                      Öffnen
                    </Button>
                    <Button type="button" size="sm" variant="outline"
                      onClick={() => { setSlideshowVideoUrl(null); setSlideshowStatus('idle'); setSlideshowProgress(0); }}>
                      Neu
                    </Button>
                  </div>
                </div>
              )}

              {/* Fehler */}
              {slideshowStatus === 'failed' && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg text-sm text-red-700 dark:text-red-300">
                  ❌ Slideshow fehlgeschlagen. Prüfe ob ffmpeg + Musik-Ordner auf dem VPS vorhanden sind.
                  <Button type="button" size="sm" variant="outline" className="mt-2 w-full"
                    onClick={() => setSlideshowStatus('idle')}>
                    Erneut versuchen
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        {/* ── Ende Slideshow-Generator (alt, hidden) ───────────────────── */}

        {/* Automatisch generierte Tags anzeigen */}
        {(isDIYCategory || isLeonCategory || isRVLifeCategory) && (
          <div className="space-y-3">
            <Label>Automatische Tags</Label>
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                🤖 Diese Tags werden automatisch aufgrund der Kategorie "{currentCategoryConfig?.name}" hinzugefügt:
              </p>
              <div className="flex flex-wrap gap-2">
                {/* Zeige automatisch generierte Tags */}
                {currentCategoryConfig?.autoTags?.map(autoTag => (
                  <Badge
                    key={autoTag}
                    variant="default"
                    className="bg-green-100 text-green-700 border-green-300"
                  >
                    ✓ #{autoTag}
                  </Badge>
                )) || (isDIYCategory && (
                  <Badge
                    variant="default"
                    className="bg-orange-100 text-orange-700 border-orange-300"
                  >
                    ✓ #diy
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DIY-spezifische Tags */}
        {isDIYCategory && (
          <div className="space-y-3">
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                ⚠️ Dieser Artikel erscheint im DIY-Bereich. Wähle spezifische Kategorien:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.values(DIY_CATEGORIES).map(diyCat => {
                  const Icon = getDIYIcon(diyCat.icon);
                  return (
                    <Badge
                      key={diyCat.id}
                      variant={displayTags.includes(diyCat.id) ? "default" : "outline"}
                      className="cursor-pointer justify-start p-2"
                      onClick={() => {
                        // DIY-Tag hinzufügen, falls noch nicht vorhanden
                        if (!displayTags.includes('diy')) {
                          setTags(prev => {
                            const newTags = [...prev, 'diy'];
                            return newTags;
                          });
                        }
                        // Toggle spezifischen DIY-Tag
                        setTags(prev =>
                          prev.includes(diyCat.id)
                            ? prev.filter(t => t !== diyCat.id)
                            : [...prev, diyCat.id]
                        );
                      }}
                    >
                      <span className="mr-2">{diyCat.emoji}</span>
                      {diyCat.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* RV Life-spezifische Tags */}
        {isRVLifeCategory && (
          <div className="space-y-3">
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                🚐 Dieser Artikel erscheint im RV Life Bereich. Wähle spezifische Kategorien:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { id: 'kueche-essen', emoji: '🍳', name: 'Küche & Essen' },
                  { id: 'ausstattung', emoji: '🏠', name: 'Ausstattung' },
                  { id: 'freeliving', emoji: '🕊️', name: 'Freeliving' },
                  { id: 'lifestyle', emoji: '✨', name: 'Lifestyle' }
                ].map(rvCat => (
                  <Badge
                    key={rvCat.id}
                    variant={displayTags.includes(rvCat.id) ? "default" : "outline"}
                    className="cursor-pointer justify-start p-2"
                    onClick={() => {
                      // Toggle RV Life Kategorie-Tag
                      setTags(prev =>
                        prev.includes(rvCat.id)
                          ? prev.filter(t => t !== rvCat.id)
                          : [...prev, rvCat.id]
                      );
                    }}
                  >
                    <span className="mr-2">{rvCat.emoji}</span>
                    {rvCat.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Label>Tags</Label>

          {/* Ausgewählte Tags anzeigen */}
          {displayTags.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                🏷️ Aktuell ausgewählte Tags:
              </p>
              <div className="flex flex-wrap gap-2">
                {displayTags.map(tag => (
                  <Badge
                    key={tag}
                    variant="default"
                    className="bg-blue-100 text-blue-700 border-blue-300 cursor-pointer"
                    onClick={() => {
                      // Entferne aus displayTags und tags
                      setTags(prev => prev.filter(t => t !== tag));
                    }}
                  >
                    #{tag} ×
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                💡 Tippe auf einen Tag zum Entfernen
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Verfügbare Tags:
            </p>
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => (
                <Badge
                  key={tag}
                  variant={displayTags.includes(tag) ? "secondary" : "outline"}
                  className={`cursor-pointer ${
                    displayTags.includes(tag)
                      ? 'bg-gray-100 text-gray-500'
                      : 'hover:bg-blue-100 hover:text-blue-700'
                  }`}
                  onClick={() => handleTagToggle(tag)}
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Eigene Tags (mit Komma oder Leerzeichen trennen)..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const value = e.currentTarget.value;
                  const newTags = value.split(/[\s,]+/).filter(Boolean);
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
                const newTags = value.split(/[\s,]+/).filter(Boolean);
                setTags(prev => [...prev, ...newTags]);
                input.value = '';
              }}
            >
              Hinzufügen
            </Button>
          </div>
        </div>



        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="article-date">Veröffentlichungsdatum</Label>
            <Input
              id="article-date"
              type="date"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
          <div className="space-y-0.5">
            <Label htmlFor="article-publish-teaser" className="text-sm font-medium">Teaser-Note veröffentlichen</Label>
            <p className="text-xs text-muted-foreground">Erscheint im Nostr-Feed bei Primal, Amethyst & Damus</p>
          </div>
          <Switch
            id="article-publish-teaser"
            checked={publishTeaserNote}
            onCheckedChange={setPublishTeaserNote}
          />
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
          <div className="space-y-0.5">
            <Label htmlFor="article-auto-translate" className="text-sm font-medium">🇬🇧 Automatisch ins Englische übersetzen</Label>
            <p className="text-xs text-muted-foreground">Erstellt automatisch eine englische Version unter mojobus.co/en/…</p>
          </div>
          <Switch
            id="article-auto-translate"
            checked={autoTranslateEn}
            onCheckedChange={(checked) => {
              setAutoTranslateEn(checked);
              localStorage.setItem(AUTO_TRANSLATE_STORAGE_KEY, String(checked));
            }}
          />
        </div>

        <Button
          onClick={handleSubmit}
          className="w-full"
          disabled={!title.trim() || !content.trim() || isPublishingTeaser}
        >
          <FileText className="h-4 w-4 mr-2" />
          {isPublishingTeaser ? 'Wird veröffentlicht...' : (editEvent ? 'Bericht aktualisieren' : 'Bericht veröffentlichen')}
        </Button>      </CardContent>
    </Card>
  );
}