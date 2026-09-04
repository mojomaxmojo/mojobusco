/**
 * useNotePublish.ts — Veröffentlichen + Weiterleitung des Note-Formulars
 * (Validierung, Tag-Aufbau inkl. Land/Bilder/GPS-Tags, Nostr-Event,
 * Kontinuitäts-Tracking, Pipeline-Benachrichtigung, Auto-Übersetzung EN,
 * Formular-Reset, navigate('/notes')) — 1:1 aus NoteForm.tsx verschoben
 * (PLAN5.md Schritt 8). Reines Verschieben, keine Logik-Änderungen.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/useToast";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useAutoTranslate } from "@/hooks/useAutoTranslate";
import { useContinuityTracking } from "@/hooks/useContinuityTracking";
import { createRequiredTags } from '@/config/contentCategories';
import { getCountryTag } from '@/components/CountrySelector';
import { nip19 } from "nostr-tools";
import { canonicalUrl, noteUrl } from "@/lib/canonicalUrl";
import { notifyPublishedPipeline } from "@/lib/publishNotify";
import type { NostrEvent } from "@nostrify/nostrify";
import { NOTE_COUNTRY_TAGS } from './noteFormConstants';
import type { GpsData, GpsStatus } from '@/lib/gpsExtraction';
import type { Dispatch, SetStateAction } from "react";

interface UseNotePublishParams {
  content: string;
  tags: string[];
  imageFiles: File[];
  imageUrls: string[];
  imageGpsData: Record<number, GpsData>;
  imageGpsStatuses: Record<number, GpsStatus>;
  location: string;
  selectedCountry: string;
  autoTranslateEn: boolean;
  setContent: Dispatch<SetStateAction<string>>;
  setTags: Dispatch<SetStateAction<string[]>>;
  setLocation: Dispatch<SetStateAction<string>>;
  setSelectedCountry: Dispatch<SetStateAction<string>>;
  setImageFiles: Dispatch<SetStateAction<File[]>>;
  setImageUrls: Dispatch<SetStateAction<string[]>>;
  setImageGpsData: Dispatch<SetStateAction<Record<number, GpsData>>>;
  setImageGpsStatuses: Dispatch<SetStateAction<Record<number, GpsStatus>>>;
}

export function useNotePublish({
  content, tags, imageFiles, imageUrls, imageGpsData, imageGpsStatuses,
  location, selectedCountry, autoTranslateEn,
  setContent, setTags, setLocation, setSelectedCountry,
  setImageFiles, setImageUrls, setImageGpsData, setImageGpsStatuses,
}: UseNotePublishParams) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState({ stage: '', status: '' });

  const { toast } = useToast();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { translateAndPublish } = useAutoTranslate();
  const navigate = useNavigate();
  const { trackPublishedPost } = useContinuityTracking();

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
    const countryList = NOTE_COUNTRY_TAGS;
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

  return { handleSubmit, isPublishing, publishProgress };
}
