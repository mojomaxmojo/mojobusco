/**
 * Meldet einen veröffentlichten Post (Artikel/Platz/Notiz/Media/Trip) an
 * den Continuity-Tracking-Endpunkt (`POST /api/continuity/track`), damit
 * Motive/Entitäten/Stimmung/offene Fäden für spätere KI-Generierungen
 * gesammelt werden können.
 *
 * Läuft NIE blockierend: Fehler werden nur per console.warn geloggt, der
 * Publish-Flow im Frontend wird dadurch nie unterbrochen (analog zum
 * bestehenden Teaser-Post-Fallback in ArticleForm.tsx).
 */

/**
 * Ermittelt die API-Basis-URL. Unter Capacitor (Android-APK, `file://`
 * Kontext) wird die feste Domain verwendet, im Browser ein leerer String
 * (relativer Pfad). Zentral in src/lib/apiBase.ts (vorher lokale Kopie).
 */

import { getApiBaseUrl } from '@/lib/apiBase';

/** Eingabe für `trackPublishedPost()`. */
export interface TrackPublishedPostInput {
  id: string;
  type: 'article' | 'place' | 'note' | 'media' | 'trip';
  kind: number;
  title?: string;
  location?: string;
  country?: string;
  publishedAt?: string | number;
  content: string;
  /** Kanonische URL (https://mojobus.co/…) — für 🔗-Insert im Moments-Block */
  url?: string;
}

export function useContinuityTracking() {
  const trackPublishedPost = (input: TrackPublishedPostInput): void => {
    fetch(`${getApiBaseUrl()}/api/continuity/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).catch((error) => {
      console.warn('[useContinuityTracking] Tracking fehlgeschlagen:', error);
    });
  };

  return { trackPublishedPost };
}
