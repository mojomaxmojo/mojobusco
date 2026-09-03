/**
 * placeFormUtils.ts — reine Funktionen für das Ort-Formular (PlaceForm.tsx) —
 * 1:1 aus PlaceForm.tsx verschoben (PLAN4.md Schritt 2), kein State,
 * keine Hooks, keine Logik-Änderungen.
 */

// Hilfsfunktion: Bild-URLs aus Markdown extrahieren (gleiche Logik wie ArticleForm)
export const extractPlaceImageUrls = (markdown: string): string[] => {
  const regex = /!\[.*?\]\((https?:\/\/[^)]+)\)/g;
  const urls: string[] = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    urls.push(match[1]);
  }
  return [...new Set(urls)];
};
