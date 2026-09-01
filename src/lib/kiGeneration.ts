/**
 * KI-Generierung Utility Functions
 *
 * Zentrale Funktionen für alle Tabs:
 * - Medien
 * - Trips
 * - Berichte (article)
 * - Plätze (place)
 * - Note
 *
 * Gender-Support:
 * - 'neutral' → Keine geschlechtsspezifischen Marker
 * - 'male' → Männliche Perspektive (Mojo)
 * - 'female' → Weibliche Perspektive (Susanne)
 */

import { type LifestyleType, type GenderType } from '@/config/prompts/lifestyles';
import { DEFAULT_TEXT_MODEL } from '@/config/ai-models';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Re-export für einfachen Import
export type { GenderType };

export type TextModelTier = 'mini' | 'medium' | 'maxi' | 'test';

interface GenerateOptions {
  lifestyle: LifestyleType;
  model?: TextModelTier;
  title?: string;
  description?: string;
  location?: string;
  text?: string;
  gender?: GenderType;
}

interface GenerateMediaOptions extends GenerateOptions {
  images: File[];
}

interface GenerateTripOptions extends GenerateOptions {
  images: File[];
  locations?: string[];
  startDate?: string;
  endDate?: string;
}

interface GenerateArticleOptions extends GenerateOptions {
  images: File[];
}

interface GeneratePlaceOptions extends GenerateOptions {
  images: File[];
  gps?: {
    latitude: number;
    longitude: number;
  };
}

interface GenerateNoteOptions extends GenerateOptions {
  images: File[];
}

/**
 * Generiert einen Medien-Artikel mit Bildern
 * Tab: "Medien"
 */
export async function generateMediaArticle(options: GenerateMediaOptions): Promise<{
  article: string;
  hashtags: string;
  model: string;
  lifestyle: string;
}> {
  const formData = new FormData();
  
  options.images.forEach((image, index) => {
    formData.append('images', image);
  });
  
  if (options.title) formData.append('title', options.title);
  if (options.description) formData.append('description', options.description);
  if (options.location) formData.append('location', options.location);
  if (options.text) formData.append('text', options.text);
  formData.append('lifestyle', options.lifestyle);
  formData.append('model', options.model || DEFAULT_TEXT_MODEL);
  formData.append('gender', options.gender || 'neutral');

  const response = await fetch(`${API_BASE}/api/generate-media-article`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Fehler bei der Generierung');
  }

  return response.json();
}

export interface TripGenerationResult {
  article: string;
  captions: string[];
}

export interface TripJobStatus {
  jobId: string;
  status: 'queued' | 'analyzing' | 'generating_summary' | 'generating_captions' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  completedImages?: number;
  totalImages?: number;
  completedCaptions?: number;
  totalCaptions?: number;
  result?: TripGenerationResult;
  error?: string;
}

/**
 * Startet die asynchrone Generierung eines Trip-Artikels.
 * Tab: "Trips"
 */
export async function startTripGeneration(options: GenerateTripOptions): Promise<{ jobId: string }> {
  const formData = new FormData();

  options.images.forEach((image) => {
    formData.append('images', image);
  });

  if (options.title) formData.append('title', options.title);
  if (options.description) formData.append('description', options.description);
  if (options.locations) formData.append('locations', JSON.stringify(options.locations));
  if (options.startDate) formData.append('startDate', options.startDate);
  if (options.endDate) formData.append('endDate', options.endDate);
  formData.append('lifestyle', options.lifestyle);
  formData.append('model', options.model || DEFAULT_TEXT_MODEL);
  formData.append('gender', options.gender || 'neutral');

  const response = await fetch(`${API_BASE}/api/generate-trip`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Fehler beim Starten der Generierung');
  }

  return response.json();
}

/**
 * Fragt den aktuellen Status eines Trip-Generierungs-Jobs ab.
 */
export async function getTripGenerationStatus(jobId: string): Promise<TripJobStatus> {
  const response = await fetch(`${API_BASE}/api/generate-trip/${jobId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Fehler beim Abrufen des Status');
  }

  return response.json();
}

/**
 * Bricht einen laufenden Trip-Generierungs-Job ab.
 */
export async function cancelTripGeneration(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/api/generate-trip/${jobId}/cancel`, {
    method: 'POST'
  });
}

/**
 * Generiert einen Trip-Artikel mit Stationen (asynchron mit Polling).
 * Tab: "Trips"
 */
export async function generateTripArticle(options: GenerateTripOptions): Promise<TripGenerationResult> {
  const { jobId } = await startTripGeneration(options);

  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const status = await getTripGenerationStatus(jobId);

        if (status.status === 'completed' && status.result) {
          clearInterval(interval);
          resolve(status.result);
        } else if (status.status === 'failed') {
          clearInterval(interval);
          reject(new Error(status.error || 'Fehler bei der Generierung'));
        } else if (status.status === 'cancelled') {
          clearInterval(interval);
          reject(new Error('Generierung wurde abgebrochen'));
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 2000);
  });
}

/**
 * Generiert einen Bericht/Artikel
 * Tab: "Berichte"
 */
export async function generateArticle(options: GenerateArticleOptions): Promise<{
  article: string;
  hashtags: string;
  lifestyle: string;
}> {
  const formData = new FormData();
  
  options.images.forEach((image, index) => {
    formData.append('images', image);
  });
  
  if (options.title) formData.append('title', options.title);
  if (options.description) formData.append('description', options.description);
  if (options.location) formData.append('location', options.location);
  if (options.text) formData.append('text', options.text);
  formData.append('lifestyle', options.lifestyle);
  formData.append('model', options.model || DEFAULT_TEXT_MODEL);
  formData.append('gender', options.gender || 'neutral');

  const response = await fetch(`${API_BASE}/api/generate-article`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Fehler bei der Generierung');
  }

  return response.json();
}

/**
 * Generiert eine Platz-Beschreibung
 * Tab: "Plätze"
 */
export async function generatePlaceDescription(options: GeneratePlaceOptions): Promise<{
  description: string;
  hashtags: string;
  lifestyle: string;
}> {
  const formData = new FormData();
  
  options.images.forEach((image, index) => {
    formData.append('images', image);
  });
  
  if (options.title) formData.append('title', options.title);
  if (options.description) formData.append('description', options.description);
  if (options.location) formData.append('location', options.location);
  if (options.gps) {
    formData.append('gps_lat', options.gps.latitude.toString());
    formData.append('gps_lon', options.gps.longitude.toString());
  }
  formData.append('lifestyle', options.lifestyle);
  formData.append('model', options.model || DEFAULT_TEXT_MODEL);
  formData.append('gender', options.gender || 'neutral');

  const response = await fetch(`${API_BASE}/api/generate-place`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Fehler bei der Generierung');
  }

  return response.json();
}

/**
 * Generiert eine kurze Notiz
 * Tab: "Note"
 */
export async function generateNote(options: GenerateNoteOptions): Promise<{
  note: string;
  hashtags: string;
  lifestyle: string;
}> {
  const formData = new FormData();
  
  options.images.forEach((image, index) => {
    formData.append('images', image);
  });
  
  if (options.title) formData.append('title', options.title);
  if (options.description) formData.append('description', options.description);
  if (options.location) formData.append('location', options.location);
  if (options.text) formData.append('text', options.text);
  formData.append('lifestyle', options.lifestyle);
  formData.append('model', options.model || DEFAULT_TEXT_MODEL);
  formData.append('gender', options.gender || 'neutral');

  const response = await fetch(`${API_BASE}/api/generate-note`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Fehler bei der Generierung');
  }

  return response.json();
}
