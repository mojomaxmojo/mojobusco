/**
 * useArticleTagCategories.ts
 *
 * Kategorie/Tags-Domäne des Berichte-Formulars — 1:1 aus ArticleForm.tsx
 * verschoben (PLAN.md Schritt 5). Reines Verschieben, keine
 * Logik-Änderungen.
 */

import { useState } from "react";
import { ARTICLE_CATEGORIES, DIY_TAGS, TAG_GROUPS } from "@/config";

export function useArticleTagCategories() {
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Get available tags from config (excluding DIY & Leon tags which are shown separately)
  const availableTags = TAG_GROUPS
    .filter(group => !['Technik', 'Pets', 'RV Life', 'Küche & Essen', 'Ausstattung', 'Freeliving', 'Länder'].includes(group.name)) // DIY, Leon & RV Life tags are shown separately
    .flatMap(group => group.tags)
    .filter(tag => !DIY_TAGS.includes(tag.id))
    .map(tag => tag.id); // Remove # - it will be added in JSX

  // Prueft ob die aktuelle Kategorie ein DIY-Bereich ist
  const currentCategoryConfig = ARTICLE_CATEGORIES.find(cat => cat.id === category);
  const isDIYCategory = currentCategoryConfig?.isDIY || false;

  // Prueft ob Leon-Kategorie
  const isLeonCategory = tags.includes('leon') || currentCategoryConfig?.isLeon || false;

  // Prueft ob RV Life-Kategorie
  const isRVLifeCategory = currentCategoryConfig?.isRVLife || false;

  // Prueft ob Strand/Ort-Kategorie
  const isStrandOrtCategory = category === 'strand-ort' || currentCategoryConfig?.isStrandOrt || false;

  // Automatische Tags zu manuellen Tags hinzufügen
  const updateTagsWithAuto = (currentTags: string[]) => {
    let updatedTags = [...currentTags];

    // Leon-spezifische Tags hinzufügen
    if (isLeonCategory && currentCategoryConfig?.autoTags) {
      currentCategoryConfig.autoTags.forEach(autoTag => {
        if (!updatedTags.includes(autoTag)) {
          updatedTags.push(autoTag);
        }
      });
    }

    // RV Life-spezifische Tags hinzufügen
    if (isRVLifeCategory && currentCategoryConfig?.autoTags) {
      currentCategoryConfig.autoTags.forEach(autoTag => {
        if (!updatedTags.includes(autoTag)) {
          updatedTags.push(autoTag);
        }
      });
    }

    // DIY-spezifische Tags hinzufügen
    if (isDIYCategory && !updatedTags.includes('diy')) {
      updatedTags.push('diy');
    }

    return updatedTags;
  };

  // Berechnete displayTags (kein useState nötig, da berechnet) - Fixed
  const displayTags = updateTagsWithAuto(tags);

  const handleTagToggle = (tag: string) => {
    setTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return {
    category, setCategory,
    tags, setTags,
    availableTags,
    currentCategoryConfig,
    isDIYCategory,
    isLeonCategory,
    isRVLifeCategory,
    isStrandOrtCategory,
    displayTags,
    handleTagToggle,
  };
}