/**
 * useArticlePublish.ts
 *
 * Publish-Flow des Berichte-Formulars — 1:1 aus ArticleForm.tsx verschoben
 * (PLAN.md Schritt 8). Reines Verschieben, keine Logik-Änderungen.
 *
 * Enthält: loadDraftIntoForm · draftPayload · notifyAssistantPublished ·
 * handleSubmit (inkl. Route navigate('/artikel')).
 */

import { createRequiredTags } from "@/config/contentCategories";
import { getCountryTag } from "@/components/CountrySelector";
import { createLongformTeaser } from "@/lib/createLongformTeaser";
import { getTagValue } from "@/lib/nostrEventUtils";
import type { GpsData, GpsStatus } from "@/lib/gpsExtraction";
import type { NostrEvent } from "@nostrify/nostrify";
import { canonicalUrl, articleUrl, canonicalNaddr } from "@/lib/canonicalUrl";
import { buildAuthorInput, buildSmartSlug } from "@/config/assistant";
import { nip19 } from "nostr-tools";
import { AUTOSAVE_KEY } from "./articleFormConfig";
import { COUNTRY_TAG_LIST } from "./articleFormConfig";
import type { TripType } from "@/config/tags";
import type { AssistantDraftArticle } from "@/components/assistant/DraftsOverview";
import { splitAuthorInput } from "./articleFormUtils";
import type { useToast } from "@/hooks/useToast";
import type { useNostrPublish } from "@/hooks/useNostrPublish";
import type { useAssistantApi } from "@/components/assistant/useAssistantApi";
import type { useAutoTranslate } from "@/hooks/useAutoTranslate";
import type { useContinuityTracking } from "@/hooks/useContinuityTracking";
import type { useCurrentUser } from "@/hooks/useCurrentUser";

type ToastFn = ReturnType<typeof useToast>['toast'];
type PublishEventFn = ReturnType<typeof useNostrPublish>['mutateAsync'];
type AssistantRequestFn = ReturnType<typeof useAssistantApi>['request'];
type TranslateAndPublishFn = ReturnType<typeof useAutoTranslate>['translateAndPublish'];
type TrackPublishedPostFn = ReturnType<typeof useContinuityTracking>['trackPublishedPost'];
type CurrentUser = ReturnType<typeof useCurrentUser>['user'];

interface UseArticlePublishParams {
  // Werte
  title: string;
  summary: string;
  content: string;
  image: string;
  imageFile: File | null;
  imageGps: GpsData | null;
  imageGpsStatus: GpsStatus;
  imageCapturedAt: Date | null;
  category: string;
  location: string;
  selectedCountry: string;
  publishedAt: string;
  seoTitle: string;
  seoMetaDescription: string;
  seoSlug: string;
  experiencesConfirmed: boolean;
  publishTeaserNote: boolean;
  autoTranslateEn: boolean;
  displayTags: string[];
  lifestyle: string;
  articleLength: 'short' | 'medium' | 'long';
  tripType: TripType | '';
  tags: string[];
  researchFacts: string;
  experienceNotes: string;
  generatedVideoUrl: string | null;
  slideshowVideoUrl: string | null;
  currentDraftId: string | null;
  currentDraftStatus: 'draft' | 'published' | null;
  editEvent?: NostrEvent;
  // Helfer
  toast: ToastFn;
  publishEvent: PublishEventFn;
  currentUser: CurrentUser;
  assistantRequest: AssistantRequestFn;
  translateAndPublish: TranslateAndPublishFn;
  trackPublishedPost: TrackPublishedPostFn;
  // Reset-Setter fürs Formular-Clearing
  setTitle: (v: string) => void;
  setSummary: (v: string) => void;
  setContent: (v: string) => void;
  setImage: (v: string) => void;
  setCategory: (v: string) => void;
  setTags: (v: string[]) => void;
  setLocation: (v: string) => void;
  setSelectedCountry: (v: string) => void;
  setPublishedAt: (v: string) => void;
  setSeoTitle: (v: string) => void;
  setSeoMetaDescription: (v: string) => void;
  setSeoSlug: (v: string) => void;
  setImageFile: (v: File | null) => void;
  setImageGps: (v: GpsData | null) => void;
  setImageCapturedAt: (v: Date | null) => void;
  setImageGpsStatus: (v: GpsStatus) => void;
  setEditingImageGps: (v: boolean) => void;
  setImageMetaMap: (v: Record<string, { alt?: string; caption?: string; note?: string }>) => void;
  // für loadDraftIntoForm (vom Plan nicht gelistet, technisch nötig)
  setArticleLength: (v: 'short' | 'medium' | 'long') => void;
  setTripType: (v: TripType) => void;
  setLifestyle: (v: string) => void;
  setResearchFacts: (v: string) => void;
  setExperienceNotes: (v: string) => void;
  // Teaser-Publish-Indikator (State bleibt in ArticleForm, Setter wird weitergereicht)
  setIsPublishingTeaser: (v: boolean) => void;
  // Route (navigate aus useNavigate in ArticleForm)
  navigate: (path: string) => void;
  // Entwurf
  setCurrentDraftId: (v: string | null) => void;
  setCurrentDraftStatus: (v: 'draft' | 'published' | null) => void;
}

