/**
 * articleFormUtils.ts
 *
 * Reine Funktionen für das Berichte-Formular (ArticleForm.tsx) —
 * 1:1 aus ArticleForm.tsx verschoben (PLAN.md Schritt 2), kein State,
 * keine Hooks, keine Logik-Änderungen.
 */

import { FACT_MARKER, EXPERIENCE_MARKER } from "@/config/assistant";

// Hilfsfunktion: Bild-URLs aus Markdown-Content extrahieren
// Format: ![alt](https://...) oder ![alt](https://...)
export const extractImageUrlsFromMarkdown = (markdown: string): string[] => {
  const regex = /!\[.*?\]\((https?:\/\/[^)]+)\)/g;
  const urls: string[] = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    urls.push(match[1]);
  }
  return [...new Set(urls)]; // Duplikate entfernen
};

// Assistent: author_input (mit Markern) zurück in FAKTEN/ERLEBNISSE splitten
export const splitAuthorInput = (input: string): { facts: string; experiences: string } => {
  if (!input) return { facts: '', experiences: '' };
  const fIdx = input.indexOf(FACT_MARKER);
  const eIdx = input.indexOf(EXPERIENCE_MARKER);
  let facts = '';
  let experiences = '';
  if (fIdx >= 0) {
    facts = input.slice(fIdx + FACT_MARKER.length, eIdx >= 0 ? eIdx : undefined).trim();
  }
  if (eIdx >= 0) {
    experiences = input.slice(eIdx + EXPERIENCE_MARKER.length).trim();
  }
  return { facts, experiences };
};
