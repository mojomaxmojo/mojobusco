/**
 * useArticleAutosave.ts
 *
 * ── Nr. 13: Lokaler Autosave (Browser-Crash-Schutz) ─────────────────────
 * Speichert die Formular-Felder debounced in localStorage. Server-Sync
 * bleibt manuell („Als Entwurf speichern", Token-Pflicht unberührt).
 * Wiederherstellung nur per Banner — wenn Formular leer & kein Entwurf/
 * Edit geladen wurde (bewusst geladener Inhalt hat Vorrang).
 *
 * 1:1 aus ArticleForm.tsx verschoben (PLAN.md Schritt 3) — reines
 * Verschieben, keine Logik-Änderungen.
 */

import { useState, useEffect } from "react";
import { AUTOSAVE_KEY, type AutosaveData } from "./articleFormConfig";
import type { TripType } from "@/config/tags";
import type { useToast } from "@/hooks/useToast";

type ToastFn = ReturnType<typeof useToast>['toast'];

type ArticleLifestyle = 'mojobus' | 'vanlife' | 'rvlife' | 'beachlife' | 'wohnmobil' | 'perpetual-travelers';

interface UseArticleAutosaveValues {
  title: string;
  summary: string;
  content: string;
  location: string;
  selectedCountry: string;
  category: string;
  tags: string[];
  articleLength: 'short' | 'medium' | 'long';
  tripType: TripType | '';
  lifestyle: ArticleLifestyle;
  seoTitle: string;
  seoMetaDescription: string;
  seoSlug: string;
  researchFacts: string;
  experienceNotes: string;
  publishedAt: string;
}

interface UseArticleAutosaveParams {
  editEvent?: any;
  currentDraftId: string | null;
  toast: ToastFn;
  // aktuelle Werte (für den Schreib-Effect):
  values: UseArticleAutosaveValues;
  // Setter (für restore):
  setTitle: (v: string) => void;
  setSummary: (v: string) => void;
  setContent: (v: string) => void;
  setLocation: (v: string) => void;
  setSelectedCountry: (v: string) => void;
  setCategory: (v: string) => void;
  setTags: (v: string[]) => void;
  setArticleLength: (v: 'short' | 'medium' | 'long') => void;
  setTripType: (v: TripType) => void;
  setLifestyle: (v: ArticleLifestyle) => void;
  setSeoTitle: (v: string) => void;
  setSeoMetaDescription: (v: string) => void;
  setSeoSlug: (v: string) => void;
  setResearchFacts: (v: string) => void;
  setExperienceNotes: (v: string) => void;
  setPublishedAt: (v: string) => void;
}

export function useArticleAutosave({
  editEvent,
  currentDraftId,
  toast,
  values,
  setTitle,
  setSummary,
  setContent,
  setLocation,
  setSelectedCountry,
  setCategory,
  setTags,
  setArticleLength,
  setTripType,
  setLifestyle,
  setSeoTitle,
  setSeoMetaDescription,
  setSeoSlug,
  setResearchFacts,
  setExperienceNotes,
  setPublishedAt,
}: UseArticleAutosaveParams) {
  const {
    title, summary, content, location, selectedCountry, category, tags,
    articleLength, tripType, lifestyle, seoTitle, seoMetaDescription, seoSlug,
    researchFacts, experienceNotes, publishedAt,
  } = values;

  const [autosaveCandidate, setAutosaveCandidate] = useState<AutosaveData | null>(null);

  useEffect(() => {
    const hasContent = title.trim() || summary.trim() || content.trim();
    if (!hasContent) return;
    const timer = setTimeout(() => {
      try {
        const data: AutosaveData = {
          savedAt: Date.now(),
          title, summary, content, location, selectedCountry, category, tags,
          articleLength, tripType, lifestyle,
          seoTitle, seoMetaDescription, seoSlug,
          researchFacts, experienceNotes, publishedAt,
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
      } catch { /* Quota/Privatmodus — Autosave ist best-effort */ }
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, summary, content, location, selectedCountry, category, tags, articleLength, tripType, lifestyle, seoTitle, seoMetaDescription, seoSlug, researchFacts, experienceNotes, publishedAt]);

  // Kandidat einmalig beim Mount prüfen — Banner nur, wenn Formular leer
  // ist und kein Entwurf/Edit geladen wurde (bewusst geladener Inhalt hat
  // immer Vorrang vor dem Autosave).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as AutosaveData;
      if (!data.savedAt || Date.now() - data.savedAt > 7 * 24 * 3600 * 1000) {
        localStorage.removeItem(AUTOSAVE_KEY);
        return;
      }
      if (editEvent || currentDraftId) return;
      if (title.trim() || content.trim()) return;
      setAutosaveCandidate(data);
    } catch { /* kaputter Eintrag — ignorieren */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restoreAutosave = () => {
    if (!autosaveCandidate) return;
    const d = autosaveCandidate;
    if (d.title !== undefined) setTitle(d.title);
    if (d.summary !== undefined) setSummary(d.summary);
    if (d.content !== undefined) setContent(d.content);
    if (d.location !== undefined) setLocation(d.location);
    if (d.selectedCountry) setSelectedCountry(d.selectedCountry);
    if (d.category !== undefined) setCategory(d.category);
    if (Array.isArray(d.tags)) setTags(d.tags);
    if (d.articleLength) setArticleLength(d.articleLength);
    if (d.tripType) setTripType(d.tripType as TripType);
    if (d.lifestyle) setLifestyle(d.lifestyle as typeof lifestyle);
    if (d.seoTitle !== undefined) setSeoTitle(d.seoTitle);
    if (d.seoMetaDescription !== undefined) setSeoMetaDescription(d.seoMetaDescription);
    if (d.seoSlug !== undefined) setSeoSlug(d.seoSlug);
    if (d.researchFacts !== undefined) setResearchFacts(d.researchFacts);
    if (d.experienceNotes !== undefined) setExperienceNotes(d.experienceNotes);
    if (d.publishedAt) setPublishedAt(d.publishedAt);
    setAutosaveCandidate(null);
    toast({ title: 'Entwurf wiederhergestellt', description: `Stand: ${new Date(d.savedAt).toLocaleString('de-DE')}` });
  };

  const discardAutosave = () => {
    localStorage.removeItem(AUTOSAVE_KEY);
    setAutosaveCandidate(null);
  };

  return { autosaveCandidate, restoreAutosave, discardAutosave };
}
