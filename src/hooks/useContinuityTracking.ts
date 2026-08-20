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
 * (relativer Pfad). Muster wie in useAutoTranslate.ts.
 */
function getApiBaseUrl(): string {
  try {
    const cap = (window as { Capacitor?: { isNative?: boolean; getPlatform?: () => string } }).Capacitor;
    const isNative =
      cap?.isNative === true ||
      (window as { __Capacitor?: { isNative?: boolean } }).__Capacitor?.isNative === true ||
      cap?.getPlatform?.() === 'android' ||
      cap?.getPlatform?.() === 'ios';
    if (isNative) return 'https://mojobus.co';
  } catch {
    /* ignore */
  }
  return '';
}

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
