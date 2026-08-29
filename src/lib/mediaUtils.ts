/**
 * mediaUtils – kleine gemeinsame Media-URL-Helfer
 *
 * Zuvor doppelt definiert in Home.tsx und ContentCard.tsx (identische
 * Implementierung). Eine Quelle der Wahrheit, damit sich die Kopien nicht
 * auseinanderentwickeln.
 */

/** Extrahiert die erste Bild-/Video-URL aus einem Text-Content */
export function extractFirstImageUrl(content: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|avi|mkv))/gi;
  const matches = content.match(urlRegex);
  return matches && matches.length > 0 ? matches[0] : null;
}

/** Ist die URL ein Video (nach Endung)? */
export function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('.mp4') ||
         lower.includes('.webm') ||
         lower.includes('.mov') ||
         lower.includes('.avi') ||
         lower.includes('.mkv');
}
