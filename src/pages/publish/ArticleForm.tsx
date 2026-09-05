import { useState, useEffect, useMemo, useRef } from "react";
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
import { getApiBaseUrl } from "@/lib/apiBase";
import { ImageOptimizationToggle } from "@/components/ImageOptimizationToggle";
import { LocationPicker } from "@/components/LocationPicker";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PerspectiveSelector } from "@/components/PerspectiveSelector";
import { type GenderType } from "@/config/prompts/lifestyles";
import { ModelSelect, type TextModelTier } from "@/components/ModelSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ARTICLE_CATEGORIES, DIY_CATEGORIES, DIY_TAGS, TAG_GROUPS } from "@/config";
import { TRIP_TYPES, type TripType } from "@/config/tags";
import { RV_LIFE_CONFIG } from "@/config/rvlife";
import { STRANDORT_CONFIG } from "@/config/strandort";
import { AUTO_TRANSLATE_STORAGE_KEY } from "@/config/translation";
import { MilkdownEditor } from "@/components/MilkdownEditor";
import { RemotionVideoBlock } from "@/components/RemotionVideoBlock";
import { SlideshowBlock } from "@/components/SlideshowBlock";
import { Progress } from "@/components/ui/progress";
import { Upload, UploadCloud, Video, Music, File as FileIcon, Camera, Calendar, Tag, Battery, Sun, Wrench, Hammer, Cpu, Mountain, Lightbulb, Dog, Trees, Droplets, Waves, Eye, Loader2, CheckCircle, Route, Sparkles, FileText, MessageSquare, Map, Info } from "@/lib/icons";
import { getTagValue, getTagValues, getEventGpsTags } from "@/lib/nostrEventUtils";
import type { NostrEvent } from '@nostrify/nostrify';
import { useArticleTagCategories } from "./articleForm/useArticleTagCategories";
import { useArticleImageGps } from "./articleForm/useArticleImageGps";
import { useArticleAutosave } from "./articleForm/useArticleAutosave";
import { useArticleMediaGenerators } from "./articleForm/useArticleMediaGenerators";
import { useArticlePublish } from "./articleForm/useArticlePublish";
import { ArticleImageGpsSection } from "./articleForm/ArticleImageGpsSection";
import { COUNTRY_TAG_LIST, ARTICLE_LENGTH_OPTIONS, getDIYIcon, RV_LIFE_TAG_OPTIONS, STRAND_ORT_TAG_OPTIONS } from "./articleForm/articleFormConfig";
import { extractImageUrlsFromMarkdown } from "./articleForm/articleFormUtils";
import { buildAuthorInput } from "@/config/assistant";
import type { AssistantIdea } from "@/components/assistant/IdeasPanel";
import { useAssistantApi } from "@/components/assistant/useAssistantApi";
import { AssistantSection } from "@/components/assistant/AssistantSection";
import { SeoPublishPanel } from "@/components/assistant/SeoPublishPanel";
import { DraftsOverview } from "@/components/assistant/DraftsOverview";
import { MediaLibraryPanel } from "@/components/assistant/MediaLibraryPanel";
import { canonicalUrl, articleUrl, canonicalNaddr } from "@/lib/canonicalUrl";
import { resolveBildPlaceholders } from "./publishUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function ArticleForm({ editEvent }: { editEvent?: NostrEvent }) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const { category, setCategory, tags, setTags, availableTags, currentCategoryConfig, isDIYCategory, isLeonCategory, isRVLifeCategory, isStrandOrtCategory, displayTags, handleTagToggle } = useArticleTagCategories();
  const [location, setLocation] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [publishedAt, setPublishedAt] = useState('');
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [lifestyle, setLifestyle] = useState<'mojobus' | 'vanlife' | 'rvlife' | 'beachlife' | 'wohnmobil' | 'perpetual-travelers'>('mojobus');
  const [selectedModel, setSelectedModel] = useState<TextModelTier>('medium');
  const [articleLength, setArticleLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]); // 3 KI-Titel-Vorschläge
  const [tripType, setTripType] = useState<TripType | ''>('');
  // Assistent: FAKTEN + ERLEBNISSE — werden beim Generieren via buildAuthorInput
  // klar getrennt markiert dem `text`-Parameter vorangestellt
  const [researchFacts, setResearchFacts] = useState('');
  const [experienceNotes, setExperienceNotes] = useState('');
  // Ref-API des MilkdownEditors: Markdown an Cursorposition einfügen (Assistent-Links)
  const editorInsertRef = useRef<((markdown: string) => void) | null>(null);
  // SEO-Panel (Assistent): seo_title / meta_description / slug + Erlebnisse-Pflicht
  const [seoTitle, setSeoTitle] = useState('');
  const [seoMetaDescription, setSeoMetaDescription] = useState('');
  const [seoSlug, setSeoSlug] = useState('');
  const [experiencesConfirmed, setExperiencesConfirmed] = useState(true);
  // Media-Library-Dialog (Titelbild aus eigener Library wählen)
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  // Info-i am Generieren-Button: erklärt, welche Inputs in den Text fließen
  const [showGenerationInfo, setShowGenerationInfo] = useState(false);
  // Aktuell geladener Entwurf (DraftsOverview)
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [currentDraftStatus, setCurrentDraftStatus] = useState<'draft' | 'published' | null>(null);
  const { request: assistantRequest } = useAssistantApi();
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
  const {
    image, setImage,
    imageFile, setImageFile,
    imageGps, setImageGps,
    imageCapturedAt, setImageCapturedAt,
    imageGpsStatus, setImageGpsStatus,
    editingImageGps, setEditingImageGps,
    showMapPicker, setShowMapPicker,
    isUploading,
    handleArticleImageUpload,
    handleImageUpload,
    imageMetaMap, setImageMetaMap,
  } = useArticleImageGps({ toast, uploadFile, selectedCountry, setLocation, setSelectedCountry });
  const { gender: autoGender, user: currentUser } = useCurrentUser(); // Automatisch erkannte Perspektive (Mojo=male, Susanne=female)
  const [perspectiveTouched, setPerspectiveTouched] = useState(false);
  const [perspective, setPerspective] = useState<GenderType>(autoGender);
  // Solange der User die Perspektive nicht manuell geändert hat, folgt sie der Auto-Erkennung
  useEffect(() => {
    if (!perspectiveTouched) setPerspective(autoGender);
  }, [autoGender, perspectiveTouched]);
  const gender = perspective;
  const navigate = useNavigate();
  const { translateAndPublish } = useAutoTranslate();
  const { trackPublishedPost } = useContinuityTracking();

  // ── Nr. 13: Lokaler Autosave (Browser-Crash-Schutz) ───────────────────
  // Speichert die Formular-Felder debounced in localStorage. Server-Sync
  // bleibt manuell („Als Entwurf speichern", Token-Pflicht unberührt).
  // Wiederherstellung nur per Banner — wenn Formular leer & kein Entwurf/
  // Edit geladen wurde (bewusst geladener Inhalt hat Vorrang).
  const { autosaveCandidate, restoreAutosave, discardAutosave } = useArticleAutosave({
    editEvent,
    currentDraftId,
    toast,
    values: {
      title, summary, content, location, selectedCountry, category, tags,
      articleLength, tripType, lifestyle, seoTitle, seoMetaDescription, seoSlug,
      researchFacts, experienceNotes, publishedAt,
    },
    setTitle, setSummary, setContent, setLocation, setSelectedCountry,
    setCategory, setTags, setArticleLength, setTripType, setLifestyle,
    setSeoTitle, setSeoMetaDescription, setSeoSlug, setResearchFacts,
    setExperienceNotes, setPublishedAt,
  });

  const {
    videoEnabled, setVideoEnabled,
    isGeneratingVideo, setIsGeneratingVideo,
    generatedVideoUrl, setGeneratedVideoUrl,
    videoJobId, setVideoJobId,
    videoProgress, setVideoProgress,
    videoDuration, setVideoDuration,
    videoAspect, setVideoAspect,
    videoMode, setVideoMode,
    generateVideoWithRunway,
    embedVideoInArticle,
    slideshowEnabled, setSlideshowEnabled,
    slideshowMusicMode, setSlideshowMusicMode,
    slideshowAspect, setSlideshowAspect,
    slideshowImgDuration, setSlideshowImgDuration,
    isGeneratingSlideshow, setIsGeneratingSlideshow,
    slideshowJobId, setSlideshowJobId,
    slideshowProgress, setSlideshowProgress,
    slideshowStatus, setSlideshowStatus,
    slideshowVideoUrl, setSlideshowVideoUrl,
    generateSlideshow,
    embedSlideshowInArticle,
  } = useArticleMediaGenerators({
    image, content, title, summary, location, selectedCountry, lifestyle, tags,
    toast, uploadFile, setContent,
  });


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
      formData.append('text', buildAuthorInput({ facts: researchFacts, experiences: experienceNotes, editorText: content }));
      formData.append('lifestyle', lifestyle);
      formData.append('model', selectedModel);

      // Zusätzliche Kontext-Felder
      formData.append('category', category || '');
      formData.append('tags', JSON.stringify(tags));
      formData.append('country', selectedCountry || '');
      formData.append('articleLength', articleLength);
      formData.append('gender', gender || 'neutral');
      formData.append('tripType', tripType || '');

      // Wetter-Kontext: Veröffentlichungsdatum + Titelbild-GPS (GPS schlägt
      // Geocoding — funktioniert auch für Strandnamen, die open-meteo nicht kennt)
      if (publishedAt) formData.append('publishedAt', publishedAt);
      if (imageGps) {
        formData.append('gps_lat', String(imageGps.latitude));
        formData.append('gps_lon', String(imageGps.longitude));
      }
      // Aufnahmezeitpunkt (EXIF) — Wetter wird dann für genau diesen Moment
      // (Datum + Stunde, Stundenbasis) statt Tagesaggregat abgefragt
      if (imageCapturedAt) {
        // device-lokal interpretiert (Kamerazeit ≈ Ortszeit am Aufnahmeort)
        const pad = (n: number) => String(n).padStart(2, '0');
        formData.append('captured_date', `${imageCapturedAt.getFullYear()}-${pad(imageCapturedAt.getMonth() + 1)}-${pad(imageCapturedAt.getDate())}`);
        formData.append('captured_hour', String(imageCapturedAt.getHours()));
      }

      // Bild-URLs aus dem MilkdownEditor (bereits auf Blossom hochgeladen)
      if (markdownImageUrls.length > 0) {
        formData.append('markdownImageUrls', JSON.stringify(markdownImageUrls));
        console.log(`[KI] ${markdownImageUrls.length} Bild-URL(s) aus Editor mitgeschickt`);
        // Bild-Metadaten pro Bild-URL (Alt-Text/Caption/Freitext) parallel mitschicken
        const markdownImageMeta = markdownImageUrls.map(u => imageMetaMap[u] || {});
        formData.append('markdownImageMeta', JSON.stringify(markdownImageMeta));
      }

      const response = await fetch(`${getApiBaseUrl()}/api/generate-article`, {
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
      setTitle(getTagValue(editEvent, 'title') || '');
      setSummary(getTagValue(editEvent, 'summary') || '');

      // Content ist bereits Markdown (vom MilkdownEditor)
      setContent(editEvent.content || '');

      setImage(getTagValue(editEvent, 'image') || '');
      setCategory(getTagValue(editEvent, 'category') || '');

      // SEO-Felder (Assistent) aus dem Event laden — ohne dieses Laden
      // würde ein Edit+Republish die Tags stillschweigend löschen
      setSeoTitle(getTagValue(editEvent, 'seo_title') || '');
      setSeoMetaDescription(getTagValue(editEvent, 'meta_description') || '');
      setSeoSlug(getTagValue(editEvent, 'slug') || '');

      // Datum aus dem Event extrahieren (published_at Tag)
      const publishedAtTag = getTagValue(editEvent, 'published_at');
      if (publishedAtTag) {
        // Wenn Unix-Timestamp, in Datum umwandeln
        if ( /^\d+$/.test(publishedAtTag)) {
          setPublishedAt(new Date(parseInt(publishedAtTag) * 1000).toISOString().split('T')[0]);
        } else {
          // Wenn schon im richtigen Format
          setPublishedAt(publishedAtTag);
        }
      }

      const eventTags = getTagValues(editEvent, 't');
      setTags(eventTags);

      // Extract country from tags
      const countryTags = COUNTRY_TAG_LIST;
      const foundCountry = eventTags.find(tag => countryTags.includes(tag));
      if (foundCountry) {
        setSelectedCountry(foundCountry);
      }

      // Load GPS data from tags
      const { gpsLat, gpsLon, gpsAlt, gpsPrecision, gpsSource } = getEventGpsTags(editEvent);

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


  const {
    draftPayload,
    loadDraftIntoForm,
    notifyAssistantPublished,
    handleSubmit,
  } = useArticlePublish({
    // Werte
    title, summary, content, image, imageFile, imageGps, imageGpsStatus,
    imageCapturedAt, category, location, selectedCountry, publishedAt,
    seoTitle, seoMetaDescription, seoSlug, experiencesConfirmed,
    publishTeaserNote, autoTranslateEn, displayTags,
    lifestyle, articleLength, tripType, tags,
    researchFacts, experienceNotes,
    generatedVideoUrl, slideshowVideoUrl, currentDraftId, currentDraftStatus,
    editEvent,
    // Helfer
    toast, publishEvent, currentUser, assistantRequest, translateAndPublish,
    trackPublishedPost,
    // Reset-Setter fürs Formular-Clearing
    setTitle, setSummary, setContent, setImage, setCategory, setTags,
    setLocation, setSelectedCountry, setPublishedAt,
    setSeoTitle, setSeoMetaDescription, setSeoSlug,
    setImageFile,
    setImageGps, setImageCapturedAt, setImageGpsStatus, setEditingImageGps,
    setImageMetaMap,
    setArticleLength, setTripType, setLifestyle, setResearchFacts,
    setExperienceNotes,
    // Teaser-Indikator
    setIsPublishingTeaser,
    // Route
    navigate,
    // Entwurf
    setCurrentDraftId, setCurrentDraftStatus,
  });


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
        {/* Nr. 13: Autosave-Banner (nur wenn Formular leer & nichts geladen) */}
        {autosaveCandidate && !editEvent && !currentDraftId && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3">
            <p className="text-xs flex-1">
              💾 Automatisch gespeicherter Entwurf vom{' '}
              {new Date(autosaveCandidate.savedAt).toLocaleString('de-DE')} gefunden.
            </p>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={restoreAutosave}>Wiederherstellen</Button>
              <Button size="sm" variant="ghost" onClick={discardAutosave}>Verwerfen</Button>
            </div>
          </div>
        )}
        {/* Artikellänge Auswahl - Über dem Titelbild */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Artikellänge:</span>
            <div className="flex gap-1">
              {ARTICLE_LENGTH_OPTIONS.map((len) => (
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

        <ArticleImageGpsSection
          image={image}
          setImage={setImage}
          isUploading={isUploading}
          handleArticleImageUpload={handleArticleImageUpload}
          imageGps={imageGps}
          setImageGps={setImageGps}
          imageGpsStatus={imageGpsStatus}
          setImageGpsStatus={setImageGpsStatus}
          editingImageGps={editingImageGps}
          setEditingImageGps={setEditingImageGps}
          setShowMediaLibrary={setShowMediaLibrary}
          location={location}
          setLocation={setLocation}
          selectedCountry={selectedCountry}
          setSelectedCountry={setSelectedCountry}
          toast={toast}
        />


        {/* Assistent: Ideen, Research, Momente, interne Links (nur Vorschläge) —
            bewusst NACH Standort/Land, damit die Ideen den Ort aus dem Formular ziehen */}
        <AssistantSection
          title={title}
          location={location}
          country={selectedCountry}
          gpsLat={imageGps?.latitude}
          gpsLon={imageGps?.longitude}
          captureDate={imageCapturedAt ? `${imageCapturedAt.getFullYear()}-${String(imageCapturedAt.getMonth() + 1).padStart(2, '0')}-${String(imageCapturedAt.getDate()).padStart(2, '0')}` : undefined}
          captureHour={imageCapturedAt ? imageCapturedAt.getHours() : undefined}
          tags={tags}
          date={publishedAt || new Date().toISOString()}
          editorInsertRef={editorInsertRef}
          publishedUrl={editEvent?.pubkey && editEvent.kind
            ? canonicalUrl(articleUrl(canonicalNaddr({
                kind: editEvent.kind,
                pubkey: editEvent.pubkey,
                identifier: getTagValue(editEvent, 'd') || ''
              })))
            : null}
          onApplyIdea={(idea: AssistantIdea) => {
            if (idea.title) setTitle(idea.title);
            if (idea.keyword && !tags.includes(idea.keyword)) {
              setTags([...tags, idea.keyword]);
            }
          }}
          onApplyFacts={(facts) => {
            setResearchFacts(facts);
            toast({ title: 'FAKTEN übernommen', description: 'Landen beim Generieren klar markiert im Autor-Input.' });
          }}
          onApplyExperiences={(experiences) => {
            setExperienceNotes(experiences);
            toast({ title: 'ERLEBNISSE übernommen', description: 'Landen beim Generieren klar markiert im Autor-Input.' });
          }}
          onAppendMarkdown={(markdown) => {
            setContent(prev => prev ? `${prev}\n${markdown}` : markdown);
          }}
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
            onImageMetaChange={(url, meta) => setImageMetaMap(prev => ({ ...prev, [url]: meta }))}
            insertMarkdownRef={editorInsertRef}
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
              <SelectItem value="reisen">🗺️ Reisen</SelectItem>
              <SelectItem value="technik">🔧 Technik</SelectItem>
              <SelectItem value="leben">🏠 Leben</SelectItem>
              <SelectItem value="diy">🛠️ DIY & Ausbau</SelectItem>
              <SelectItem value="strand-ort">🏖️ Strand/Ort</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
                {RV_LIFE_TAG_OPTIONS.map(rvCat => (
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

        {/* Strand/Ort-spezifische Tags */}
        {isStrandOrtCategory && (
          <div className="space-y-3">
            <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4">
              <p className="text-sm text-cyan-700 dark:text-cyan-300 mb-3">
                🏖️ Dieser Artikel erscheint im Strand/Ort Bereich. Wähle spezifische Kategorien:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {STRAND_ORT_TAG_OPTIONS.map(soCat => (
                  <Badge
                    key={soCat.id}
                    variant={displayTags.includes(soCat.id) ? "default" : "outline"}
                    className="cursor-pointer justify-start p-2"
                    onClick={() => {
                      // Toggle Strand/Ort Kategorie-Tag
                      setTags(prev =>
                        prev.includes(soCat.id)
                          ? prev.filter(t => t !== soCat.id)
                          : [...prev, soCat.id]
                      );
                    }}
                  >
                    <span className="mr-2">{soCat.emoji}</span>
                    {soCat.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* KI-Artikel generieren (Optional) */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-ocean-500" />
            <h3 className="font-semibold">KI-Artikel generieren (Optional)</h3>
          </div>

          {/* Lifestyle Auswahl */}
          <div className="space-y-2">
            <Label>Lifestyle</Label>
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
          <div className="mt-4 space-y-2">
            <ModelSelect
              value={selectedModel}
              onChange={setSelectedModel}
            />
            <p className="text-xs text-muted-foreground">
              Stufen sind zentral in src/config/ai-models.js konfigurierbar.
            </p>
          </div>

          {/* Info-i: Was ruft den Text auf? (Ehrlichkeits-Gate sichtbar machen) */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowGenerationInfo(v => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Was fließt in die Text-Generierung ein?"
            >
              <Info className="h-3.5 w-3.5" />
              Was fließt in den Text ein?
            </button>
            {showGenerationInfo && (
              <div className="mt-2 rounded-md border bg-muted/40 p-3 space-y-1.5 text-xs text-muted-foreground">
                <p>
                  <strong className="text-foreground">FAKTEN</strong> (Recherche-Block im Assistenten):
                  Belegbares mit Quellen — Zahlen fließen NUR von hier ein.
                </p>
                <p>
                  <strong className="text-foreground">ERLEBNISSE</strong> (Erlebnis-Notizen + Momente aus der Brand DNA):
                  Was du wirklich erlebt hast — macht den Artikel authentisch.
                </p>
                <p>
                  <strong className="text-foreground">Editor-Text</strong>: Deine Roh-Skizze oder Stimmung —
                  ein fertiger Artikel ist NICHT nötig.
                </p>
                <p>
                  <strong className="text-foreground">Bilder</strong> (Titelbild + Editor): werden analysiert;
                  EXIF liefert GPS und Aufnahme-Zeit → echtes Wetter als Kontext.
                </p>
                <p>
                  Die KI schreibt daraus im MojoBus-Stil (1. Person, atmosphärisch) und
                  erfindet nichts — fehlende Fakten bleiben einfach weg (Ehrlichkeits-Gate).
                  Ort, Datum, Perspektive, Art der Reise und Länge steuern Tonalität und Umfang.
                </p>
              </div>
            )}
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

        {/* Assistent: SEO-Veröffentlichungs-Panel + Entwürfe */}
        <SeoPublishPanel
          title={title}
          articleText={content}
          summary={summary}
          seoTitle={seoTitle}
          onSeoTitleChange={setSeoTitle}
          metaDescription={seoMetaDescription}
          onMetaDescriptionChange={setSeoMetaDescription}
          slug={seoSlug}
          onSlugChange={setSeoSlug}
          experiencesConfirmed={experiencesConfirmed}
          onExperiencesConfirmedChange={setExperiencesConfirmed}
        />
        <DraftsOverview
          draftPayload={draftPayload}
          activeDraftId={currentDraftId}
          activeDraftStatus={currentDraftStatus}
          onDraftSaved={(id) => {
            setCurrentDraftId(id || null);
            setCurrentDraftStatus(id ? (currentDraftStatus || 'draft') : null);
          }}
          onDraftLoaded={loadDraftIntoForm}
        />

        <Button
          onClick={handleSubmit}
          className="w-full"
          disabled={!title.trim() || !content.trim() || isPublishingTeaser || !experiencesConfirmed}
        >
          <FileText className="h-4 w-4 mr-2" />
          {isPublishingTeaser ? 'Wird veröffentlicht...' : (editEvent ? 'Bericht aktualisieren' : 'Bericht veröffentlichen')}
        </Button>

        {/* Assistent: Media-Library-Dialog (Titelbild wählen / Bild in Editor einfügen) */}
        <Dialog open={showMediaLibrary} onOpenChange={setShowMediaLibrary}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Media-Library</DialogTitle>
              <DialogDescription>
                Bild aus der eigenen Library wählen — „Übernehmen" setzt es als Titelbild,
                „In Editor einfügen" fügt es als Markdown-Bild ein.
              </DialogDescription>
            </DialogHeader>
            <MediaLibraryPanel
              onApplyAsTitle={(url) => {
                setImage(url);
                setShowMediaLibrary(false);
              }}
              onInsertIntoEditor={(url, alt) => {
                const markdown = `![${alt || 'Bild'}](${url})`;
                if (editorInsertRef.current) {
                  editorInsertRef.current(markdown);
                } else {
                  setContent(prev => prev ? `${prev}\n${markdown}` : markdown);
                  toast({ title: 'Hinweis', description: 'Bild am Ende des Editors angehängt.' });
                }
                setShowMediaLibrary(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