export function useArticlePublish({
  title,
  summary,
  content,
  image,
  imageFile,
  imageGps,
  imageGpsStatus,
  imageCapturedAt,
  category,
  location,
  selectedCountry,
  publishedAt,
  seoTitle,
  seoMetaDescription,
  seoSlug,
  experiencesConfirmed,
  publishTeaserNote,
  autoTranslateEn,
  displayTags,
  lifestyle,
  articleLength,
  tripType,
  tags,
  researchFacts,
  experienceNotes,
  generatedVideoUrl,
  slideshowVideoUrl,
  currentDraftId,
  currentDraftStatus,
  editEvent,
  toast,
  publishEvent,
  currentUser,
  assistantRequest,
  translateAndPublish,
  trackPublishedPost,
  setTitle,
  setSummary,
  setContent,
  setImage,
  setCategory,
  setTags,
  setLocation,
  setSelectedCountry,
  setPublishedAt,
  setSeoTitle,
  setSeoMetaDescription,
  setSeoSlug,
  setImageFile,
  setImageGps,
  setImageCapturedAt,
  setImageGpsStatus,
  setEditingImageGps,
  setImageMetaMap,
  setArticleLength,
  setTripType,
  setLifestyle,
  setResearchFacts,
  setExperienceNotes,
  setIsPublishingTeaser,
  navigate,
  setCurrentDraftId,
  setCurrentDraftStatus,
}: UseArticlePublishParams) {

  // Assistent: Entwurf komplett ins Formular laden
  const loadDraftIntoForm = (article: AssistantDraftArticle) => {
    setCurrentDraftId(article.id);
    setCurrentDraftStatus(article.status || 'draft');
    setTitle(article.title || '');
    setSummary(article.summary || '');
    setContent(article.content || '');
    setImage(article.image_url || '');
    setCategory(article.category || '');
    setLocation(article.location || '');
    setSelectedCountry(article.country || '');
    setTags(Array.isArray(article.tags) ? article.tags : []);
    if (article.article_length === 'short' || article.article_length === 'medium' || article.article_length === 'long') {
      setArticleLength(article.article_length);
    }
    if (article.trip_type) setTripType(article.trip_type as TripType);
    if (article.lifestyle) setLifestyle(article.lifestyle as typeof lifestyle);
    setSeoTitle(article.seo_title || '');
    setSeoMetaDescription(article.meta_description || '');
    setSeoSlug(article.slug || '');
    const { facts, experiences } = splitAuthorInput(article.author_input || '');
    setResearchFacts(facts);
    setExperienceNotes(experiences);
  };

  // Assistent: Payload für „Als Entwurf speichern"
  const draftPayload = {
    title: title.trim(),
    summary: summary.trim(),
    content,
    author_input: buildAuthorInput({ facts: researchFacts, experiences: experienceNotes, editorText: '' }),
    seo_title: seoTitle.trim(),
    meta_description: seoMetaDescription.trim(),
    slug: (seoSlug.trim() || buildSmartSlug(title)).trim(),
    location: location.trim(),
    country: selectedCountry,
    category,
    tags,
    article_length: articleLength,
    trip_type: tripType || '',
    lifestyle,
    image_url: image
  };

  // Assistent: Publish-Meldung (non-blocking) → PUT Status published (bei geladenem
  // Entwurf) + POST /published (markiert published, triggert Pipeline + IndexNow).
  // Fehler blockieren den Publish nie (console.warn, Muster wie useContinuityTracking).
  const notifyAssistantPublished = (finalDTag: string) => {
    try {
      const pubkeyForNaddr = editEvent?.pubkey || currentUser?.pubkey;
      if (!pubkeyForNaddr) {
        console.warn('[Article] Kein Pubkey — Assistent-Publish-Meldung übersprungen');
        return;
      }
      const naddr = nip19.naddrEncode({ kind: 30023, pubkey: pubkeyForNaddr, identifier: finalDTag });
      const url = canonicalUrl(articleUrl(naddr));

      void (async () => {
        try {
          if (currentDraftId) {
            await assistantRequest(`/api/assistant/article/${currentDraftId}`, {
              method: 'PUT',
              body: JSON.stringify({ status: 'published' })
            }).catch((err: unknown) => {
              console.warn('[Article] PUT article status fehlgeschlagen:', err);
            });
          }
          await assistantRequest('/api/assistant/published', {
            method: 'POST',
            body: JSON.stringify({
              article_id: currentDraftId || undefined,
              d_tag: finalDTag,
              url
            })
          });
        } catch (err) {
          console.warn('[Article] Assistent-Publish-Meldung fehlgeschlagen:', err);
        }
      })();
    } catch (err) {
      console.warn('[Article] Assistent-Publish-Meldung fehlgeschlagen:', err);
    }
  };

  const handleSubmit = async () => {
    // Assistent: Erlebnisse-Pflicht — ohne Bestätigung kein Veröffentlichen
    if (!experiencesConfirmed) {
      toast({
        title: 'Erlebnisse bestätigen',
        description: 'Bitte bestätige „Alle Erlebnisse im Text sind echt", bevor du veröffentlichst.',
        variant: 'destructive'
      });
      return;
    }

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
    const countryList = COUNTRY_TAG_LIST;
    const displayTagsWithoutCountry = displayTags.filter(tag =>
      !countryList.includes(tag.toLowerCase()) &&
      !tag.startsWith('#') &&
      !countryList.includes(tag.replace('#', '').toLowerCase())
    );

    // Create tags from config (mit allen Tags inkl. automatischen!)
    const baseTags = createRequiredTags('articles', displayTagsWithoutCountry);

    // Get the original d-tag for edit, or create new one
    const originalDTag = getTagValue(editEvent, 'd');
    const dTag = originalDTag || `article-${Date.now()}`;

    // published_at: Beim Edit ORIGINALES Datum behalten, bei Neuem aktuelles Datum setzen
    const existingPublishedAt = getTagValue(editEvent, 'published_at');
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

    // SEO-Zusatz-Tags (Assistent) — bestehende Tags unverändert
    if (seoTitle.trim()) additionalTags.push(['seo_title', seoTitle.trim()]);
    const effectiveMetaDescription = seoMetaDescription.trim() || summary.trim();
    if (effectiveMetaDescription) additionalTags.push(['meta_description', effectiveMetaDescription]);
    const effectiveSlug = (seoSlug.trim() || buildSmartSlug(title)).trim();
    if (effectiveSlug) additionalTags.push(['slug', effectiveSlug]);

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

    // Assistent: Pipeline + IndexNow nach JEDEM Bericht-Publish (non-blocking)
    notifyAssistantPublished(dTag);

    // Nr. 13: Autosave leeren — der veröffentlichte Inhalt ist gesichert
    localStorage.removeItem(AUTOSAVE_KEY);

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
      } catch (teaserErr) {
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

    // Kontinuitäts-Tracking: Motive/Entitäten/Stimmung/offene Fäden erfassen
    trackPublishedPost({
      id: dTag,
      type: 'article',
      kind: 30023,
      title: title.trim(),
      location: location.trim(),
      country: selectedCountry,
      publishedAt: publishedAtTimestamp,
      content: content.trim(),
      url: currentUser?.pubkey
        ? canonicalUrl(articleUrl(canonicalNaddr({ kind: 30023, pubkey: currentUser.pubkey, identifier: dTag })))
        : undefined,
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
    setImageCapturedAt(null);
    setImageGpsStatus('not_found');
    setEditingImageGps(false);
    setImageMetaMap({});

    setTimeout(() => {
      navigate('/artikel');
    }, 1000);
  };

  return {
    draftPayload,
    loadDraftIntoForm,
    notifyAssistantPublished,
    handleSubmit,
  };
}