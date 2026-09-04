/**
 * usePlaceAiDescription.ts — KI-Beschreibungs-Generierung des Ort-Formulars —
 * 1:1 aus PlaceForm.tsx verschoben (PLAN4.md Schritt 7). Reines Verschieben,
 * keine Logik-Änderungen.
 */

import { getApiBaseUrl } from "@/lib/apiBase";
import { resolveBildPlaceholders } from "../publishUtils";
import { extractPlaceImageUrls } from "./placeFormUtils";
import type { useToast } from "@/hooks/useToast";
import type { TripType } from "@/config/tags";
import type { TextModelTier } from "@/components/ModelSelect";
import type { Dispatch, SetStateAction } from "react";

type ToastFn = ReturnType<typeof useToast>['toast'];

interface UsePlaceAiDescriptionParams {
  // Werte
  name: string;
  description: string;
  imageFile: File | null;
  additionalImages: string[];
  location: string;
  coordinates: { lat: string; lng: string };
  visitDate: string;
  lifestyle: string;
  selectedModel: TextModelTier;
  category: string;
  facilities: string[];
  bestFor: string[];
  selectedCountry: string;
  gender: string;
  rating: number;
  price: string;
  tripType: TripType | '';
  imageMetaMap: Record<string, { alt?: string; caption?: string; note?: string }>;
  manualTags: string[];
  // Helfer + Setter
  toast: ToastFn;
  setDescription: (v: string) => void;
  setManualTags: Dispatch<SetStateAction<string[]>>;
  setIsGeneratingDescription: Dispatch<SetStateAction<boolean>>;
}

export function usePlaceAiDescription({
  name,
  description,
  imageFile,
  additionalImages,
  location,
  coordinates,
  visitDate,
  lifestyle,
  selectedModel,
  category,
  facilities,
  bestFor,
  selectedCountry,
  gender,
  rating,
  price,
  tripType,
  imageMetaMap,
  manualTags,
  toast,
  setDescription,
  setManualTags,
  setIsGeneratingDescription,
}: UsePlaceAiDescriptionParams) {
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
        // Wetter-Kontext: Besuchsdatum (Server-Fallback: heute)
        if (visitDate) formData.append('publishedAt', visitDate);
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
         // Bild-Metadaten pro Bild-URL (Alt-Text/Caption/Freitext) parallel mitschicken
         const markdownImageMeta = markdownImageUrls.map(u => imageMetaMap[u] || {});
         formData.append('markdownImageMeta', JSON.stringify(markdownImageMeta));
       }

       const response = await fetch(`${getApiBaseUrl()}/api/generate-place`, {
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

  return { generatePlaceWithAI };
}
