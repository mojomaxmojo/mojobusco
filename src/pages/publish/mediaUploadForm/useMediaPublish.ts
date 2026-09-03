/**
 * useMediaPublish.ts
 *
 * Publish-Flow des Medien-Formulars (Blossom-Upload → Nostr-Publish →
 * Tracking/Pipeline → Formular-Reset → Route navigate('/bilder')) — 1:1 aus
 * MediaUploadForm.tsx verschoben (PLAN3.md Schritt 8, ehem. Z. 672–912).
 * Reines Verschieben, keine Logik-Änderungen.
 */

import { useNavigate } from "react-router-dom";
import { canonicalUrl, imageUrl } from "@/lib/canonicalUrl";
import { nip19 } from "nostr-tools";
import { notifyPublishedPipeline } from "@/lib/publishNotify";
import { useToast } from "@/hooks/useToast";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useContinuityTracking } from "@/hooks/useContinuityTracking";
import { getCountryTag } from "@/components/CountrySelector";
import { countryList, mojobusTag } from "./mediaUploadFormConfig";
import type { Dispatch, SetStateAction } from "react";
import type { MediaFile, UploadProgress } from "../publishUtils";

export function useMediaPublish({ files, title, description, customTags,
  selectedSubTags, detailedTags, selectedCountry, mainCategory, location, date,
  setFiles, setTitle, setDescription, setMainCategory, setSelectedSubTags,
  setDetailedTags, setCustomTags, setLocation, setSelectedCountry, setDate,
  setIsUploading, setUploadProgress,
}: {
  // Werte
  files: MediaFile[];
  title: string;
  description: string;
  customTags: string;
  selectedSubTags: string[];
  detailedTags: string[];
  selectedCountry: string;
  mainCategory: string;
  location: string;
  date: string;
  // Setter
  setFiles: Dispatch<SetStateAction<MediaFile[]>>;
  setTitle: Dispatch<SetStateAction<string>>;
  setDescription: Dispatch<SetStateAction<string>>;
  setMainCategory: Dispatch<SetStateAction<string>>;
  setSelectedSubTags: Dispatch<SetStateAction<string[]>>;
  setDetailedTags: Dispatch<SetStateAction<string[]>>;
  setCustomTags: Dispatch<SetStateAction<string>>;
  setLocation: Dispatch<SetStateAction<string>>;
  setSelectedCountry: Dispatch<SetStateAction<string>>;
  setDate: Dispatch<SetStateAction<string>>;
  setIsUploading: Dispatch<SetStateAction<boolean>>;
  setUploadProgress: Dispatch<SetStateAction<UploadProgress>>;
}) {
  const { toast } = useToast();
  const { mutateAsync: uploadFile } = useUploadFile();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { trackPublishedPost } = useContinuityTracking();
  const navigate = useNavigate();

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
          url: publishedEvent.id ? canonicalUrl(imageUrl(nip19.noteEncode(publishedEvent.id))) : undefined,
        });

        // Publish-Pipeline sofort triggern (Prerender/Sitemap/Feed + IndexNow)
        if (publishedEvent.id) {
          notifyPublishedPipeline({
            d_tag: publishedEvent.id,
            url: canonicalUrl(imageUrl(nip19.noteEncode(publishedEvent.id))),
          });
        }
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

  return { handleSubmit };
}
