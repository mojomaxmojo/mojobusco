/**
 * usePlacePublish.ts
 *
 * Publish-Flow des Ort-Formulars — 1:1 aus PlaceForm.tsx verschoben
 * (PLAN4.md Schritt 8). Reines Verschieben, keine Logik-Änderungen.
 *
 * Enthält: handleSubmit (inkl. Route navigate('/plaetze')).
 */

import { createRequiredTags } from "@/config/contentCategories";
import { getCountryTag } from "@/components/CountrySelector";
import { buildSmartSlug } from "@/config/assistant";
import { createLongformTeaser } from "@/lib/createLongformTeaser";
import { getTagValue } from "@/lib/nostrEventUtils";
import { getErrorMessage } from "@/lib/utils";
import type { GpsData, GpsStatus } from "@/lib/gpsExtraction";
import type { NostrEvent } from "@nostrify/nostrify";
import { placeUrl, canonicalUrl, canonicalNaddr } from "@/lib/canonicalUrl";
import { notifyPublishedPipeline } from "@/lib/publishNotify";
import type { useToast } from "@/hooks/useToast";
import type { useNostrPublish } from "@/hooks/useNostrPublish";
import type { useAutoTranslate } from "@/hooks/useAutoTranslate";
import type { useContinuityTracking } from "@/hooks/useContinuityTracking";
import type { useCurrentUser } from "@/hooks/useCurrentUser";

type ToastFn = ReturnType<typeof useToast>['toast'];
type PublishEventFn = ReturnType<typeof useNostrPublish>['mutateAsync'];
type TranslateAndPublishFn = ReturnType<typeof useAutoTranslate>['translateAndPublish'];
type TrackPublishedPostFn = ReturnType<typeof useContinuityTracking>['trackPublishedPost'];
type CurrentUser = ReturnType<typeof useCurrentUser>['user'];

interface UsePlacePublishParams {
  // Werte
  name: string;
  description: string;
  location: string;
  coordinates: { lat: string; lng: string };
  category: string;
  rating: number;
  facilities: string[];
  bestFor: string[];
  price: string;
  visitDate: string;
  image: string;
  additionalImages: string[];
  manualTags: string[];
  selectedCountry: string;
  seoTitle: string;
  seoMetaDescription: string;
  seoSlug: string;
  publishTeaserNote: boolean;
  autoTranslateEn: boolean;
  imageGps: GpsData | null;
  imageGpsStatus: GpsStatus;
  editEvent?: NostrEvent;
  // Helfer
  toast: ToastFn;
  publishEvent: PublishEventFn;
  currentUser: CurrentUser;
  translateAndPublish: TranslateAndPublishFn;
  trackPublishedPost: TrackPublishedPostFn;
  // Route (navigate aus useNavigate in PlaceForm)
  navigate: (path: string) => void;
  // Reset-Setter fürs Formular-Clearing
  setName: (v: string) => void;
  setDescription: (v: string) => void;
  setLocation: (v: string) => void;
  setCoordinates: (v: { lat: string; lng: string }) => void;
  setCategory: (v: string) => void;
  setRating: (v: number) => void;
  setFacilities: (v: string[]) => void;
  setBestFor: (v: string[]) => void;
  setPrice: (v: string) => void;
  setVisitDate: (v: string) => void;
  setImageFile: (v: File | null) => void;
  setImageGps: (v: GpsData | null) => void;
  setImageGpsStatus: (v: GpsStatus) => void;
  setEditingImageGps: (v: boolean) => void;
  setImageMetaMap: (v: Record<string, { alt?: string; caption?: string; note?: string }>) => void;
  setIsPublishingTeaser: (v: boolean) => void;
}

export function usePlacePublish({
  name,
  description,
  location,
  coordinates,
  category,
  rating,
  facilities,
  bestFor,
  price,
  visitDate,
  image,
  additionalImages,
  manualTags,
  selectedCountry,
  seoTitle,
  seoMetaDescription,
  seoSlug,
  publishTeaserNote,
  autoTranslateEn,
  imageGps,
  imageGpsStatus,
  editEvent,
  toast,
  publishEvent,
  currentUser,
  translateAndPublish,
  trackPublishedPost,
  navigate,
  setName,
  setDescription,
  setLocation,
  setCoordinates,
  setCategory,
  setRating,
  setFacilities,
  setBestFor,
  setPrice,
  setVisitDate,
  setImageFile,
  setImageGps,
  setImageGpsStatus,
  setEditingImageGps,
  setImageMetaMap,
  setIsPublishingTeaser,
}: UsePlacePublishParams) {
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
    const originalDTag = getTagValue(editEvent, 'd');
    const dTag = originalDTag || `place-${Date.now()}`;

    // published_at / visit_date: Beim Edit ORIGINALES Datum behalten, bei Neuem visitDate oder heute
    const existingPublishedAt = getTagValue(editEvent, 'published_at');
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
          } catch (teaserErr) {
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
      } catch (err) {
        toast({
          title: 'Fehler',
          description: getErrorMessage(err) || 'Ort konnte nicht gespeichert werden.',
          variant: 'destructive',
        });
      }
    };

    handlePublishPlace();
  };

  return { handleSubmit };
}
