/**
 * useTripPublish.ts – Trip-Publish (kind 30025), Teaser-Note (kind 1),
 * Auto-Übersetzung DE→EN, Kontinuitäts-Tracking, Reset + Redirect
 * aus TripPublishForm.tsx (1:1 verschoben, PLAN6 Schritt 22).
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildWaypointTags, buildImageTags, calculateTotalDistance, buildTripContent, buildTripTags } from '@/lib/trip/tripPublishBuilder'
import { canonicalUrl, tripUrl, canonicalNaddr } from '@/lib/canonicalUrl'
import { createLongformTeaser } from '@/lib/createLongformTeaser'
import { notifyPublishedPipeline } from '@/lib/publishNotify'
import { AUTO_TRANSLATE_STORAGE_KEY } from '@/config/translation'
import { useToast } from '@/hooks/useToast'
import { useNostrPublish } from '@/hooks/useNostrPublish'
import { useContinuityTracking } from '@/hooks/useContinuityTracking'
import { useAutoTranslate } from '@/hooks/useAutoTranslate'
import type { TripStation, TripData } from '@/lib/trip/tripTypes'

export function useTripPublish({
  stations,
  setStations,
  tripData,
  setTripData,
  editDtag,
  setEditDtag,
  isEditMode,
  slideshowVideoUrl,
  setSlideshowVideoUrl,
  gender,
  user,
  setCurrentStep,
  uploadImages,
}: {
  stations: TripStation[]
  setStations: React.Dispatch<React.SetStateAction<TripStation[]>>
  tripData: TripData
  setTripData: React.Dispatch<React.SetStateAction<TripData>>
  editDtag: string | null
  setEditDtag: (v: string | null) => void
  isEditMode: boolean
  slideshowVideoUrl: string | null
  setSlideshowVideoUrl: (v: string | null) => void
  gender: string
  user: { pubkey?: string } | null
  setCurrentStep: (v: 'upload' | 'details' | 'preview' | 'publish') => void
  uploadImages: () => Promise<TripStation[]>
}) {
  const { toast } = useToast();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { trackPublishedPost } = useContinuityTracking();
  const { translateAndPublish } = useAutoTranslate();
  const navigate = useNavigate();

  // Publish trip
  // Teaser-Note State
  const [publishTeaserNote, setPublishTeaserNote] = useState(true);

  // Auto-Übersetzung (DE→EN) State
  const [autoTranslateEn, setAutoTranslateEn] = useState(() => {
    const stored = localStorage.getItem(AUTO_TRANSLATE_STORAGE_KEY);
    return stored === null ? true : stored !== 'false';
  });

  const handlePublish = async () => {
    // First upload all images and get updated stations
    const uploadedStations = await uploadImages();

    if (uploadedStations.length === 0) {
      console.error('[Trip Publish] No stations uploaded');
      return;
    }

    // Check for GPS stations
    const gpsStations = uploadedStations.filter(s => s.gps && s.uploadedUrl);
    if (gpsStations.length < 2) {
      toast({
        title: 'Nicht genug GPS-Daten',
        description: 'Mindestens 2 Stationen mit GPS erforderlich.',
        variant: 'destructive'
      });
      return;
    }

    // Create trip event (Kind 30025 - compatible with mojotravel)
    // Use existing d-tag for updates, or create new one
    const dTag = editDtag || `trip-${Date.now()}`;

    console.log('[Trip Publish] Publishing with', uploadedStations.length, 'stations');
    console.log('[Trip Publish] GPS stations:', gpsStations.length);
    console.log('[Trip Publish] Mode:', isEditMode ? 'UPDATE' : 'CREATE');
    console.log('[Trip Publish] d-tag:', dTag);

    const waypointTags = buildWaypointTags(gpsStations);

    const imageTags = buildImageTags(uploadedStations);

    const totalDistance = calculateTotalDistance(gpsStations);

    const content = buildTripContent(uploadedStations, tripData);

    console.log('[Trip Publish] Waypoint tags:', waypointTags.length);
    console.log('[Trip Publish] Image tags:', imageTags.length);

    const tags = buildTripTags(dTag, tripData, waypointTags, imageTags, totalDistance, slideshowVideoUrl);

    // Publish
    setIsPublishing(true);

    const doPublish = async (retryCount = 0): Promise<boolean> => {
      try {
        await publishEvent({
          kind: 30025, // Trip events (Kind 30025 - Parameterized Replaceable)
          content,
          tags,
        });

        toast({
          title: isEditMode ? 'Trip aktualisiert!' : 'Trip veröffentlicht!',
          description: isEditMode
            ? 'Dein Trip wurde erfolgreich aktualisiert.'
            : 'Dein Trip wurde erfolgreich veröffentlicht.',
        });

        // Kontinuitäts-Tracking: Motive/Entitäten/Stimmung/offene Fäden erfassen
        // (nur der erste/Hauptort, Wegpunkt 1)
        trackPublishedPost({
          id: dTag,
          type: 'trip',
          kind: 30025,
          title: tripData.title,
          location: gpsStations[0]?.location || gpsStations[0]?.title || '',
          country: tripData.country,
          content,
          url: user?.pubkey
            ? canonicalUrl(tripUrl(canonicalNaddr({ kind: 30025, pubkey: user.pubkey, identifier: dTag })))
            : undefined,
        });

        // Publish-Pipeline sofort triggern (Prerender/Sitemap/Feed + IndexNow)
        if (user?.pubkey) {
          notifyPublishedPipeline({
            d_tag: dTag,
            url: canonicalUrl(tripUrl(canonicalNaddr({ kind: 30025, pubkey: user.pubkey, identifier: dTag }))),
          });
        }

        // Auto-Übersetzung (DE→EN): EN-Version im Hintergrund veröffentlichen
        if (autoTranslateEn && user?.pubkey) {
          translateAndPublish({
            type: 'trip', kind: 30025, originalDTag: dTag,
            pubkey: user.pubkey, title: tripData.title, summary: tripData.summary,
            content, baseTags: tags, publishTeaser: publishTeaserNote,
          });
        }

        return true;
      } catch (error: any) {
        console.error('[Trip Publish] Error:', error);

        // Retry up to 3 times
        if (retryCount < 3) {
          console.log(`[Trip Publish] Retrying... (${retryCount + 1}/3)`);
          toast({
            title: 'Veröffentlichung wird erneut versucht...',
            description: `Versuch ${retryCount + 1} von 3`,
          });
          await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
          return doPublish(retryCount + 1);
        }

        toast({
          title: 'Fehler beim Veröffentlichen',
          description: `Der Trip konnte nicht veröffentlicht werden: ${error?.message || 'Unbekannter Fehler'}. Bitte versuche es später erneut.`,
          variant: 'destructive',
        });
        return false;
      }
    };

    const success = await doPublish();
    setIsPublishing(false);

    if (!success) return;

    // Teaser-Note (Kind 1) automatisch posten
    if (publishTeaserNote && user?.pubkey) {
      const teaserLoggerPrefix = '[Trip Teaser]';
      try {
        const firstStation = uploadedStations.find(s => s.uploadedUrl);
        const firstImageUrl = firstStation?.uploadedUrl;
        const teaserSummary = tripData.summary.trim().slice(0, 120) + (tripData.summary.trim().length > 120 ? '…' : '');

        const tripTeaserTags = [
          'trip',
          'reisen',
          ...(tripData.tripType ? [tripData.tripType] : []),
        ];

        console.log(`${teaserLoggerPrefix} Erstelle Teaser...`, {
          title: tripData.title.trim(),
          summaryLength: teaserSummary.length,
          imageUrl: firstImageUrl,
          videoUrl: slideshowVideoUrl,
          tags: tripTeaserTags,
          country: tripData.country
        });

        const teaser = createLongformTeaser({
          type: 'trip',
          title: tripData.title.trim() || 'Trip',
          body: tripData.summary.trim(),
          summary: teaserSummary,
          pubkey: user.pubkey,
          dTag,
          kind: 30025,
          imageUrl: firstImageUrl,
          videoUrl: slideshowVideoUrl,
          tags: tripTeaserTags,
          country: tripData.country,
        });

        console.log(`${teaserLoggerPrefix} Teaser erstellt:`, {
          contentLength: teaser.content.length,
          tagCount: teaser.tags.length,
          tags: teaser.tags,
          naddr: teaser.naddr
        });

        const publishResult = await publishEvent({
          kind: 1,
          content: teaser.content,
          tags: teaser.tags,
        });

        console.log(`${teaserLoggerPrefix} publishEvent result:`, publishResult);

        toast({
          title: '✅ Teaser-Note veröffentlicht!',
          description: 'Erscheint im Nostr-Feed bei Primal, Amethyst & Damus',
        });
      } catch (teaserErr: any) {
        const errorMessage = teaserErr?.message || 'Unbekannter Fehler';
        const errorStack = teaserErr?.stack || '';
        console.error(`${teaserLoggerPrefix} Teaser-Post fehlgeschlagen:`, teaserErr);
        console.error(`${teaserLoggerPrefix} Details:`, {
          message: errorMessage,
          stack: errorStack,
          fullError: JSON.stringify(teaserErr, Object.getOwnPropertyNames(teaserErr))
        });

        toast({
          title: '⚠️ Trip gespeichert',
          description: `Teaser-Note konnte nicht gepostet werden: ${errorMessage}`,
          variant: 'destructive',
        });
      }
    }

    // Reset + Redirect
    setStations([]);
    setTripData({ title: '', summary: '', country: '', tripType: '' });
    setEditDtag(null);
    setSlideshowVideoUrl(null);
    setCurrentStep('upload');
    navigate('/map/trips');
  };

  return {
    isPublishing,
    setIsPublishing,
    publishTeaserNote,
    setPublishTeaserNote,
    autoTranslateEn,
    setAutoTranslateEn,
    handlePublish,
  }
}