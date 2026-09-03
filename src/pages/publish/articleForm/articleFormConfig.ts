/**
 * articleFormConfig.ts
 *
 * Konstanten, Typen, Icon-Maps und Options-Daten für das Berichte-Formular
 * (ArticleForm.tsx) — 1:1 aus ArticleForm.tsx verschoben (PLAN.md Schritt 1),
 * reines Verschieben, keine Logik-Änderungen.
 */

import { Battery, Sun, Wrench, Hammer, Cpu, Waves, Mountain, Eye, Trees, Droplets, Camera } from "@/lib/icons";

// ── Nr. 13: Lokaler Autosave (Browser-Crash-Schutz) ─────────────────────
export const AUTOSAVE_KEY = 'assistant:autosave:article';
export const AUTOSAVE_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

export interface AutosaveData {
  savedAt: number;
  title?: string;
  summary?: string;
  content?: string;
  location?: string;
  selectedCountry?: string;
  category?: string;
  tags?: string[];
  articleLength?: 'short' | 'medium' | 'long';
  tripType?: string;
  lifestyle?: string;
  seoTitle?: string;
  seoMetaDescription?: string;
  seoSlug?: string;
  researchFacts?: string;
  experienceNotes?: string;
  publishedAt?: string;
}

// ── Icon mapping for DIY categories ──────────────────────────────────────
export const getDIYIcon = (iconName: string) => {
  switch (iconName) {
    case 'Battery': return Battery;
    case 'Sun': return Sun;
    case 'Wrench': return Wrench;
    case 'Hammer': return Hammer;
    case 'Cpu': return Cpu;
    default: return Wrench;
  }
};

// ── Icon mapping for Nature categories ───────────────────────────────────
export const getNatureIcon = (iconName: string) => {
  switch (iconName) {
    case 'strand': return Waves;
    case 'berge': return Mountain;
    case 'see': return Eye;
    case 'wald': return Trees;
    case 'wasserfall': return Droplets;
    case 'wiese': return Sun;
    case 'tiere': return Camera;
    default: return Camera;
  }
};

// ── Länder-Tags (bisher 2× inline: Edit-Effect + handleSubmit) ──────────
export const COUNTRY_TAG_LIST = ['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg'];

// ── Artikellänge-Optionen (bisher inline im JSX) ────────────────────────
export const ARTICLE_LENGTH_OPTIONS = [
  { value: 'short', label: 'Kurz', words: '500-1000' },
  { value: 'medium', label: 'Mittel', words: '1000-2000' },
  { value: 'long', label: 'Lang', words: '2000-3000' }
] as const;

// ── RV Life-spezifische Tag-Optionen (bisher inline im JSX) ─────────────
export const RV_LIFE_TAG_OPTIONS = [
  { id: 'kueche-essen', emoji: '🍳', name: 'Küche & Essen' },
  { id: 'ausstattung', emoji: '🏠', name: 'Ausstattung' },
  { id: 'freeliving', emoji: '🕊️', name: 'Freeliving' },
  { id: 'lifestyle', emoji: '✨', name: 'Lifestyle' }
];

// ── Strand/Ort-spezifische Tag-Optionen (bisher inline im JSX) ──────────
export const STRAND_ORT_TAG_OPTIONS = [
  { id: 'strand', emoji: '🏖️', name: 'Strand' },
  { id: 'berg', emoji: '⛰️', name: 'Berg' },
  { id: 'wald', emoji: '🌲', name: 'Wald' },
  { id: 'meer', emoji: '🌊', name: 'Meer' },
  { id: 'ort', emoji: '📍', name: 'Ort' }
];
